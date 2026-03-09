"use client";

import { useEffect, useState, useCallback } from "react";
import { Bot, Wifi, WifiOff, Activity, RefreshCw, Send, Clock } from "lucide-react";

interface AgentInfo {
  id: string;
  name: string;
  provider: string;
  model: string;
  status: string;
}

interface AgentStatus {
  connected: boolean;
  url?: string;
  message?: string;
  agents: AgentInfo[];
  teams: { id: string; name: string; agents: string[]; leader_agent: string }[];
  queue: Record<string, number>;
}

export default function AgentPanel() {
  const [status, setStatus] = useState<AgentStatus | null>(null);
  const [loading, setLoading] = useState(true);
  const [messageInput, setMessageInput] = useState("");
  const [selectedAgent, setSelectedAgent] = useState("");
  const [sending, setSending] = useState(false);
  const [responses, setResponses] = useState<{ agent: string; message: string; time: string }[]>([]);

  const fetchStatus = useCallback(async () => {
    try {
      const res = await fetch("/api/agents");
      const data = await res.json();
      setStatus(data);
    } catch {
      setStatus({ connected: false, message: "Failed to connect", agents: [], teams: [], queue: {} });
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchStatus();
    const interval = setInterval(fetchStatus, 10000);
    return () => clearInterval(interval);
  }, [fetchStatus]);

  const sendMessage = async () => {
    if (!messageInput.trim()) return;
    setSending(true);
    try {
      const res = await fetch("/api/agents", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ content: messageInput, agent_id: selectedAgent || undefined }),
      });
      if (res.ok) {
        setResponses((prev) => [
          { agent: selectedAgent || "default", message: messageInput, time: new Date().toLocaleTimeString() },
          ...prev,
        ]);
        setMessageInput("");
      }
    } catch {
      // ignore
    } finally {
      setSending(false);
    }
  };

  if (loading) {
    return (
      <div className="surface p-6 animate-pulse">
        <div className="h-6 bg-zinc-800 rounded w-48 mb-4" />
        <div className="h-20 bg-zinc-800 rounded" />
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Connection Status */}
      <div className="surface p-5">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            {status?.connected ? (
              <Wifi size={18} className="text-green-400" />
            ) : (
              <WifiOff size={18} className="text-red-400" />
            )}
            <div>
              <span className="text-sm font-medium" style={{ color: "var(--text-primary)" }}>
                TinyClaw {status?.connected ? "Connected" : "Disconnected"}
              </span>
              {status?.url && (
                <p className="text-[10px] font-mono" style={{ color: "var(--text-muted)" }}>{status.url}</p>
              )}
              {status?.message && !status?.connected && (
                <p className="text-xs mt-0.5" style={{ color: "var(--text-muted)" }}>{status.message}</p>
              )}
            </div>
          </div>
          <button onClick={fetchStatus} className="p-2 rounded-lg transition-colors hover:bg-white/5">
            <RefreshCw size={14} style={{ color: "var(--text-muted)" }} />
          </button>
        </div>

        {/* Queue Stats */}
        {status?.connected && status.queue && (
          <div className="mt-4 grid grid-cols-4 gap-3">
            {Object.entries(status.queue).map(([key, val]) => (
              <div key={key} className="text-center p-2 rounded-lg" style={{ backgroundColor: "var(--bg-tertiary)" }}>
                <div className="text-lg font-bold" style={{ color: "var(--text-primary)" }}>{val}</div>
                <div className="text-[10px] uppercase" style={{ color: "var(--text-muted)" }}>{key}</div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Agents List */}
      {status?.agents && status.agents.length > 0 && (
        <div className="surface p-5">
          <h3 className="text-sm font-semibold flex items-center gap-2 mb-4" style={{ color: "var(--text-primary)" }}>
            <Bot size={16} className="text-purple-400" />
            Agents ({status.agents.length})
          </h3>
          <div className="space-y-2">
            {status.agents.map((agent) => (
              <div
                key={agent.id}
                className={`flex items-center justify-between p-3 rounded-lg border transition-colors cursor-pointer ${
                  selectedAgent === agent.id
                    ? "border-purple-500/50 bg-purple-900/10"
                    : "hover:bg-white/[0.03]"
                }`}
                style={selectedAgent !== agent.id ? { borderColor: "var(--border)" } : {}}
                onClick={() => setSelectedAgent(agent.id === selectedAgent ? "" : agent.id)}
              >
                <div className="flex items-center gap-3">
                  <div className={`w-2 h-2 rounded-full ${agent.status === "processing" ? "bg-yellow-400" : "bg-green-400"}`} />
                  <div>
                    <span className="text-sm" style={{ color: "var(--text-primary)" }}>{agent.name || agent.id}</span>
                    <span className="block text-[10px]" style={{ color: "var(--text-muted)" }}>{agent.provider}/{agent.model}</span>
                  </div>
                </div>
                <Activity size={14} style={{ color: "var(--text-muted)" }} />
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Teams */}
      {status?.teams && status.teams.length > 0 && (
        <div className="surface p-5">
          <h3 className="text-sm font-semibold mb-3" style={{ color: "var(--text-primary)" }}>Teams</h3>
          <div className="space-y-2">
            {status.teams.map((team) => (
              <div key={team.id} className="p-3 rounded-lg border" style={{ borderColor: "var(--border)" }}>
                <span className="text-sm" style={{ color: "var(--text-primary)" }}>{team.name}</span>
                <div className="flex gap-1 mt-1">
                  {team.agents.map((aid) => (
                    <span key={aid} className="text-[10px] px-2 py-0.5 rounded-full" style={{ backgroundColor: "var(--bg-tertiary)", color: "var(--text-muted)" }}>
                      {aid === team.leader_agent ? `* ${aid}` : aid}
                    </span>
                  ))}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Send Message */}
      {status?.connected && (
        <div className="surface p-5">
          <h3 className="text-sm font-semibold flex items-center gap-2 mb-3" style={{ color: "var(--text-primary)" }}>
            <Send size={14} style={{ color: "var(--accent)" }} />
            Send to Agent
          </h3>
          <div className="flex gap-2">
            <input
              value={messageInput}
              onChange={(e) => setMessageInput(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && sendMessage()}
              placeholder={selectedAgent ? `Message @${selectedAgent}...` : "Message default agent..."}
              className="input flex-1 text-sm"
            />
            <button
              onClick={sendMessage}
              disabled={sending}
              className="btn btn-primary"
            >
              {sending ? "..." : "Send"}
            </button>
          </div>

          {/* Recent Activity */}
          {responses.length > 0 && (
            <div className="mt-3 space-y-1">
              {responses.slice(0, 5).map((r, i) => (
                <div key={i} className="flex items-center gap-2 text-xs" style={{ color: "var(--text-muted)" }}>
                  <Clock size={10} />
                  <span style={{ color: "var(--text-secondary)" }}>@{r.agent}</span>
                  <span className="truncate">{r.message}</span>
                  <span className="ml-auto">{r.time}</span>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Not Connected Guide */}
      {!status?.connected && (
        <div className="surface p-6 text-center">
          <Bot size={32} className="mx-auto mb-3" style={{ color: "var(--text-muted)", opacity: 0.4 }} />
          <p className="text-sm mb-2" style={{ color: "var(--text-secondary)" }}>TinyClaw is not reachable</p>
          {status?.url && (
            <p className="text-xs font-mono mb-3" style={{ color: "var(--text-muted)" }}>Trying: {status.url}</p>
          )}
          <div className="text-left rounded-lg p-4 text-xs font-mono space-y-1" style={{ backgroundColor: "var(--bg-tertiary)", color: "var(--text-muted)" }}>
            <p style={{ color: "var(--text-secondary)" }}># On the TinyClaw host:</p>
            <p>cd ~/tinyclaw && bash tinyclaw.sh start</p>
            <p className="mt-2" style={{ opacity: 0.5 }}># Or install fresh:</p>
            <p>npm install -g tinyclaw</p>
            <p>tinyclaw init && tinyclaw start</p>
          </div>
          <p className="text-xs mt-3" style={{ color: "var(--text-muted)" }}>
            Configure the URL in <code className="px-1 py-0.5 rounded" style={{ backgroundColor: "var(--bg-tertiary)" }}>.env.local</code> via <code className="px-1 py-0.5 rounded" style={{ backgroundColor: "var(--bg-tertiary)" }}>TINYCLAW_API_URL</code>
          </p>
        </div>
      )}
    </div>
  );
}
