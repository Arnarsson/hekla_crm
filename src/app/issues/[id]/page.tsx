"use client";

import { useEffect, useState, useRef } from "react";
import { useParams, useRouter } from "next/navigation";
import type { Task, TaskPriority, TaskStatus, Activity } from "@/lib/types";
import {
  ArrowLeft, Trash2, Save, CheckCircle2, Circle, Loader, Ban,
  AlertTriangle, SignalMedium, SignalLow, Copy, Lightbulb,
  UserCircle, Puzzle, Search, FileText, Zap, Eye, Send, Plus,
  ChevronDown, Clock, MessageSquare, Tag,
} from "lucide-react";
import MemberPicker from "@/components/MemberPicker";
import LabelPicker from "@/components/LabelPicker";
import { TEAM_MEMBERS, getMemberColor, getMemberInitials, ISSUE_LABELS } from "@/lib/team";

// ── Config ──────────────────────────────────────────────────────────

const STATUS_CONFIG: Record<TaskStatus, { icon: typeof Circle; color: string; label: string; bg: string }> = {
  pending: { icon: Circle, color: "text-zinc-400", label: "Todo", bg: "bg-zinc-500" },
  in_progress: { icon: Loader, color: "text-yellow-500", label: "In Progress", bg: "bg-yellow-500" },
  completed: { icon: CheckCircle2, color: "text-green-500", label: "Done", bg: "bg-green-500" },
  cancelled: { icon: Ban, color: "text-zinc-600", label: "Cancelled", bg: "bg-zinc-600" },
};

const PRIORITY_CONFIG: Record<TaskPriority, { icon: typeof AlertTriangle; color: string; label: string; tagColor: string }> = {
  high: { icon: AlertTriangle, color: "text-orange-500", label: "Urgent", tagColor: "bg-orange-900/30 text-orange-400" },
  medium: { icon: SignalMedium, color: "text-yellow-500", label: "Medium", tagColor: "bg-yellow-900/20 text-yellow-500" },
  low: { icon: SignalLow, color: "text-zinc-500", label: "Low", tagColor: "bg-zinc-800/50 text-zinc-500" },
};

const SOURCE_LABELS: Record<string, string> = {
  extraction: "Extraction", manual: "Manual", auto_action: "Auto Action", agent: "Agent",
};

function shortId(id: string): string {
  return `#${id.slice(0, 8)}`;
}

function timeAgo(iso: string): string {
  const ms = Date.now() - new Date(iso).getTime();
  const mins = Math.floor(ms / 60000);
  if (mins < 1) return "just now";
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  const days = Math.floor(hrs / 24);
  return `${days}d ago`;
}

// ownerColor and ownerInitials now from team.ts

// ── Comment type (stored in task description JSON block) ────────────

interface Comment {
  id: string;
  author: string;
  text: string;
  created_at: string;
}

interface SubTask {
  id: string;
  title: string;
  done: boolean;
}

// We store comments, subtasks, and labels as JSON in a metadata field
interface IssueMeta {
  comments: Comment[];
  subtasks: SubTask[];
  labels?: string[];
}

function parseMeta(task: Task): IssueMeta {
  try {
    const match = task.description?.match(/<!--META:([\s\S]*?)-->/);
    if (match) return JSON.parse(match[1]);
  } catch { /* ignore */ }
  return { comments: [], subtasks: [], labels: [] };
}

function encodeMeta(description: string, meta: IssueMeta): string {
  const cleanDesc = description.replace(/<!--META:[\s\S]*?-->/, "").trim();
  return `${cleanDesc}\n<!--META:${JSON.stringify(meta)}-->`;
}

// ── Render @mentions in comment text ────────────────────────────────

function renderCommentText(text: string): React.ReactNode {
  const parts = text.split(/(@\w+)/g);
  return parts.map((part, i) => {
    if (part.startsWith("@")) {
      const name = part.slice(1);
      const member = TEAM_MEMBERS.find(
        (m) => m.name.toLowerCase() === name.toLowerCase() || m.id === name.toLowerCase()
      );
      if (member) {
        return (
          <span key={i} className="inline-flex items-center gap-0.5 px-1 py-0.5 rounded text-[10px] font-medium" style={{ backgroundColor: "var(--accent)", color: "white", opacity: 0.9 }}>
            @{member.name}
          </span>
        );
      }
    }
    return <span key={i}>{part}</span>;
  });
}

