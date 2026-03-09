"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import {
  Scan, ArrowRight, CheckCircle, Phone, Mail, Clock, AlertTriangle,
  TrendingDown, Zap, ChevronRight, ExternalLink, Upload, Plus, Trash2,
} from "lucide-react";
import type { Task, Contact, Deal, Activity } from "@/lib/types";

export default function DashboardPage() {
  const [tasks, setTasks] = useState<Task[]>([]);
  const [contacts, setContacts] = useState<Contact[]>([]);
  const [deals, setDeals] = useState<Deal[]>([]);
  const [alerts, setAlerts] = useState<Activity[]>([]);
  const [scanning, setScanning] = useState(false);
  const [quickTask, setQuickTask] = useState("");
  const [toast, setToast] = useState<string | null>(null);

  const load = () => {
    fetch("/api/tasks").then((r) => r.json()).then(setTasks).catch(console.error);
    fetch("/api/contacts").then((r) => r.json()).then(setContacts).catch(console.error);
    fetch("/api/deals").then((r) => r.json()).then(setDeals).catch(console.error);
    fetch("/api/activities?limit=20&type=alert").then((r) => r.json()).then(setAlerts).catch(console.error);
  };
  useEffect(load, []);
  useEffect(() => { if (!toast) return; const t = setTimeout(() => setToast(null), 2000); return () => clearTimeout(t); }, [toast]);

  const flash = (msg: string) => setToast(msg);

  const handleScan = async () => { setScanning(true); await fetch("/api/scan", { method: "POST" }); setScanning(false); load(); flash("Scan complete"); };

  const completeTask = async (id: string, title: string) => {
    await fetch(`/api/tasks/${id}`, { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ status: "completed" }) });
    setTasks((t) => t.filter((x) => x.id !== id));
    flash(`Done: ${title}`);
  };

  const deleteTask = async (id: string) => {
    await fetch(`/api/tasks/${id}`, { method: "DELETE" });
    setTasks((t) => t.filter((x) => x.id !== id));
  };

  const advanceDeal = async (deal: Deal) => {
    const order = ["lead", "qualified", "proposal", "negotiation", "closed_won"] as const;
    const idx = order.indexOf(deal.stage as typeof order[number]);
    if (idx < 0 || idx >= order.length - 1) return;
    const next = order[idx + 1];
    await fetch(`/api/deals/${deal.id}`, { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ stage: next }) });
    setDeals((ds) => ds.map((d) => d.id === deal.id ? { ...d, stage: next } : d));
    flash(`${deal.title} → ${next}`);
  };

  const logInteraction = async (contact: Contact, type: string) => {
    await fetch(`/api/contacts/${contact.id}`, { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ last_interaction: new Date().toISOString() }) });
    await fetch(`/api/contacts/${contact.id}`, { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ _action: "add_note", text: `Logged ${type}` }) });
    setContacts((cs) => cs.map((c) => c.id === contact.id ? { ...c, last_interaction: new Date().toISOString() } : c));
    flash(`Logged ${type} with ${contact.name}`);
  };

  const addQuickTask = async () => {
    if (!quickTask.trim()) return;
    await fetch("/api/tasks", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ title: quickTask, priority: "medium", source: "manual" }) });
    setQuickTask("");
    load();
    flash("Task created");
  };

  const now = new Date();
  const overdueTasks = tasks.filter((t) => t.status !== "completed" && t.status !== "cancelled" && t.deadline && new Date(t.deadline) < now);
  const todayTasks = tasks.filter((t) => t.status === "pending" || t.status === "in_progress").sort((a, b) => {
    const p = { high: 0, medium: 1, low: 2 };
    return (p[a.priority] || 1) - (p[b.priority] || 1);
  }).slice(0, 12);

  const staleContacts = contacts.filter((c) => {
    const days = Math.floor((now.getTime() - new Date(c.last_interaction).getTime()) / 86400000);
    return days > 7;
  }).sort((a, b) => new Date(a.last_interaction).getTime() - new Date(b.last_interaction).getTime()).slice(0, 6);

  const activeDeals = deals.filter((d) => d.stage !== "closed_won" && d.stage !== "closed_lost");
  const staleDeals = activeDeals.filter((d) => Math.floor((now.getTime() - new Date(d.updated_at).getTime()) / 86400000) > 7);
  const activeTasks = tasks.filter((t) => t.status === "pending" || t.status === "in_progress").length;
  const totalPipeline = activeDeals.reduce((s, d) => s + (d.value || 0), 0);

  return (
    <div className="page-container">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold" style={{ color: "var(--text-primary)" }}>Command Center</h1>
          <div className="flex items-center gap-4 mt-1 text-xs" style={{ color: "var(--text-muted)" }}>
            <span>{contacts.length} contacts</span>
            <span>{activeDeals.length} deals</span>
            <span>{activeTasks} tasks</span>
            {totalPipeline > 0 && <span className="text-green-400">${totalPipeline.toLocaleString()}</span>}
          </div>
        </div>
        <div className="flex gap-2">
          <Link href="/upload" className="flex items-center gap-2 px-3 py-1.5 rounded-lg btn btn-primary btn-xs transition-colors"><Upload size={12} /> Extract</Link>
          <button onClick={handleScan} disabled={scanning} className="flex items-center gap-2 px-3 py-1.5 rounded-lg btn btn-surface btn-xs transition-colors disabled:opacity-50">
            <Scan size={12} className={scanning ? "animate-spin" : ""} /> Scan
          </button>
        </div>
      </div>

      {/* Quick add bar */}
      <div className="flex gap-2">
        <input value={quickTask} onChange={(e) => setQuickTask(e.target.value)} onKeyDown={(e) => e.key === "Enter" && addQuickTask()}
          placeholder="Quick add task... (Enter)" className="flex-1 px-3 py-2 input text-xs" />
        <button onClick={addQuickTask} className="px-3 py-2 rounded-lg btn btn-surface btn-xs transition-colors"><Plus size={12} /></button>
      </div>

      {/* Overdue bar */}
      {overdueTasks.length > 0 && (
        <div className="bg-red-950/40 border border-red-900/50 rounded-lg p-2.5 flex items-center gap-3 flex-wrap">
          <AlertTriangle size={14} className="text-red-400 shrink-0" />
          <span className="text-xs text-red-300 font-medium">{overdueTasks.length} overdue</span>
          {overdueTasks.slice(0, 4).map((t) => (
            <div key={t.id} className="flex items-center gap-1.5">
              <span className="text-[10px] text-red-400 max-w-[120px] truncate">{t.title}</span>
              <button onClick={() => completeTask(t.id, t.title)} className="text-[9px] px-1.5 py-0.5 rounded bg-red-900/50 text-red-300 hover:bg-red-900 transition-colors">Done</button>
              <button onClick={() => deleteTask(t.id)} className="text-red-800 hover:text-red-400 transition-colors"><Trash2 size={9} /></button>
            </div>
          ))}
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        {/* Left: Queue + Outreach */}
        <div className="lg:col-span-2 space-y-4">
          {/* Priority Tasks */}
          <div className="surface p-4">
            <div className="flex items-center justify-between mb-2">
              <h2 className="text-[10px] font-semibold uppercase tracking-widest flex items-center gap-1.5" style={{ color: "var(--text-muted)" }}><Zap size={10} className="text-brand-400" /> Priority Queue</h2>
              <Link href="/tasks" className="text-[9px] text-zinc-600 hover:text-zinc-400 flex items-center gap-0.5">All <ChevronRight size={8} /></Link>
            </div>
            <div className="space-y-0.5">
              {todayTasks.length === 0 ? (
                <p className="text-xs text-zinc-600 py-3 text-center">No open tasks. <Link href="/upload" className="text-brand-400">Extract a conversation</Link> to generate.</p>
              ) : todayTasks.map((t) => (
                <div key={t.id} className="flex items-center gap-2 p-2 rounded-lg hover:bg-zinc-800/40 group transition-colors">
                  <button onClick={() => completeTask(t.id, t.title)} className="w-4 h-4 rounded border border-zinc-700 group-hover:border-brand-500 shrink-0 transition-colors hover:bg-brand-500/20" />
                  <span className="text-xs flex-1 min-w-0 truncate" style={{ color: "var(--text-primary)" }}>{t.title}</span>
                  {t.owner && <span className="text-[9px] text-zinc-700 max-w-[60px] truncate">{t.owner}</span>}
                  <span className={`text-[8px] px-1 py-0.5 rounded ${t.priority === "high" ? "bg-red-900/30 text-red-400" : t.priority === "medium" ? "bg-yellow-900/20 text-yellow-500" : "text-zinc-700"}`}>{t.priority}</span>
                  <button onClick={() => deleteTask(t.id)} className="opacity-0 group-hover:opacity-100 text-zinc-700 hover:text-red-400 transition-all"><Trash2 size={10} /></button>
                </div>
              ))}
            </div>
          </div>

          {/* Needs Outreach */}
          <div className="surface p-4">
            <div className="flex items-center justify-between mb-2">
              <h2 className="text-[10px] font-semibold uppercase tracking-widest flex items-center gap-1.5" style={{ color: "var(--text-muted)" }}><TrendingDown size={10} className="text-orange-400" /> Needs Outreach</h2>
              <Link href="/contacts" className="text-[9px] text-zinc-600 hover:text-zinc-400 flex items-center gap-0.5">All <ChevronRight size={8} /></Link>
            </div>
            {staleContacts.length === 0 ? (
              <p className="text-xs text-zinc-600 py-3 text-center">All contacts active.</p>
            ) : (
              <div className="space-y-1">
                {staleContacts.map((c) => {
                  const days = Math.floor((now.getTime() - new Date(c.last_interaction).getTime()) / 86400000);
                  return (
                    <div key={c.id} className="flex items-center gap-2 p-2 rounded-lg hover:bg-zinc-800/40 group transition-colors">
                      <div className="flex-1 min-w-0">
                        <Link href={`/contacts/${c.id}`} className="text-xs hover:text-brand-400 font-medium" style={{ color: "var(--text-primary)" }}>{c.name}</Link>
                        <span className="text-[9px] text-zinc-700 ml-1.5">{c.organization} · {days}d</span>
                      </div>
                      <div className="flex gap-0.5 shrink-0">
                        {c.email && <a href={`mailto:${c.email}`} onClick={() => logInteraction(c, "email")} className="w-6 h-6 rounded bg-zinc-800 hover:bg-brand-600/20 hover:text-brand-400 text-zinc-600 flex items-center justify-center transition-colors" title="Email"><Mail size={10} /></a>}
                        {c.phone && <a href={`tel:${c.phone}`} onClick={() => logInteraction(c, "call")} className="w-6 h-6 rounded bg-zinc-800 hover:bg-green-600/20 hover:text-green-400 text-zinc-600 flex items-center justify-center transition-colors" title="Call"><Phone size={10} /></a>}
                        <button onClick={() => logInteraction(c, "meeting")} className="w-6 h-6 rounded bg-zinc-800 hover:bg-purple-600/20 hover:text-purple-400 text-zinc-600 flex items-center justify-center transition-colors text-[8px] font-bold" title="Log meeting">M</button>
                        <Link href={`/contacts/${c.id}`} className="w-6 h-6 rounded bg-zinc-800 hover:bg-zinc-700 text-zinc-600 flex items-center justify-center transition-colors"><ExternalLink size={10} /></Link>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>

          {/* Stale Deals */}
          {staleDeals.length > 0 && (
            <div className="surface p-4">
              <div className="flex items-center justify-between mb-2">
                <h2 className="text-[10px] font-semibold uppercase tracking-widest flex items-center gap-1.5" style={{ color: "var(--text-muted)" }}><Clock size={10} className="text-yellow-400" /> Stale Deals</h2>
                <Link href="/deals" className="text-[9px] text-zinc-600 hover:text-zinc-400 flex items-center gap-0.5">Pipeline <ChevronRight size={8} /></Link>
              </div>
              <div className="space-y-1">
                {staleDeals.slice(0, 5).map((d) => {
                  const days = Math.floor((now.getTime() - new Date(d.updated_at).getTime()) / 86400000);
                  return (
                    <div key={d.id} className="flex items-center gap-2 p-2 rounded-lg hover:bg-zinc-800/40 group transition-colors">
                      <Link href={`/deals/${d.id}`} className="text-xs hover:text-brand-400 font-medium flex-1 truncate" style={{ color: "var(--text-primary)" }}>{d.title}</Link>
                      <span className="text-[9px] text-zinc-700">{d.stage.replace("_", " ")} · {days}d</span>
                      <button onClick={() => advanceDeal(d)} className="text-[9px] px-2 py-0.5 rounded bg-zinc-800 hover:bg-brand-600/20 hover:text-brand-400 transition-colors flex items-center gap-0.5" style={{ color: "var(--text-muted)" }}>Advance <ChevronRight size={7} /></button>
                    </div>
                  );
                })}
              </div>
            </div>
          )}
        </div>

        {/* Right: Pipeline + Alerts */}
        <div className="space-y-4">
          <div className="surface p-4">
            <h2 className="text-[10px] font-semibold uppercase tracking-widest mb-2" style={{ color: "var(--text-muted)" }}>Pipeline</h2>
            <div className="space-y-1.5">
              {(["lead", "qualified", "proposal", "negotiation"] as const).map((stage) => {
                const count = deals.filter((d) => d.stage === stage).length;
                if (count === 0) return null;
                const colors: Record<string, string> = { lead: "bg-zinc-500", qualified: "bg-blue-500", proposal: "bg-yellow-500", negotiation: "bg-orange-500" };
                return (
                  <Link key={stage} href="/deals" className="flex items-center gap-2 hover:bg-zinc-800/30 rounded p-1 transition-colors">
                    <div className={`w-1.5 h-1.5 rounded-full ${colors[stage]}`} />
                    <span className="text-[10px] text-zinc-400 capitalize flex-1">{stage}</span>
                    <span className="text-[10px] font-medium" style={{ color: "var(--text-primary)" }}>{count}</span>
                  </Link>
                );
              })}
              {deals.filter((d) => d.stage === "closed_won").length > 0 && (
                <div className="flex items-center gap-2 pt-1 border-t border-zinc-800 p-1">
                  <div className="w-1.5 h-1.5 rounded-full bg-green-500" />
                  <span className="text-[10px] text-green-400 flex-1">Won</span>
                  <span className="text-[10px] font-medium" style={{ color: "var(--text-primary)" }}>{deals.filter((d) => d.stage === "closed_won").length}</span>
                </div>
              )}
            </div>
          </div>

          {/* Quick links */}
          <div className="surface p-4 space-y-1">
            <Link href="/upload" className="flex items-center gap-2 p-2 rounded-lg bg-brand-600/10 hover:bg-brand-600/20 text-brand-400 text-xs transition-colors"><Upload size={12} /> Extract <ArrowRight size={10} className="ml-auto" /></Link>
            <Link href="/contacts" className="flex items-center gap-2 p-2 rounded-lg hover:bg-zinc-800/50 text-zinc-400 text-xs transition-colors"><Mail size={12} /> Contacts <ArrowRight size={10} className="ml-auto" /></Link>
            <Link href="/deals" className="flex items-center gap-2 p-2 rounded-lg hover:bg-zinc-800/50 text-zinc-400 text-xs transition-colors"><Zap size={12} /> Deals <ArrowRight size={10} className="ml-auto" /></Link>
            <Link href="/logs" className="flex items-center gap-2 p-2 rounded-lg hover:bg-zinc-800/50 text-zinc-400 text-xs transition-colors"><Clock size={12} /> Activity Log <ArrowRight size={10} className="ml-auto" /></Link>
          </div>

          {alerts.length > 0 && (
            <div className="surface p-4 border-l-2 border-l-yellow-500">
              <h2 className="text-[10px] font-semibold uppercase tracking-widest mb-2" style={{ color: "var(--text-muted)" }}>Alerts</h2>
              <div className="space-y-1.5">
                {alerts.slice(0, 5).map((a) => (
                  <div key={a.id} className="text-[10px]">
                    <span className="text-zinc-400">{a.title}</span>
                    {a.entity_id && a.entity_type && (
                      <Link href={`/${a.entity_type === "contact" ? "contacts" : a.entity_type === "deal" ? "deals" : "tasks"}/${a.entity_id}`} className="text-brand-400 hover:text-brand-300 ml-1">→</Link>
                    )}
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>

      {toast && <div className="toast">{toast}</div>}
    </div>
  );
}
