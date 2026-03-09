"use client";

import { useEffect, useState, useRef } from "react";
import type { Task, TaskPriority, TaskStatus } from "@/lib/types";
import { Plus, Scan, CheckCircle, Trash2, ChevronDown, Pencil, X, Archive } from "lucide-react";
import MemberPicker from "@/components/MemberPicker";
import { TEAM_MEMBERS, normalizeOwner, getMemberColor, getMemberInitials } from "@/lib/team";

const PRIORITY_STYLES: Record<string, string> = {
  high: "bg-red-900/30 text-red-400 border-red-900/50",
  medium: "bg-yellow-900/20 text-yellow-500 border-yellow-900/40",
  low: "bg-zinc-800/50 text-zinc-500 border-zinc-700",
};

const STATUS_STYLES: Record<string, string> = {
  pending: "text-zinc-400",
  in_progress: "text-blue-400",
  completed: "text-green-500",
  cancelled: "text-zinc-600",
};

export default function TasksPage() {
  const [tasks, setTasks] = useState<Task[]>([]);
  const [scanning, setScanning] = useState(false);
  const [filter, setFilter] = useState<string>("active");
  const [quickTitle, setQuickTitle] = useState("");
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editForm, setEditForm] = useState<Partial<Task>>({});
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [toast, setToast] = useState<string | null>(null);
  const [ownerFilter, setOwnerFilter] = useState<string>("all");

  const load = () => { fetch("/api/tasks").then((r) => r.json()).then(setTasks).catch(console.error); };
  useEffect(load, []);
  useEffect(() => { if (!toast) return; const t = setTimeout(() => setToast(null), 3000); return () => clearTimeout(t); }, [toast]);

  const flash = (msg: string) => setToast(msg);

  const handleScan = async () => {
    setScanning(true);
    await fetch("/api/scan", { method: "POST" });
    load();
    setScanning(false);
    flash("Scan complete");
  };

  const patchTask = async (id: string, updates: Partial<Task>) => {
    await fetch(`/api/tasks/${id}`, { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify(updates) });
    setTasks((ts) => ts.map((t) => t.id === id ? { ...t, ...updates } : t));
  };

  const deleteTask = async (id: string) => {
    await fetch(`/api/tasks/${id}`, { method: "DELETE" });
    setTasks((ts) => ts.filter((t) => t.id !== id));
    setSelected((s) => { const n = new Set(s); n.delete(id); return n; });
    flash("Deleted");
  };

  const quickCreate = async () => {
    if (!quickTitle.trim()) return;
    const res = await fetch("/api/tasks", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ title: quickTitle, priority: "medium", source: "manual" }) });
    if (res.ok) { setQuickTitle(""); load(); flash("Task created"); }
  };

  const bulkDelete = async (ids: string[]) => {
    if (!confirm(`Delete ${ids.length} tasks?`)) return;
    await fetch("/api/tasks", { method: "DELETE", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ ids }) });
    setSelected(new Set());
    load();
    flash(`Deleted ${ids.length} tasks`);
  };

  const bulkUpdate = async (ids: string[], updates: Partial<Task>) => {
    await fetch("/api/tasks", { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ ids, updates }) });
    load();
    setSelected(new Set());
    flash(`Updated ${ids.length} tasks`);
  };

  const bulkDeleteByFilter = async (filterName: string) => {
    const labels: Record<string, string> = { done: "completed/cancelled", stale: "stale (overdue 14+ days)" };
    if (!confirm(`Delete all ${labels[filterName] || filterName} tasks?`)) return;
    const res = await fetch("/api/tasks", { method: "DELETE", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ filter: filterName }) });
    const data = await res.json();
    load();
    flash(`Deleted ${data.deleted} tasks`);
  };

  const startEdit = (task: Task) => {
    setEditingId(task.id);
    setEditForm({ title: task.title, description: task.description, owner: task.owner, deadline: task.deadline, priority: task.priority, status: task.status });
  };

  const saveEdit = async () => {
    if (!editingId) return;
    await patchTask(editingId, editForm);
    setEditingId(null);
    setEditForm({});
    flash("Updated");
  };

  const cancelEdit = () => { setEditingId(null); setEditForm({}); };

  const toggleSelect = (id: string) => {
    setSelected((s) => { const n = new Set(s); n.has(id) ? n.delete(id) : n.add(id); return n; });
  };

  const selectAll = () => {
    if (selected.size === filtered.length) { setSelected(new Set()); }
    else { setSelected(new Set(filtered.map(t => t.id))); }
  };

  const now = new Date();
  const filtered = tasks.filter((t) => {
    // Status filter
    if (filter === "active") { if (t.status !== "pending" && t.status !== "in_progress") return false; }
    else if (filter === "overdue") {
      if (t.status === "completed" || t.status === "cancelled") return false;
      if (!t.deadline) return false;
      try { if (new Date(t.deadline) >= now) return false; } catch { return false; }
    }
    else if (filter !== "all") { if (t.status !== filter) return false; }
    // Owner filter — normalize raw owner to match canonical name
    if (ownerFilter !== "all" && !normalizeOwner(t.owner).includes(ownerFilter)) return false;
    return true;
  }).sort((a, b) => {
    const aOverdue = a.deadline && new Date(a.deadline) < now ? 1 : 0;
    const bOverdue = b.deadline && new Date(b.deadline) < now ? 1 : 0;
    if (bOverdue !== aOverdue) return bOverdue - aOverdue;
    const p: Record<string, number> = { high: 0, medium: 1, low: 2 };
    return (p[a.priority] ?? 1) - (p[b.priority] ?? 1);
  });

  const overdue = tasks.filter((t) => t.deadline && t.status !== "completed" && t.status !== "cancelled" && (() => { try { return new Date(t.deadline) < now; } catch { return false; } })()).length;
  const active = tasks.filter((t) => t.status === "pending" || t.status === "in_progress").length;
  const done = tasks.filter((t) => t.status === "completed" || t.status === "cancelled").length;

  return (
    <div className="page-container">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="page-title">Tasks</h1>
          <div className="flex items-center gap-3 mt-0.5 text-xs" style={{ color: "var(--text-muted)" }}>
            <span>{active} active</span>
            <span>{tasks.length} total</span>
            {overdue > 0 && <span className="text-red-400">{overdue} overdue</span>}
          </div>
        </div>
        <div className="flex gap-2">
          {done > 0 && (
            <button onClick={() => bulkDeleteByFilter("done")} className="btn btn-surface btn-xs flex items-center gap-1.5 text-zinc-500 hover:text-red-400">
              <Archive size={12} /> Clear done ({done})
            </button>
          )}
          <button onClick={handleScan} disabled={scanning} className="btn btn-surface btn-xs flex items-center gap-1.5">
            <Scan size={12} className={scanning ? "animate-spin" : ""} /> Scan
          </button>
        </div>
      </div>

      {/* Quick add */}
      <div className="flex gap-2 mt-4">
        <input value={quickTitle} onChange={(e) => setQuickTitle(e.target.value)} onKeyDown={(e) => e.key === "Enter" && quickCreate()}
          placeholder="Quick add task..." className="input flex-1 text-xs" />
        <button onClick={quickCreate} className="btn btn-primary btn-xs flex items-center gap-1">
          <Plus size={12} /> Add
        </button>
      </div>

      {/* Filters */}
      <div className="flex items-center gap-1 mt-3 flex-wrap">
        {["active", "overdue", "all", "pending", "in_progress", "completed", "cancelled"].map((f) => (
          <button key={f} onClick={() => setFilter(f)} className={`px-2.5 py-1 rounded-lg text-[10px] capitalize transition-colors ${filter === f ? "bg-[var(--accent)]/20 text-[var(--accent)]" : "hover:text-[var(--text-secondary)]"}`} style={filter !== f ? { color: "var(--text-muted)" } : {}}>
            {f === "overdue" ? `Overdue (${overdue})` : f.replace("_", " ")}
          </button>
        ))}

        <span className="mx-1 text-zinc-700">|</span>

        <select value={ownerFilter} onChange={(e) => setOwnerFilter(e.target.value)} className="input text-[10px] py-1 px-2 w-auto">
          <option value="all">All owners</option>
          <option value="Sven">Sven</option>
          <option value="Hjalti">Hjalti</option>
          <option value="Christopher">Christopher</option>
          <option value="All">All (shared)</option>
        </select>

        {selected.size > 0 && (
          <div className="ml-auto flex gap-1">
            <button onClick={() => bulkUpdate(Array.from(selected), { status: "completed" })} className="px-2 py-1 rounded text-[10px] bg-green-900/20 text-green-400 hover:bg-green-900/30 transition-colors">
              Complete ({selected.size})
            </button>
            <button onClick={() => bulkDelete(Array.from(selected))} className="px-2 py-1 rounded text-[10px] bg-red-900/20 text-red-400 hover:bg-red-900/30 transition-colors">
              Delete ({selected.size})
            </button>
          </div>
        )}
      </div>

      {/* Task list */}
      <div className="space-y-0.5 mt-3">
        {filtered.length > 0 && (
          <div className="flex items-center gap-2 px-3 py-1">
            <input type="checkbox" checked={selected.size === filtered.length && filtered.length > 0} onChange={selectAll} className="accent-[var(--accent)]" />
            <span className="text-[10px]" style={{ color: "var(--text-muted)" }}>Select all ({filtered.length})</span>
          </div>
        )}

        {filtered.map((task) => {
          const isOverdue = task.deadline && task.status !== "completed" && task.status !== "cancelled" && (() => { try { return new Date(task.deadline) < now; } catch { return false; } })();
          const isDone = task.status === "completed" || task.status === "cancelled";
          const isEditing = editingId === task.id;

          if (isEditing) {
            return (
              <div key={task.id} className="surface p-3 space-y-2">
                <input value={editForm.title || ""} onChange={(e) => setEditForm({ ...editForm, title: e.target.value })} className="input text-sm w-full" placeholder="Title" autoFocus />
                <textarea value={editForm.description || ""} onChange={(e) => setEditForm({ ...editForm, description: e.target.value })} className="input text-xs w-full" rows={2} placeholder="Description (optional)" />
                <div className="grid grid-cols-4 gap-2">
                  <MemberPicker value={editForm.owner || ""} onChange={(v) => setEditForm({ ...editForm, owner: v })} placeholder="Owner" />
                  <input value={editForm.deadline || ""} onChange={(e) => setEditForm({ ...editForm, deadline: e.target.value })} className="input text-xs" placeholder="Deadline" />
                  <select value={editForm.priority || "medium"} onChange={(e) => setEditForm({ ...editForm, priority: e.target.value as TaskPriority })} className="input text-xs">
                    <option value="high">High</option>
                    <option value="medium">Medium</option>
                    <option value="low">Low</option>
                  </select>
                  <select value={editForm.status || "pending"} onChange={(e) => setEditForm({ ...editForm, status: e.target.value as TaskStatus })} className="input text-xs">
                    <option value="pending">Pending</option>
                    <option value="in_progress">In Progress</option>
                    <option value="completed">Completed</option>
                    <option value="cancelled">Cancelled</option>
                  </select>
                </div>
                <div className="flex gap-2">
                  <button onClick={saveEdit} className="btn btn-primary btn-xs">Save</button>
                  <button onClick={cancelEdit} className="btn btn-surface btn-xs">Cancel</button>
                </div>
              </div>
            );
          }

          return (
            <div key={task.id} className={`flex items-center gap-2 px-3 py-2 rounded-lg transition-colors group ${isOverdue ? "bg-red-950/20 border border-red-900/30" : "hover:bg-white/[0.03]"} ${selected.has(task.id) ? "bg-[var(--accent)]/5" : ""}`}>
              <input type="checkbox" checked={selected.has(task.id)} onChange={() => toggleSelect(task.id)} className="accent-[var(--accent)] shrink-0" />

              {/* Complete button */}
              {!isDone ? (
                <button onClick={() => patchTask(task.id, { status: "completed" })} className="w-4 h-4 rounded border shrink-0 transition-colors hover:bg-green-900/30 hover:border-green-500" style={{ borderColor: "var(--border)" }} title="Complete" />
              ) : (
                <CheckCircle size={16} className="text-green-500/40 shrink-0" />
              )}

              <div className="flex-1 min-w-0" onClick={() => startEdit(task)} role="button">
                <span className={`text-[13px] ${isDone ? "line-through" : ""}`} style={{ color: isDone ? "var(--text-muted)" : "var(--text-primary)" }}>
                  {task.title}
                </span>
                <div className="flex items-center gap-2 mt-0.5 text-[10px]" style={{ color: "var(--text-muted)" }}>
                  {task.owner && (() => {
                    const name = normalizeOwner(task.owner);
                    return name ? (
                      <span className="flex items-center gap-1">
                        <span className={`w-3.5 h-3.5 rounded-full ${getMemberColor(name.split(", ")[0])} flex items-center justify-center inline-flex`}>
                          <span className="text-[6px] text-white font-bold">{getMemberInitials(name.split(", ")[0])}</span>
                        </span>
                        {name}
                      </span>
                    ) : null;
                  })()}
                  {task.deadline && (
                    <span className={isOverdue ? "text-red-400 font-medium" : ""}>
                      {isOverdue ? "OVERDUE " : ""}{task.deadline}
                    </span>
                  )}
                  <span className="capitalize opacity-50">{task.source}</span>
                </div>
              </div>

              {/* Priority badge */}
              <button
                onClick={() => {
                  const cycle: TaskPriority[] = ["low", "medium", "high"];
                  const next = cycle[(cycle.indexOf(task.priority) + 1) % cycle.length];
                  patchTask(task.id, { priority: next });
                }}
                className={`text-[9px] px-1.5 py-0.5 rounded border cursor-pointer transition-colors ${PRIORITY_STYLES[task.priority]}`}
                title="Click to cycle priority"
              >
                {task.priority}
              </button>

              {/* Status badge */}
              {!isDone && (
                <button
                  onClick={() => {
                    const next: TaskStatus = task.status === "pending" ? "in_progress" : "pending";
                    patchTask(task.id, { status: next });
                  }}
                  className={`text-[9px] px-1.5 py-0.5 rounded cursor-pointer ${STATUS_STYLES[task.status]}`}
                  title="Toggle status"
                >
                  {task.status === "in_progress" ? "active" : task.status}
                </button>
              )}

              {/* Actions */}
              <div className="flex gap-0.5 opacity-0 group-hover:opacity-100 transition-opacity shrink-0">
                <button onClick={() => startEdit(task)} className="w-6 h-6 rounded flex items-center justify-center transition-colors hover:bg-white/10" style={{ color: "var(--text-muted)" }} title="Edit">
                  <Pencil size={10} />
                </button>
                <button onClick={() => deleteTask(task.id)} className="w-6 h-6 rounded flex items-center justify-center transition-colors hover:bg-red-900/30 hover:text-red-400" style={{ color: "var(--text-muted)" }} title="Delete">
                  <Trash2 size={10} />
                </button>
              </div>
            </div>
          );
        })}

        {filtered.length === 0 && (
          <div className="text-center py-8 text-xs" style={{ color: "var(--text-muted)" }}>
            {filter === "overdue" ? "No overdue tasks." : filter === "active" ? "All clear." : "No tasks match filter."}
          </div>
        )}
      </div>

      {toast && <div className="toast">{toast}</div>}
    </div>
  );
}
