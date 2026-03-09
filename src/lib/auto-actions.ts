/**
 * Auto-Action Engine — proactive intelligence scanning
 * Detects overdue items, stale deals, relationship decay, etc.
 */

import type { Task, Activity } from "./types";
import { listContacts, listDeals, listTasks, saveTask, logActivity, updateContact } from "./db";

export interface ScanResult {
  overdue_tasks: number;
  stale_deals: number;
  decaying_relationships: number;
  follow_up_suggestions: number;
  tasks_created: number;
  alerts: Activity[];
}

export async function generateAutoActions(): Promise<ScanResult> {
  const now = new Date();
  const nowISO = now.toISOString();
  const contacts = await listContacts();
  const deals = await listDeals();
  const tasks = await listTasks();
  const alerts: Activity[] = [];
  let tasksCreated = 0;

  // ── Overdue tasks ───────────────────────────────────────────────
  const overdueTasks = tasks.filter((t) => {
    if (t.status === "completed" || t.status === "cancelled") return false;
    if (!t.deadline) return false;
    try {
      return new Date(t.deadline) < now;
    } catch {
      return false;
    }
  });

  for (const t of overdueTasks) {
    const alert: Omit<Activity, "id" | "created_at"> = {
      type: "alert",
      title: `Overdue: ${t.title}`,
      description: `Task was due ${t.deadline}. Owner: ${t.owner}`,
      entity_type: "task",
      entity_id: t.id,
    };
    await logActivity(alert);
    alerts.push({ ...alert, id: "", created_at: nowISO });
  }

  // ── Stale deals (same stage >14 days) ──────────────────────────
  const staleDeals = deals.filter((d) => {
    if (d.stage === "closed_won" || d.stage === "closed_lost") return false;
    const daysSinceUpdate = (now.getTime() - new Date(d.updated_at).getTime()) / (1000 * 60 * 60 * 24);
    return daysSinceUpdate > 14;
  });

  for (const d of staleDeals) {
    const alert: Omit<Activity, "id" | "created_at"> = {
      type: "alert",
      title: `Stale deal: ${d.title}`,
      description: `In "${d.stage}" stage since ${new Date(d.updated_at).toLocaleDateString()}. Consider advancing or closing.`,
      entity_type: "deal",
      entity_id: d.id,
    };
    await logActivity(alert);
    alerts.push({ ...alert, id: "", created_at: nowISO });

    const hasTask = tasks.some(
      (t) => t.deal_id === d.id && (t.status === "pending" || t.status === "in_progress")
    );
    if (!hasTask) {
      const task: Task = {
        id: crypto.randomUUID(),
        title: `Follow up on stale deal: ${d.title}`,
        description: `Deal has been in "${d.stage}" stage for >14 days. Take action to advance or close.`,
        status: "pending",
        priority: "high",
        owner: d.owner,
        deadline: new Date(now.getTime() + 3 * 24 * 60 * 60 * 1000).toISOString().split("T")[0],
        deal_id: d.id,
        source: "auto_action",
        created_at: nowISO,
        updated_at: nowISO,
      };
      await saveTask(task);
      tasksCreated++;
    }
  }

  // ── Relationship decay (>14 days no interaction) ───────────────
  const decayingContacts = contacts.filter((c) => {
    const daysSinceInteraction = (now.getTime() - new Date(c.last_interaction).getTime()) / (1000 * 60 * 60 * 24);
    return daysSinceInteraction > 14 && c.relationship_strength > 20;
  });

  for (const c of decayingContacts) {
    const alert: Omit<Activity, "id" | "created_at"> = {
      type: "alert",
      title: `Relationship decay: ${c.name}`,
      description: `No interaction since ${new Date(c.last_interaction).toLocaleDateString()}. Strength: ${c.relationship_strength}`,
      entity_type: "contact",
      entity_id: c.id,
    };
    await logActivity(alert);
    alerts.push({ ...alert, id: "", created_at: nowISO });

    const decay = Math.max(c.relationship_strength - 5, 0);
    await updateContact(c.id, { relationship_strength: decay });
  }

  // ── Follow-up suggestions (deal inactive >7 days) ─────────────
  const followUpDeals = deals.filter((d) => {
    if (d.stage === "closed_won" || d.stage === "closed_lost") return false;
    const daysSince = (now.getTime() - new Date(d.updated_at).getTime()) / (1000 * 60 * 60 * 24);
    return daysSince > 7 && daysSince <= 14;
  });

  for (const d of followUpDeals) {
    const hasTask = tasks.some(
      (t) => t.deal_id === d.id && (t.status === "pending" || t.status === "in_progress")
    );
    if (!hasTask) {
      const task: Task = {
        id: crypto.randomUUID(),
        title: `Follow up: ${d.title}`,
        description: `Deal inactive for ${Math.floor((now.getTime() - new Date(d.updated_at).getTime()) / (1000 * 60 * 60 * 24))} days. Consider reaching out.`,
        status: "pending",
        priority: "medium",
        owner: d.owner,
        deadline: new Date(now.getTime() + 2 * 24 * 60 * 60 * 1000).toISOString().split("T")[0],
        deal_id: d.id,
        source: "auto_action",
        created_at: nowISO,
        updated_at: nowISO,
      };
      await saveTask(task);
      tasksCreated++;
    }
  }

  await logActivity({
    type: "scan",
    title: "Auto-action scan completed",
    description: `${overdueTasks.length} overdue, ${staleDeals.length} stale, ${decayingContacts.length} decaying, ${followUpDeals.length} follow-ups`,
  });

  return {
    overdue_tasks: overdueTasks.length,
    stale_deals: staleDeals.length,
    decaying_relationships: decayingContacts.length,
    follow_up_suggestions: followUpDeals.length,
    tasks_created: tasksCreated,
    alerts,
  };
}
