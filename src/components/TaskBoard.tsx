"use client";

import { useState } from "react";
import type { Task } from "@/lib/types";
import { Clock, AlertCircle, CheckCircle, XCircle } from "lucide-react";

const STATUS_CONFIG = {
  pending: { icon: Clock, color: "text-zinc-400", bg: "bg-zinc-800" },
  in_progress: { icon: AlertCircle, color: "text-yellow-400", bg: "bg-yellow-900/20" },
  completed: { icon: CheckCircle, color: "text-green-400", bg: "bg-green-900/20" },
  cancelled: { icon: XCircle, color: "text-red-400", bg: "bg-red-900/20" },
};

const PRIORITY_COLORS = {
  high: "bg-red-900/30 text-red-400",
  medium: "bg-yellow-900/30 text-yellow-400",
  low: "bg-zinc-800 text-zinc-400",
};

interface Props {
  tasks: Task[];
  onStatusChange: (taskId: string, status: string) => void;
}

export default function TaskBoard({ tasks, onStatusChange }: Props) {
  const [statusFilter, setStatusFilter] = useState<string>("active");
  const [sourceFilter, setSourceFilter] = useState<string>("all");

  const filtered = tasks.filter((t) => {
    if (statusFilter === "active") return t.status === "pending" || t.status === "in_progress";
    if (statusFilter !== "all") return t.status === statusFilter;
    return true;
  }).filter((t) => {
    if (sourceFilter === "all") return true;
    return t.source === sourceFilter;
  });

  const now = new Date();

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-4">
        <div className="flex gap-1">
          {["active", "all", "pending", "in_progress", "completed", "cancelled"].map((s) => (
            <button key={s} onClick={() => setStatusFilter(s)} className={`px-3 py-1.5 rounded-lg text-xs capitalize transition-colors ${statusFilter === s ? "bg-brand-600/20 text-brand-400" : "text-zinc-500 hover:text-zinc-300"}`}>
              {s.replace("_", " ")}
            </button>
          ))}
        </div>
        <div className="flex gap-1 ml-auto">
          {["all", "extraction", "manual", "auto_action", "agent"].map((s) => (
            <button key={s} onClick={() => setSourceFilter(s)} className={`px-3 py-1.5 rounded-lg text-xs capitalize transition-colors ${sourceFilter === s ? "bg-zinc-700 text-zinc-300" : "text-zinc-600 hover:text-zinc-400"}`}>
              {s.replace("_", " ")}
            </button>
          ))}
        </div>
      </div>

      <div className="space-y-2">
        {filtered.map((task) => {
          const config = STATUS_CONFIG[task.status];
          const Icon = config.icon;
          const isOverdue = task.deadline && task.status !== "completed" && task.status !== "cancelled" && new Date(task.deadline) < now;

          return (
            <div key={task.id} className={`glass-card p-4 flex items-start gap-3 ${isOverdue ? "border-red-900/50" : ""}`}>
              <Icon size={16} className={`${config.color} mt-0.5 shrink-0`} />
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2">
                  <span className="text-sm text-white">{task.title}</span>
                  <span className={`text-[10px] px-1.5 py-0.5 rounded ${PRIORITY_COLORS[task.priority]}`}>{task.priority}</span>
                  {isOverdue && <span className="text-[10px] px-1.5 py-0.5 rounded bg-red-900/30 text-red-400">OVERDUE</span>}
                </div>
                {task.description && <p className="text-xs text-zinc-500 mt-1 line-clamp-2">{task.description}</p>}
                <div className="flex items-center gap-3 mt-2 text-xs text-zinc-600">
                  {task.owner && <span>Owner: {task.owner}</span>}
                  {task.deadline && <span>Due: {task.deadline}</span>}
                  <span className="capitalize">{task.source.replace("_", " ")}</span>
                </div>
              </div>
              <select
                value={task.status}
                onChange={(e) => onStatusChange(task.id, e.target.value)}
                className="px-2 py-1 bg-zinc-800 border border-zinc-700 rounded text-xs text-zinc-400 focus:outline-none focus:border-brand-500"
              >
                <option value="pending">Pending</option>
                <option value="in_progress">In Progress</option>
                <option value="completed">Completed</option>
                <option value="cancelled">Cancelled</option>
              </select>
            </div>
          );
        })}
        {filtered.length === 0 && (
          <div className="glass-card p-8 text-center text-zinc-600">No tasks match filters</div>
        )}
      </div>
    </div>
  );
}
