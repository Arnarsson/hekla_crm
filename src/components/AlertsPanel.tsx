"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import type { Activity } from "@/lib/types";
import { AlertTriangle, Clock, TrendingDown, Bell } from "lucide-react";

export default function AlertsPanel() {
  const [alerts, setAlerts] = useState<Activity[]>([]);

  useEffect(() => {
    fetch("/api/activities?limit=10&type=alert")
      .then((r) => r.json())
      .then(setAlerts)
      .catch(console.error);
  }, []);

  if (alerts.length === 0) return null;

  return (
    <div className="glass-card p-5 border-l-2 border-l-yellow-500">
      <h3 className="text-sm font-semibold text-white flex items-center gap-2 mb-4">
        <Bell size={16} className="text-yellow-400" />
        Alerts
        <span className="text-xs bg-yellow-900/30 text-yellow-400 px-2 py-0.5 rounded-full">{alerts.length}</span>
      </h3>
      <div className="space-y-2">
        {alerts.slice(0, 5).map((a) => {
          const icon = a.title.includes("Overdue") ? Clock : a.title.includes("decay") ? TrendingDown : AlertTriangle;
          const Icon = icon;
          return (
            <div key={a.id} className="flex items-start gap-3 p-3 rounded-lg bg-zinc-900/50 border border-zinc-800">
              <Icon size={14} className="text-yellow-400 mt-0.5 shrink-0" />
              <div className="flex-1 min-w-0">
                <div className="text-sm text-white">{a.title}</div>
                <div className="text-xs text-zinc-500 mt-0.5">{a.description}</div>
              </div>
              {a.entity_id && a.entity_type && (
                <Link
                  href={`/${a.entity_type === "task" ? "tasks" : a.entity_type === "deal" ? "deals" : a.entity_type === "contact" ? "contacts" : "pipelines"}/${a.entity_type === "task" ? "" : a.entity_id}`}
                  className="text-xs text-brand-400 hover:text-brand-300 whitespace-nowrap"
                >
                  View
                </Link>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
