import { NextRequest, NextResponse } from "next/server";
import { listDeals, saveDeal } from "@/lib/db";
import type { Deal } from "@/lib/types";

export async function GET() {
  const deals = await listDeals();
  return NextResponse.json(deals);
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const now = new Date().toISOString();
    const deal: Deal = {
      id: crypto.randomUUID(),
      title: body.title || "",
      contact_ids: body.contact_ids || [],
      stage: body.stage || "lead",
      value: body.value,
      currency: body.currency || "USD",
      win_probability: body.win_probability || 10,
      owner: body.owner || "",
      next_action: body.next_action || "",
      deadline: body.deadline || "",
      source_extractions: [],
      pricing_terms: body.pricing_terms || [],
      agreements: body.agreements || [],
      created_at: now,
      updated_at: now,
    };
    await saveDeal(deal);
    return NextResponse.json(deal, { status: 201 });
  } catch (error) {
    return NextResponse.json({ error: "Failed to create deal" }, { status: 500 });
  }
}
