/**
 * Claude CLI extraction engine
 * Uses the locally-installed `claude` CLI (already authenticated)
 * instead of requiring an Anthropic API key.
 *
 * Set CLAUDE_CLI_PATH in .env.local if auto-detection fails.
 *
 * IMPORTANT: We must strip CLAUDECODE and related env vars when spawning
 * the CLI, otherwise it tries to connect to a parent Claude Code process
 * instead of running standalone.
 */

import { spawn, execFile } from "child_process";
import { promisify } from "util";
import { existsSync } from "fs";
import { join } from "path";

const execFileAsync = promisify(execFile);

interface ClaudeCliResult {
  success: boolean;
  output: string;
  error?: string;
  method: "cli" | "tinyclaw" | "manual";
}

let cachedPath: string | null = null;

function log(msg: string) {
  const ts = new Date().toISOString().slice(11, 23);
  console.log(`[claude-cli ${ts}] ${msg}`);
}

/**
 * Build a clean env that strips Claude Code session vars
 * so the CLI runs as a standalone process.
 */
function getCleanEnv(): NodeJS.ProcessEnv {
  const env = { ...process.env };
  delete env.CLAUDECODE;
  delete env.CLAUDE_CODE;
  delete env.CLAUDE_CODE_SESSION;
  delete env.CLAUDE_PARENT_SESSION;
  delete env.CLAUDE_SESSION_ID;
  return env;
}

async function findClaude(): Promise<string | null> {
  if (cachedPath) return cachedPath;

  const explicit = process.env.CLAUDE_CLI_PATH;
  if (explicit && existsSync(explicit)) {
    cachedPath = explicit;
    return explicit;
  }

  const home = process.env.HOME || "";
  const candidates = [
    join(home, ".local/bin/claude"),
    "/usr/local/bin/claude",
    "/opt/homebrew/bin/claude",
    join(home, ".npm-global/bin/claude"),
    join(home, ".volta/bin/claude"),
  ];

  for (const p of candidates) {
    if (existsSync(p)) {
      cachedPath = p;
      return p;
    }
  }

  return null;
}

export async function checkClaudeCli(): Promise<{ available: boolean; version?: string; path?: string; error?: string }> {
  const claudePath = await findClaude();
  if (!claudePath) {
    return { available: false, error: "claude CLI not found. Set CLAUDE_CLI_PATH in .env.local" };
  }

  try {
    const { stdout } = await execFileAsync(claudePath, ["--version"], {
      timeout: 5000,
      env: getCleanEnv(),
    });
    return { available: true, version: stdout.trim(), path: claudePath };
  } catch (err) {
    return { available: false, error: err instanceof Error ? err.message : "claude check failed" };
  }
}

/**
 * Run claude --print with system prompt as arg, user prompt via stdin.
 * Uses --max-turns 1 to prevent any interactive/agentic behavior.
 */
export async function runClaudeSimple(prompt: string, systemPrompt: string): Promise<ClaudeCliResult> {
  const claudePath = await findClaude();
  if (!claudePath) {
    return {
      success: false,
      output: "",
      error: "claude CLI not found. Set CLAUDE_CLI_PATH in .env.local",
      method: "cli",
    };
  }

  return new Promise((resolve) => {
    const args = [
      "--print",
      "--output-format", "text",
      "--max-turns", "1",
      "--system-prompt", systemPrompt,
    ];

    log(`SPAWN: path=${claudePath}`);
    log(`SPAWN: system-prompt=${systemPrompt.length} chars, stdin=${prompt.length} chars`);
    log(`SPAWN: args=[--print, --output-format text, --max-turns 1, --system-prompt ...]`);

    const startTime = Date.now();
    const child = spawn(claudePath, args, {
      stdio: ["pipe", "pipe", "pipe"],
      timeout: 300_000, // 5 minutes
      env: getCleanEnv(),
    });

    log(`SPAWN: pid=${child.pid}`);

    let stdout = "";
    let stderr = "";
    let stdoutBytes = 0;

    child.stdout.on("data", (data: Buffer) => {
      const chunk = data.toString();
      stdout += chunk;
      stdoutBytes += data.length;
      // Log progress every 1KB of output
      if (stdoutBytes % 1024 < data.length) {
        log(`STDOUT: ${stdoutBytes} bytes received so far (${((Date.now() - startTime) / 1000).toFixed(1)}s)`);
      }
    });

    child.stderr.on("data", (data: Buffer) => {
      const chunk = data.toString();
      stderr += chunk;
      log(`STDERR: ${chunk.trim()}`);
    });

    // Write user prompt via stdin
    log(`STDIN: writing ${prompt.length} chars...`);
    child.stdin.on("error", (err) => {
      log(`STDIN ERROR: ${err.message}`);
    });
    child.stdin.write(prompt, () => {
      log(`STDIN: write complete, closing stdin`);
      child.stdin.end();
    });

    child.on("close", (code, signal) => {
      const elapsed = ((Date.now() - startTime) / 1000).toFixed(1);
      log(`EXIT: code=${code}, signal=${signal}, stdout=${stdout.length} bytes, stderr=${stderr.length} bytes, elapsed=${elapsed}s`);

      if (signal) {
        log(`KILLED by signal ${signal} (likely timeout or OOM)`);
      }

      if (code === 0 && stdout) {
        log(`SUCCESS: got ${stdout.length} chars of output`);
        resolve({ success: true, output: stdout, method: "cli" });
      } else {
        const errorMsg = signal
          ? `Process killed by ${signal} after ${elapsed}s`
          : stderr || (stdout && stdout.length < 500 ? stdout.trim() : "") || `claude exited with code ${code}`;
        log(`FAIL: ${errorMsg.slice(0, 300)}`);
        resolve({
          success: false,
          output: "",
          error: errorMsg,
          method: "cli",
        });
      }
    });

    child.on("error", (err) => {
      log(`PROCESS ERROR: ${err.message}`);
      resolve({ success: false, output: "", error: err.message, method: "cli" });
    });
  });
}

