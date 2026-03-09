import { NextRequest, NextResponse } from "next/server";
import { listContacts, saveContact } from "@/lib/db";
import type { Contact } from "@/lib/types";

export async function GET() {
  const contacts = await listContacts();
  return NextResponse.json(contacts);
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const now = new Date().toISOString();
    const contact: Contact = {
      id: crypto.randomUUID(),
      name: body.name || "",
      organization: body.organization || "",
      role: body.role || "",
      relationship_type: body.relationship_type || "client",
      email: body.email,
      phone: body.phone,
      linkedin_url: body.linkedin_url,
      trust: body.trust || 3,
      relationship_strength: body.relationship_strength || 50,
      engagement_score: body.engagement_score || 40,
      engagement_status: body.engagement_status || "warming",
      last_interaction: now,
      tags: body.tags || [],
      notes: [],
      source_extractions: [],
      created_at: now,
      updated_at: now,
    };
    await saveContact(contact);
    return NextResponse.json(contact, { status: 201 });
  } catch (error) {
    return NextResponse.json({ error: "Failed to create contact" }, { status: 500 });
  }
}
