import { NextRequest, NextResponse } from "next/server";
import { listTasks, saveTask, bulkDeleteTasks, updateTask } from "@/lib/db";
import type { Task } from "@/lib/types";

export async function GET() {
  const tasks = await listTasks();
  return NextResponse.json(tasks);
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const now = new Date().toISOString();
    const task: Task = {
      id: crypto.randomUUID(),
      title: body.title || "",
      description: body.description || "",
      status: body.status || "pending",
      priority: body.priority || "medium",
      owner: body.owner || "",
      deadline: body.deadline || "",
      contact_id: body.contact_id,
      deal_id: body.deal_id,
      extraction_id: body.extraction_id,
      assigned_agent: body.assigned_agent,
      source: "manual",
      created_at: now,
      updated_at: now,
    };
    await saveTask(task);
    return NextResponse.json(task, { status: 201 });
  } catch {
    return NextResponse.json({ error: "Failed to create task" }, { status: 500 });
  }
}

// Bulk operations
export async function DELETE(req: NextRequest) {
  try {
    const body = await req.json();
    if (body.ids && Array.isArray(body.ids)) {
      const count = await bulkDeleteTasks(body.ids);
      return NextResponse.json({ deleted: count });
    }
    // Bulk action: delete by filter
    if (body.filter) {
      const tasks = await listTasks();
      const now = new Date();
      let toDelete: string[] = [];

      if (body.filter === "completed") {
        toDelete = tasks.filter(t => t.status === "completed").map(t => t.id);
      } else if (body.filter === "cancelled") {
        toDelete = tasks.filter(t => t.status === "cancelled").map(t => t.id);
      } else if (body.filter === "stale") {
        // Tasks with deadlines more than 14 days in the past
        toDelete = tasks.filter(t => {
          if (t.status === "completed" || t.status === "cancelled") return false;
          if (!t.deadline) return false;
          try {
            const d = new Date(t.deadline);
            return !isNaN(d.getTime()) && (now.getTime() - d.getTime()) > 14 * 24 * 60 * 60 * 1000;
          } catch { return false; }
        }).map(t => t.id);
      } else if (body.filter === "done") {
        toDelete = tasks.filter(t => t.status === "completed" || t.status === "cancelled").map(t => t.id);
      }

      const count = await bulkDeleteTasks(toDelete);
      return NextResponse.json({ deleted: count });
    }
    return NextResponse.json({ error: "ids or filter required" }, { status: 400 });
  } catch {
    return NextResponse.json({ error: "Failed" }, { status: 500 });
  }
}

// Bulk update
export async function PATCH(req: NextRequest) {
  try {
    const body = await req.json();
    if (body.ids && Array.isArray(body.ids) && body.updates) {
      let count = 0;
      for (const id of body.ids) {
        const result = await updateTask(id, body.updates);
        if (result) count++;
      }
      return NextResponse.json({ updated: count });
    }
    return NextResponse.json({ error: "ids and updates required" }, { status: 400 });
  } catch {
    return NextResponse.json({ error: "Failed" }, { status: 500 });
  }
}
