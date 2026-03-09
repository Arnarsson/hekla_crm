import { NextRequest, NextResponse } from "next/server";
import { checkHealth, listAgents, listTeams, getQueueStatus, getBaseUrl, sendMessage } from "@/lib/tinyclaw";

export async function GET() {
  try {
    const health = await checkHealth();

    if (!health.connected) {
      return NextResponse.json({
        connected: false,
        url: health.url,
        message: `TinyClaw not reachable at ${health.url}. ${health.error || ""}`,
        agents: [],
        teams: [],
        queue: {},
      });
    }

    const [agents, teams, queue] = await Promise.all([
      listAgents().catch(() => []),
      listTeams().catch(() => []),
      getQueueStatus().catch(() => ({})),
    ]);

    return NextResponse.json({ connected: true, url: health.url, agents, teams, queue });
  } catch (error) {
    return NextResponse.json({
      connected: false,
      url: getBaseUrl(),
      message: error instanceof Error ? error.message : "Unknown error",
      agents: [],
      teams: [],
      queue: {},
    });
  }
}

// POST: Send a message to a TinyClaw agent (proxied through Next.js to avoid CORS)
export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { content, agent_id } = body;

    if (!content) {
      return NextResponse.json({ error: "Missing 'content' field" }, { status: 400 });
    }

    const result = await sendMessage(content, agent_id);
    return NextResponse.json(result);
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Failed to send message" },
      { status: 500 }
    );
  }
}
