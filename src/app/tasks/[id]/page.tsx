"use client";

import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import type { Task, TaskPriority, TaskStatus } from "@/lib/types";
import { ArrowLeft, Trash2, Save, CheckCircle } from "lucide-react";

const PRIORITY_STYLES: Record<string, string> = {
  high: "bg-red-900/30 text-red-400",
  medium: "bg-yellow-900/20 text-yellow-500",
  low: "bg-zinc-800/50 text-zinc-500",
};

const STATUS_STYLES: Record<string, string> = {
  pending: "text-zinc-400",
  in_progress: "text-blue-400",
  completed: "text-green-500",
  cancelled: "text-zinc-600",
};

export default function TaskDetailPage() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const [task, setTask] = useState<Task | null>(null);
  const [form, setForm] = useState<Partial<Task>>({});
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [dirty, setDirty] = useState(false);

  useEffect(() => {
    fetch(`/api/tasks/${id}`).then(r => {
      if (!r.ok) { setLoading(false); return; }
      return r.json();
    }).then(t => {
      if (t) { setTask(t); setForm(t); }
      setLoading(false);
    }).catch(() => setLoading(false));
  }, [id]);

  const update = (updates: Partial<Task>) => {
    setForm(f => ({ ...f, ...updates }));
    setDirty(true);
  };

  const save = async () => {
    setSaving(true);
    const res = await fetch(`/api/tasks/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(form),
    });
    if (res.ok) {
      const updated = await res.json();
      setTask(updated);
      setForm(updated);
      setDirty(false);
    }
    setSaving(false);
  };

  const del = async () => {
    if (!confirm("Delete this task?")) return;
    await fetch(`/api/tasks/${id}`, { method: "DELETE" });
    router.push("/tasks");
  };

  const complete = async () => {
    update({ status: "completed" });
    await fetch(`/api/tasks/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ status: "completed" }),
    });
    const res = await fetch(`/api/tasks/${id}`);
    if (res.ok) { const t = await res.json(); setTask(t); setForm(t); setDirty(false); }
  };

  if (loading) {
    return <div className="page-container"><div className="text-sm" style={{ color: "var(--text-muted)" }}>Loading...</div></div>;
  }

  if (!task) {
    return (
      <div className="page-container">
        <button onClick={() => router.push("/tasks")} className="btn btn-surface btn-xs flex items-center gap-1 mb-4">
          <ArrowLeft size={12} /> Back to tasks
        </button>
        <div className="surface p-8 text-center">
          <p style={{ color: "var(--text-muted)" }}>Task not found</p>
        </div>
      </div>
    );
  }

  const isDone = task.status === "completed" || task.status === "cancelled";

  return (
    <div className="page-container">
      {/* Header */}
      <div className="flex items-center justify-between">
        <button onClick={() => router.push("/tasks")} className="btn btn-surface btn-xs flex items-center gap-1">
          <ArrowLeft size={12} /> Tasks
        </button>
        <div className="flex gap-2">
          {!isDone && (
            <button onClick={complete} className="btn btn-xs flex items-center gap-1 bg-green-900/20 text-green-400 hover:bg-green-900/30">
              <CheckCircle size={12} /> Complete
            </button>
          )}
          {dirty && (
            <button onClick={save} disabled={saving} className="btn btn-primary btn-xs flex items-center gap-1">
              <Save size={12} /> {saving ? "Saving..." : "Save"}
            </button>
          )}
          <button onClick={del} className="btn btn-xs flex items-center gap-1 bg-red-900/20 text-red-400 hover:bg-red-900/30">
            <Trash2 size={12} /> Delete
          </button>
        </div>
      </div>

      {/* Task form */}
      <div className="surface p-5 mt-4 space-y-4">
        <div>
          <label className="text-[10px] uppercase tracking-wider mb-1 block" style={{ color: "var(--text-muted)" }}>Title</label>
          <input
            value={form.title || ""}
            onChange={(e) => update({ title: e.target.value })}
            className="input w-full text-sm font-medium"
          />
        </div>

        <div>
          <label className="text-[10px] uppercase tracking-wider mb-1 block" style={{ color: "var(--text-muted)" }}>Description</label>
          <textarea
            value={form.description || ""}
            onChange={(e) => update({ description: e.target.value })}
            className="input w-full text-xs"
            rows={4}
            placeholder="Add details..."
          />
        </div>

        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          <div>
            <label className="text-[10px] uppercase tracking-wider mb-1 block" style={{ color: "var(--text-muted)" }}>Status</label>
            <select value={form.status || "pending"} onChange={(e) => update({ status: e.target.value as TaskStatus })} className="input w-full text-xs">
              <option value="pending">Pending</option>
              <option value="in_progress">In Progress</option>
              <option value="completed">Completed</option>
              <option value="cancelled">Cancelled</option>
            </select>
          </div>

          <div>
            <label className="text-[10px] uppercase tracking-wider mb-1 block" style={{ color: "var(--text-muted)" }}>Priority</label>
            <select value={form.priority || "medium"} onChange={(e) => update({ priority: e.target.value as TaskPriority })} className="input w-full text-xs">
              <option value="high">High</option>
              <option value="medium">Medium</option>
              <option value="low">Low</option>
            </select>
          </div>

          <div>
            <label className="text-[10px] uppercase tracking-wider mb-1 block" style={{ color: "var(--text-muted)" }}>Owner</label>
            <input value={form.owner || ""} onChange={(e) => update({ owner: e.target.value })} className="input w-full text-xs" placeholder="Assign..." />
          </div>

          <div>
            <label className="text-[10px] uppercase tracking-wider mb-1 block" style={{ color: "var(--text-muted)" }}>Deadline</label>
            <input value={form.deadline || ""} onChange={(e) => update({ deadline: e.target.value })} className="input w-full text-xs" placeholder="e.g. 2026-03-15" />
          </div>
        </div>
      </div>

      {/* Meta */}
      <div className="surface p-4 mt-3">
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3 text-[10px]" style={{ color: "var(--text-muted)" }}>
          <div>
            <span className="uppercase tracking-wider block mb-0.5">Source</span>
            <span className="capitalize" style={{ color: "var(--text-secondary)" }}>{task.source}</span>
          </div>
          <div>
            <span className="uppercase tracking-wider block mb-0.5">Created</span>
            <span style={{ color: "var(--text-secondary)" }}>{new Date(task.created_at).toLocaleDateString()}</span>
          </div>
          <div>
            <span className="uppercase tracking-wider block mb-0.5">Updated</span>
            <span style={{ color: "var(--text-secondary)" }}>{new Date(task.updated_at).toLocaleDateString()}</span>
          </div>
          <div>
            <span className="uppercase tracking-wider block mb-0.5">ID</span>
            <span className="font-mono" style={{ color: "var(--text-secondary)" }}>{task.id.slice(0, 8)}</span>
          </div>
        </div>
      </div>
    </div>
  );
}
