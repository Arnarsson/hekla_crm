"use client";

import Link from "next/link";
import type { Deal, DealStage } from "@/lib/types";

const STAGE_LABELS: Record<DealStage, string> = {
  lead: "Lead",
  qualified: "Qualified",
  proposal: "Proposal",
  negotiation: "Negotiation",
  closed_won: "Won",
  closed_lost: "Lost",
};

const STAGE_COLORS: Record<DealStage, string> = {
  lead: "border-t-zinc-500",
  qualified: "border-t-blue-500",
  proposal: "border-t-yellow-500",
  negotiation: "border-t-orange-500",
  closed_won: "border-t-green-500",
  closed_lost: "border-t-red-500",
};

interface Props {
  deals: Deal[];
  stages: DealStage[];
  onStageChange: (dealId: string, newStage: DealStage) => void;
}

export default function DealKanban({ deals, stages, onStageChange }: Props) {
  return (
    <div className="grid grid-cols-6 gap-3">
      {stages.map((stage) => {
        const stageDeals = deals.filter((d) => d.stage === stage);
        const stageValue = stageDeals.reduce((s, d) => s + (d.value || 0), 0);

        return (
          <div key={stage} className={`glass-card border-t-2 ${STAGE_COLORS[stage]} p-3`}>
            <div className="flex items-center justify-between mb-3">
              <span className="text-xs font-semibold text-zinc-400 uppercase">{STAGE_LABELS[stage]}</span>
              <span className="text-xs text-zinc-600">{stageDeals.length}</span>
            </div>
            {stageValue > 0 && (
              <div className="text-xs text-zinc-500 mb-3">${stageValue.toLocaleString()}</div>
            )}
            <div className="space-y-2">
              {stageDeals.map((deal) => (
                <div key={deal.id} className="p-3 rounded-lg bg-zinc-900/50 border border-zinc-800 hover:border-zinc-700 transition-colors">
                  <Link href={`/deals/${deal.id}`} className="text-sm text-white hover:text-brand-400 transition-colors font-medium block">
                    {deal.title}
                  </Link>
                  {deal.value && (
                    <div className="text-xs text-green-400 mt-1">${deal.value.toLocaleString()}</div>
                  )}
                  <div className="text-xs text-zinc-500 mt-1">{deal.win_probability}% win</div>
                  {deal.owner && <div className="text-xs text-zinc-600 mt-1">{deal.owner}</div>}
                  <select
                    value={deal.stage}
                    onChange={(e) => onStageChange(deal.id, e.target.value as DealStage)}
                    className="mt-2 w-full px-2 py-1 bg-zinc-800 border border-zinc-700 rounded text-xs text-zinc-400 focus:outline-none focus:border-brand-500"
                  >
                    {stages.map((s) => (
                      <option key={s} value={s}>{STAGE_LABELS[s]}</option>
                    ))}
                  </select>
                </div>
              ))}
              {stageDeals.length === 0 && (
                <div className="text-xs text-zinc-700 text-center py-4">No deals</div>
              )}
            </div>
          </div>
        );
      })}
    </div>
  );
}
