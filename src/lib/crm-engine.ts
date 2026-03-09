/**
 * CRM Population Engine — auto-builds CRM from extraction data
 * Runs after every extraction to create/update contacts, deals, tasks
 */

import type {
  PipelineExtraction,
  Contact,
  Deal,
  Task,
  DealStage,
  RelationshipType,
} from "./types";
import {
  saveContact,
  findContactByNameOrg,
  updateContact,
  saveDeal,
  listDeals,
  saveTask,
  listTasks,
  updateTask,
  saveInteraction,
  logActivity,
} from "./db";

interface CRMCounts {
  contacts_created: number;
  contacts_updated: number;
  deals_created: number;
  deals_updated: number;
  tasks_created: number;
  interactions_logged: number;
}

export async function processExtractionIntoCRM(extraction: PipelineExtraction): Promise<CRMCounts> {
  const counts: CRMCounts = {
    contacts_created: 0,
    contacts_updated: 0,
    deals_created: 0,
    deals_updated: 0,
    tasks_created: 0,
    interactions_logged: 0,
  };

  const now = new Date().toISOString();
  const contactIdMap: Record<string, string> = {};

  // ── Contacts from relationships ─────────────────────────────────
  for (const rel of extraction.relationships || []) {
    if (!rel.person) continue;

    const existing = await findContactByNameOrg(rel.person, rel.organization || "");

    if (existing) {
      const sources = new Set(existing.source_extractions);
      sources.add(extraction.id);
      await updateContact(existing.id, {
        source_extractions: Array.from(sources),
        last_interaction: now,
        role: rel.role || existing.role,
        relationship_type: mapRelationshipType(rel.relationship_to_us) || existing.relationship_type,
      });
      contactIdMap[rel.person.toLowerCase()] = existing.id;
      counts.contacts_updated++;
    } else {
      const id = crypto.randomUUID();
      const contact: Contact = {
        id,
        name: rel.person,
        organization: rel.organization || "",
        role: rel.role || "",
        relationship_type: mapRelationshipType(rel.relationship_to_us) || "client",
        trust: 3,
        relationship_strength: 30,
        engagement_score: 40,
        engagement_status: "warming",
        last_interaction: now,
        tags: [],
        notes: [],
        source_extractions: [extraction.id],
        created_at: now,
        updated_at: now,
      };
      await saveContact(contact);
      contactIdMap[rel.person.toLowerCase()] = id;
      counts.contacts_created++;

      await logActivity({
        type: "contact_created",
        title: `Contact added: ${rel.person}`,
        description: `${rel.person} (${rel.organization}) — ${rel.relationship_to_us}`,
        entity_type: "contact",
        entity_id: id,
      });
    }

    // Log interaction
    await saveInteraction({
      id: crypto.randomUUID(),
      contact_id: contactIdMap[rel.person.toLowerCase()],
      type: "extraction",
      summary: `Mentioned in ${extraction.source_filename}`,
      extraction_id: extraction.id,
      created_at: now,
    });
    counts.interactions_logged++;
  }

  // ── Deals from prospects ────────────────────────────────────────
  for (const prospect of extraction.prospects || []) {
    if (!prospect.prospect) continue;

    const existingDeals = await listDeals();
    const existing = existingDeals.find(
      (d) => d.title.toLowerCase() === prospect.prospect.toLowerCase()
    );

    if (existing) {
      const newStage = mapProspectStage(prospect.status);
      const stageOrder: DealStage[] = ["lead", "qualified", "proposal", "negotiation", "closed_won", "closed_lost"];
      const currentIdx = stageOrder.indexOf(existing.stage);
      const newIdx = stageOrder.indexOf(newStage);

      const sources = new Set(existing.source_extractions);
      sources.add(extraction.id);

      const contactId = contactIdMap[prospect.contact_person?.toLowerCase()];
      const contactIds = new Set(existing.contact_ids);
      if (contactId) contactIds.add(contactId);

      const pricingTerms = [...existing.pricing_terms, ...(extraction.pricing || [])];
      const agreements = [...existing.agreements, ...(extraction.agreements || [])];

      const updates: Partial<Deal> = {
        source_extractions: Array.from(sources),
        contact_ids: Array.from(contactIds),
        next_action: prospect.next_action || existing.next_action,
        deadline: prospect.deadline || existing.deadline,
        pricing_terms: pricingTerms,
        agreements,
        win_probability: computeWinProbability(prospect.status, pricingTerms, agreements),
      };

      if (newIdx > currentIdx) {
        updates.stage = newStage;
        await logActivity({
          type: "deal_stage_changed",
          title: `Deal progressed: ${prospect.prospect}`,
          description: `${existing.stage} → ${newStage}`,
          entity_type: "deal",
          entity_id: existing.id,
        });
      }

      await saveDeal({ ...existing, ...updates, updated_at: now });
      counts.deals_updated++;
    } else {
      const id = crypto.randomUUID();
      const contactId = contactIdMap[prospect.contact_person?.toLowerCase()];
      const stage = mapProspectStage(prospect.status);

      const deal: Deal = {
        id,
        title: prospect.prospect,
        contact_ids: contactId ? [contactId] : [],
        stage,
        currency: "USD",
        win_probability: computeWinProbability(prospect.status, extraction.pricing || [], extraction.agreements || []),
        owner: prospect.owner || "",
        next_action: prospect.next_action || "",
        deadline: prospect.deadline || "",
        source_extractions: [extraction.id],
        pricing_terms: extraction.pricing || [],
        agreements: extraction.agreements || [],
        created_at: now,
        updated_at: now,
      };
      await saveDeal(deal);
      counts.deals_created++;

      await logActivity({
        type: "deal_created",
        title: `Deal created: ${prospect.prospect}`,
        description: `Stage: ${stage}, Owner: ${prospect.owner}`,
        entity_type: "deal",
        entity_id: id,
      });
    }
  }

  // ── Tasks from action items + followups (with deduplication) ────
  const existingTasks = await listTasks();

  for (const action of extraction.action_items || []) {
    if (action.status === "done") continue;

    // Smart dedup: skip if a similar active task already exists
    const duplicate = findDuplicateTask(existingTasks, action.action, action.owner);
    if (duplicate) {
      // Update existing task if new info is available
      const updates: Partial<Task> = {};
      if (action.deadline && !duplicate.deadline) updates.deadline = action.deadline;
      if (action.status === "in_progress" && duplicate.status === "pending") updates.status = "in_progress";
      if (Object.keys(updates).length > 0) {
        await updateTask(duplicate.id, updates);
        counts.tasks_created++; // count as update
      }
      continue;
    }

    const task: Task = {
      id: crypto.randomUUID(),
      title: action.action,
      description: action.source_quote || "",
      status: action.status === "in_progress" ? "in_progress" : "pending",
      priority: inferPriority(action.deadline),
      owner: action.owner || "",
      deadline: action.deadline || "",
      extraction_id: extraction.id,
      source: "extraction",
      created_at: now,
      updated_at: now,
    };
    await saveTask(task);
    existingTasks.push(task);
    counts.tasks_created++;
  }

  for (const followup of extraction.followups || []) {
    const title = `Follow up: ${followup.topic}`;

    // Dedup followups too
    const duplicate = findDuplicateTask(existingTasks, followup.topic, followup.between_whom);
    if (duplicate) continue;

    const task: Task = {
      id: crypto.randomUUID(),
      title,
      description: `Between: ${followup.between_whom}\nReason deferred: ${followup.why_deferred}\nNext step: ${followup.suggested_next_step}`,
      status: "pending",
      priority: "medium",
      owner: followup.between_whom?.split(",")[0]?.trim() || "",
      deadline: "",
      extraction_id: extraction.id,
      source: "extraction",
      created_at: now,
      updated_at: now,
    };
    await saveTask(task);
    existingTasks.push(task);
    counts.tasks_created++;
  }

  // ── Compute relationship strengths ──────────────────────────────
  for (const [name, contactId] of Object.entries(contactIdMap)) {
    const strength = computeRelationshipStrength(name, extraction);
    await updateContact(contactId, { relationship_strength: strength });
  }

  // Log the extraction activity
  await logActivity({
    type: "extraction",
    title: `Extraction: ${extraction.source_filename}`,
    description: `${counts.contacts_created} contacts, ${counts.deals_created} deals, ${counts.tasks_created} tasks created`,
    entity_type: "extraction",
    entity_id: extraction.id,
  });

  return counts;
}

