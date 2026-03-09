/**
 * Agent-Powered Actions — sends tasks/outreach requests to TinyClaw agents
 */

import type { Task, Contact, Deal } from "./types";
import { sendMessage } from "./tinyclaw";
import { updateTask, logActivity } from "./db";

export async function assignTaskToAgent(task: Task, agentId: string): Promise<{ success: boolean; messageId?: string; error?: string }> {
  try {
    const message = `You have been assigned a task.\n\nTitle: ${task.title}\nDescription: ${task.description}\nPriority: ${task.priority}\nDeadline: ${task.deadline}\nOwner: ${task.owner}\n\nPlease work on this and report back when complete.`;

    const result = await sendMessage(message, agentId);

    await updateTask(task.id, { assigned_agent: agentId, status: "in_progress" });

    await logActivity({
      type: "agent_action",
      title: `Task assigned to agent: ${agentId}`,
      description: task.title,
      entity_type: "task",
      entity_id: task.id,
    });

    return { success: true, messageId: result?.id };
  } catch (err) {
    return { success: false, error: err instanceof Error ? err.message : "Failed to assign task" };
  }
}

export async function requestOutreachDraft(
  contact: Contact,
  deal: Deal | null,
  context: string,
  agentId: string
): Promise<{ success: boolean; messageId?: string; error?: string }> {
  try {
    let message = `Draft an outreach message for the following contact:\n\nName: ${contact.name}\nOrganization: ${contact.organization}\nRole: ${contact.role}\nRelationship: ${contact.relationship_type}`;

    if (deal) {
      message += `\n\nRelated Deal: ${deal.title}\nStage: ${deal.stage}\nNext Action: ${deal.next_action}`;
    }

    if (context) {
      message += `\n\nContext: ${context}`;
    }

    message += `\n\nPlease draft a professional, concise outreach message.`;

    const result = await sendMessage(message, agentId);

    await logActivity({
      type: "agent_action",
      title: `Outreach draft requested for ${contact.name}`,
      description: `Agent: ${agentId}, Deal: ${deal?.title || "none"}`,
      entity_type: "contact",
      entity_id: contact.id,
    });

    return { success: true, messageId: result?.id };
  } catch (err) {
    return { success: false, error: err instanceof Error ? err.message : "Failed to request outreach" };
  }
}

export async function requestFollowUpDraft(
  task: Task,
  agentId: string
): Promise<{ success: boolean; messageId?: string; error?: string }> {
  try {
    const message = `Draft a follow-up message for this task:\n\nTitle: ${task.title}\nDescription: ${task.description}\nOwner: ${task.owner}\nDeadline: ${task.deadline}\n\nPlease draft a professional follow-up message.`;

    const result = await sendMessage(message, agentId);

    await logActivity({
      type: "agent_action",
      title: `Follow-up draft requested`,
      description: task.title,
      entity_type: "task",
      entity_id: task.id,
    });

    return { success: true, messageId: result?.id };
  } catch (err) {
    return { success: false, error: err instanceof Error ? err.message : "Failed to request follow-up" };
  }
}
