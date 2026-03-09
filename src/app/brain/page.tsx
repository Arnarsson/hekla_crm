"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Brain, Search, FileText, Users, Handshake, Zap, Clock } from "lucide-react";

interface ExtractionSummary {
  id: string;
  source_filename: string;
  source_type: string;
  executive_summary: string;
  created_at: string;
  prospect_count: number;
  contact_count: number;
  action_count: number;
}

interface BrainStatus {
  online: boolean;
}

export default function BrainPage() {
  const router = useRouter();
  const [extractions, setExtractions] = useState<ExtractionSummary[]>([]);
  const [stats, setStats] = useState({ contacts: 0, deals: 0, tasks: 0, extractions: 0 });
  const [brainStatus, setBrainStatus] = useState<BrainStatus | null>(null);
  const [search, setSearch] = useState("");
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    Promise.all([
      fetch("/api/pipelines").then((r) => r.json()),
      fetch("/api/contacts").then((r) => r.json()),
      fetch("/api/deals").then((r) => r.json()),
      fetch("/api/tasks").then((r) => r.json()),
      fetch("/api/brain").then((r) => r.json()).catch(() => ({ online: false })),
    ]).then(([exts, contacts, deals, tasks, brain]) => {
      const summaries: ExtractionSummary[] = (exts || []).map((e: Record<string, unknown>) => ({
        id: e.id,
        source_filename: e.source_filename || "Unknown",
        source_type: e.source_type || "other",
        executive_summary: e.executive_summary || "",
        created_at: e.created_at || "",
        prospect_count: (e.prospects as unknown[] || []).length,
        contact_count: (e.relationships as unknown[] || []).length,
        action_count: (e.action_items as unknown[] || []).length,
      }));
      summaries.sort((a, b) => b.created_at.localeCompare(a.created_at));
      setExtractions(summaries);
      setStats({
        contacts: (contacts || []).length,
        deals: (deals || []).length,
        tasks: (tasks || []).length,
        extractions: summaries.length,
      });
      setBrainStatus(brain);
      setLoading(false);
    }).catch(() => setLoading(false));
  }, []);

  const filtered = search.trim()
    ? extractions.filter((e) =>
        e.source_filename.toLowerCase().includes(search.toLowerCase()) ||
        e.executive_summary.toLowerCase().includes(search.toLowerCase())
      )
    : extractions;

  if (loading) {
    return (
      <div className="page-container">
        <div className="text-sm" style={{ color: "var(--text-muted)" }}>Loading brain...</div>
      </div>
    );
  }

  return (
    <div className="page-container">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="page-title flex items-center gap-2">
            <Brain size={20} style={{ color: "var(--accent)" }} />
            Brain
          </h1>
          <p className="text-xs mt-0.5" style={{ color: "var(--text-muted)" }}>
            Intelligence from {stats.extractions} conversations
          </p>
        </div>
        <div className="flex items-center gap-2">
          <div className={`w-2 h-2 rounded-full ${brainStatus?.online ? "bg-green-500" : "bg-zinc-600"}`} />
          <span className="text-[10px]" style={{ color: "var(--text-muted)" }}>
            {brainStatus?.online ? "Brain Online" : "Brain Offline"}
          </span>
        </div>
      </div>

      {/* Knowledge stats */}
      <div className="grid grid-cols-4 gap-2 mt-4">
        {[
          { label: "Conversations", value: stats.extractions, icon: FileText, color: "text-blue-400" },
          { label: "Contacts", value: stats.contacts, icon: Users, color: "text-green-400" },
          { label: "Deals", value: stats.deals, icon: Handshake, color: "text-purple-400" },
          { label: "Tasks", value: stats.tasks, icon: Zap, color: "text-yellow-500" },
        ].map((s) => (
          <div key={s.label} className="surface p-3 text-center">
            <s.icon size={16} className={`${s.color} mx-auto mb-1`} />
            <div className="text-lg font-bold" style={{ color: "var(--text-primary)" }}>{s.value}</div>
            <div className="text-[10px]" style={{ color: "var(--text-muted)" }}>{s.label}</div>
          </div>
        ))}
      </div>

      {/* Search */}
      <div className="relative mt-4">
        <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2" style={{ color: "var(--text-muted)" }} />
        <input
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Search conversations, summaries, people..."
          className="input w-full pl-9 text-xs"
        />
      </div>

      {/* Extraction timeline */}
      <div className="mt-4 space-y-2">
        <h2 className="text-[10px] uppercase tracking-wider font-medium px-1" style={{ color: "var(--text-muted)" }}>
          <Clock size={10} className="inline mr-1" />
          Knowledge Timeline
        </h2>
        {filtered.length === 0 && (
          <div className="surface p-6 text-center text-xs" style={{ color: "var(--text-muted)" }}>
            {search ? "No matches found" : "No extractions yet. Upload a conversation to get started."}
          </div>
        )}
        {filtered.map((ext) => (
          <div
            key={ext.id}
            onClick={() => router.push(`/pipelines/${ext.id}`)}
            className="surface p-3 cursor-pointer hover:ring-1 hover:ring-[var(--accent)]/20 transition-all group"
          >
            <div className="flex items-start justify-between">
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2">
                  <FileText size={12} className="text-blue-400 shrink-0" />
                  <span className="text-xs font-medium" style={{ color: "var(--text-primary)" }}>
                    {ext.source_filename}
                  </span>
                  <span className="text-[9px] px-1.5 py-0.5 rounded bg-zinc-800/50" style={{ color: "var(--text-muted)" }}>
                    {ext.source_type}
                  </span>
                </div>
                {ext.executive_summary && (
                  <p className="text-[11px] mt-1.5 line-clamp-2 leading-relaxed" style={{ color: "var(--text-secondary)" }}>
                    {ext.executive_summary}
                  </p>
                )}
                <div className="flex items-center gap-3 mt-2 text-[10px]" style={{ color: "var(--text-muted)" }}>
                  {ext.contact_count > 0 && <span>{ext.contact_count} contacts</span>}
                  {ext.prospect_count > 0 && <span>{ext.prospect_count} prospects</span>}
                  {ext.action_count > 0 && <span>{ext.action_count} actions</span>}
                </div>
              </div>
              <span className="text-[10px] shrink-0 ml-3" style={{ color: "var(--text-muted)" }}>
                {new Date(ext.created_at).toLocaleDateString()}
              </span>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