// ── Agent actions config ────────────────────────────────────────────

const AGENT_ACTIONS = [
  { id: "subtasks", icon: Puzzle, label: "Break into subtasks", agent: "eureka", desc: "No subtasks yet, needs breakdown" },
  { id: "research", icon: Search, label: "Research & scope", agent: "scout", desc: "General suggestion" },
  { id: "plan", icon: FileText, label: "Write implementation plan", agent: "eureka", desc: "General suggestion" },
  { id: "blockers", icon: AlertTriangle, label: "Find blockers", agent: "", desc: "" },
  { id: "implement", icon: Zap, label: "Implement", agent: "", desc: "" },
  { id: "review", icon: Eye, label: "Code review", agent: "", desc: "" },
];

// ── Main component ──────────────────────────────────────────────────

export default function IssueDetailPage() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const [task, setTask] = useState<Task | null>(null);
  const [activities, setActivities] = useState<Activity[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [dirty, setDirty] = useState(false);

  // Form state
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [status, setStatus] = useState<TaskStatus>("pending");
  const [priority, setPriority] = useState<TaskPriority>("medium");
  const [owner, setOwner] = useState("");
  const [deadline, setDeadline] = useState("");

  // Meta state
  const [meta, setMeta] = useState<IssueMeta>({ comments: [], subtasks: [], labels: [] });
  const [commentText, setCommentText] = useState("");
  const [newSubtask, setNewSubtask] = useState("");
  const [editingDesc, setEditingDesc] = useState(false);
  const [toast, setToast] = useState<string | null>(null);
  const [showMentions, setShowMentions] = useState(false);
  const [mentionFilter, setMentionFilter] = useState("");
  const commentInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    Promise.all([
      fetch(`/api/tasks/${id}`).then((r) => r.ok ? r.json() : null),
      fetch(`/api/activities`).then((r) => r.json()),
    ]).then(([t, acts]) => {
      if (t) {
        setTask(t);
        setTitle(t.title);
        const m = parseMeta(t);
        setMeta(m);
        setDescription(t.description?.replace(/<!--META:[\s\S]*?-->/, "").trim() || "");
        setStatus(t.status);
        setPriority(t.priority);
        setOwner(t.owner);
        setDeadline(t.deadline);
      }
      // Filter activities for this task
      const taskActs = (acts || []).filter((a: Activity) => a.entity_id === id);
      setActivities(taskActs);
      setLoading(false);
    }).catch(() => setLoading(false));
  }, [id]);

  useEffect(() => {
    if (!toast) return;
    const t = setTimeout(() => setToast(null), 2000);
    return () => clearTimeout(t);
  }, [toast]);

  const save = async (overrides?: Partial<Task>) => {
    setSaving(true);
    const fullDesc = encodeMeta(description, meta);
    const body = {
      title, description: fullDesc, status, priority, owner, deadline,
      ...overrides,
    };
    const res = await fetch(`/api/tasks/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
    if (res.ok) {
      const updated = await res.json();
      setTask(updated);
      setDirty(false);
      setToast("Saved");
    }
    setSaving(false);
  };

  const del = async () => {
    if (!confirm("Delete this issue?")) return;
    await fetch(`/api/tasks/${id}`, { method: "DELETE" });
    router.push("/issues");
  };

  const duplicate = async () => {
    const res = await fetch("/api/tasks", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        title: `${title} (copy)`,
        description: encodeMeta(description, { comments: [], subtasks: meta.subtasks }),
        priority, owner, source: "manual",
      }),
    });
    if (res.ok) {
      const newTask = await res.json();
      router.push(`/issues/${newTask.id}`);
    }
  };

  const addComment = () => {
    if (!commentText.trim()) return;
    const comment: Comment = {
      id: crypto.randomUUID(),
      author: owner || "You",
      text: commentText,
      created_at: new Date().toISOString(),
    };
    const newMeta = { ...meta, comments: [...meta.comments, comment] };
    setMeta(newMeta);
    setCommentText("");
    setShowMentions(false);
    // Auto-save
    const fullDesc = encodeMeta(description, newMeta);
    fetch(`/api/tasks/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ description: fullDesc }),
    });
  };

  const handleCommentKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Enter" && !showMentions) {
      addComment();
    }
  };

  const handleCommentChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const val = e.target.value;
    setCommentText(val);
    // Check for @mention trigger
    const atMatch = val.match(/@(\w*)$/);
    if (atMatch) {
      setShowMentions(true);
      setMentionFilter(atMatch[1].toLowerCase());
    } else {
      setShowMentions(false);
    }
  };

  const insertMention = (name: string) => {
    const newText = commentText.replace(/@\w*$/, `@${name} `);
    setCommentText(newText);
    setShowMentions(false);
    commentInputRef.current?.focus();
  };

  const updateLabels = (newLabels: string[]) => {
    const newMeta = { ...meta, labels: newLabels };
    setMeta(newMeta);
    const fullDesc = encodeMeta(description, newMeta);
    fetch(`/api/tasks/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ description: fullDesc, tags: newLabels }),
    });
  };

  const addSubtask = () => {
    if (!newSubtask.trim()) return;
    const sub: SubTask = { id: crypto.randomUUID(), title: newSubtask, done: false };
    const newMeta = { ...meta, subtasks: [...meta.subtasks, sub] };
    setMeta(newMeta);
    setNewSubtask("");
    const fullDesc = encodeMeta(description, newMeta);
    fetch(`/api/tasks/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ description: fullDesc }),
    });
  };

  const toggleSubtask = (subId: string) => {
    const newMeta = {
      ...meta,
      subtasks: meta.subtasks.map((s) => s.id === subId ? { ...s, done: !s.done } : s),
    };
    setMeta(newMeta);
    const fullDesc = encodeMeta(description, newMeta);
    fetch(`/api/tasks/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ description: fullDesc }),
    });
  };

  const removeSubtask = (subId: string) => {
    const newMeta = { ...meta, subtasks: meta.subtasks.filter((s) => s.id !== subId) };
    setMeta(newMeta);
    const fullDesc = encodeMeta(description, newMeta);
    fetch(`/api/tasks/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ description: fullDesc }),
    });
  };

  const sendToAgent = async (actionId: string) => {
    setToast(`Sending to agent...`);
    try {
      const action = AGENT_ACTIONS.find((a) => a.id === actionId);
      await fetch("/api/agents", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          content: `${action?.label}: ${title}\n\nDescription: ${description}`,
          agent_id: action?.agent || undefined,
        }),
      });
      setToast(`Sent to ${action?.agent || "agent"}`);
    } catch {
      setToast("Agent not available");
    }
  };

  if (loading) {
    return <div className="page-container"><div className="text-sm" style={{ color: "var(--text-muted)" }}>Loading...</div></div>;
  }

  if (!task) {
    return (
      <div className="page-container">
        <button onClick={() => router.push("/issues")} className="btn btn-surface btn-xs flex items-center gap-1 mb-4">
          <ArrowLeft size={12} /> Back
        </button>
        <div className="surface p-8 text-center">
          <p style={{ color: "var(--text-muted)" }}>Issue not found</p>
        </div>
      </div>
    );
  }

  const stCfg = STATUS_CONFIG[status];
  const StIcon = stCfg.icon;
  const priCfg = PRIORITY_CONFIG[priority];
  const PriIcon = priCfg.icon;
  const isDone = status === "completed" || status === "cancelled";

  // Generate insights
  const insights: { icon: typeof Lightbulb; color: string; text: string }[] = [];
  if (!owner) {
    insights.push({ icon: UserCircle, color: "text-yellow-500", text: "This issue has no owner assigned. Assign someone to take ownership and drive progress." });
  }
  if (deadline && new Date(deadline) < new Date() && !isDone) {
    insights.push({ icon: AlertTriangle, color: "text-red-400", text: `This issue is overdue (was due ${deadline}). Consider reprioritizing or updating the deadline.` });
  }
  if (meta.subtasks.length === 0 && !isDone) {
    insights.push({ icon: Puzzle, color: "text-blue-400", text: "Consider breaking this issue into sub-tasks for better tracking." });
  }
  if (status === "pending" && priority === "high") {
    insights.push({ icon: Zap, color: "text-orange-400", text: "High priority issue still in Todo. Consider starting work or reassigning." });
  }

  return (
    <div className="page-container">
      {/* Top nav */}
      <div className="flex items-center justify-between">
        <button onClick={() => router.push("/issues")} className="btn btn-surface btn-xs flex items-center gap-1">
          <ArrowLeft size={12} /> Issues
        </button>
        <div className="flex gap-1.5">
          {dirty && (
            <button onClick={() => save()} disabled={saving} className="btn btn-primary btn-xs flex items-center gap-1">
              <Save size={10} /> {saving ? "..." : "Save"}
            </button>
          )}
        </div>
      </div>

      {/* ── Issue header ─────────────────────────────────────────────── */}
      <div className="mt-4">
        {/* Status + Priority tags */}
        <div className="flex items-center gap-2 mb-2">
          <button
            onClick={() => {
              const next: TaskStatus = status === "pending" ? "in_progress" : status === "in_progress" ? "completed" : "pending";
              setStatus(next);
              save({ status: next });
            }}
            className={`text-[10px] px-2 py-0.5 rounded flex items-center gap-1 ${stCfg.bg}/20 ${stCfg.color}`}
          >
            <StIcon size={10} /> {stCfg.label}
          </button>
          <button
            onClick={() => {
              const cycle: TaskPriority[] = ["low", "medium", "high"];
              const next = cycle[(cycle.indexOf(priority) + 1) % cycle.length];
              setPriority(next);
              setDirty(true);
            }}
            className={`text-[10px] px-2 py-0.5 rounded flex items-center gap-1 ${priCfg.tagColor}`}
          >
            <PriIcon size={10} /> {priCfg.label}
          </button>
          {task.source && (
            <span className="text-[10px] px-2 py-0.5 rounded bg-zinc-800/50" style={{ color: "var(--text-muted)" }}>
              {SOURCE_LABELS[task.source] || task.source}
            </span>
          )}
          {(meta.labels || []).map((lid) => {
            const label = ISSUE_LABELS.find((l) => l.id === lid);
            return label ? (
              <span key={lid} className={`text-[10px] px-2 py-0.5 rounded ${label.color}`}>{label.name}</span>
            ) : null;
          })}
        </div>

        {/* Title */}
        <input
          value={title}
          onChange={(e) => { setTitle(e.target.value); setDirty(true); }}
          className="bg-transparent text-lg font-semibold w-full outline-none"
          style={{ color: "var(--text-primary)" }}
          placeholder="Issue title..."
        />

        {/* ID */}
        <div className="text-[10px] font-mono mt-1" style={{ color: "var(--text-muted)" }}>
          {shortId(task.id)}
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 mt-4">
        {/* ── Left column (main content) ───────────────────────────── */}
        <div className="lg:col-span-2 space-y-4">

          {/* AI Insights */}
          {insights.length > 0 && (
            <div className="surface p-4">
              <h3 className="text-[10px] uppercase tracking-wider font-medium mb-2 flex items-center gap-1.5" style={{ color: "var(--text-muted)" }}>
                <Lightbulb size={10} style={{ color: "var(--accent)" }} />
                Hekla&apos;s Take
                <span className="text-[9px] px-1.5 py-0.5 rounded-full bg-zinc-800/50">{insights.length} insight{insights.length !== 1 ? "s" : ""}</span>
              </h3>
              <div className="space-y-2">
                {insights.map((ins, i) => {
                  const InsIcon = ins.icon;
                  return (
                    <div key={i} className="flex items-start gap-2">
                      <InsIcon size={12} className={`${ins.color} mt-0.5 shrink-0`} />
                      <p className="text-xs leading-relaxed" style={{ color: "var(--text-secondary)" }}>{ins.text}</p>
                    </div>
                  );
                })}
              </div>
              <p className="text-[9px] mt-2 italic" style={{ color: "var(--text-muted)" }}>
                AI-powered insights based on issue metadata and patterns
              </p>
            </div>
          )}

          {/* Description */}
          <div className="surface p-4">
            <div className="flex items-center justify-between mb-2">
              <h3 className="text-[10px] uppercase tracking-wider font-medium" style={{ color: "var(--text-muted)" }}>Description</h3>
              <button onClick={() => setEditingDesc(!editingDesc)} className="text-[10px]" style={{ color: "var(--accent)" }}>
                {editingDesc ? "Done" : "Edit"}
              </button>
            </div>
            {editingDesc ? (
              <textarea
                value={description}
                onChange={(e) => { setDescription(e.target.value); setDirty(true); }}
                className="input w-full text-xs min-h-[80px]"
                placeholder="Add a description..."
                autoFocus
              />
            ) : (
              <p className="text-xs leading-relaxed whitespace-pre-wrap" style={{ color: description ? "var(--text-secondary)" : "var(--text-muted)" }}>
                {description || "No description yet. Click Edit to add one."}
              </p>
            )}
          </div>

          {/* Sub-tasks */}
          <div className="surface p-4">
            <div className="flex items-center justify-between mb-2">
              <h3 className="text-[10px] uppercase tracking-wider font-medium" style={{ color: "var(--text-muted)" }}>Sub-tasks</h3>
              {meta.subtasks.length > 0 && (
                <span className="text-[10px]" style={{ color: "var(--text-muted)" }}>
                  {meta.subtasks.filter((s) => s.done).length}/{meta.subtasks.length}
                </span>
              )}
            </div>

            {/* Progress bar */}
            {meta.subtasks.length > 0 && (
              <div className="h-1 rounded-full mb-3 overflow-hidden" style={{ backgroundColor: "var(--bg-tertiary)" }}>
                <div
                  className="h-full rounded-full transition-all"
                  style={{
                    width: `${(meta.subtasks.filter((s) => s.done).length / meta.subtasks.length) * 100}%`,
                    backgroundColor: "var(--accent)",
                  }}
                />
              </div>
            )}

            <div className="space-y-0.5">
              {meta.subtasks.map((sub) => (
                <div key={sub.id} className="flex items-center gap-2 py-1 group">
                  <button onClick={() => toggleSubtask(sub.id)}>
                    {sub.done ? (
                      <CheckCircle2 size={14} className="text-green-500" />
                    ) : (
                      <Circle size={14} style={{ color: "var(--text-muted)" }} />
                    )}
                  </button>
                  <span
                    className={`text-xs flex-1 ${sub.done ? "line-through" : ""}`}
                    style={{ color: sub.done ? "var(--text-muted)" : "var(--text-primary)" }}
                  >
                    {sub.title}
                  </span>
                  <button
                    onClick={() => removeSubtask(sub.id)}
                    className="opacity-0 group-hover:opacity-100 text-[10px]"
                    style={{ color: "var(--text-muted)" }}
                  >
                    &times;
                  </button>
                </div>
              ))}
            </div>

            {/* Add subtask */}
            <div className="flex gap-2 mt-2">
              <input
                value={newSubtask}
                onChange={(e) => setNewSubtask(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && addSubtask()}
                placeholder="Add a sub-task..."
                className="input flex-1 text-xs"
              />
              <button onClick={addSubtask} className="btn btn-surface btn-xs">
                <Plus size={10} />
              </button>
            </div>

            {meta.subtasks.length === 0 && (
              <p className="text-[10px] mt-1" style={{ color: "var(--text-muted)" }}>
                No sub-tasks yet
              </p>
            )}
          </div>

          {/* Agent Assignment */}
          <div className="surface p-4">
            <div className="flex items-center justify-between mb-3">
              <h3 className="text-[10px] uppercase tracking-wider font-medium" style={{ color: "var(--text-muted)" }}>Agent Assignment</h3>
              <span className="text-[10px] px-1.5 py-0.5 rounded bg-zinc-800/50" style={{ color: "var(--text-muted)" }}>Idle</span>
            </div>

            <p className="text-[10px] mb-3" style={{ color: "var(--accent)" }}>Recommended</p>

            <div className="space-y-1">
              {AGENT_ACTIONS.slice(0, 3).map((action) => {
                const AIcon = action.icon;
                return (
                  <button
                    key={action.id}
                    onClick={() => sendToAgent(action.id)}
                    className="w-full flex items-center gap-2.5 p-2 rounded-lg hover:bg-white/[0.03] transition-colors text-left"
                  >
                    <AIcon size={14} style={{ color: "var(--accent)" }} />
                    <div className="flex-1 min-w-0">
                      <div className="text-xs" style={{ color: "var(--text-primary)" }}>{action.label}</div>
                      {action.agent && (
                        <div className="text-[10px]" style={{ color: "var(--text-muted)" }}>
                          {action.agent} &mdash; {action.desc}
                        </div>
                      )}
                    </div>
                  </button>
                );
              })}
            </div>

            <p className="text-[10px] mt-3 mb-2" style={{ color: "var(--text-muted)" }}>All Actions</p>

            <div className="grid grid-cols-3 gap-1">
              {AGENT_ACTIONS.slice(3).map((action) => {
                const AIcon = action.icon;
                return (
                  <button
                    key={action.id}
                    onClick={() => sendToAgent(action.id)}
                    className="flex items-center gap-1.5 p-1.5 rounded hover:bg-white/[0.03] transition-colors"
                  >
                    <AIcon size={10} style={{ color: "var(--text-muted)" }} />
                    <span className="text-[10px]" style={{ color: "var(--text-secondary)" }}>{action.label}</span>
                  </button>
                );
              })}
            </div>

            <button className="w-full mt-2 p-2 rounded-lg border border-dashed text-[10px] hover:bg-white/[0.02] transition-colors flex items-center justify-center gap-1.5" style={{ borderColor: "var(--border)", color: "var(--text-muted)" }}>
              <Puzzle size={10} /> Generate Subtasks with AI
              <span className="ml-auto" style={{ color: "var(--accent)" }}>Custom agent spawn &rarr;</span>
            </button>
          </div>

          {/* Activity */}
          <div className="surface p-4">
            <h3 className="text-[10px] uppercase tracking-wider font-medium mb-3" style={{ color: "var(--text-muted)" }}>Activity</h3>
            <div className="space-y-2">
              {activities.length === 0 && meta.comments.length === 0 && (
                <div className="flex items-center gap-2 text-[10px]" style={{ color: "var(--text-muted)" }}>
                  <Clock size={10} />
                  <span>System created this issue</span>
                  <span className="ml-auto">{timeAgo(task.created_at)}</span>
                </div>
              )}
              {activities.map((a) => (
                <div key={a.id} className="flex items-center gap-2 text-[10px]" style={{ color: "var(--text-muted)" }}>
                  <Clock size={10} />
                  <span style={{ color: "var(--text-secondary)" }}>{a.title}</span>
                  <span className="ml-auto">{timeAgo(a.created_at)}</span>
                </div>
              ))}
            </div>
          </div>

          {/* Comments */}
          <div className="surface p-4">
            <h3 className="text-[10px] uppercase tracking-wider font-medium mb-3" style={{ color: "var(--text-muted)" }}>
              Comments ({meta.comments.length})
            </h3>

            {meta.comments.length === 0 && (
              <p className="text-xs mb-3" style={{ color: "var(--text-muted)" }}>
                No comments yet. Be the first to share your thoughts.
              </p>
            )}

            <div className="space-y-3 mb-3">
              {meta.comments.map((c) => (
                <div key={c.id} className="flex items-start gap-2">
                  <div className={`w-6 h-6 rounded-full ${getMemberColor(c.author)} flex items-center justify-center shrink-0`}>
                    <span className="text-[9px] text-white font-medium">{getMemberInitials(c.author)}</span>
                  </div>
                  <div className="flex-1">
                    <div className="flex items-center gap-2">
                      <span className="text-xs font-medium" style={{ color: "var(--text-primary)" }}>{c.author}</span>
                      <span className="text-[10px]" style={{ color: "var(--text-muted)" }}>{timeAgo(c.created_at)}</span>
                    </div>
                    <p className="text-xs mt-0.5 leading-relaxed" style={{ color: "var(--text-secondary)" }}>
                      {renderCommentText(c.text)}
                    </p>
                  </div>
                </div>
              ))}
            </div>

            {/* Comment input with @mention */}
            <div className="relative">
              <div className="flex gap-2">
                <input
                  ref={commentInputRef}
                  value={commentText}
                  onChange={handleCommentChange}
                  onKeyDown={handleCommentKeyDown}
                  placeholder="Add a comment... (type @ to mention)"
                  className="input flex-1 text-xs"
                />
                <button onClick={addComment} className="btn btn-primary btn-xs">
                  Post
                </button>
              </div>
              {showMentions && (
                <div className="absolute bottom-full mb-1 left-0 w-48 rounded-lg border shadow-lg overflow-hidden z-50" style={{ backgroundColor: "var(--bg-secondary)", borderColor: "var(--border)" }}>
                  {TEAM_MEMBERS.filter((m) => !mentionFilter || m.name.toLowerCase().includes(mentionFilter) || m.id.includes(mentionFilter)).map((m) => (
                    <button
                      key={m.id}
                      onClick={() => insertMention(m.name)}
                      className="w-full flex items-center gap-2 px-3 py-1.5 hover:bg-white/[0.05] transition-colors text-left"
                    >
                      <div className={`w-5 h-5 rounded-full ${m.color} flex items-center justify-center shrink-0`}>
                        <span className="text-[8px] text-white font-bold">{m.initials}</span>
                      </div>
                      <span className="text-xs" style={{ color: "var(--text-primary)" }}>{m.name}</span>
                      <span className="text-[10px] ml-auto" style={{ color: "var(--text-muted)" }}>{m.role}</span>
                    </button>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>

        {/* ── Right sidebar ──────────────────────────────────────────── */}
        <div className="space-y-3">
          {/* Properties */}
          <div className="surface p-4 space-y-3">
            <div>
              <label className="text-[10px] uppercase tracking-wider block mb-1" style={{ color: "var(--text-muted)" }}>Status</label>
              <select
                value={status}
                onChange={(e) => { setStatus(e.target.value as TaskStatus); setDirty(true); }}
                className="input w-full text-xs"
              >
                <option value="pending">Todo</option>
                <option value="in_progress">In Progress</option>
                <option value="completed">Done</option>
                <option value="cancelled">Cancelled</option>
              </select>
            </div>

            <div>
              <label className="text-[10px] uppercase tracking-wider block mb-1" style={{ color: "var(--text-muted)" }}>Priority</label>
              <select
                value={priority}
                onChange={(e) => { setPriority(e.target.value as TaskPriority); setDirty(true); }}
                className="input w-full text-xs"
              >
                <option value="high">Urgent</option>
                <option value="medium">Medium</option>
                <option value="low">Low</option>
              </select>
            </div>

            <div>
              <label className="text-[10px] uppercase tracking-wider block mb-1" style={{ color: "var(--text-muted)" }}>Assignee</label>
              <MemberPicker value={owner} onChange={(v) => { setOwner(v); setDirty(true); }} />
            </div>

            <div>
              <label className="text-[10px] uppercase tracking-wider block mb-1" style={{ color: "var(--text-muted)" }}>Labels</label>
              <LabelPicker value={meta.labels || []} onChange={updateLabels} />
            </div>

            <div>
              <label className="text-[10px] uppercase tracking-wider block mb-1" style={{ color: "var(--text-muted)" }}>Deadline</label>
              <input
                type="date"
                value={deadline}
                onChange={(e) => { setDeadline(e.target.value); setDirty(true); }}
                className="input w-full text-xs"
              />
            </div>
          </div>

          {/* Meta info */}
          <div className="surface p-4 space-y-2 text-[10px]" style={{ color: "var(--text-muted)" }}>
            <div className="flex justify-between">
              <span>Source</span>
              <span className="capitalize" style={{ color: "var(--text-secondary)" }}>{SOURCE_LABELS[task.source] || task.source}</span>
            </div>
            <div className="flex justify-between">
              <span>Created</span>
              <span style={{ color: "var(--text-secondary)" }}>{new Date(task.created_at).toLocaleDateString()}</span>
            </div>
            <div className="flex justify-between">
              <span>Updated</span>
              <span style={{ color: "var(--text-secondary)" }}>{new Date(task.updated_at).toLocaleDateString()}</span>
            </div>
            <div className="flex justify-between">
              <span>ID</span>
              <span className="font-mono" style={{ color: "var(--text-secondary)" }}>{task.id.slice(0, 8)}</span>
            </div>
          </div>

          {/* Actions */}
          <div className="surface p-3 space-y-1">
            {dirty && (
              <button onClick={() => save()} disabled={saving} className="w-full btn btn-primary btn-xs flex items-center justify-center gap-1">
                <Save size={10} /> {saving ? "Saving..." : "Save Changes"}
              </button>
            )}
            {!isDone && (
              <button
                onClick={() => { setStatus("completed"); save({ status: "completed" }); }}
                className="w-full btn btn-xs flex items-center justify-center gap-1 bg-green-900/20 text-green-400 hover:bg-green-900/30"
              >
                <CheckCircle2 size={10} /> Complete
              </button>
            )}
            <button onClick={duplicate} className="w-full btn btn-surface btn-xs flex items-center justify-center gap-1">
              <Copy size={10} /> Duplicate
            </button>
            <button onClick={del} className="w-full btn btn-xs flex items-center justify-center gap-1 bg-red-900/20 text-red-400 hover:bg-red-900/30">
              <Trash2 size={10} /> Delete
            </button>
          </div>
        </div>
      </div>

      {toast && <div className="toast">{toast}</div>}
    </div>
  );
}
