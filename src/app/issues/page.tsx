"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import type { Task, TaskPriority, TaskStatus } from "@/lib/types";
import { CircleDot, Plus, X, ChevronRight, ChevronDown, MoreHorizontal, Circle, Loader, CheckCircle2, Ban, AlertTriangle, SignalHigh, SignalMedium, SignalLow } from "lucide-react";
import { normalizeOwner, getMemberColor, getMemberInitials } from "@/lib/team";

// ── Status config (Linear-style) ────────────────────────────────────

const STATUS_CONFIG: Record<TaskStatus, { icon: typeof Circle; color: string; label: string; bg: string }> = {
  pending: { icon: Circle, color: "text-zinc-400", label: "Todo", bg: "bg-zinc-400" },
  in_progress: { icon: Loader, color: "text-yellow-500", label: "In Progress", bg: "bg-yellow-500" },
  completed: { icon: CheckCircle2, color: "text-green-500", label: "Done", bg: "bg-green-500" },
  cancelled: { icon: Ban, color: "text-zinc-600", label: "Cancelled", bg: "bg-zinc-600" },
};

const PRIORITY_CONFIG: Record<TaskPriority, { icon: typeof SignalHigh; color: string; label: string }> = {
  high: { icon: AlertTriangle, color: "text-orange-500", label: "Urgent" },
  medium: { icon: SignalMedium, color: "text-yellow-500", label: "Medium" },
  low: { icon: SignalLow, color: "text-zinc-500", label: "Low" },
};

const SOURCE_COLORS: Record<string, string> = {
  extraction: "bg-blue-900/30 text-blue-400",
  manual: "bg-zinc-800 text-zinc-400",
  auto_action: "bg-purple-900/30 text-purple-400",
  agent: "bg-green-900/30 text-green-400",
};

// ── Helpers ──────────────────────────────────────────────────────────

function formatDate(iso: string): string {
  if (!iso) return "";
  try {
    const d = new Date(iso);
    return d.toLocaleDateString("en-US", { month: "short", day: "numeric" });
  } catch { return ""; }
}

function shortId(id: string): string {
  return `H-${id.slice(0, 4).toUpperCase()}`;
}

// Normalized avatar from owner name
function ownerInitial(owner: string): { letter: string; bg: string } {
  const name = normalizeOwner(owner);
  if (!name) return { letter: "?", bg: "bg-zinc-700" };
  const first = name.split(", ")[0];
  return { letter: getMemberInitials(first).slice(0, 1), bg: getMemberColor(first) };
}

// ── Main component ──────────────────────────────────────────────────

