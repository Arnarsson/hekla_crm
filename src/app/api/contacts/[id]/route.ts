import { NextRequest, NextResponse } from "next/server";
import { getContact, updateContact, deleteContact, addContactNote, deleteContactNote, listInteractionsByContact } from "@/lib/db";
import { brainRequest } from "@/lib/brain";
import type { ContactIntelligence } from "@/lib/types";

export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const url = new URL(req.url);
  const withIntelligence = url.searchParams.get("intelligence") === "true";

  const contact = await getContact(id);
  if (!contact) return NextResponse.json({ error: "Not found" }, { status: 404 });

  if (withIntelligence && !contact.intelligence) {
    const interactions = await listInteractionsByContact(id);
    const intelligence = await brainRequest<ContactIntelligence>(
      "/score-contacts",
      { contact, interactions },
      () => computeLocalIntelligence(contact, interactions.length)
    );
    await updateContact(id, { intelligence });
    return NextResponse.json({ ...contact, intelligence });
  }

  return NextResponse.json(contact);
}

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const body = await req.json();

  if (body._action === "add_note") {
    const result = await addContactNote(id, body.text);
    if (!result) return NextResponse.json({ error: "Not found" }, { status: 404 });
    return NextResponse.json(result);
  }
  if (body._action === "delete_note") {
    const result = await deleteContactNote(id, body.note_id);
    if (!result) return NextResponse.json({ error: "Not found" }, { status: 404 });
    return NextResponse.json(result);
  }

  const updated = await updateContact(id, body);
  if (!updated) return NextResponse.json({ error: "Not found" }, { status: 404 });
  return NextResponse.json(updated);
}

export async function DELETE(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const deleted = await deleteContact(id);
  if (!deleted) return NextResponse.json({ error: "Not found" }, { status: 404 });
  return NextResponse.json({ success: true });
}

function computeLocalIntelligence(contact: { relationship_strength: number; engagement_score: number; engagement_status: string; relationship_type: string; last_interaction: string; source_extractions: string[] }, interactionCount: number): ContactIntelligence {
  const daysSince = Math.floor((Date.now() - new Date(contact.last_interaction).getTime()) / (1000 * 60 * 60 * 24));
  const strength = contact.relationship_strength;

  let strengthLabel: "weak" | "moderate" | "strong" | "urgent" = "moderate";
  if (strength >= 70) strengthLabel = "strong";
  else if (strength >= 40) strengthLabel = "moderate";
  else strengthLabel = "weak";

  let riskLevel: "low" | "medium" | "high" | "critical" = "low";
  if (daysSince > 30) riskLevel = "critical";
  else if (daysSince > 14) riskLevel = "high";
  else if (daysSince > 7) riskLevel = "medium";

  let trend: "improving" | "stable" | "declining" = "stable";
  if (daysSince > 14) trend = "declining";
  else if (interactionCount > 3) trend = "improving";

  const nextActions: { action: string; priority: "low" | "medium" | "high" | "urgent"; context: string }[] = [];
  if (daysSince > 7) {
    nextActions.push({ action: `Reach out to ${contact.relationship_type}`, priority: daysSince > 14 ? "high" : "medium", context: `${daysSince} days since last interaction` });
  }
  if (contact.source_extractions.length === 1) {
    nextActions.push({ action: "Add more context", priority: "low", context: "Only 1 extraction source" });
  }

  return {
    strategic_summary: `${strengthLabel} ${contact.relationship_type} relationship with ${interactionCount} logged interactions. ${daysSince === 0 ? "Active today." : `Last seen ${daysSince} days ago.`}`,
    engagement_score: contact.engagement_score || Math.min(interactionCount * 15, 100),
    engagement_status: contact.engagement_status as ContactIntelligence["engagement_status"] || (daysSince > 14 ? "cold" : daysSince > 7 ? "cooling" : "active"),
    relationship_strength_label: strengthLabel,
    next_actions: nextActions,
    key_topics: [],
    risk_level: riskLevel,
    trend,
    days_since_contact: daysSince,
  };
}
