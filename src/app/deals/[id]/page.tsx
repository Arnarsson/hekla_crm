"use client";

import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import Link from "next/link";
import { ArrowLeft, DollarSign } from "lucide-react";
import type { Deal, DealStage, Contact } from "@/lib/types";

const STAGES: DealStage[] = ["lead", "qualified", "proposal", "negotiation", "closed_won", "closed_lost"];
const STAGE_COLORS: Record<string, string> = {
  lead: "bg-zinc-800 text-zinc-400",
  qualified: "bg-blue-900/30 text-blue-400",
  proposal: "bg-yellow-900/30 text-yellow-400",
  negotiation: "bg-orange-900/30 text-orange-400",
  closed_won: "bg-green-900/30 text-green-400",
  closed_lost: "bg-red-900/30 text-red-400",
};

export default function DealDetailPage() {
  const { id } = useParams();
  const router = useRouter();
  const [deal, setDeal] = useState<Deal | null>(null);
  const [contacts, setContacts] = useState<Contact[]>([]);

  useEffect(() => {
    fetch(`/api/deals/${id}`).then((r) => r.json()).then(setDeal).catch(console.error);
    fetch("/api/contacts").then((r) => r.json()).then(setContacts).catch(console.error);
  }, [id]);

  const handleStageChange = async (stage: DealStage) => {
    const res = await fetch(`/api/deals/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ stage }),
    });
    if (res.ok) setDeal(await res.json());
  };

  if (!deal) {
    return (
      <div className="page-container">
        <div className="surface p-8 text-center text-zinc-500">Loading...</div>
      </div>
    );
  }

  const linkedContacts = contacts.filter((c) => deal.contact_ids.includes(c.id));

  return (
    <div className="page-container">
      <button onClick={() => router.back()} className="flex items-center gap-2 text-sm text-zinc-500 hover:text-zinc-300 transition-colors">
        <ArrowLeft size={16} /> Back
      </button>

      <div className="surface p-6">
        <h1 className="text-2xl font-bold text-white">{deal.title}</h1>
        <div className="flex items-center gap-4 mt-3">
          {deal.value && (
            <span className="flex items-center gap-1 text-lg text-green-400">
              <DollarSign size={18} /> {deal.currency} {deal.value.toLocaleString()}
            </span>
          )}
          <span className="text-sm text-zinc-500">Win: {deal.win_probability}%</span>
          <span className="text-sm text-zinc-500">Owner: {deal.owner}</span>
        </div>

        <div className="mt-4">
          <span className="text-xs text-zinc-500 block mb-2">Stage</span>
          <div className="flex gap-1">
            {STAGES.map((s) => (
              <button key={s} onClick={() => handleStageChange(s)} className={`px-3 py-1.5 rounded-lg text-xs capitalize transition-colors ${deal.stage === s ? STAGE_COLORS[s] : "text-zinc-600 hover:text-zinc-400"}`}>
                {s.replace("_", " ")}
              </button>
            ))}
          </div>
        </div>

        {deal.next_action && (
          <div className="mt-4">
            <span className="text-xs text-zinc-500">Next Action</span>
            <p className="text-sm text-white mt-1">{deal.next_action}</p>
          </div>
        )}
        {deal.deadline && (
          <div className="mt-2">
            <span className="text-xs text-zinc-500">Deadline</span>
            <p className="text-sm text-white mt-1">{deal.deadline}</p>
          </div>
        )}
      </div>

      {linkedContacts.length > 0 && (
        <div className="surface p-5">
          <h3 className="text-sm font-semibold text-white mb-3">Linked Contacts</h3>
          <div className="space-y-2">
            {linkedContacts.map((c) => (
              <Link key={c.id} href={`/contacts/${c.id}`} className="block p-3 rounded-lg border border-zinc-800 hover:border-zinc-700 transition-colors">
                <span className="text-sm text-white">{c.name}</span>
                <span className="text-xs text-zinc-500 ml-2">{c.organization} — {c.role}</span>
              </Link>
            ))}
          </div>
        </div>
      )}

      {deal.pricing_terms.length > 0 && (
        <div className="surface p-5">
          <h3 className="text-sm font-semibold text-white mb-3">Pricing Terms</h3>
          <table className="data-table">
            <thead><tr><th>Item</th><th>Terms</th><th>Proposed By</th><th>Agreed</th></tr></thead>
            <tbody>
              {deal.pricing_terms.map((p, i) => (
                <tr key={i}><td className="text-white">{p.item}</td><td className="text-zinc-400">{p.proposed_terms}</td><td className="text-zinc-400">{p.who_proposed}</td><td className="text-zinc-400">{p.agreed}</td></tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {deal.agreements.length > 0 && (
        <div className="surface p-5">
          <h3 className="text-sm font-semibold text-white mb-3">Agreements</h3>
          <div className="space-y-2">
            {deal.agreements.map((a, i) => (
              <div key={i} className="p-3 rounded-lg border border-zinc-800">
                <span className="text-sm text-white">{a.decision}</span>
                <span className="block text-xs text-zinc-500">By: {a.who_agreed} — Binding: {a.binding}</span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
