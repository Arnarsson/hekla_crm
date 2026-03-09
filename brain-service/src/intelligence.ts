/**
 * AI-powered intelligence functions
 * These run on the Linux brain with GPU acceleration
 */

import Anthropic from "@anthropic-ai/sdk";

const client = new Anthropic();

export async function scoreContacts(contacts: unknown[]): Promise<{ scores: Record<string, number> }> {
  const response = await client.messages.create({
    model: "claude-sonnet-4-20250514",
    max_tokens: 4096,
    system: "You are a CRM intelligence engine. Score each contact's relationship strength (0-100) based on interaction history, deal involvement, and engagement patterns. Return JSON: { scores: { contact_id: score } }",
    messages: [{ role: "user", content: JSON.stringify(contacts) }],
  });

  const text = response.content.filter((b) => b.type === "text").map((b) => b.text).join("");
  const match = text.match(/\{[\s\S]*\}/);
  return match ? JSON.parse(match[0]) : { scores: {} };
}

export async function scoreDeals(deals: unknown[]): Promise<{ scores: Record<string, { probability: number; reasoning: string }> }> {
  const response = await client.messages.create({
    model: "claude-sonnet-4-20250514",
    max_tokens: 4096,
    system: "You are a deal intelligence engine. For each deal, estimate win probability (0-100) with brief reasoning based on stage, engagement, pricing agreements, and deal velocity. Return JSON: { scores: { deal_id: { probability: number, reasoning: string } } }",
    messages: [{ role: "user", content: JSON.stringify(deals) }],
  });

  const text = response.content.filter((b) => b.type === "text").map((b) => b.text).join("");
  const match = text.match(/\{[\s\S]*\}/);
  return match ? JSON.parse(match[0]) : { scores: {} };
}

export async function generateOutreach(params: { contact: unknown; deal?: unknown; context?: string }): Promise<{ draft: string; subject?: string }> {
  const response = await client.messages.create({
    model: "claude-sonnet-4-20250514",
    max_tokens: 2048,
    system: "You are a professional business communication expert. Draft concise, personalized outreach messages. Return JSON: { draft: string, subject?: string }",
    messages: [{
      role: "user",
      content: `Draft outreach for:\n\nContact: ${JSON.stringify(params.contact)}\n${params.deal ? `Deal: ${JSON.stringify(params.deal)}\n` : ""}${params.context ? `Context: ${params.context}` : ""}`,
    }],
  });

  const text = response.content.filter((b) => b.type === "text").map((b) => b.text).join("");
  const match = text.match(/\{[\s\S]*\}/);
  return match ? JSON.parse(match[0]) : { draft: text };
}

export async function runScan(data: unknown): Promise<{ analysis: string; recommendations: string[] }> {
  const response = await client.messages.create({
    model: "claude-sonnet-4-20250514",
    max_tokens: 4096,
    system: "You are a CRM intelligence engine. Analyze the full dataset and identify: overdue items, stale deals, relationship decay, opportunities, and recommended actions. Return JSON: { analysis: string, recommendations: string[] }",
    messages: [{ role: "user", content: JSON.stringify(data) }],
  });

  const text = response.content.filter((b) => b.type === "text").map((b) => b.text).join("");
  const match = text.match(/\{[\s\S]*\}/);
  return match ? JSON.parse(match[0]) : { analysis: text, recommendations: [] };
}
