import { NextRequest, NextResponse } from "next/server";
import { getDeal, updateDeal, deleteDeal, logActivity } from "@/lib/db";

export async function GET(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const deal = await getDeal(id);
  if (!deal) return NextResponse.json({ error: "Not found" }, { status: 404 });
  return NextResponse.json(deal);
}

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const body = await req.json();
  const existing = await getDeal(id);
  if (!existing) return NextResponse.json({ error: "Not found" }, { status: 404 });

  if (body.stage && body.stage !== existing.stage) {
    await logActivity({
      type: "deal_stage_changed",
      title: `Deal stage changed: ${existing.title}`,
      description: `${existing.stage} → ${body.stage}`,
      entity_type: "deal",
      entity_id: id,
    });
  }

  const updated = await updateDeal(id, body);
  if (!updated) return NextResponse.json({ error: "Not found" }, { status: 404 });
  return NextResponse.json(updated);
}

export async function DELETE(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const deleted = await deleteDeal(id);
  if (!deleted) return NextResponse.json({ error: "Not found" }, { status: 404 });
  return NextResponse.json({ success: true });
}
