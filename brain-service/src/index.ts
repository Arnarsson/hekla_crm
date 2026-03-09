/**
 * Hekla Brain Service — lightweight API for heavy AI processing
 * Runs on Linux server (100.83.83.58:3778) with GPU + 64GB RAM
 */

import { createServer, IncomingMessage, ServerResponse } from "http";
import { extractConversation } from "./extract.js";
import { scoreContacts, scoreDeals, generateOutreach, runScan } from "./intelligence.js";

const PORT = parseInt(process.env.PORT || "3778");

function parseBody(req: IncomingMessage): Promise<unknown> {
  return new Promise((resolve, reject) => {
    let body = "";
    req.on("data", (chunk) => (body += chunk));
    req.on("end", () => {
      try {
        resolve(body ? JSON.parse(body) : {});
      } catch {
        reject(new Error("Invalid JSON"));
      }
    });
    req.on("error", reject);
  });
}

function json(res: ServerResponse, data: unknown, status = 200) {
  res.writeHead(status, {
    "Content-Type": "application/json",
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type",
  });
  res.end(JSON.stringify(data));
}

const server = createServer(async (req, res) => {
  // CORS preflight
  if (req.method === "OPTIONS") {
    res.writeHead(204, {
      "Access-Control-Allow-Origin": "*",
      "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
      "Access-Control-Allow-Headers": "Content-Type",
    });
    res.end();
    return;
  }

  const url = new URL(req.url || "/", `http://localhost:${PORT}`);
  const path = url.pathname;

  try {
    // Health check
    if (path === "/health" && req.method === "GET") {
      return json(res, { status: "ok", service: "hekla-brain", uptime: process.uptime() });
    }

    // GPU-powered extraction
    if (path === "/extract" && req.method === "POST") {
      const body = (await parseBody(req)) as {
        conversation: string;
        source_type?: string;
        context?: string;
        system_prompt: string;
        user_prompt: string;
      };
      const result = await extractConversation(body);
      return json(res, result);
    }

    // Bulk contact scoring
    if (path === "/score-contacts" && req.method === "POST") {
      const body = (await parseBody(req)) as { contacts: unknown[] };
      const result = await scoreContacts(body.contacts);
      return json(res, result);
    }

    // Deal win probability
    if (path === "/score-deals" && req.method === "POST") {
      const body = (await parseBody(req)) as { deals: unknown[] };
      const result = await scoreDeals(body.deals);
      return json(res, result);
    }

    // Outreach generation
    if (path === "/generate-outreach" && req.method === "POST") {
      const body = (await parseBody(req)) as { contact: unknown; deal?: unknown; context?: string };
      const result = await generateOutreach(body);
      return json(res, result);
    }

    // Full scan
    if (path === "/scan" && req.method === "POST") {
      const body = (await parseBody(req)) as { data: unknown };
      const result = await runScan(body.data);
      return json(res, result);
    }

    json(res, { error: "Not found" }, 404);
  } catch (err) {
    console.error(`Error on ${path}:`, err);
    json(res, { error: err instanceof Error ? err.message : "Internal error" }, 500);
  }
});

server.listen(PORT, "0.0.0.0", () => {
  console.log(`Hekla Brain Service running on :${PORT}`);
  console.log(`Health: http://0.0.0.0:${PORT}/health`);
});
