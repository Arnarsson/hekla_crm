import { NextResponse } from "next/server";
import { generateAutoActions } from "@/lib/auto-actions";

export async function POST() {
  try {
    const result = await generateAutoActions();
    return NextResponse.json(result);
  } catch (error) {
    console.error("Scan error:", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Scan failed" },
      { status: 500 }
    );
  }
}
