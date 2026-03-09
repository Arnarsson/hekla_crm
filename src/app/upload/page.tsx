"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import UploadForm from "@/components/UploadForm";
import PipelineView from "@/components/PipelineView";
import type { PipelineExtraction } from "@/lib/types";

export default function UploadPage() {
  const router = useRouter();
  const [extractions, setExtractions] = useState<PipelineExtraction[]>([]);
  const [activeIndex, setActiveIndex] = useState(0);

  const handleExtracted = (data: Record<string, unknown>) => {
    if (data.id && data.prospects) {
      setExtractions((prev) => [...prev, data as unknown as PipelineExtraction]);
    } else if (data.id && data.status === "processing") {
      router.push(`/pipelines/${data.id}`);
    }
  };

  const reset = () => {
    setExtractions([]);
    setActiveIndex(0);
  };

  const activeExtraction = extractions[activeIndex] || null;

  return (
    <div className="page-container">
      <div>
        <h1 className="text-2xl font-bold text-white">Upload & Extract</h1>
        <p className="text-sm text-zinc-500 mt-1">
          Upload conversation exports and extract every actionable item into your pipeline
        </p>
      </div>

      {extractions.length === 0 ? (
        <UploadForm onExtracted={handleExtracted} />
      ) : (
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="text-lg font-semibold text-white">
              Extraction Complete
              {extractions.length > 1 && (
                <span className="text-sm text-zinc-500 font-normal ml-2">
                  ({extractions.length} extractions)
                </span>
              )}
            </h2>
            <div className="flex gap-2">
              <button
                onClick={() => router.push("/pipelines")}
                className="btn btn-surface"
              >
                View All Pipelines
              </button>
              <button
                onClick={reset}
                className="btn btn-primary"
              >
                New Extraction
              </button>
            </div>
          </div>

          {/* Tabs for multiple extractions */}
          {extractions.length > 1 && (
            <div className="flex gap-1 overflow-x-auto pb-1">
              {extractions.map((ext, i) => (
                <button
                  key={ext.id}
                  onClick={() => setActiveIndex(i)}
                  className={`px-3 py-1.5 rounded-lg text-xs font-medium whitespace-nowrap transition-colors ${
                    i === activeIndex
                      ? "bg-brand-600/20 text-brand-400 border border-brand-500/30"
                      : "bg-zinc-800/50 text-zinc-500 border border-zinc-800 hover:text-zinc-400"
                  }`}
                >
                  {ext.source_filename || `Extraction ${i + 1}`}
                </button>
              ))}
            </div>
          )}

          {activeExtraction && <PipelineView extraction={activeExtraction} />}
        </div>
      )}
    </div>
  );
}
