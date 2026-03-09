"use client";

import { useEffect, useState, useRef } from "react";
import { Zap, RefreshCw, Circle, Loader, CheckCircle, XCircle, Send } from "lucide-react";

interface AgentInfo {
  connected: boolean;
  url: string;
  message?: string;
  agents: {
    id: string;
    name: string;
    status: string;
    provider: string;
    model: string;
    system_prompt?: string;
  }[];
  teams: {
    id: string;
    name: string;
    leader_id: string;
    member_ids: string[];
  }[];
  queue: Record<string, unknown>;
}

interface ActivityItem {
  id: string;
  type: string;
  title: string;
  description?: string;
  created_at: string;
}

export default function AgentActivityPage() {
  const [agentData, setAgentData] = useState<AgentInfo | null>(null);
  const [activities, setActivities] = useState<ActivityItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [sending, setSending] = useState(false);
  const [message, setMessage] = useState("");
  const [selectedAgent, setSelectedAgent] = useState("");
  const [response, setResponse] = useState<string | null>(null);
  const refreshInterval = useRef<ReturnType<typeof setInterval>>(undefined);

  const loadData = async () => {
    try {
      const [agents, acts] = await Promise.all([
        fetch("/api/agents").then((r) => r.json()),
        fetch("/api/activities").then((r) => r.json()),
      ]);
      setAgentData(agents);
      // Filter for agent-related activities
      const agentActs = (acts || []).filter((a: ActivityItem) =>
        a.type === "scan" || a.type === "extraction" || a.type.includes("agent")
      );
      setActivities(agentActs.slice(0, 30));
      if (agents.agents?.length > 0 && !selectedAgent) {
        setSelectedAgent(agents.agents[0].id);
      }
    } catch { /* silent */ }
    setLoading(false);
  };

  useEffect(() => {
    loadData();
    refreshInterval.current = setInterval(loadData, 10000); // Poll every 10s
    return () => { if (refreshInterval.current) clearInterval(refreshInterval.current); };
  }, []);

  const sendMessage = async () => {
    if (!message.trim()) return;
    setSending(true);
    setResponse(null);
    try {
      const res = await fetch("/api/agents", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ content: message, agent_id: selectedAgent || undefined }),
      });
      const data = await res.json();
      setResponse(data.response || data.error || JSON.stringify(data));
      setMessage("");
    } catch (err) {
      setResponse(`Error: ${err instanceof Error ? err.message : "Failed"}`);
    }
    setSending(false);
  };

  const STATUS_ICON: Record<string, typeof Circle> = {
    idle: Circle,
    running: Loader,
    completed: CheckCircle,
    error: XCircle,
  };

  const STATUS_COLOR: Record<string, string> = {
    idle: "text-zinc-500",
    running: "text-blue-400",
    completed: "text-green-500",
    error: "text-red-400",
  };

  if (loading) {
    return (
      <div className="page-container">
        <div className="text-sm" style={{ color: "var(--text-muted)" }}>Loading agent status...</div>
      </div>
    );
  }

  return (
    <div className="page-container">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="page-title flex items-center gap-2">
            <Zap size={20} style={{ color: "var(--accent)" }} />
            Agent Activity
          </h1>
          <p className="text-xs mt-0.5" style={{ color: "var(--text-muted)" }}>
            {agentData?.connected
              ? `Connected to TinyClaw — ${agentData.agents.length} agents`
              : "TinyClaw disconnected"}
          </p>
        </div>
        <button onClick={loadData} className="btn btn-surface btn-xs flex items-center gap-1">
          <RefreshCw size={12} /> Refresh
        </button>
      </div>

      {/* Connection status */}
      <div className="surface p-3 mt-3 flex items-center gap-3">
        <div className={`w-2.5 h-2.5 rounded-full ${agentData?.connected ? "bg-green-500" : "bg-red-500"}`} />
        <div className="flex-1">
          <span className="text-xs font-medium" style={{ color: "var(--text-primary)" }}>
            TinyClaw {agentData?.connected ? "Online" : "Offline"}
          </span>
          <span className="text-[10px] ml-2" style={{ color: "var(--text-muted)" }}>
            {agentData?.url}
          </span>
        </div>
        {agentData?.connected && agentData.teams.length > 0 && (
          <span className="text-[10px]" style={{ color: "var(--text-muted)" }}>
            {agentData.teams.length} team{agentData.teams.length !== 1 ? "s" : ""}
          </span>
        )}
      </div>

      {/* Agents grid */}
      {agentData?.connected && agentData.agents.length > 0 && (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-2 mt-3">
          {agentData.agents.map((agent) => {
            const Icon = STATUS_ICON[agent.status] || Circle;
            const color = STATUS_COLOR[agent.status] || "text-zinc-500";
            return (
              <div key={agent.id} className="surface p-3">
                <div className="flex items-center gap-2 mb-1">
                  <Icon size={12} className={color} />
                  <span className="text-xs font-medium" style={{ color: "var(--text-primary)" }}>
                    {agent.name}
                  </span>
                </div>
                <div className="text-[10px] space-y-0.5" style={{ color: "var(--text-muted)" }}>
                  <div>Status: <span className={color}>{agent.status}</span></div>
                  <div>Model: {agent.model}</div>
                  <div>Provider: {agent.provider}</div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Send message to agent */}
      {agentData?.connected && (
        <div className="surface p-3 mt-3">
          <h2 className="text-[10px] uppercase tracking-wider font-medium mb-2" style={{ color: "var(--text-muted)" }}>
            Send Message to Agent
          </h2>
          <div className="flex gap-2">
            {agentData.agents.length > 1 && (
              <select
                value={selectedAgent}
                onChange={(e) => setSelectedAgent(e.target.value)}
                className="input text-xs w-auto"
              >
                {agentData.agents.map((a) => (
                  <option key={a.id} value={a.id}>{a.name}</option>
                ))}
              </select>
            )}
            <input
              value={message}
              onChange={(e) => setMessage(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && sendMessage()}
              placeholder="Type a message for the agent..."
              className="input flex-1 text-xs"
            />
            <button
              onClick={sendMessage}
              disabled={sending || !message.trim()}
              className="btn btn-primary btn-xs flex items-center gap-1"
            >
              <Send size={12} /> {sending ? "..." : "Send"}
            </button>
          </div>
          {response && (
            <div className="mt-2 p-2 rounded text-xs font-mono bg-zinc-900/50" style={{ color: "var(--text-secondary)" }}>
              {response}
            </div>
          )}
        </div>
      )}

      {/* Not connected message */}
      {!agentData?.connected && (
        <div className="surface p-6 mt-3 text-center">
          <Zap size={24} className="mx-auto mb-2" style={{ color: "var(--text-muted)", opacity: 0.3 }} />
          <p className="text-xs" style={{ color: "var(--text-muted)" }}>
            {agentData?.message || "TinyClaw agent framework not reachable"}
          </p>
          <p className="text-[10px] mt-1" style={{ color: "var(--text-muted)" }}>
            Start TinyClaw at {agentData?.url || "localhost:3777"} to enable agent features
          </p>
        </div>
      )}

      {/* Activity log */}
      <div className="mt-4">
        <h2 className="text-[10px] uppercase tracking-wider font-medium mb-2 px-1" style={{ color: "var(--text-muted)" }}>
          Recent Agent Activity
        </h2>
        <div className="space-y-0.5">
          {activities.length === 0 && (
            <div className="text-[10px] text-center py-4" style={{ color: "var(--text-muted)" }}>
              No agent activity yet
            </div>
          )}
          {activities.map((a) => (
            <div key={a.id} className="flex items-center gap-2 px-3 py-1.5 rounded-lg hover:bg-white/[0.03]">
              <div className={`w-1.5 h-1.5 rounded-full ${a.type === "scan" ? "bg-cyan-400" : a.type === "extraction" ? "bg-blue-400" : "bg-zinc-500"}`} />
              <span className="text-xs flex-1" style={{ color: "var(--text-secondary)" }}>{a.title}</span>
              <span className="text-[9px]" style={{ color: "var(--text-muted)" }}>
                {new Date(a.created_at).toLocaleString()}
              </span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
