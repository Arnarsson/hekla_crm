"use client";

import { useEffect, useState } from "react";
import type { Activity, ActivityType } from "@/lib/types";
import { ScrollText, FileText, UserCircle, Kanban, ListTodo, Bot, Scan, AlertTriangle } from "lucide-react";

const TYPE_ICONS: Record<string, typeof FileText> = {
  extraction: FileText,
  contact_created: UserCircle,
  contact_updated: UserCircle,
  deal_created: Kanban,
  deal_updated: Kanban,
  deal_stage_changed: Kanban,
  task_created: ListTodo,
  task_completed: ListTodo,
  agent_action: Bot,
  scan: Scan,
  alert: AlertTriangle,
};

const TYPE_COLORS: Record<string, string> = {
  extraction: "text-brand-400",
  contact_created: "text-green-400",
  contact_updated: "text-blue-400",
  deal_created: "text-purple-400",
  deal_updated: "text-purple-400",
  deal_stage_changed: "text-yellow-400",
  task_created: "text-orange-400",
  task_completed: "text-green-400",
  agent_action: "text-cyan-400",
  scan: "text-zinc-400",
  alert: "text-red-400",
};

export default function LogsPage() {
  const [activities, setActivities] = useState<Activity[]>([]);
  const [typeFilter, setTypeFilter] = useState<string>("all");

  useEffect(() => {
    const url = typeFilter === "all" ? "/api/activities?limit=100" : `/api/activities?limit=100&type=${typeFilter}`;
    fetch(url).then((r) => r.json()).then(setActivities).catch(console.error);
  }, [typeFilter]);

  const types: (ActivityType | "all")[] = ["all", "extraction", "contact_created", "deal_created", "deal_stage_changed", "task_created", "task_completed", "agent_action", "scan", "alert"];

  return (
    <div className="page-container">
      <div>
        <h1 className="text-2xl font-bold text-white flex items-center gap-3">
          <ScrollText size={24} className="text-brand-400" /> Activity Log
        </h1>
        <p className="text-sm text-zinc-500 mt-1">All system events and actions</p>
      </div>

      <div className="flex gap-1 flex-wrap">
        {types.map((t) => (
          <button key={t} onClick={() => setTypeFilter(t)} className={`px-3 py-1.5 rounded-lg text-xs transition-colors ${typeFilter === t ? "bg-brand-600/20 text-brand-400" : "text-zinc-500 hover:text-zinc-300"}`}>
            {t === "all" ? "All" : t.replace(/_/g, " ")}
          </button>
        ))}
      </div>

      <div className="space-y-2">
        {activities.map((a) => {
          const Icon = TYPE_ICONS[a.type] || FileText;
          const color = TYPE_COLORS[a.type] || "text-zinc-400";
          return (
            <div key={a.id} className="surface p-4 flex items-start gap-3 fade-in">
              <Icon size={16} className={`${color} mt-0.5 shrink-0`} />
              <div className="flex-1 min-w-0">
                <div className="text-sm text-white">{a.title}</div>
                <div className="text-xs text-zinc-500 mt-0.5">{a.description}</div>
              </div>
              <span className="text-xs text-zinc-600 whitespace-nowrap">{new Date(a.created_at).toLocaleString()}</span>
            </div>
          );
        })}
        {activities.length === 0 && (
          <div className="surface p-8 text-center text-zinc-600">No activity yet</div>
        )}
      </div>
    </div>
  );
}
