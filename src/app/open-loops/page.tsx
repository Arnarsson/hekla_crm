"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import type { Task, Deal, Contact } from "@/lib/types";
import { RefreshCw, CheckCircle, AlertTriangle, Clock, ChevronRight, Users, Handshake, Plus, X } from "lucide-react";

interface LoopItem {
  id: string;
  type: "followup" | "stale_deal" | "decay" | "pending_task";
  title: string;
  subtitle: string;
  urgency: "high" | "medium" | "low";
  entityType: "task" | "deal" | "contact";
  entityId: string;
  daysOld: number;
}

export default function OpenLoopsPage() {
  const router = useRouter();
  const [tasks, setTasks] = useState<Task[]>([]);
  const [deals, setDeals] = useState<Deal[]>([]);
  const [contacts, setContacts] = useState<Contact[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<string>("all");
  const [dismissed, setDismissed] = useState<Set<string>>(new Set());
  const [quickTitle, setQuickTitle] = useState("");

  useEffect(() => {
    Promise.all([
      fetch("/api/tasks").then((r) => r.json()),
      fetch("/api/deals").then((r) => r.json()),
      fetch("/api/contacts").then((r) => r.json()),
    ]).then(([t, d, c]) => {
      setTasks(t);
      setDeals(d);
      setContacts(c);
      setLoading(false);
    }).catch(() => setLoading(false));
  }, []);

  const now = new Date();

  // Build loop items from all data sources
  const loops: LoopItem[] = [];

  // Follow-up tasks (from extractions, still pending)
  for (const t of tasks) {
    if (t.status === "completed" || t.status === "cancelled") continue;
    if (!t.title.toLowerCase().startsWith("follow up")) continue;
    const days = Math.floor((now.getTime() - new Date(t.created_at).getTime()) / (1000 * 60 * 60 * 24));
    loops.push({
      id: `task-${t.id}`,
      type: "followup",
      title: t.title,
      subtitle: `${t.owner || "Unassigned"} - created ${days}d ago`,
      urgency: days > 14 ? "high" : days > 7 ? "medium" : "low",
      entityType: "task",
      entityId: t.id,
      daysOld: days,
    });
  }

  // Pending tasks from extractions that are old
  for (const t of tasks) {
    if (t.status === "completed" || t.status === "cancelled") continue;
    if (t.source !== "extraction") continue;
    if (t.title.toLowerCase().startsWith("follow up")) continue;
    const days = Math.floor((now.getTime() - new Date(t.created_at).getTime()) / (1000 * 60 * 60 * 24));
    if (days < 3) continue; // Only show after 3 days
    loops.push({
      id: `ptask-${t.id}`,
      type: "pending_task",
      title: t.title,
      subtitle: `${t.owner || "Unassigned"} - pending ${days}d`,
      urgency: days > 14 ? "high" : days > 7 ? "medium" : "low",
      entityType: "task",
      entityId: t.id,
      daysOld: days,
    });
  }

  // Stale deals
  for (const d of deals) {
    if (d.stage === "closed_won" || d.stage === "closed_lost") continue;
    const days = Math.floor((now.getTime() - new Date(d.updated_at).getTime()) / (1000 * 60 * 60 * 24));
    if (days < 7) continue;
    loops.push({
      id: `deal-${d.id}`,
      type: "stale_deal",
      title: d.title,
      subtitle: `${d.stage} - inactive ${days}d${d.owner ? ` - ${d.owner}` : ""}`,
      urgency: days > 21 ? "high" : days > 14 ? "medium" : "low",
      entityType: "deal",
      entityId: d.id,
      daysOld: days,
    });
  }

  // Decaying relationships
  for (const c of contacts) {
    const days = Math.floor((now.getTime() - new Date(c.last_interaction).getTime()) / (1000 * 60 * 60 * 24));
    if (days < 14 || c.relationship_strength <= 20) continue;
    loops.push({
      id: `contact-${c.id}`,
      type: "decay",
      title: c.name,
      subtitle: `${c.organization || "No org"} - ${days}d since last contact - strength ${c.relationship_strength}`,
      urgency: days > 30 ? "high" : days > 21 ? "medium" : "low",
      entityType: "contact",
      entityId: c.id,
      daysOld: days,
    });
  }

  // Sort by urgency then age
  const urgencyOrder: Record<string, number> = { high: 0, medium: 1, low: 2 };
  loops.sort((a, b) => {
    if (urgencyOrder[a.urgency] !== urgencyOrder[b.urgency]) return urgencyOrder[a.urgency] - urgencyOrder[b.urgency];
    return b.daysOld - a.daysOld;
  });

  const filtered = loops.filter((l) => {
    if (dismissed.has(l.id)) return false;
    if (filter === "all") return true;
    return l.type === filter;
  });

  const counts = {
    followup: loops.filter((l) => l.type === "followup" && !dismissed.has(l.id)).length,
    stale_deal: loops.filter((l) => l.type === "stale_deal" && !dismissed.has(l.id)).length,
    decay: loops.filter((l) => l.type === "decay" && !dismissed.has(l.id)).length,
    pending_task: loops.filter((l) => l.type === "pending_task" && !dismissed.has(l.id)).length,
  };

  const completeLoop = async (loop: LoopItem) => {
    if (loop.entityType === "task") {
      await fetch(`/api/tasks/${loop.entityId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status: "completed" }),
      });
      setTasks((ts) => ts.map((t) => (t.id === loop.entityId ? { ...t, status: "completed" as const } : t)));
    }
    setDismissed((s) => { const n = new Set(s); n.add(loop.id); return n; });
  };

  const quickCreate = async () => {
    if (!quickTitle.trim()) return;
    const res = await fetch("/api/tasks", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ title: `Follow up: ${quickTitle}`, priority: "medium", source: "manual" }),
    });
    if (res.ok) {
      const task = await res.json();
      setTasks((ts) => [...ts, task]);
      setQuickTitle("");
    }
  };

  const URGENCY_STYLES: Record<string, string> = {
    high: "text-red-400",
    medium: "text-yellow-500",
    low: "text-zinc-500",
  };

  const TYPE_ICONS: Record<string, typeof RefreshCw> = {
    followup: Clock,
    stale_deal: Handshake,
    decay: Users,
    pending_task: AlertTriangle,
  };

  const TYPE_LABELS: Record<string, string> = {
    followup: "Follow-up",
    stale_deal: "Stale Deal",
    decay: "Relationship",
    pending_task: "Pending Task",
  };

  if (loading) {
    return (
      <div className="page-container">
        <div className="text-sm" style={{ color: "var(--text-muted)" }}>Loading open loops...</div>
      </div>
    );
  }

  return (
    <div className="page-container">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="page-title flex items-center gap-2">
            <RefreshCw size={20} style={{ color: "var(--accent)" }} />
            Open Loops
          </h1>
          <p className="text-xs mt-0.5" style={{ color: "var(--text-muted)" }}>
            {filtered.length} unresolved items across your pipeline
          </p>
        </div>
      </div>

      {/* Quick add */}
      <div className="flex gap-2 mt-4">
        <input
          value={quickTitle}
          onChange={(e) => setQuickTitle(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && quickCreate()}
          placeholder="Add a follow-up..."
          className="input flex-1 text-xs"
        />
        <button onClick={quickCreate} className="btn btn-primary btn-xs flex items-center gap-1">
          <Plus size={12} /> Add
        </button>
      </div>

      {/* Summary cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-2 mt-4">
        {(Object.entries(counts) as [string, number][]).map(([type, count]) => {
          const Icon = TYPE_ICONS[type];
          return (
            <button
              key={type}
              onClick={() => setFilter(filter === type ? "all" : type)}
              className={`surface p-3 text-left transition-colors ${filter === type ? "ring-1 ring-[var(--accent)]/30" : ""}`}
            >
              <div className="flex items-center gap-1.5 mb-1">
                <Icon size={12} style={{ color: "var(--text-muted)" }} />
                <span className="text-[10px] uppercase tracking-wider" style={{ color: "var(--text-muted)" }}>
                  {TYPE_LABELS[type]}
                </span>
              </div>
              <span className="text-lg font-bold" style={{ color: count > 0 ? "var(--text-primary)" : "var(--text-muted)" }}>
                {count}
              </span>
            </button>
          );
        })}
      </div>

      {/* Loop list */}
      <div className="space-y-0.5 mt-4">
        {filtered.length === 0 && (
          <div className="surface p-8 text-center text-xs" style={{ color: "var(--text-muted)" }}>
            {loops.length === 0 ? "No open loops. Everything is resolved!" : "No items match this filter."}
          </div>
        )}
        {filtered.map((loop) => {
          const Icon = TYPE_ICONS[loop.type];
          return (
            <div
              key={loop.id}
              className="flex items-center gap-2 px-3 py-2 rounded-lg hover:bg-white/[0.03] group"
            >
              {/* Resolve button */}
              <button
                onClick={() => completeLoop(loop)}
                className="w-4 h-4 rounded border shrink-0 transition-colors hover:bg-green-900/30 hover:border-green-500"
                style={{ borderColor: "var(--border)" }}
                title="Resolve"
              />

              {/* Type icon */}
              <Icon size={14} className={URGENCY_STYLES[loop.urgency]} />

              {/* Content */}
              <div className="flex-1 min-w-0">
                <span className="text-[13px]" style={{ color: "var(--text-primary)" }}>{loop.title}</span>
                <div className="text-[10px] mt-0.5" style={{ color: "var(--text-muted)" }}>
                  {loop.subtitle}
                </div>
              </div>

              {/* Type label */}
              <span className="text-[9px] px-1.5 py-0.5 rounded bg-zinc-800/50" style={{ color: "var(--text-muted)" }}>
                {TYPE_LABELS[loop.type]}
              </span>

              {/* Days badge */}
              <span className={`text-[9px] font-mono ${URGENCY_STYLES[loop.urgency]}`}>
                {loop.daysOld}d
              </span>

              {/* Navigate */}
              <button
                onClick={() => router.push(`/${loop.entityType === "task" ? "tasks" : loop.entityType === "deal" ? "deals" : "contacts"}/${loop.entityId}`)}
                className="opacity-0 group-hover:opacity-100 transition-opacity"
                style={{ color: "var(--text-muted)" }}
              >
                <ChevronRight size={14} />
              </button>

              {/* Dismiss */}
              <button
                onClick={() => setDismissed((s) => { const n = new Set(s); n.add(loop.id); return n; })}
                className="opacity-0 group-hover:opacity-100 transition-opacity"
                style={{ color: "var(--text-muted)" }}
                title="Dismiss"
              >
                <X size={12} />
              </button>
            </div>
          );
        })}
      </div>
    </div>
  );
}
