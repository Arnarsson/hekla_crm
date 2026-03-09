import { NextRequest, NextResponse } from "next/server";
import { listExtractions, getDashboardStats } from "@/lib/db";

export async function GET(req: NextRequest) {
  const url = new URL(req.url);
  const stats = url.searchParams.get("stats") === "true";
  const limit = parseInt(url.searchParams.get("limit") || "50");
  const offset = parseInt(url.searchParams.get("offset") || "0");

  if (stats) {
    return NextResponse.json(await getDashboardStats());
  }

  const extractions = await listExtractions(limit, offset);
  return NextResponse.json(extractions);
}
