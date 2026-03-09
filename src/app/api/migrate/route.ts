import { NextResponse } from "next/server";
import { listExtractions } from "@/lib/db";
import { processExtractionIntoCRM } from "@/lib/crm-engine";

export async function POST() {
  const extractions = await listExtractions();
  const results = [];

  for (const extraction of extractions) {
    const counts = await processExtractionIntoCRM(extraction);
    results.push({ id: extraction.id, source: extraction.source_filename, ...counts });
  }

  return NextResponse.json({
    extractions_processed: extractions.length,
    results,
  });
}
