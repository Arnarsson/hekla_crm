import { NextResponse } from "next/server";
import { isBrainOnline, getBrainUrl } from "@/lib/brain";

export async function GET() {
  const online = await isBrainOnline();
  return NextResponse.json({ online, url: getBrainUrl() });
}
