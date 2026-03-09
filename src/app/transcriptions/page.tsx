"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Mic, Upload, FileText, Clock, Users, Zap } from "lucide-react";

interface Extraction {
  id: string;
  source_filename: string;
  source_type: string;
  executive_summary: string;
  created_at: string;
  relationships: unknown[];
  prospects: unknown[];
  action_items: unknown[];
}

export default function TranscriptionsPage() {
  const router = useRouter();
  const [extractions, setExtractions] = useState<Extraction[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch("/api/pipelines")
      .then((r) => r.json())
      .then((data) => {
        // Filter to transcript-type extractions, or show all if none
        const transcripts = (data || []).filter(
          (e: Extraction) => e.source_type === "transcript" || e.source_type === "other"
        );
        transcripts.sort((a: Extraction, b: Extraction) => b.created_at.localeCompare(a.created_at));
        setExtractions(transcripts.length > 0 ? transcripts : data || []);
        setLoading(false);
      })
      .catch(() => setLoading(false));
  }, []);

  if (loading) {
    return (
      <div className="page-container">
        <div className="text-sm" style={{ color: "var(--text-muted)" }}>Loading transcriptions...</div>
      </div>
    );
  }

  return (
    <div className="page-container">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="page-title flex items-center gap-2">
            <Mic size={20} style={{ color: "var(--accent)" }} />
            Transcriptions
          </h1>
          <p className="text-xs mt-0.5" style={{ color: "var(--text-muted)" }}>
            {extractions.length} processed conversations
          </p>
        </div>
        <button onClick={() => router.push("/upload")} className="btn btn-primary btn-xs flex items-center gap-1">
          <Upload size={12} /> Upload
        </button>
      </div>

      {/* Transcription list */}
      <div className="mt-4 space-y-1">
        {extractions.length === 0 && (
          <div className="surface p-8 text-center">
            <Mic size={32} className="mx-auto mb-3" style={{ color: "var(--text-muted)", opacity: 0.3 }} />
            <p className="text-xs" style={{ color: "var(--text-muted)" }}>No transcriptions yet</p>
            <button onClick={() => router.push("/upload")} className="btn btn-primary btn-xs mt-3">
              Upload your first conversation
            </button>
          </div>
        )}
        {extractions.map((ext) => (
          <div
            key={ext.id}
            onClick={() => router.push(`/pipelines/${ext.id}`)}
            className="surface p-3 cursor-pointer hover:ring-1 hover:ring-[var(--accent)]/20 transition-all group"
          >
            <div className="flex items-center gap-3">
              <div className="w-8 h-8 rounded-lg flex items-center justify-center shrink-0" style={{ backgroundColor: "var(--accent)", opacity: 0.15 }}>
                <FileText size={14} style={{ color: "var(--accent)" }} />
              </div>
              <div className="flex-1 min-w-0">
                <div className="text-xs font-medium" style={{ color: "var(--text-primary)" }}>
                  {ext.source_filename}
                </div>
                {ext.executive_summary && (
                  <p className="text-[10px] mt-0.5 line-clamp-1" style={{ color: "var(--text-muted)" }}>
                    {ext.executive_summary}
                  </p>
                )}
                <div className="flex items-center gap-3 mt-1 text-[10px]" style={{ color: "var(--text-muted)" }}>
                  {ext.relationships?.length > 0 && (
                    <span className="flex items-center gap-0.5"><Users size={9} /> {ext.relationships.length}</span>
                  )}
                  {ext.prospects?.length > 0 && (
                    <span className="flex items-center gap-0.5"><Zap size={9} /> {ext.prospects.length}</span>
                  )}
                  {ext.action_items?.length > 0 && (
                    <span className="flex items-center gap-0.5"><Clock size={9} /> {ext.action_items.length}</span>
                  )}
                </div>
              </div>
              <div className="text-right shrink-0">
                <span className="text-[9px] px-1.5 py-0.5 rounded bg-zinc-800/50" style={{ color: "var(--text-muted)" }}>
                  {ext.source_type}
                </span>
                <div className="text-[10px] mt-1" style={{ color: "var(--text-muted)" }}>
                  {new Date(ext.created_at).toLocaleDateString()}
                </div>
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
