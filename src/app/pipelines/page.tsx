"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import type { PipelineExtraction } from "@/lib/types";
import { FileText, Trash2, Download } from "lucide-react";

export default function PipelinesPage() {
  const [extractions, setExtractions] = useState<PipelineExtraction[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch("/api/pipelines")
      .then((r) => r.json())
      .then((data) => {
        setExtractions(data);
        setLoading(false);
      })
      .catch(() => setLoading(false));
  }, []);

  const handleDelete = async (id: string) => {
    await fetch(`/api/pipelines/${id}`, { method: "DELETE" });
    setExtractions((prev) => prev.filter((e) => e.id !== id));
  };

  return (
    <div className="page-container">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-white">Pipeline Extractions</h1>
          <p className="text-sm text-zinc-500 mt-1">All extracted pipeline intelligence from your conversations</p>
        </div>
        <Link
          href="/upload"
          className="btn btn-primary"
        >
          New Extraction
        </Link>
      </div>

      {loading ? (
        <div className="space-y-3">
          {Array.from({ length: 3 }).map((_, i) => (
            <div key={i} className="surface p-5 animate-pulse">
              <div className="h-5 bg-zinc-800 rounded w-48 mb-2" />
              <div className="h-3 bg-zinc-800 rounded w-96" />
            </div>
          ))}
        </div>
      ) : extractions.length === 0 ? (
        <div className="surface p-12 text-center">
          <FileText size={40} className="mx-auto text-zinc-700 mb-4" />
          <p className="text-zinc-400 mb-4">No extractions yet</p>
          <Link
            href="/upload"
            className="btn btn-primary inline-flex items-center gap-2"
          >
            Upload Your First Conversation
          </Link>
        </div>
      ) : (
        <div className="space-y-3">
          {extractions.map((ext) => (
            <div key={ext.id} className="surface p-5 fade-in">
              <div className="flex items-start justify-between">
                <Link href={`/pipelines/${ext.id}`} className="flex-1 group">
                  <h3 className="text-sm font-medium text-white group-hover:text-brand-400 transition-colors">
                    {ext.source_filename}
                  </h3>
                  <p className="text-xs text-zinc-500 mt-1">
                    {ext.source_type} &middot; {new Date(ext.created_at).toLocaleString()}
                    {ext.context_label && ` &middot; ${ext.context_label}`}
                  </p>
                  <div className="flex gap-4 mt-2">
                    <span className="text-xs text-zinc-600">{ext.prospects?.length || 0} prospects</span>
                    <span className="text-xs text-zinc-600">{ext.action_items?.length || 0} actions</span>
                    <span className="text-xs text-zinc-600">{ext.risks?.length || 0} risks</span>
                    <span className="text-xs text-zinc-600">{ext.ideas?.length || 0} ideas</span>
                  </div>
                </Link>
                <div className="flex gap-2 ml-4">
                  <a
                    href={`/api/pipelines/${ext.id}?format=csv`}
                    className="p-2 rounded-lg hover:bg-zinc-800 transition-colors"
                    title="Download CSV"
                  >
                    <Download size={14} className="text-zinc-500" />
                  </a>
                  <button
                    onClick={() => handleDelete(ext.id)}
                    className="p-2 rounded-lg hover:bg-red-900/20 transition-colors"
                    title="Delete"
                  >
                    <Trash2 size={14} className="text-zinc-500 hover:text-red-400" />
                  </button>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
