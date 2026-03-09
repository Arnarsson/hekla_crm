"use client";

import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import PipelineView from "@/components/PipelineView";
import type { PipelineExtraction } from "@/lib/types";
import { Loader2 } from "lucide-react";
import Link from "next/link";

export default function PipelineDetailPage() {
  const params = useParams();
  const [extraction, setExtraction] = useState<PipelineExtraction | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    fetch(`/api/pipelines/${params.id}`)
      .then((r) => {
        if (!r.ok) throw new Error("Not found");
        return r.json();
      })
      .then(setExtraction)
      .catch((err) => setError(err.message))
      .finally(() => setLoading(false));
  }, [params.id]);

  return (
    <div className="page-container">
      {loading ? (
        <div className="flex items-center justify-center h-64">
          <Loader2 size={24} className="animate-spin text-brand-400" />
        </div>
      ) : error ? (
        <div className="surface p-12 text-center">
          <p className="text-red-400 mb-4">{error}</p>
          <Link href="/pipelines" className="text-brand-400 hover:underline text-sm">
            Back to Pipelines
          </Link>
        </div>
      ) : extraction ? (
        <PipelineView extraction={extraction} />
      ) : null}
    </div>
  );
}
