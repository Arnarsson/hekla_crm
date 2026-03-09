import { NextRequest, NextResponse } from "next/server";
import { listPartners, createPartner, deletePartner, validateToken, regenerateToken } from "@/lib/partners";

export async function GET(req: NextRequest) {
  const token = req.nextUrl.searchParams.get("token");

  if (token) {
    const partner = await validateToken(token);
    if (!partner) return NextResponse.json({ error: "Invalid token" }, { status: 401 });
    return NextResponse.json({ id: partner.id, name: partner.name, role: partner.role });
  }

  return NextResponse.json(await listPartners());
}

export async function POST(req: NextRequest) {
  const body = await req.json();
  if (!body.name || !body.email) {
    return NextResponse.json({ error: "Name and email required" }, { status: 400 });
  }
  const partner = await createPartner(body.name, body.email, body.role || "viewer");
  return NextResponse.json(partner, { status: 201 });
}

export async function DELETE(req: NextRequest) {
  const id = req.nextUrl.searchParams.get("id");
  if (!id) return NextResponse.json({ error: "ID required" }, { status: 400 });
  const deleted = await deletePartner(id);
  if (!deleted) return NextResponse.json({ error: "Not found" }, { status: 404 });
  return NextResponse.json({ success: true });
}

export async function PATCH(req: NextRequest) {
  const body = await req.json();
  if (!body.id) return NextResponse.json({ error: "ID required" }, { status: 400 });
  const partner = await regenerateToken(body.id);
  if (!partner) return NextResponse.json({ error: "Not found" }, { status: 404 });
  return NextResponse.json(partner);
}
