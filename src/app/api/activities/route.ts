import { NextRequest, NextResponse } from "next/server";
import { listActivities } from "@/lib/db";

export async function GET(req: NextRequest) {
  const url = new URL(req.url);
  const limit = parseInt(url.searchParams.get("limit") || "50");
  const offset = parseInt(url.searchParams.get("offset") || "0");
  const type = url.searchParams.get("type");

  let activities = await listActivities(limit + offset);

  if (type) {
    activities = activities.filter((a) => a.type === type);
  }

  return NextResponse.json(activities.slice(offset, offset + limit));
}
