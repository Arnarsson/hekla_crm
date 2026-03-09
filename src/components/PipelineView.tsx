"use client";

import { useState } from "react";
import type { PipelineExtraction } from "@/lib/types";
import {
  Users, Handshake, Lightbulb, CheckSquare, DollarSign,
  Flag, Network, AlertTriangle, MessageSquare, FileText,
  Download, ChevronDown, ChevronRight,
} from "lucide-react";

interface Props {
  extraction: PipelineExtraction;
}

type SectionKey = "prospects" | "agreements" | "ideas" | "action_items" | "pricing" | "milestones" | "relationships" | "risks" | "followups";

const SECTIONS: { key: SectionKey; label: string; icon: typeof Users }[] = [
  { key: "prospects", label: "Prospects & Leads", icon: Users },
  { key: "agreements", label: "Agreements & Decisions", icon: Handshake },
  { key: "ideas", label: "Ideas & Opportunities", icon: Lightbulb },
  { key: "action_items", label: "Action Items", icon: CheckSquare },
  { key: "pricing", label: "Pricing & Terms", icon: DollarSign },
  { key: "milestones", label: "Milestones & Timeline", icon: Flag },
  { key: "relationships", label: "Relationship Map", icon: Network },
  { key: "risks", label: "Risks & Blockers", icon: AlertTriangle },
  { key: "followups", label: "Follow-up Needed", icon: MessageSquare },
];

