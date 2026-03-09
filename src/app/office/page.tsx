"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Building2, Users, Handshake, CheckCircle, FileText, TrendingUp, AlertTriangle, Clock } from "lucide-react";

interface OfficeStats {
  contacts: number;
  deals: number;
  activeTasks: number;
  completedTasks: number;
  overdueTasks: number;
  extractions: number;
  recentActivity: { type: string; title: string; created_at: string }[];
  dealsByStage: Record<string, number>;
}

export default function OfficePage() {
  const router = useRouter();
  const [stats, setStats] = useState<OfficeStats | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    Promise.all([
      fetch("/api/contacts").then((r) => r.json()),
      fetch("/api/deals").then((r) => r.json()),
      fetch("/api/tasks").then((r) => r.json()),
      fetch("/api/pipelines").then((r) => r.json()),
      fetch("/api/activities").then((r) => r.json()),
    ]).then(([contacts, deals, tasks, extractions, activities]) => {
      const now = new Date();
      const dealsByStage: Record<string, number> = {};
      for (const d of deals || []) {
        dealsByStage[d.stage] = (dealsByStage[d.stage] || 0) + 1;
      }

      setStats({
        contacts: (contacts || []).length,
        deals: (deals || []).length,
        activeTasks: (tasks || []).filter((t: { status: string }) => t.status === "pending" || t.status === "in_progress").length,
        completedTasks: (tasks || []).filter((t: { status: string }) => t.status === "completed").length,
        overdueTasks: (tasks || []).filter((t: { status: string; deadline: string }) => {
          if (t.status === "completed" || t.status === "cancelled") return false;
          if (!t.deadline) return false;
          try { return new Date(t.deadline) < now; } catch { return false; }
        }).length,
        extractions: (extractions || []).length,
        recentActivity: (activities || []).slice(0, 10),
        dealsByStage,
      });
      setLoading(false);
    }).catch(() => setLoading(false));
  }, []);

  if (loading) {
    return (
      <div className="page-container">
        <div className="text-sm" style={{ color: "var(--text-muted)" }}>Loading office...</div>
      </div>
    );
  }

  if (!stats) return null;

  const stageLabels: Record<string, string> = {
    lead: "Lead",
    qualified: "Qualified",
    proposal: "Proposal",
    negotiation: "Negotiation",
    closed_won: "Won",
    closed_lost: "Lost",
  };

  return (
    <div className="page-container">
      <div>
        <h1 className="page-title flex items-center gap-2">
          <Building2 size={20} style={{ color: "var(--accent)" }} />
          Office
        </h1>
        <p className="text-xs mt-0.5" style={{ color: "var(--text-muted)" }}>
          Hekla Mission Control overview
        </p>
      </div>

      {/* Key metrics */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-2 mt-4">
        <button onClick={() => router.push("/contacts")} className="surface p-3 text-left hover:ring-1 hover:ring-[var(--accent)]/20 transition-all">
          <Users size={14} className="text-green-400 mb-1" />
          <div className="text-xl font-bold" style={{ color: "var(--text-primary)" }}>{stats.contacts}</div>
          <div className="text-[10px]" style={{ color: "var(--text-muted)" }}>Contacts</div>
        </button>
        <button onClick={() => router.push("/deals")} className="surface p-3 text-left hover:ring-1 hover:ring-[var(--accent)]/20 transition-all">
          <Handshake size={14} className="text-purple-400 mb-1" />
          <div className="text-xl font-bold" style={{ color: "var(--text-primary)" }}>{stats.deals}</div>
          <div className="text-[10px]" style={{ color: "var(--text-muted)" }}>Deals</div>
        </button>
        <button onClick={() => router.push("/tasks")} className="surface p-3 text-left hover:ring-1 hover:ring-[var(--accent)]/20 transition-all">
          <CheckCircle size={14} className="text-blue-400 mb-1" />
          <div className="text-xl font-bold" style={{ color: "var(--text-primary)" }}>{stats.activeTasks}</div>
          <div className="text-[10px]" style={{ color: "var(--text-muted)" }}>
            Active tasks
            {stats.overdueTasks > 0 && <span className="text-red-400 ml-1">({stats.overdueTasks} overdue)</span>}
          </div>
        </button>
        <button onClick={() => router.push("/brain")} className="surface p-3 text-left hover:ring-1 hover:ring-[var(--accent)]/20 transition-all">
          <FileText size={14} className="text-yellow-500 mb-1" />
          <div className="text-xl font-bold" style={{ color: "var(--text-primary)" }}>{stats.extractions}</div>
          <div className="text-[10px]" style={{ color: "var(--text-muted)" }}>Extractions</div>
        </button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-3 mt-4">
        {/* Pipeline */}
        <div className="surface p-4">
          <h2 className="text-[10px] uppercase tracking-wider font-medium mb-3 flex items-center gap-1" style={{ color: "var(--text-muted)" }}>
            <TrendingUp size={10} /> Pipeline
          </h2>
          <div className="space-y-1.5">
            {Object.entries(stageLabels).map(([stage, label]) => {
              const count = stats.dealsByStage[stage] || 0;
              const maxCount = Math.max(...Object.values(stats.dealsByStage), 1);
              const pct = (count / maxCount) * 100;
              return (
                <div key={stage} className="flex items-center gap-2">
                  <span className="text-[10px] w-20 text-right" style={{ color: "var(--text-muted)" }}>{label}</span>
                  <div className="flex-1 h-3 rounded-full overflow-hidden" style={{ backgroundColor: "var(--bg-tertiary)" }}>
                    <div
                      className="h-full rounded-full transition-all"
                      style={{
                        width: `${pct}%`,
                        backgroundColor: stage === "closed_won" ? "var(--success)" : stage === "closed_lost" ? "var(--text-muted)" : "var(--accent)",
                        opacity: count > 0 ? 0.7 : 0,
                      }}
                    />
                  </div>
                  <span className="text-[10px] w-4 text-center font-mono" style={{ color: count > 0 ? "var(--text-secondary)" : "var(--text-muted)" }}>
                    {count}
                  </span>
                </div>
              );
            })}
          </div>
        </div>

        {/* Recent activity */}
        <div className="surface p-4">
          <h2 className="text-[10px] uppercase tracking-wider font-medium mb-3 flex items-center gap-1" style={{ color: "var(--text-muted)" }}>
            <Clock size={10} /> Recent Activity
          </h2>
          <div className="space-y-1">
            {stats.recentActivity.length === 0 && (
              <p className="text-[10px]" style={{ color: "var(--text-muted)" }}>No activity yet</p>
            )}
            {stats.recentActivity.map((a, i) => (
              <div key={i} className="flex items-center gap-2 py-1">
                <div className={`w-1 h-1 rounded-full shrink-0 ${a.type === "alert" ? "bg-red-400" : a.type.includes("created") ? "bg-green-400" : "bg-zinc-500"}`} />
                <span className="text-[11px] flex-1 truncate" style={{ color: "var(--text-secondary)" }}>{a.title}</span>
                <span className="text-[9px] shrink-0" style={{ color: "var(--text-muted)" }}>
                  {new Date(a.created_at).toLocaleDateString()}
                </span>
              </div>
            ))}
          </div>
          {stats.recentActivity.length > 0 && (
            <button onClick={() => router.push("/logs")} className="text-[10px] mt-2" style={{ color: "var(--accent)" }}>
              View all activity
            </button>
          )}
        </div>
      </div>

      {/* Quick actions */}
      <div className="surface p-4 mt-3">
        <h2 className="text-[10px] uppercase tracking-wider font-medium mb-2" style={{ color: "var(--text-muted)" }}>Quick Actions</h2>
        <div className="flex gap-2 flex-wrap">
          <button onClick={() => router.push("/upload")} className="btn btn-surface btn-xs">Upload Conversation</button>
          <button onClick={() => router.push("/daily")} className="btn btn-surface btn-xs">Daily Focus</button>
          <button onClick={() => router.push("/open-loops")} className="btn btn-surface btn-xs">Open Loops</button>
          <button onClick={() => router.push("/contacts")} className="btn btn-surface btn-xs">Contacts</button>
          <button onClick={() => router.push("/deals")} className="btn btn-surface btn-xs">Deals</button>
        </div>
      </div>
    </div>
  );
}
