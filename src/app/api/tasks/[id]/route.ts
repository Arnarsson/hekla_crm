import { NextRequest, NextResponse } from "next/server";
import { getTask, updateTask, deleteTask, logActivity } from "@/lib/db";

export async function GET(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const task = await getTask(id);
  if (!task) return NextResponse.json({ error: "Not found" }, { status: 404 });
  return NextResponse.json(task);
}

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const body = await req.json();
  const existing = await getTask(id);
  if (!existing) return NextResponse.json({ error: "Not found" }, { status: 404 });

  if (body.status === "completed" && existing.status !== "completed") {
    await logActivity({
      type: "task_completed",
      title: `Task completed: ${existing.title}`,
      description: `Owner: ${existing.owner}`,
      entity_type: "task",
      entity_id: id,
    });
  }

  const updated = await updateTask(id, body);
  if (!updated) return NextResponse.json({ error: "Not found" }, { status: 404 });
  return NextResponse.json(updated);
}

export async function DELETE(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const deleted = await deleteTask(id);
  if (!deleted) return NextResponse.json({ error: "Not found" }, { status: 404 });
  return NextResponse.json({ success: true });
}