/**
 * Max chars per chunk — 100K chars ≈ 25K tokens.
 * Leaves plenty of room for system prompt + response.
 */
const MAX_CHUNK_CHARS = 100_000;

export function splitIntoChunks(text: string, maxChars: number = MAX_CHUNK_CHARS): string[] {
  if (text.length <= maxChars) return [text];

  const chunks: string[] = [];
  let remaining = text;

  while (remaining.length > 0) {
    if (remaining.length <= maxChars) {
      chunks.push(remaining);
      break;
    }

    let splitAt = remaining.lastIndexOf("\n\n", maxChars);
    if (splitAt < maxChars * 0.5) {
      splitAt = remaining.lastIndexOf("\n", maxChars);
    }
    if (splitAt < maxChars * 0.5) {
      splitAt = maxChars;
    }

    chunks.push(remaining.slice(0, splitAt));
    remaining = remaining.slice(splitAt).trimStart();
  }

  return chunks;
}

/**
 * Run extraction on large text by chunking if needed.
 */
export async function runClaudeChunked(
  prompt: string,
  systemPrompt: string
): Promise<ClaudeCliResult> {
  const chunks = splitIntoChunks(prompt);

  log(`INPUT: ${prompt.length} chars → ${chunks.length} chunk(s)`);

  if (chunks.length === 1) {
    return runClaudeSimple(prompt, systemPrompt);
  }

  log(`CHUNKING: splitting ${prompt.length} chars into ${chunks.length} chunks`);
  chunks.forEach((c, i) => log(`  chunk ${i + 1}: ${c.length} chars`));

  const results: ClaudeCliResult[] = [];
  for (let i = 0; i < chunks.length; i++) {
    log(`CHUNK ${i + 1}/${chunks.length}: starting (${chunks[i].length} chars)`);
    const chunkPrompt = `[CHUNK ${i + 1} OF ${chunks.length}] Extract pipeline intelligence from this portion of the conversation:\n\n${chunks[i]}`;
    const result = await runClaudeSimple(chunkPrompt, systemPrompt);
    if (!result.success) {
      log(`CHUNK ${i + 1}/${chunks.length}: FAILED — ${result.error}`);
      return {
        success: false,
        output: "",
        error: `Chunk ${i + 1}/${chunks.length} failed: ${result.error}`,
        method: "cli",
      };
    }
    log(`CHUNK ${i + 1}/${chunks.length}: SUCCESS (${result.output.length} chars)`);
    results.push(result);
  }

  const mergedOutput = results.map((r) => r.output).join("\n---CHUNK_BOUNDARY---\n");
  log(`MERGE: ${results.length} chunks → ${mergedOutput.length} chars total`);
  return { success: true, output: mergedOutput, method: "cli" };
}

export async function runClaudeExtraction(options: {
  systemPrompt: string;
  userPrompt: string;
}): Promise<ClaudeCliResult> {
  return runClaudeSimple(options.userPrompt, options.systemPrompt);
}

export function parseJsonFromResponse(text: string): Record<string, unknown> | null {
  try { return JSON.parse(text.trim()); } catch {}

  const fenceMatch = text.match(/```(?:json)?\s*\n?([\s\S]*?)\n?```/);
  if (fenceMatch) {
    try { return JSON.parse(fenceMatch[1].trim()); } catch {}
  }

  const jsonMatch = text.match(/\{[\s\S]*\}/);
  if (jsonMatch) {
    try { return JSON.parse(jsonMatch[0]); } catch {}
  }

  return null;
}
