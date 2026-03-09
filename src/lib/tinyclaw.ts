/**
 * TinyClaw API Client
 * Connects to TinyClaw multi-agent framework
 * Supports both local (localhost:3777) and remote (e.g., 192.168.50.62:3777) instances
 * See: https://github.com/TinyAGI/tinyclaw
 */

import type { TinyClawAgent, TinyClawTeam, TinyClawMessage, TinyClawEvent } from "./types";

export function getBaseUrl(): string {
  return process.env.TINYCLAW_API_URL || "http://localhost:3777";
}

async function apiCall<T>(path: string, options?: RequestInit): Promise<T> {
  const url = `${getBaseUrl()}${path}`;
  const res = await fetch(url, {
    headers: { "Content-Type": "application/json", ...options?.headers },
    signal: AbortSignal.timeout(15000), // 15s timeout for remote connections
    ...options,
  });

  if (!res.ok) {
    const text = await res.text().catch(() => "Unknown error");
    throw new Error(`TinyClaw API error [${res.status}]: ${text}`);
  }

  return res.json();
}

// ── Agent Management ─────────────────────────────────────────────────

export async function listAgents(): Promise<TinyClawAgent[]> {
  return apiCall<TinyClawAgent[]>("/api/agents");
}

export async function getAgent(id: string): Promise<TinyClawAgent> {
  return apiCall<TinyClawAgent>(`/api/agents/${id}`);
}

export async function createAgent(agent: Partial<TinyClawAgent>): Promise<TinyClawAgent> {
  return apiCall<TinyClawAgent>("/api/agents", {
    method: "POST",
    body: JSON.stringify(agent),
  });
}

export async function updateAgent(id: string, updates: Partial<TinyClawAgent>): Promise<TinyClawAgent> {
  return apiCall<TinyClawAgent>(`/api/agents/${id}`, {
    method: "PUT",
    body: JSON.stringify(updates),
  });
}

export async function deleteAgent(id: string): Promise<void> {
  await apiCall(`/api/agents/${id}`, { method: "DELETE" });
}

// ── Team Management ──────────────────────────────────────────────────

export async function listTeams(): Promise<TinyClawTeam[]> {
  return apiCall<TinyClawTeam[]>("/api/teams");
}

export async function createTeam(team: Partial<TinyClawTeam>): Promise<TinyClawTeam> {
  return apiCall<TinyClawTeam>("/api/teams", {
    method: "POST",
    body: JSON.stringify(team),
  });
}

// ── Messaging ────────────────────────────────────────────────────────

export async function sendMessage(content: string, agentId?: string): Promise<TinyClawMessage> {
  const payload: Record<string, string> = { content };
  if (agentId) payload.agent_id = agentId;

  return apiCall<TinyClawMessage>("/api/message", {
    method: "POST",
    body: JSON.stringify(payload),
  });
}

export async function getQueueStatus(): Promise<{ pending: number; processing: number; completed: number; dead: number }> {
  return apiCall("/api/queue/status");
}

export async function getRecentResponses(limit = 20): Promise<TinyClawMessage[]> {
  return apiCall<TinyClawMessage[]>(`/api/responses?limit=${limit}`);
}

// ── SSE Event Stream ─────────────────────────────────────────────────

export function createEventStream(onEvent: (event: TinyClawEvent) => void, onError?: (err: Error) => void): () => void {
  const eventSource = new EventSource(`${getBaseUrl()}/api/events/stream`);

  eventSource.onmessage = (event) => {
    try {
      const data = JSON.parse(event.data) as TinyClawEvent;
      onEvent(data);
    } catch (err) {
      console.error("Failed to parse SSE event:", err);
    }
  };

  eventSource.onerror = () => {
    if (onError) onError(new Error("SSE connection error"));
  };

  return () => eventSource.close();
}

// ── Pipeline-specific Agent Operations ───────────────────────────────

export async function sendExtractionToAgent(
  conversationText: string,
  agentId: string,
  context?: string
): Promise<TinyClawMessage> {
  const prefix = context ? `[CONTEXT]\n${context}\n\n` : "";
  const content = `@${agentId} ${prefix}[EXTRACT PIPELINE]\n${conversationText}`;

  return sendMessage(content, agentId);
}

// ── Health Check ─────────────────────────────────────────────────────

export async function checkHealth(): Promise<{
  connected: boolean;
  url: string;
  agents: number;
  queue: Record<string, number>;
  error?: string;
}> {
  const url = getBaseUrl();
  try {
    const [agents, queue] = await Promise.all([listAgents(), getQueueStatus()]);
    return { connected: true, url, agents: agents.length, queue };
  } catch (err) {
    return {
      connected: false,
      url,
      agents: 0,
      queue: {},
      error: err instanceof Error ? err.message : "Connection failed",
    };
  }
}
