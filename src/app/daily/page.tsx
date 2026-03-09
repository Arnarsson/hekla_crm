"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import type { Task, Deal, Contact } from "@/lib/types";
import { Target, CheckCircle, AlertTriangle, Clock, ArrowRight, ChevronRight, Flame, Plus } from "lucide-react";

const PRIORITY_STYLES: Record<string, string> = {
  high: "bg-red-900/30 text-red-400",
  medium: "bg-yellow-900/20 text-yellow-500",
  low: "bg-zinc-800/50 text-zinc-500",
};

interface DailyData {
  tasks: Task[];
  deals: Deal[];
  contacts: Contact[];
}

export default function DailyPage() {
  const router = useRouter();
  const [data, setData] = useState<DailyData>({ tasks: [], deals: [], contacts: [] });
  const [loading, setLoading] = useState(true);
  const [quickTitle, setQuickTitle] = useState("");

  useEffect(() => {
    Promise.all([
      fetch("/api/tasks").then((r) => r.json()),
      fetch("/api/deals").then((r) => r.json()),
      fetch("/api/contacts").then((r) => r.json()),
    ]).then(([tasks, deals, contacts]) => {
      setData({ tasks, deals, contacts });
      setLoading(false);
    }).catch(() => setLoading(false));
  }, []);

  const now = new Date();
  const today = now.toISOString().split("T")[0];
  const weekFromNow = new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000);

  // Compute daily focus items
  const activeTasks = data.tasks.filter(
    (t) => t.status === "pending" || t.status === "in_progress"
  );

  const overdueTasks = activeTasks.filter((t) => {
    if (!t.deadline) return false;
    try { return new Date(t.deadline) < now; } catch { return false; }
  });

  const todayTasks = activeTasks.filter((t) => t.deadline === today);

  const upcomingTasks = activeTasks.filter((t) => {
    if (!t.deadline) return false;
    try {
      const d = new Date(t.deadline);
      return d >= now && d <= weekFromNow;
    } catch { return false; }
  });

  // Smart top-3: overdue first, then today, then high priority, then soonest deadline
  const scored = activeTasks.map((t) => {
    let score = 0;
    const isOverdue = t.deadline && (() => { try { return new Date(t.deadline) < now; } catch { return false; } })();
    const isToday = t.deadline === today;
    if (isOverdue) score += 100;
    if (isToday) score += 80;
    if (t.priority === "high") score += 60;
    if (t.priority === "medium") score += 30;
    if (t.status === "in_progress") score += 20;
    if (t.deadline) {
      try {
        const daysUntil = (new Date(t.deadline).getTime() - now.getTime()) / (1000 * 60 * 60 * 24);
        if (daysUntil > 0 && daysUntil <= 7) score += Math.round(40 - daysUntil * 5);
      } catch { /* skip */ }
    }
    return { task: t, score };
  }).sort((a, b) => b.score - a.score);

  const top3 = scored.slice(0, 3).map((s) => s.task);

  // Stale deals
  const staleDeals = data.deals.filter((d) => {
    if (d.stage === "closed_won" || d.stage === "closed_lost") return false;
    const days = (now.getTime() - new Date(d.updated_at).getTime()) / (1000 * 60 * 60 * 24);
    return days > 7;
  });

  // Decaying contacts
  const decaying = data.contacts.filter((c) => {
    const days = (now.getTime() - new Date(c.last_interaction).getTime()) / (1000 * 60 * 60 * 24);
    return days > 14 && c.relationship_strength > 20;
  });

  const completeTask = async (id: string) => {
    await fetch(`/api/tasks/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ status: "completed" }),
    });
    setData((d) => ({
      ...d,
      tasks: d.tasks.map((t) => (t.id === id ? { ...t, status: "completed" as const } : t)),
    }));
  };

  const quickCreate = async () => {
    if (!quickTitle.trim()) return;
    const res = await fetch("/api/tasks", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ title: quickTitle, priority: "high", source: "manual", deadline: today }),
    });
    if (res.ok) {
      const task = await res.json();
      setData((d) => ({ ...d, tasks: [...d.tasks, task] }));
      setQuickTitle("");
    }
  };

  if (loading) {
    return (
      <div className="page-container">
        <div className="text-sm" style={{ color: "var(--text-muted)" }}>Loading daily focus...</div>
      </div>
    );
  }

  return (
    <div className="page-container">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="page-title flex items-center gap-2">
            <Target size={20} style={{ color: "var(--accent)" }} />
            Daily Focus
          </h1>
          <p className="text-xs mt-0.5" style={{ color: "var(--text-muted)" }}>
            {now.toLocaleDateString("en-US", { weekday: "long", month: "long", day: "numeric" })}
          </p>
        </div>
        <div className="flex items-center gap-3 text-xs" style={{ color: "var(--text-muted)" }}>
          <span>{activeTasks.length} active</span>
          {overdueTasks.length > 0 && <span className="text-red-400">{overdueTasks.length} overdue</span>}
          {staleDeals.length > 0 && <span className="text-yellow-500">{staleDeals.length} stale deals</span>}
        </div>
      </div>

      {/* Quick add for today */}
      <div className="flex gap-2 mt-4">
        <input
          value={quickTitle}
          onChange={(e) => setQuickTitle(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && quickCreate()}
          placeholder="Add a task for today..."
          className="input flex-1 text-xs"
        />
        <button onClick={quickCreate} className="btn btn-primary btn-xs flex items-center gap-1">
          <Plus size={12} /> Today
        </button>
      </div>

      {/* Top 3 Focus */}
      <div className="mt-5">
        <h2 className="text-xs font-semibold uppercase tracking-wider mb-2" style={{ color: "var(--text-muted)" }}>
          <Flame size={12} className="inline mr-1" style={{ color: "var(--accent)" }} />
          Top Focus
        </h2>
        <div className="space-y-1">
          {top3.length === 0 && (
            <div className="surface p-6 text-center text-xs" style={{ color: "var(--text-muted)" }}>
              All clear! No active tasks.
            </div>
          )}
          {top3.map((task, i) => {
            const isOverdue = task.deadline && (() => { try { return new Date(task.deadline) < now; } catch { return false; } })();
            return (
              <div
                key={task.id}
                className={`surface p-3 flex items-center gap-3 group ${isOverdue ? "border border-red-900/30" : ""}`}
              >
                <span className="text-lg font-bold w-6 text-center" style={{ color: "var(--accent)", opacity: 0.5 }}>
                  {i + 1}
                </span>
                <button
                  onClick={() => completeTask(task.id)}
                  className="w-5 h-5 rounded border shrink-0 transition-colors hover:bg-green-900/30 hover:border-green-500"
                  style={{ borderColor: "var(--border)" }}
                  title="Complete"
                />
                <div className="flex-1 min-w-0">
                  <div className="text-sm" style={{ color: "var(--text-primary)" }}>{task.title}</div>
                  <div className="flex items-center gap-2 mt-0.5 text-[10px]" style={{ color: "var(--text-muted)" }}>
                    {task.owner && <span>{task.owner}</span>}
                    {task.deadline && (
                      <span className={isOverdue ? "text-red-400 font-medium" : ""}>
                        {isOverdue ? "OVERDUE " : ""}{task.deadline}
                      </span>
                    )}
                  </div>
                </div>
                <span className={`text-[9px] px-1.5 py-0.5 rounded ${PRIORITY_STYLES[task.priority]}`}>
                  {task.priority}
                </span>
                <button
                  onClick={() => router.push(`/tasks/${task.id}`)}
                  className="opacity-0 group-hover:opacity-100 transition-opacity"
                  style={{ color: "var(--text-muted)" }}
                >
                  <ChevronRight size={14} />
                </button>
              </div>
            );
          })}
        </div>
      </div>

      {/* Overdue */}
      {overdueTasks.length > 0 && (
        <div className="mt-5">
          <h2 className="text-xs font-semibold uppercase tracking-wider mb-2 text-red-400">
            <AlertTriangle size={12} className="inline mr-1" />
            Overdue ({overdueTasks.length})
          </h2>
          <div className="space-y-0.5">
            {overdueTasks.slice(0, 5).map((task) => (
              <div key={task.id} className="flex items-center gap-2 px-3 py-2 rounded-lg bg-red-950/10 border border-red-900/20 group">
                <button
                  onClick={() => completeTask(task.id)}
                  className="w-4 h-4 rounded border shrink-0 transition-colors hover:bg-green-900/30 hover:border-green-500 border-red-900/50"
                  title="Complete"
                />
                <div className="flex-1 min-w-0">
                  <span className="text-xs" style={{ color: "var(--text-primary)" }}>{task.title}</span>
                  <div className="text-[10px] text-red-400/70 mt-0.5">
                    Due {task.deadline} {task.owner && `- ${task.owner}`}
                  </div>
                </div>
                <button onClick={() => router.push(`/tasks/${task.id}`)} className="opacity-0 group-hover:opacity-100" style={{ color: "var(--text-muted)" }}>
                  <ChevronRight size={12} />
                </button>
              </div>
            ))}
            {overdueTasks.length > 5 && (
              <button onClick={() => router.push("/tasks?filter=overdue")} className="text-[10px] px-3 py-1 text-red-400 hover:text-red-300">
                +{overdueTasks.length - 5} more overdue
              </button>
            )}
          </div>
        </div>
      )}

      {/* This week */}
      {upcomingTasks.length > 0 && (
        <div className="mt-5">
          <h2 className="text-xs font-semibold uppercase tracking-wider mb-2" style={{ color: "var(--text-muted)" }}>
            <Clock size={12} className="inline mr-1" />
            This Week ({upcomingTasks.length})
          </h2>
          <div className="space-y-0.5">
            {upcomingTasks.sort((a, b) => a.deadline.localeCompare(b.deadline)).slice(0, 8).map((task) => (
              <div key={task.id} className="flex items-center gap-2 px-3 py-1.5 rounded-lg hover:bg-white/[0.03] group">
                <button
                  onClick={() => completeTask(task.id)}
                  className="w-4 h-4 rounded border shrink-0 transition-colors hover:bg-green-900/30 hover:border-green-500"
                  style={{ borderColor: "var(--border)" }}
                />
                <span className="text-xs flex-1" style={{ color: "var(--text-primary)" }}>{task.title}</span>
                <span className="text-[10px]" style={{ color: "var(--text-muted)" }}>{task.deadline}</span>
                <span className={`text-[9px] px-1.5 py-0.5 rounded ${PRIORITY_STYLES[task.priority]}`}>
                  {task.priority}
                </span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Alerts row */}
      {(staleDeals.length > 0 || decaying.length > 0) && (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3 mt-5">
          {staleDeals.length > 0 && (
            <div className="surface p-3">
              <h3 className="text-[10px] uppercase tracking-wider mb-2 text-yellow-500">Stale Deals</h3>
              {staleDeals.slice(0, 3).map((d) => (
                <div key={d.id} className="flex items-center justify-between py-1">
                  <button onClick={() => router.push(`/deals/${d.id}`)} className="text-xs hover:underline" style={{ color: "var(--text-primary)" }}>
                    {d.title}
                  </button>
                  <span className="text-[10px] text-yellow-500/60">{d.stage}</span>
                </div>
              ))}
              {staleDeals.length > 3 && (
                <button onClick={() => router.push("/deals")} className="text-[10px] mt-1" style={{ color: "var(--accent)" }}>
                  +{staleDeals.length - 3} more
                </button>
              )}
            </div>
          )}
          {decaying.length > 0 && (
            <div className="surface p-3">
              <h3 className="text-[10px] uppercase tracking-wider mb-2 text-orange-400">Relationship Decay</h3>
              {decaying.slice(0, 3).map((c) => (
                <div key={c.id} className="flex items-center justify-between py-1">
                  <button onClick={() => router.push(`/contacts/${c.id}`)} className="text-xs hover:underline" style={{ color: "var(--text-primary)" }}>
                    {c.name}
                  </button>
                  <span className="text-[10px] text-orange-400/60">{c.organization}</span>
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
