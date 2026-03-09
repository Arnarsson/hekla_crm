import { NextRequest, NextResponse } from "next/server";
import { getExtraction, deleteExtraction } from "@/lib/db";
import { exportFullCSV, exportToLinearFormat, exportToNotionFormat, exportToMarkdown } from "@/lib/export";

export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const url = new URL(req.url);
  const format = url.searchParams.get("format");

  const extraction = await getExtraction(id);
  if (!extraction) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  if (format === "csv") {
    return new NextResponse(exportFullCSV(extraction), {
      headers: { "Content-Type": "text/csv", "Content-Disposition": `attachment; filename=pipeline-${id}.csv` },
    });
  }

  if (format === "linear") {
    return new NextResponse(exportToLinearFormat(extraction), {
      headers: { "Content-Type": "text/markdown" },
    });
  }

  if (format === "notion") {
    return new NextResponse(exportToNotionFormat(extraction), {
      headers: { "Content-Type": "text/markdown" },
    });
  }

  if (format === "markdown") {
    return new NextResponse(exportToMarkdown(extraction), {
      headers: { "Content-Type": "text/markdown", "Content-Disposition": `attachment; filename=pipeline-${id}.md` },
    });
  }

  return NextResponse.json(extraction);
}

export async function DELETE(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const deleted = await deleteExtraction(id);
  if (!deleted) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }
  return NextResponse.json({ success: true });
}
