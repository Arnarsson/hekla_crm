import { NextRequest, NextResponse } from "next/server";
import { saveExtraction } from "@/lib/db";
import { EXTRACTION_SYSTEM_PROMPT, buildUserPrompt } from "@/lib/extraction-prompt";
import { checkClaudeCli, runClaudeChunked, parseJsonFromResponse } from "@/lib/claude-cli";
import { brainRequest } from "@/lib/brain";
import { processExtractionIntoCRM } from "@/lib/crm-engine";
import type { PipelineExtraction } from "@/lib/types";

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const {
      conversation,
      source_filename,
      source_type,
      context_label,
      custom_context,
      use_tinyclaw,
      agent_id,
      manual_json,
    } = body;

    // ── Mode 1: Manual JSON Import ───────────────────────────────────
    if (manual_json) {
      const parsed = typeof manual_json === "string"
        ? parseJsonFromResponse(manual_json)
        : manual_json;

      if (!parsed) {
        return NextResponse.json(
          { error: "Could not parse the pasted JSON. Make sure it matches the extraction schema." },
          { status: 400 }
        );
      }

      const id = crypto.randomUUID();
      const extraction: PipelineExtraction = {
        id,
        created_at: new Date().toISOString(),
        source_filename: source_filename || "manual-import.json",
        source_type: source_type || "manual",
        context_label: context_label || "Manual Import",
        raw_input_preview: typeof manual_json === "string" ? manual_json.slice(0, 500) : JSON.stringify(manual_json).slice(0, 500),
        prospects: (parsed.prospects as PipelineExtraction["prospects"]) || [],
        agreements: (parsed.agreements as PipelineExtraction["agreements"]) || [],
        ideas: (parsed.ideas as PipelineExtraction["ideas"]) || [],
        action_items: (parsed.action_items as PipelineExtraction["action_items"]) || [],
        pricing: (parsed.pricing as PipelineExtraction["pricing"]) || [],
        milestones: (parsed.milestones as PipelineExtraction["milestones"]) || [],
        relationships: (parsed.relationships as PipelineExtraction["relationships"]) || [],
        risks: (parsed.risks as PipelineExtraction["risks"]) || [],
        followups: (parsed.followups as PipelineExtraction["followups"]) || [],
        executive_summary: (parsed.executive_summary as string) || "",
      };

      await saveExtraction(extraction);
      const crmCounts = await processExtractionIntoCRM(extraction);
      return NextResponse.json({ ...extraction, crm: crmCounts });
    }

    // ── Validate input ───────────────────────────────────────────────
    if (!conversation || !source_filename) {
      return NextResponse.json(
        { error: "Missing required fields: conversation, source_filename" },
        { status: 400 }
      );
    }

    const context = custom_context || undefined;
    const userPrompt = buildUserPrompt(conversation, context, source_type);

    let extractedData: Record<string, unknown>;

    // ── Mode 2: TinyClaw Agent (async) ───────────────────────────────
    if (use_tinyclaw && agent_id) {
      const tinyClawUrl = process.env.TINYCLAW_API_URL || "http://localhost:3777";
      const message = `${EXTRACTION_SYSTEM_PROMPT}\n\n${userPrompt}`;

      const res = await fetch(`${tinyClawUrl}/api/message`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ content: `@${agent_id} ${message}`, agent_id }),
      });

      if (!res.ok) {
        throw new Error(`TinyClaw agent error: ${res.status}`);
      }

      const agentResponse = await res.json();
      const id = crypto.randomUUID();
      const pendingExtraction: PipelineExtraction = {
        id,
        created_at: new Date().toISOString(),
        source_filename,
        source_type: source_type || "other",
        context_label,
        agent_id,
        prospects: [],
        agreements: [],
        ideas: [],
        action_items: [],
        pricing: [],
        milestones: [],
        relationships: [],
        risks: [],
        followups: [],
        executive_summary: "Processing via TinyClaw agent... Check back shortly.",
        raw_input_preview: conversation.slice(0, 500),
      };

      await saveExtraction(pendingExtraction);
      return NextResponse.json({ id, status: "processing", agent_message_id: agentResponse.id });
    }

    // ── Mode 3: Brain API (GPU-powered, if online) → fallback to CLI ─
    extractedData = await brainRequest<Record<string, unknown>>(
      "/extract",
      { conversation, source_type, context: custom_context, system_prompt: EXTRACTION_SYSTEM_PROMPT, user_prompt: userPrompt },
      async () => {
        // Fallback: Claude CLI
        const cliCheck = await checkClaudeCli();

        if (cliCheck.available) {
          const result = await runClaudeChunked(userPrompt, EXTRACTION_SYSTEM_PROMPT);

          if (result.success && result.output) {
            const chunkTexts = result.output.split("\n---CHUNK_BOUNDARY---\n");
            const parsedChunks = chunkTexts
              .map((t) => parseJsonFromResponse(t))
              .filter(Boolean) as Record<string, unknown>[];

            if (parsedChunks.length > 0) {
              const arrayKeys = [
                "prospects", "agreements", "ideas", "action_items",
                "pricing", "milestones", "relationships", "risks", "followups",
              ] as const;

              const merged: Record<string, unknown> = {};
              for (const key of arrayKeys) {
                merged[key] = parsedChunks.flatMap(
                  (c) => (Array.isArray(c[key]) ? c[key] : [])
                );
              }
              merged.executive_summary =
                parsedChunks[parsedChunks.length - 1].executive_summary ||
                parsedChunks.map((c) => c.executive_summary).filter(Boolean).join(" | ");

              return merged;
            }
          }

          throw new Error(`Extraction failed: ${result.error || "No output"}`);
        }

        // No engine available
        throw new Error("no_engine");
      }
    );

    // ── Save and return ──────────────────────────────────────────────
    const id = crypto.randomUUID();
    const extraction: PipelineExtraction = {
      id,
      created_at: new Date().toISOString(),
      source_filename,
      source_type: source_type || "other",
      context_label,
      raw_input_preview: conversation.slice(0, 500),
      prospects: (extractedData.prospects as PipelineExtraction["prospects"]) || [],
      agreements: (extractedData.agreements as PipelineExtraction["agreements"]) || [],
      ideas: (extractedData.ideas as PipelineExtraction["ideas"]) || [],
      action_items: (extractedData.action_items as PipelineExtraction["action_items"]) || [],
      pricing: (extractedData.pricing as PipelineExtraction["pricing"]) || [],
      milestones: (extractedData.milestones as PipelineExtraction["milestones"]) || [],
      relationships: (extractedData.relationships as PipelineExtraction["relationships"]) || [],
      risks: (extractedData.risks as PipelineExtraction["risks"]) || [],
      followups: (extractedData.followups as PipelineExtraction["followups"]) || [],
      executive_summary: (extractedData.executive_summary as string) || "",
    };

    await saveExtraction(extraction);
    const crmCounts = await processExtractionIntoCRM(extraction);
    return NextResponse.json({ ...extraction, crm: crmCounts });
  } catch (error) {
    if (error instanceof Error && error.message === "no_engine") {
      return NextResponse.json({
        error: "No extraction engine available",
        details: [
          "Option 1: Start Brain service on Linux (GPU-powered extraction)",
          "Option 2: Install Claude CLI → npm install -g @anthropic-ai/claude-code && claude login",
          "Option 3: Start TinyClaw → tinyclaw start",
          "Option 4: Use 'Import JSON' mode — paste pre-extracted JSON",
        ],
      }, { status: 503 });
    }

    console.error("Extraction error:", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Extraction failed" },
      { status: 500 }
    );
  }
}

// ── Health check endpoint ────────────────────────────────────────────

export async function GET() {
  const cliCheck = await checkClaudeCli();

  let tinyClawConnected = false;
  try {
    const res = await fetch(`${process.env.TINYCLAW_API_URL || "http://localhost:3777"}/api/queue/status`, {
      signal: AbortSignal.timeout(3000),
    });
    tinyClawConnected = res.ok;
  } catch {}

  // Brain status is checked via /api/brain
  return NextResponse.json({
    engines: {
      claude_cli: {
        available: cliCheck.available,
        version: cliCheck.version,
        error: cliCheck.error,
        description: "Direct extraction via claude CLI",
      },
      tinyclaw: {
        available: tinyClawConnected,
        description: "Multi-agent extraction via TinyClaw",
      },
      manual_import: {
        available: true,
        description: "Paste pre-extracted JSON",
      },
    },
  });
}
