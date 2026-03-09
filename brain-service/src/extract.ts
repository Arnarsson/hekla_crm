/**
 * GPU-powered extraction using Anthropic API directly
 */

import Anthropic from "@anthropic-ai/sdk";

const client = new Anthropic();

interface ExtractionRequest {
  conversation: string;
  source_type?: string;
  context?: string;
  system_prompt: string;
  user_prompt: string;
}

export async function extractConversation(req: ExtractionRequest): Promise<Record<string, unknown>> {
  const response = await client.messages.create({
    model: "claude-sonnet-4-20250514",
    max_tokens: 8192,
    system: req.system_prompt,
    messages: [{ role: "user", content: req.user_prompt }],
  });

  const text = response.content
    .filter((b) => b.type === "text")
    .map((b) => b.text)
    .join("");

  // Parse JSON from response
  const jsonMatch = text.match(/\{[\s\S]*\}/);
  if (jsonMatch) {
    try {
      return JSON.parse(jsonMatch[0]);
    } catch {
      // Try to find JSON within markdown fences
      const fencedMatch = text.match(/```(?:json)?\s*(\{[\s\S]*?\})\s*```/);
      if (fencedMatch) {
        return JSON.parse(fencedMatch[1]);
      }
    }
  }

  throw new Error("Could not parse extraction result as JSON");
}