// ── Helpers ─────────────────────────────────────────────────────────

function mapRelationshipType(rel: string): RelationshipType | null {
  const lower = (rel || "").toLowerCase();
  if (lower.includes("client") || lower.includes("customer")) return "client";
  if (lower.includes("partner")) return "partner";
  if (lower.includes("gatekeeper")) return "gatekeeper";
  if (lower.includes("referral")) return "referral";
  if (lower.includes("competitor")) return "competitor";
  if (lower.includes("internal") || lower.includes("team")) return "internal";
  return null;
}

function mapProspectStage(status: string): DealStage {
  switch (status) {
    case "cold": return "lead";
    case "warm": return "qualified";
    case "hot": return "proposal";
    case "closed": return "closed_won";
    default: return "lead";
  }
}

function computeWinProbability(
  status: string,
  pricing: { agreed?: string }[],
  agreements: { binding?: string }[]
): number {
  let prob = 10;
  if (status === "warm") prob = 30;
  if (status === "hot") prob = 60;
  if (status === "closed") prob = 100;

  const hasPricingAgreed = pricing.some((p) => p.agreed?.toLowerCase() === "yes");
  if (hasPricingAgreed) prob = Math.min(prob + 15, 100);

  const hasBinding = agreements.some((a) => a.binding === "yes");
  if (hasBinding) prob = Math.min(prob + 20, 100);

  return prob;
}

