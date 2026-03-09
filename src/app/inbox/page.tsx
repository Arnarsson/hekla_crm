"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import type { Activity } from "@/lib/types";
import { Inbox, Bell, UserPlus, Handshake, FileText, Scan, AlertTriangle, CheckCircle, Filter } from "lucide-react";

const TYPE_CONFIG: Record<string, { icon: typeof Bell; color: string; label: string }> = {
  extraction: { icon: FileText, color: "text-blue-400", label: "Extraction" },
  contact_created: { icon: UserPlus, color: "text-green-400", label: "New Contact" },
  deal_created: { icon: Handshake, color: "text-purple-400", label: "New Deal" },
  deal_stage_changed: { icon: Handshake, color: "text-yellow-500", label: "Deal Update" },
  alert: { icon: AlertTriangle, color: "text-red-400", label: "Alert" },
  scan: { icon: Scan, color: "text-cyan-400", label: "Scan" },
  task_completed: { icon: CheckCircle, color: "text-green-500", label: "Completed" },
};

function getConfig(type: string) {
  return TYPE_CONFIG[type] || { icon: Bell, color: "text-zinc-400", label: type };
}

function groupByDate(activities: Activity[]): Record<string, Activity[]> {
  const groups: Record<string, Activity[]> = {};
  const now = new Date();
  const today = now.toISOString().split("T")[0];
  const yesterday = new Date(now.getTime() - 24 * 60 * 60 * 1000).toISOString().split("T")[0];

  for (const a of activities) {
    const date = a.created_at.split("T")[0];
    let label: string;
    if (date === today) label = "Today";
    else if (date === yesterday) label = "Yesterday";
    else label = new Date(date).toLocaleDateString("en-US", { weekday: "short", month: "short", day: "numeric" });

    if (!groups[label]) groups[label] = [];
    groups[label].push(a);
  }
  return groups;
}