export default function IssuesPage() {
  const router = useRouter();
  const [tasks, setTasks] = useState<Task[]>([]);
  const [loading, setLoading] = useState(true);
  const [tab, setTab] = useState<"all" | "active" | "backlog">("active");
  const [view, setView] = useState<"list" | "board">("list");
  const [collapsed, setCollapsed] = useState<Set<string>>(new Set());
  const [showCreate, setShowCreate] = useState(false);
  const [newTitle, setNewTitle] = useState("");
  const [newPriority, setNewPriority] = useState<TaskPriority>("medium");
  const [newOwner, setNewOwner] = useState("");
  const [newStatus, setNewStatus] = useState<TaskStatus>("pending");

  const load = () => {
    fetch("/api/tasks").then((r) => r.json()).then((t) => {
      setTasks(t);
      setLoading(false);
    }).catch(() => setLoading(false));
  };
  useEffect(load, []);

  const createIssue = async () => {
    if (!newTitle.trim()) return;
    const res = await fetch("/api/tasks", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ title: newTitle, priority: newPriority, owner: newOwner, status: newStatus, source: "manual" }),
    });
    if (res.ok) {
      setNewTitle(""); setNewPriority("medium"); setNewOwner(""); setNewStatus("pending");
      setShowCreate(false);
      load();
    }
  };

  const updateStatus = async (id: string, status: TaskStatus) => {
    await fetch(`/api/tasks/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ status }),
    });
    setTasks((ts) => ts.map((t) => (t.id === id ? { ...t, status } : t)));
  };

  const toggleCollapse = (status: string) => {
    setCollapsed((s) => {
      const n = new Set(s);
      if (n.has(status)) n.delete(status); else n.add(status);
      return n;
    });
  };

  // ── Filtering ─────────────────────────────────────────────────────

  const filtered = tasks.filter((t) => {
    if (tab === "active") return t.status === "in_progress" || t.status === "pending";
    if (tab === "backlog") return t.status === "pending" && t.priority === "low";
    return true; // "all"
  });

  // ── Status groups for list view ───────────────────────────────────

  const statusOrder: TaskStatus[] = tab === "all"
    ? ["in_progress", "pending", "completed", "cancelled"]
    : ["in_progress", "pending"];

  const groups = statusOrder.map((status) => ({
    status,
    config: STATUS_CONFIG[status],
    tasks: filtered.filter((t) => t.status === status)
      .sort((a, b) => {
        const p: Record<string, number> = { high: 0, medium: 1, low: 2 };
        return (p[a.priority] ?? 1) - (p[b.priority] ?? 1);
      }),
  })).filter((g) => g.tasks.length > 0);

  // ── Board columns ─────────────────────────────────────────────────

  const boardColumns: TaskStatus[] = ["pending", "in_progress", "completed"];

  if (loading) {
    return (
      <div className="page-container">
        <div className="text-sm" style={{ color: "var(--text-muted)" }}>Loading...</div>
      </div>
    );
  }

  return (
    <div className="page-container">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <h1 className="page-title flex items-center gap-2">
            <CircleDot size={18} style={{ color: "var(--accent)" }} />
            HEKLA
          </h1>
        </div>
        <div className="flex items-center gap-2">
          <button onClick={() => setView(view === "list" ? "board" : "list")} className="btn btn-surface btn-xs">
            {view === "list" ? "Board" : "List"}
          </button>
          <button onClick={() => setShowCreate(true)} className="btn btn-primary btn-xs flex items-center gap-1">
            <Plus size={12} />
          </button>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex items-center gap-0.5 mt-3">
        {(["all", "active", "backlog"] as const).map((t) => (
          <button
            key={t}
            onClick={() => setTab(t)}
            className={`px-3 py-1.5 rounded-lg text-xs capitalize transition-colors ${
              tab === t ? "bg-white/10 font-medium" : "hover:bg-white/5"
            }`}
            style={{ color: tab === t ? "var(--text-primary)" : "var(--text-muted)" }}
          >
            {t === "all" ? "All issues" : t === "active" ? "Active" : "Backlog"}
          </button>
        ))}
        <button onClick={() => setShowCreate(true)} className="px-2 py-1.5 rounded-lg text-xs hover:bg-white/5" style={{ color: "var(--text-muted)" }}>
          +
        </button>
      </div>

      {/* Create form */}
      {showCreate && (
        <div className="surface p-3 mt-3 space-y-2">
          <input
            value={newTitle}
            onChange={(e) => setNewTitle(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && createIssue()}
            placeholder="Issue title..."
            className="input w-full text-sm"
            autoFocus
          />
          <div className="flex gap-2 items-center">
            <select value={newStatus} onChange={(e) => setNewStatus(e.target.value as TaskStatus)} className="input text-[10px] py-1">
              <option value="pending">Todo</option>
              <option value="in_progress">In Progress</option>
            </select>
            <select value={newPriority} onChange={(e) => setNewPriority(e.target.value as TaskPriority)} className="input text-[10px] py-1">
              <option value="high">Urgent</option>
              <option value="medium">Medium</option>
              <option value="low">Low</option>
            </select>
            <input value={newOwner} onChange={(e) => setNewOwner(e.target.value)} placeholder="Assignee" className="input text-[10px] py-1 flex-1" />
            <button onClick={createIssue} className="btn btn-primary btn-xs">Create</button>
            <button onClick={() => setShowCreate(false)} className="btn btn-surface btn-xs"><X size={10} /></button>
          </div>
        </div>
      )}

      {/* ── LIST VIEW ────────────────────────────────────────────────── */}
      {view === "list" && (
        <div className="mt-3">
          {groups.length === 0 && (
            <div className="surface p-8 text-center text-xs" style={{ color: "var(--text-muted)" }}>
              No issues match this filter.
            </div>
          )}
          {groups.map((group) => {
            const Icon = group.config.icon;
            const isCollapsed = collapsed.has(group.status);

            return (
              <div key={group.status}>
                {/* Group header */}
                <button
                  onClick={() => toggleCollapse(group.status)}
                  className="w-full flex items-center gap-2 py-2 px-1 hover:bg-white/[0.02] transition-colors"
                >
                  <ChevronDown size={12} className={`transition-transform ${isCollapsed ? "-rotate-90" : ""}`} style={{ color: "var(--text-muted)" }} />
                  <Icon size={14} className={group.config.color} />
                  <span className="text-xs font-medium" style={{ color: "var(--text-primary)" }}>
                    {group.config.label}
                  </span>
                  <span className="text-[10px]" style={{ color: "var(--text-muted)" }}>
                    {group.tasks.length}
                  </span>
                  <div className="flex-1" />
                  <button
                    onClick={(e) => { e.stopPropagation(); setNewStatus(group.status); setShowCreate(true); }}
                    className="opacity-0 group-hover:opacity-100 hover:bg-white/10 rounded p-0.5"
                    style={{ color: "var(--text-muted)" }}
                  >
                    <Plus size={12} />
                  </button>
                </button>

                {/* Issue rows */}
                {!isCollapsed && (
                  <div className="border-l ml-1.5" style={{ borderColor: "var(--border)" }}>
                    {group.tasks.map((task) => {
                      const pri = PRIORITY_CONFIG[task.priority];
                      const PriIcon = pri.icon;
                      const avatar = ownerInitial(task.owner);
                      const isOverdue = task.deadline && task.status !== "completed" && task.status !== "cancelled" &&
                        (() => { try { return new Date(task.deadline) < new Date(); } catch { return false; } })();

                      return (
                        <div
                          key={task.id}
                          onClick={() => router.push(`/tasks/${task.id}`)}
                          className="flex items-center gap-2 pl-4 pr-2 py-1.5 hover:bg-white/[0.03] cursor-pointer group transition-colors"
                        >
                          {/* Priority icon */}
                          <PriIcon size={12} className={pri.color} />

                          {/* Issue ID */}
                          <span className="text-[10px] font-mono w-14 shrink-0" style={{ color: "var(--text-muted)" }}>
                            {shortId(task.id)}
                          </span>

                          {/* Status icon (clickable) */}
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              const next: TaskStatus = task.status === "pending" ? "in_progress" : task.status === "in_progress" ? "completed" : "pending";
                              updateStatus(task.id, next);
                            }}
                            title="Cycle status"
                          >
                            <Icon size={13} className={group.config.color} />
                          </button>

                          {/* Title */}
                          <span
                            className={`text-[13px] flex-1 min-w-0 truncate ${task.status === "completed" ? "line-through" : ""}`}
                            style={{ color: task.status === "completed" ? "var(--text-muted)" : "var(--text-primary)" }}
                          >
                            {task.title}
                          </span>

                          {/* Tags / labels */}
                          <div className="hidden md:flex items-center gap-1.5 shrink-0">
                            {/* Source tag */}
                            <span className={`text-[9px] px-1.5 py-0.5 rounded ${SOURCE_COLORS[task.source] || SOURCE_COLORS.manual}`}>
                              {task.source === "extraction" ? "Extraction" : task.source === "auto_action" ? "Auto" : task.source === "agent" ? "Agent" : "Manual"}
                            </span>

                            {/* Deadline */}
                            {task.deadline && (
                              <span className={`text-[10px] ${isOverdue ? "text-red-400 font-medium" : ""}`} style={!isOverdue ? { color: "var(--text-muted)" } : {}}>
                                {isOverdue ? "!" : ""}{formatDate(task.deadline)}
                              </span>
                            )}

                            {/* Assignee avatar */}
                            {task.owner && (
                              <div className={`w-5 h-5 rounded-full ${avatar.bg} flex items-center justify-center`} title={task.owner}>
                                <span className="text-[9px] text-white font-medium">{avatar.letter}</span>
                              </div>
                            )}

                            {/* Created / Updated dates */}
                            <span className="text-[10px]" style={{ color: "var(--text-muted)" }}>
                              {formatDate(task.created_at)}
                            </span>
                            <span className="text-[10px]" style={{ color: "var(--text-muted)" }}>
                              {formatDate(task.updated_at)}
                            </span>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}

      {/* ── BOARD VIEW ───────────────────────────────────────────────── */}
      {view === "board" && (
        <div className="grid grid-cols-3 gap-3 mt-4" style={{ minHeight: "400px" }}>
          {boardColumns.map((status) => {
            const cfg = STATUS_CONFIG[status];
            const Icon = cfg.icon;
            const colTasks = filtered.filter((t) => t.status === status)
              .sort((a, b) => {
                const p: Record<string, number> = { high: 0, medium: 1, low: 2 };
                return (p[a.priority] ?? 1) - (p[b.priority] ?? 1);
              });

            return (
              <div key={status}>
                {/* Column header */}
                <div className="flex items-center gap-1.5 mb-2 px-1">
                  <Icon size={13} className={cfg.color} />
                  <span className="text-xs font-medium" style={{ color: "var(--text-primary)" }}>
                    {cfg.label}
                  </span>
                  <span className="text-[10px]" style={{ color: "var(--text-muted)" }}>{colTasks.length}</span>
                  <div className="flex-1" />
                  <button className="hover:bg-white/5 rounded p-0.5" style={{ color: "var(--text-muted)" }}>
                    <MoreHorizontal size={12} />
                  </button>
                  <button
                    onClick={() => { setNewStatus(status); setShowCreate(true); }}
                    className="hover:bg-white/5 rounded p-0.5"
                    style={{ color: "var(--text-muted)" }}
                  >
                    <Plus size={12} />
                  </button>
                </div>

                {/* Cards */}
                <div className="space-y-1.5">
                  {colTasks.map((task) => {
                    const pri = PRIORITY_CONFIG[task.priority];
                    const PriIcon = pri.icon;
                    const avatar = ownerInitial(task.owner);

                    return (
                      <div
                        key={task.id}
                        onClick={() => router.push(`/tasks/${task.id}`)}
                        className="surface p-3 cursor-pointer hover:ring-1 hover:ring-[var(--accent)]/20 transition-all"
                      >
                        {/* Top row: ID + assignee */}
                        <div className="flex items-center justify-between mb-1">
                          <span className="text-[10px] font-mono" style={{ color: "var(--text-muted)" }}>
                            {shortId(task.id)}
                          </span>
                          {task.owner && (
                            <div className={`w-5 h-5 rounded-full ${avatar.bg} flex items-center justify-center`} title={task.owner}>
                              <span className="text-[9px] text-white font-medium">{avatar.letter}</span>
                            </div>
                          )}
                        </div>

                        {/* Status + title */}
                        <div className="flex items-start gap-1.5">
                          <Icon size={13} className={`${cfg.color} mt-0.5 shrink-0`} />
                          <span className="text-xs leading-snug" style={{ color: "var(--text-primary)" }}>
                            {task.title}
                          </span>
                        </div>

                        {/* Bottom: tags */}
                        <div className="flex items-center gap-1.5 mt-2 flex-wrap">
                          <PriIcon size={10} className={pri.color} />
                          <span className={`text-[9px] px-1.5 py-0.5 rounded ${SOURCE_COLORS[task.source] || SOURCE_COLORS.manual}`}>
                            {task.source === "extraction" ? "Extraction" : task.source === "auto_action" ? "Auto" : task.source === "agent" ? "Agent" : "Manual"}
                          </span>
                          {task.deadline && (
                            <span className="text-[9px] px-1.5 py-0.5 rounded bg-zinc-800/50" style={{ color: "var(--text-muted)" }}>
                              {formatDate(task.deadline)}
                            </span>
                          )}
                        </div>

                        {/* Created date */}
                        <div className="text-[10px] mt-2" style={{ color: "var(--text-muted)" }}>
                          Created {formatDate(task.created_at)}
                        </div>
                      </div>
                    );
                  })}

                  {colTasks.length === 0 && (
                    <div className="text-[10px] text-center py-6 rounded-lg border border-dashed" style={{ color: "var(--text-muted)", borderColor: "var(--border)" }}>
                      No items
                    </div>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