function computeRelationshipStrength(name: string, extraction: PipelineExtraction): number {
  let score = 0;

  const mentionCount = [
    ...(extraction.relationships || []).filter((r) => r.person.toLowerCase() === name),
    ...(extraction.prospects || []).filter((p) => p.contact_person?.toLowerCase() === name),
    ...(extraction.action_items || []).filter((a) => a.owner?.toLowerCase() === name),
  ].length;
  score += Math.min(mentionCount * 10, 30);

  score += 30;

  const types = new Set<string>();
  if ((extraction.relationships || []).some((r) => r.person.toLowerCase() === name)) types.add("relationship");
  if ((extraction.prospects || []).some((p) => p.contact_person?.toLowerCase() === name)) types.add("prospect");
  if ((extraction.action_items || []).some((a) => a.owner?.toLowerCase() === name)) types.add("action");
  if ((extraction.followups || []).some((f) => f.between_whom?.toLowerCase().includes(name))) types.add("followup");
  score += Math.min(types.size * 5, 20);

  const isHot = (extraction.prospects || []).some(
    (p) => p.contact_person?.toLowerCase() === name && p.status === "hot"
  );
  if (isHot) score += 20;

  return Math.min(score, 100);
}

function findDuplicateTask(tasks: Task[], title: string, owner?: string): Task | null {
  const normalize = (s: string) => s.toLowerCase().replace(/[^a-z0-9]/g, "");
  const normalTitle = normalize(title);

  for (const t of tasks) {
    if (t.status === "completed" || t.status === "cancelled") continue;

    const existingNorm = normalize(t.title);

    // Exact or near-exact match
    if (existingNorm === normalTitle) return t;

    // One contains the other (catches "Follow up: X" matching "X")
    if (existingNorm.includes(normalTitle) || normalTitle.includes(existingNorm)) {
      // Also check owner similarity if provided
      if (!owner || !t.owner || normalize(owner).includes(normalize(t.owner)) || normalize(t.owner).includes(normalize(owner))) {
        return t;
      }
    }

    // Fuzzy: >70% word overlap
    const titleWordsArr = title.toLowerCase().split(/\s+/).filter(w => w.length > 2);
    const existingWordsSet = new Set(t.title.toLowerCase().split(/\s+/).filter(w => w.length > 2));
    if (titleWordsArr.length > 0 && existingWordsSet.size > 0) {
      let overlap = 0;
      for (const w of titleWordsArr) { if (existingWordsSet.has(w)) overlap++; }
      const ratio = overlap / Math.min(titleWordsArr.length, existingWordsSet.size);
      if (ratio >= 0.7) return t;
    }
  }

  return null;
}

function inferPriority(deadline: string): "high" | "medium" | "low" {
  if (!deadline) return "medium";
  try {
    const d = new Date(deadline);
    const now = new Date();
    const daysUntil = (d.getTime() - now.getTime()) / (1000 * 60 * 60 * 24);
    if (daysUntil < 0) return "high";
    if (daysUntil <= 2) return "high";
    if (daysUntil <= 7) return "medium";
    return "low";
  } catch {
    return "medium";
  }
}