export default function InboxPage() {
  const router = useRouter();
  const [activities, setActivities] = useState<Activity[]>([]);
  const [loading, setLoading] = useState(true);
  const [typeFilter, setTypeFilter] = useState<string>("all");
  const [read, setRead] = useState<Set<string>>(new Set());

  useEffect(() => {
    fetch("/api/activities")
      .then((r) => r.json())
      .then((data) => {
        setActivities(data);
        setLoading(false);
      })
      .catch(() => setLoading(false));
  }, []);

  const markAllRead = () => {
    setRead(new Set(activities.map((a) => a.id)));
  };

  const filtered = activities.filter((a) => {
    if (typeFilter === "all") return true;
    if (typeFilter === "unread") return !read.has(a.id);
    return a.type === typeFilter;
  });

  const grouped = groupByDate(filtered);
  const unreadCount = activities.filter((a) => !read.has(a.id)).length;

  // Get unique types for filter
  const types = Array.from(new Set(activities.map((a) => a.type))).sort();

  const navigateToEntity = (activity: Activity) => {
    setRead((s) => { const n = new Set(s); n.add(activity.id); return n; });
    if (activity.entity_type === "task") router.push(`/tasks/${activity.entity_id}`);
    else if (activity.entity_type === "deal") router.push(`/deals/${activity.entity_id}`);
    else if (activity.entity_type === "contact") router.push(`/contacts/${activity.entity_id}`);
    else if (activity.entity_type === "extraction") router.push(`/pipelines/${activity.entity_id}`);
  };

  if (loading) {
    return (
      <div className="page-container">
        <div className="text-sm" style={{ color: "var(--text-muted)" }}>Loading inbox...</div>
      </div>
    );
  }

  return (
    <div className="page-container">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="page-title flex items-center gap-2">
            <Inbox size={20} style={{ color: "var(--accent)" }} />
            Inbox
          </h1>
          <p className="text-xs mt-0.5" style={{ color: "var(--text-muted)" }}>
            {unreadCount > 0 ? `${unreadCount} new` : "All caught up"} - {activities.length} total activities
          </p>
        </div>
        {unreadCount > 0 && (
          <button onClick={markAllRead} className="btn btn-surface btn-xs">
            Mark all read
          </button>
        )}
      </div>

      {/* Filters */}
      <div className="flex items-center gap-1 mt-4 flex-wrap">
        <button
          onClick={() => setTypeFilter("all")}
          className={`px-2.5 py-1 rounded-lg text-[10px] transition-colors ${typeFilter === "all" ? "bg-[var(--accent)]/20 text-[var(--accent)]" : ""}`}
          style={typeFilter !== "all" ? { color: "var(--text-muted)" } : {}}
        >
          All
        </button>
        <button
          onClick={() => setTypeFilter("unread")}
          className={`px-2.5 py-1 rounded-lg text-[10px] transition-colors ${typeFilter === "unread" ? "bg-[var(--accent)]/20 text-[var(--accent)]" : ""}`}
          style={typeFilter !== "unread" ? { color: "var(--text-muted)" } : {}}
        >
          Unread ({unreadCount})
        </button>
        {types.map((t) => {
          const cfg = getConfig(t);
          return (
            <button
              key={t}
              onClick={() => setTypeFilter(typeFilter === t ? "all" : t)}
              className={`px-2.5 py-1 rounded-lg text-[10px] transition-colors ${typeFilter === t ? "bg-[var(--accent)]/20 text-[var(--accent)]" : ""}`}
              style={typeFilter !== t ? { color: "var(--text-muted)" } : {}}
            >
              {cfg.label}
            </button>
          );
        })}
      </div>

      {/* Activity feed */}
      <div className="mt-4 space-y-4">
        {Object.keys(grouped).length === 0 && (
          <div className="surface p-8 text-center">
            <Inbox size={32} className="mx-auto mb-2" style={{ color: "var(--text-muted)", opacity: 0.3 }} />
            <p className="text-xs" style={{ color: "var(--text-muted)" }}>
              {typeFilter === "unread" ? "No unread items" : "No activity yet"}
            </p>
          </div>
        )}

        {Object.entries(grouped).map(([dateLabel, items]) => (
          <div key={dateLabel}>
            <h3 className="text-[10px] uppercase tracking-wider mb-1.5 px-1" style={{ color: "var(--text-muted)" }}>
              {dateLabel}
            </h3>
            <div className="space-y-0.5">
              {items.map((activity) => {
                const cfg = getConfig(activity.type);
                const Icon = cfg.icon;
                const isUnread = !read.has(activity.id);
                const hasEntity = activity.entity_id && activity.entity_type;

                return (
                  <div
                    key={activity.id}
                    onClick={() => {
                      if (hasEntity) navigateToEntity(activity);
                      else setRead((s) => { const n = new Set(s); n.add(activity.id); return n; });
                    }}
                    className={`flex items-start gap-2.5 px-3 py-2 rounded-lg transition-colors group ${hasEntity ? "cursor-pointer hover:bg-white/[0.03]" : ""} ${isUnread ? "bg-[var(--accent)]/[0.03]" : ""}`}
                  >
                    {/* Unread dot */}
                    <div className="w-1.5 h-1.5 rounded-full mt-1.5 shrink-0" style={{ backgroundColor: isUnread ? "var(--accent)" : "transparent" }} />

                    {/* Icon */}
                    <Icon size={14} className={`${cfg.color} mt-0.5 shrink-0`} />

                    {/* Content */}
                    <div className="flex-1 min-w-0">
                      <div className="text-xs" style={{ color: isUnread ? "var(--text-primary)" : "var(--text-secondary)" }}>
                        {activity.title}
                      </div>
                      {activity.description && (
                        <div className="text-[10px] mt-0.5 line-clamp-2" style={{ color: "var(--text-muted)" }}>
                          {activity.description}
                        </div>
                      )}
                    </div>

                    {/* Time */}
                    <span className="text-[10px] shrink-0 mt-0.5" style={{ color: "var(--text-muted)" }}>
                      {new Date(activity.created_at).toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit" })}
                    </span>
                  </div>
                );
              })}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
