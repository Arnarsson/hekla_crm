"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import type { Deal, DealStage } from "@/lib/types";
import { DollarSign, TrendingUp, Briefcase, ChevronRight, ExternalLink, Trash2, X } from "lucide-react";

const STAGES: DealStage[] = ["lead", "qualified", "proposal", "negotiation", "closed_won", "closed_lost"];
const STAGE_LABELS: Record<DealStage, string> = { lead: "Lead", qualified: "Qualified", proposal: "Proposal", negotiation: "Negotiation", closed_won: "Won", closed_lost: "Lost" };
const STAGE_COLORS: Record<DealStage, string> = { lead: "border-t-zinc-500", qualified: "border-t-blue-500", proposal: "border-t-yellow-500", negotiation: "border-t-orange-500", closed_won: "border-t-green-500", closed_lost: "border-t-red-500" };

export default function DealsPage() {
  const [deals, setDeals] = useState<Deal[]>([]);
  const [view, setView] = useState<"kanban" | "list">("kanban");

  useEffect(() => { fetch("/api/deals").then((r) => r.json()).then(setDeals).catch(console.error); }, []);

  const activeDeals = deals.filter((d) => d.stage !== "closed_won" && d.stage !== "closed_lost");
  const totalValue = activeDeals.reduce((s, d) => s + (d.value || 0), 0);
  const weightedValue = activeDeals.reduce((s, d) => s + (d.value || 0) * (d.win_probability / 100), 0);
  const now = new Date();

  const handleStageChange = async (dealId: string, newStage: DealStage) => {
    const res = await fetch(`/api/deals/${dealId}`, { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ stage: newStage }) });
    if (res.ok) setDeals(deals.map((d) => d.id === dealId ? { ...d, stage: newStage } : d));
  };

  const advanceDeal = (deal: Deal) => {
    const order: DealStage[] = ["lead", "qualified", "proposal", "negotiation", "closed_won"];
    const idx = order.indexOf(deal.stage);
    if (idx >= 0 && idx < order.length - 1) handleStageChange(deal.id, order[idx + 1]);
  };

  const deleteDeal = async (id: string) => {
    await fetch(`/api/deals/${id}`, { method: "DELETE" });
    setDeals((ds) => ds.filter((d) => d.id !== id));
  };

  const loseDeal = async (id: string) => handleStageChange(id, "closed_lost");

  return (
    <div className="page-container">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold text-white">Deal Pipeline</h1>
          <p className="text-xs text-zinc-500 mt-0.5">{activeDeals.length} active deals</p>
        </div>
        <div className="flex gap-1">
          <button onClick={() => setView("kanban")} className={`px-2.5 py-1 rounded-lg text-[10px] transition-colors ${view === "kanban" ? "bg-brand-600/20 text-brand-400" : "text-zinc-600"}`}>Kanban</button>
          <button onClick={() => setView("list")} className={`px-2.5 py-1 rounded-lg text-[10px] transition-colors ${view === "list" ? "bg-brand-600/20 text-brand-400" : "text-zinc-600"}`}>List</button>
        </div>
      </div>

      {/* Summary row */}
      <div className="grid grid-cols-3 gap-3">
        <div className="surface p-3 flex items-center gap-3">
          <Briefcase size={14} className="text-brand-400" />
          <div><div className="text-[10px] text-zinc-500 uppercase">Active</div><div className="text-lg font-bold text-white">{activeDeals.length}</div></div>
        </div>
        <div className="surface p-3 flex items-center gap-3">
          <DollarSign size={14} className="text-green-400" />
          <div><div className="text-[10px] text-zinc-500 uppercase">Pipeline</div><div className="text-lg font-bold text-white">${totalValue.toLocaleString()}</div></div>
        </div>
        <div className="surface p-3 flex items-center gap-3">
          <TrendingUp size={14} className="text-yellow-400" />
          <div><div className="text-[10px] text-zinc-500 uppercase">Weighted</div><div className="text-lg font-bold text-white">${Math.round(weightedValue).toLocaleString()}</div></div>
        </div>
      </div>

      {view === "kanban" ? (
        <div className="grid grid-cols-6 gap-2">
          {STAGES.map((stage) => {
            const stageDeals = deals.filter((d) => d.stage === stage);
            return (
              <div key={stage} className={`surface border-t-2 ${STAGE_COLORS[stage]} p-2`}>
                <div className="flex items-center justify-between mb-2">
                  <span className="text-[10px] font-semibold text-zinc-400 uppercase">{STAGE_LABELS[stage]}</span>
                  <span className="text-[10px] text-zinc-600">{stageDeals.length}</span>
                </div>
                <div className="space-y-1.5">
                  {stageDeals.map((deal) => {
                    const days = Math.floor((now.getTime() - new Date(deal.updated_at).getTime()) / 86400000);
                    const isStale = days > 14 && stage !== "closed_won" && stage !== "closed_lost";
                    return (
                      <div key={deal.id} className={`p-2.5 rounded-lg bg-zinc-900/50 border transition-colors group ${isStale ? "border-orange-900/40" : "border-zinc-800 hover:border-zinc-700"}`}>
                        <Link href={`/deals/${deal.id}`} className="text-xs text-white hover:text-brand-400 transition-colors font-medium block truncate">{deal.title}</Link>
                        <div className="flex items-center justify-between mt-1.5">
                          <span className="text-[10px] text-zinc-500">{deal.win_probability}%</span>
                          {isStale && <span className="text-[8px] text-orange-400">stale</span>}
                        </div>
                        {deal.owner && <div className="text-[9px] text-zinc-600 mt-0.5">{deal.owner}</div>}
                        {/* Quick actions */}
                        {stage !== "closed_won" && stage !== "closed_lost" && (
                          <div className="mt-1.5 flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                            <button onClick={() => advanceDeal(deal)} className="flex-1 text-[9px] px-2 py-1 rounded bg-zinc-800 hover:bg-brand-600/20 text-zinc-500 hover:text-brand-400 transition-colors flex items-center justify-center gap-0.5">
                              Advance <ChevronRight size={7} />
                            </button>
                            <button onClick={() => loseDeal(deal.id)} className="text-[9px] px-1.5 py-1 rounded bg-zinc-800 hover:bg-red-900/20 text-zinc-600 hover:text-red-400 transition-colors" title="Mark lost">
                              <X size={9} />
                            </button>
                            <button onClick={() => deleteDeal(deal.id)} className="text-[9px] px-1.5 py-1 rounded bg-zinc-800 hover:bg-red-900/30 text-zinc-700 hover:text-red-400 transition-colors" title="Delete">
                              <Trash2 size={9} />
                            </button>
                          </div>
                        )}
                      </div>
                    );
                  })}
                  {stageDeals.length === 0 && <div className="text-[10px] text-zinc-700 text-center py-3">—</div>}
                </div>
              </div>
            );
          })}
        </div>
      ) : (
        <div className="surface overflow-hidden">
          <table className="data-table">
            <thead>
              <tr>
                <th>Deal</th>
                <th>Stage</th>
                <th>Win %</th>
                <th>Owner</th>
                <th>Next Action</th>
                <th>Updated</th>
                <th className="w-24">Action</th>
              </tr>
            </thead>
            <tbody>
              {activeDeals.sort((a, b) => b.win_probability - a.win_probability).map((deal) => {
                const days = Math.floor((now.getTime() - new Date(deal.updated_at).getTime()) / 86400000);
                return (
                  <tr key={deal.id}>
                    <td>
                      <Link href={`/deals/${deal.id}`} className="text-sm text-white hover:text-brand-400 font-medium">{deal.title}</Link>
                    </td>
                    <td>
                      <select value={deal.stage} onChange={(e) => handleStageChange(deal.id, e.target.value as DealStage)} className="input text-xs">
                        {STAGES.map((s) => <option key={s} value={s}>{STAGE_LABELS[s]}</option>)}
                      </select>
                    </td>
                    <td><span className="text-xs text-zinc-300">{deal.win_probability}%</span></td>
                    <td><span className="text-xs text-zinc-500">{deal.owner || "—"}</span></td>
                    <td><span className="text-xs text-zinc-500 max-w-[200px] truncate block">{deal.next_action || "—"}</span></td>
                    <td><span className={`text-[10px] ${days > 14 ? "text-orange-400" : "text-zinc-600"}`}>{days}d ago</span></td>
                    <td>
                      <div className="flex gap-1">
                        <button onClick={() => advanceDeal(deal)} className="text-[9px] px-2 py-1 rounded bg-zinc-800 hover:bg-brand-600/20 text-zinc-500 hover:text-brand-400 transition-colors flex items-center gap-0.5">
                          Advance <ChevronRight size={8} />
                        </button>
                        <button onClick={() => handleStageChange(deal.id, "closed_won")} className="text-[9px] px-2 py-1 rounded bg-zinc-800 hover:bg-green-900/20 text-zinc-600 hover:text-green-400 transition-colors">Won</button>
                        <button onClick={() => loseDeal(deal.id)} className="text-[9px] px-2 py-1 rounded bg-zinc-800 hover:bg-orange-900/20 text-zinc-600 hover:text-orange-400 transition-colors">Lost</button>
                        <button onClick={() => deleteDeal(deal.id)} className="text-[9px] px-1.5 py-1 rounded bg-zinc-800 hover:bg-red-900/30 text-zinc-700 hover:text-red-400 transition-colors"><Trash2 size={9} /></button>
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
