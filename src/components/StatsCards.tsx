"use client";

import { useEffect, useState } from "react";
import { FileText, Users, AlertTriangle, CheckSquare, Bot, TrendingUp, UserCircle, Kanban, DollarSign, ListTodo } from "lucide-react";
import type { DashboardStats } from "@/lib/types";

export default function StatsCards() {
  const [stats, setStats] = useState<DashboardStats | null>(null);

  useEffect(() => {
    fetch("/api/pipelines?stats=true")
      .then((r) => r.json())
      .then(setStats)
      .catch(console.error);
  }, []);

  if (!stats) {
    return (
      <div className="grid grid-cols-2 md:grid-cols-5 lg:grid-cols-10 gap-3">
        {Array.from({ length: 10 }).map((_, i) => (
          <div key={i} className="glass-card p-3 animate-pulse">
            <div className="h-3 bg-zinc-800 rounded w-16 mb-2" />
            <div className="h-6 bg-zinc-800 rounded w-10" />
          </div>
        ))}
      </div>
    );
  }

  const cards = [
    { label: "Extractions", value: stats.total_extractions, icon: FileText, color: "text-brand-400" },
    { label: "Prospects", value: stats.total_prospects, icon: TrendingUp, color: "text-blue-400" },
    { label: "Hot", value: stats.hot_prospects, icon: TrendingUp, color: "text-green-400" },
    { label: "Actions", value: stats.open_actions, icon: CheckSquare, color: "text-yellow-400" },
    { label: "Risks", value: stats.high_risks, icon: AlertTriangle, color: "text-red-400" },
    { label: "Contacts", value: stats.total_contacts, icon: UserCircle, color: "text-cyan-400" },
    { label: "Deals", value: stats.active_deals, icon: Kanban, color: "text-purple-400" },
    { label: "Pipeline $", value: stats.pipeline_value ? `$${(stats.pipeline_value / 1000).toFixed(0)}k` : "$0", icon: DollarSign, color: "text-green-400" },
    { label: "Tasks", value: stats.pending_tasks, icon: ListTodo, color: "text-orange-400" },
    { label: "Agents", value: stats.active_agents, icon: Bot, color: "text-zinc-400" },
  ];

  return (
    <div className="grid grid-cols-2 md:grid-cols-5 lg:grid-cols-10 gap-3">
      {cards.map((card) => {
        const Icon = card.icon;
        return (
          <div key={card.label} className="glass-card p-3 fade-in">
            <div className="flex items-center gap-1.5 mb-1.5">
              <Icon size={12} className={card.color} />
              <span className="text-[10px] text-zinc-500 uppercase tracking-wider">{card.label}</span>
            </div>
            <div className="text-lg font-bold text-white">{card.value}</div>
          </div>
        );
      })}
    </div>
  );
}