export default function PipelineView({ extraction }: Props) {
  const [expandedSections, setExpandedSections] = useState<Set<string>>(
    new Set(SECTIONS.filter((s) => (extraction[s.key] as unknown[])?.length > 0).map((s) => s.key))
  );

  const toggleSection = (key: string) => {
    const next = new Set(expandedSections);
    next.has(key) ? next.delete(key) : next.add(key);
    setExpandedSections(next);
  };

  const handleExport = async (format: string) => {
    const res = await fetch(`/api/pipelines/${extraction.id}?format=${format}`);
    const blob = await res.blob();
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `pipeline-${extraction.id}.${format === "csv" ? "csv" : "md"}`;
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="glass-card p-5">
        <div className="flex items-start justify-between">
          <div>
            <h2 className="text-lg font-semibold text-white flex items-center gap-2">
              <FileText size={18} className="text-brand-400" />
              {extraction.source_filename}
            </h2>
            <p className="text-xs text-zinc-500 mt-1">
              {extraction.source_type} &middot; {new Date(extraction.created_at).toLocaleString()}
              {extraction.context_label && ` &middot; ${extraction.context_label}`}
            </p>
          </div>
          <div className="flex gap-2">
            {["csv", "linear", "notion", "markdown"].map((fmt) => (
              <button
                key={fmt}
                onClick={() => handleExport(fmt)}
                className="flex items-center gap-1 px-3 py-1.5 text-xs rounded-md bg-zinc-800 text-zinc-300 hover:bg-zinc-700 transition-colors"
              >
                <Download size={12} />
                {fmt.toUpperCase()}
              </button>
            ))}
          </div>
        </div>

        {/* Executive Summary */}
        <div className="mt-4 p-4 rounded-lg bg-zinc-900/50 border border-zinc-800">
          <h3 className="text-xs font-semibold text-zinc-400 uppercase tracking-wider mb-2">Executive Summary</h3>
          <p className="text-sm text-zinc-300 leading-relaxed">{extraction.executive_summary}</p>
        </div>
      </div>

      {/* Pipeline Sections */}
      {SECTIONS.map((section) => {
        const data = extraction[section.key] as unknown[];
        if (!data || data.length === 0) return null;
        const Icon = section.icon;
        const isExpanded = expandedSections.has(section.key);

        return (
          <div key={section.key} className="glass-card overflow-hidden fade-in">
            <button
              onClick={() => toggleSection(section.key)}
              className="w-full flex items-center justify-between p-4 hover:bg-zinc-800/30 transition-colors"
            >
              <div className="flex items-center gap-3">
                <Icon size={16} className="text-brand-400" />
                <span className="text-sm font-medium text-white">{section.label}</span>
                <span className="text-xs px-2 py-0.5 rounded-full bg-zinc-800 text-zinc-400">
                  {data.length}
                </span>
              </div>
              {isExpanded ? <ChevronDown size={16} className="text-zinc-500" /> : <ChevronRight size={16} className="text-zinc-500" />}
            </button>

            {isExpanded && (
              <div className="overflow-x-auto">
                <SectionTable sectionKey={section.key} data={data} />
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}

function SectionTable({ sectionKey, data }: { sectionKey: SectionKey; data: unknown[] }) {
  const configs: Record<SectionKey, { headers: string[]; render: (item: Record<string, string>, i: number) => React.ReactNode[] }> = {
    prospects: {
      headers: ["#", "Prospect", "Contact", "Source", "Status", "Next Action", "Owner", "Deadline"],
      render: (p, i) => [
        i + 1,
        p.prospect,
        p.contact_person,
        p.source,
        <StatusBadge key="s" value={p.status} />,
        p.next_action,
        p.owner,
        p.deadline,
      ],
    },
    agreements: {
      headers: ["#", "Decision", "Who Agreed", "Context", "Binding", "Dependencies"],
      render: (a, i) => [i + 1, a.decision, a.who_agreed, a.date_context, <BindingBadge key="b" value={a.binding} />, a.dependencies],
    },
    ideas: {
      headers: ["#", "Idea", "By", "Category", "Priority", "Status", "Value"],
      render: (item, i) => [i + 1, item.idea, item.proposed_by, item.category, <PriorityBadge key="p" value={item.priority_signal} />, item.status, item.potential_value],
    },
    action_items: {
      headers: ["#", "Action", "Owner", "Deadline", "Status", "Dependencies", "Source"],
      render: (a, i) => [
        i + 1, a.action, a.owner, a.deadline,
        <ActionStatusBadge key="s" value={a.status} />,
        a.depends_on,
        <span key="q" className="text-xs text-zinc-500 italic max-w-xs truncate block">{a.source_quote}</span>,
      ],
    },
    pricing: {
      headers: ["#", "Item", "Terms", "Proposed By", "Agreed", "Notes"],
      render: (p, i) => [i + 1, p.item, p.proposed_terms, p.who_proposed, p.agreed, p.notes],
    },
    milestones: {
      headers: ["#", "Milestone", "Target Date", "Owner", "Status", "Dependencies"],
      render: (m, i) => [i + 1, m.milestone, m.target_date, m.owner, m.status, m.dependencies],
    },
    relationships: {
      headers: ["Person", "Organization", "Role", "Relationship", "Notes"],
      render: (r) => [r.person, r.organization, r.role, r.relationship_to_us, r.notes],
    },
    risks: {
      headers: ["#", "Risk", "Raised By", "Severity", "Mitigation", "Status"],
      render: (r, i) => [i + 1, r.risk, r.raised_by, <SeverityBadge key="s" value={r.severity} />, r.mitigation, r.status],
    },
    followups: {
      headers: ["#", "Topic", "Between", "Why Deferred", "Next Step"],
      render: (f, i) => [i + 1, f.topic, f.between_whom, f.why_deferred, f.suggested_next_step],
    },
  };

  const config = configs[sectionKey];
  const items = data as Record<string, string>[];

  return (
    <table className="pipeline-table">
      <thead>
        <tr>
          {config.headers.map((h) => (
            <th key={h}>{h}</th>
          ))}
        </tr>
      </thead>
      <tbody>
        {items.map((item, i) => (
          <tr key={i}>
            {config.render(item, i).map((cell, j) => (
              <td key={j} className="text-zinc-300">{cell}</td>
            ))}
          </tr>
        ))}
      </tbody>
    </table>
  );
}

function StatusBadge({ value }: { value: string }) {
  const styles: Record<string, string> = {
    hot: "bg-green-900/30 text-green-400 border-green-800",
    warm: "bg-yellow-900/30 text-yellow-400 border-yellow-800",
    cold: "bg-red-900/30 text-red-400 border-red-800",
    closed: "bg-blue-900/30 text-blue-400 border-blue-800",
  };
  return <span className={`text-xs px-2 py-0.5 rounded-full border ${styles[value] || "bg-zinc-800 text-zinc-400 border-zinc-700"}`}>{value}</span>;
}

function ActionStatusBadge({ value }: { value: string }) {
  const emojis: Record<string, string> = { open: "🔲", in_progress: "🔄", done: "✅", unclear: "❓" };
  return <span className="text-xs">{emojis[value] || "?"} {value}</span>;
}

function PriorityBadge({ value }: { value: string }) {
  const colors: Record<string, string> = { high: "text-red-400", medium: "text-yellow-400", low: "text-green-400", unclear: "text-zinc-500" };
  return <span className={`text-xs font-medium ${colors[value] || "text-zinc-400"}`}>{value}</span>;
}

function SeverityBadge({ value }: { value: string }) {
  const styles: Record<string, string> = {
    high: "bg-red-900/30 text-red-400",
    medium: "bg-yellow-900/30 text-yellow-400",
    low: "bg-green-900/30 text-green-400",
  };
  return <span className={`text-xs px-2 py-0.5 rounded-full ${styles[value] || "bg-zinc-800 text-zinc-400"}`}>{value}</span>;
}

function BindingBadge({ value }: { value: string }) {
  const styles: Record<string, string> = {
    yes: "text-green-400",
    no: "text-zinc-500",
    soft: "text-yellow-400",
  };
  return <span className={`text-xs font-medium ${styles[value] || "text-zinc-400"}`}>{value}</span>;
}
