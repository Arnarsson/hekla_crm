"use client";

import { Suspense, useEffect, useState } from "react";
import { useSearchParams } from "next/navigation";
import { Flame, ScrollText, Clock, AlertTriangle, CheckCircle, UserCircle, Briefcase } from "lucide-react";
import type { Activity } from "@/lib/types";

interface PartnerInfo { id: string; name: string; role: string }

const TYPE_ICONS: Record<string, typeof ScrollText> = {
  extraction: ScrollText,
  contact_created: UserCircle,
  deal_created: Briefcase,
  deal_stage_changed: Briefcase,
  task_completed: CheckCircle,
  alert: AlertTriangle,
};

export default function SharedPage() {
  return <Suspense fallback={<div className="min-h-screen flex items-center justify-center"><div className="w-4 h-4 border-2 border-brand-500 border-t-transparent rounded-full animate-spin" /></div>}><SharedContent /></Suspense>;
}

function SharedContent() {
  const params = useSearchParams();
  const token = params.get("token") || "";
  const [partner, setPartner] = useState<PartnerInfo | null>(null);
  const [error, setError] = useState("");
  const [activities, setActivities] = useState<Activity[]>([]);
  const [loading, setLoading] = useState(true);
  const [typeFilter, setTypeFilter] = useState<string>("all");

  useEffect(() => {
    if (!token) { setError("Access token required. Add ?token=YOUR_TOKEN to the URL."); setLoading(false); return; }

    fetch(`/api/partners?token=${token}`)
      .then((r) => { if (!r.ok) throw new Error("Invalid token"); return r.json(); })
      .then((p) => {
        setPartner(p);
        return fetch("/api/activities?limit=100");
      })
      .then((r) => r.json())
      .then(setActivities)
      .catch(() => setError("Invalid or expired access token."))
      .finally(() => setLoading(false));
  }, [token]);

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="w-4 h-4 border-2 border-brand-500 border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="surface p-8 max-w-sm text-center">
          <Flame size={32} className="text-brand-400 mx-auto mb-4" />
          <h1 className="text-lg font-bold text-white mb-2">Hekla Mission Control</h1>
          <p className="text-sm text-red-400">{error}</p>
        </div>
      </div>
    );
  }

  const filtered = activities.filter((a) => typeFilter === "all" || a.type === typeFilter);
  const types = ["all", ...Array.from(new Set(activities.map((a) => a.type)))];

  return (
    <div className="min-h-screen p-6">
      <div className="max-w-4xl mx-auto space-y-5">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-brand-500 to-brand-700 flex items-center justify-center">
              <Flame size={16} className="text-white" />
            </div>
            <div>
              <h1 className="text-lg font-bold text-white">Activity Log</h1>
              <span className="text-[10px] text-zinc-500">Hekla Mission Control · Shared view</span>
            </div>
          </div>
          <div className="text-right">
            <span className="text-xs text-zinc-400">{partner?.name}</span>
            <span className="block text-[10px] text-zinc-600">{partner?.role}</span>
          </div>
        </div>

        {/* Filters */}
        <div className="flex gap-1 flex-wrap">
          {types.map((t) => (
            <button key={t} onClick={() => setTypeFilter(t)} className={`px-2.5 py-1 rounded-lg text-[10px] capitalize transition-colors ${typeFilter === t ? "bg-brand-600/20 text-brand-400" : "text-zinc-600 hover:text-zinc-400"}`}>
              {t.replace("_", " ")}
            </button>
          ))}
        </div>

        {/* Activity list */}
        <div className="space-y-1.5">
          {filtered.map((a) => {
            const Icon = TYPE_ICONS[a.type] || Clock;
            return (
              <div key={a.id} className="surface p-3 flex items-start gap-3">
                <Icon size={14} className="text-zinc-500 mt-0.5 shrink-0" />
                <div className="flex-1 min-w-0">
                  <span className="text-xs text-white">{a.title}</span>
                  {a.description && <p className="text-[10px] text-zinc-600 mt-0.5">{a.description}</p>}
                </div>
                <span className="text-[9px] text-zinc-700 shrink-0">{new Date(a.created_at).toLocaleString()}</span>
              </div>
            );
          })}
          {filtered.length === 0 && (
            <div className="text-center py-8 text-xs text-zinc-600">No activity to display.</div>
          )}
        </div>
      </div>
    </div>
  );
}
