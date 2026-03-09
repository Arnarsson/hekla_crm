/**
 * Hybrid Store — Vercel KV (hosted) with JSON file fallback (local dev)
 *
 * On Vercel: uses @vercel/kv (Upstash Redis) for persistent storage
 * Locally: uses pipeline-intel-data.json file as before
 */

import type {
  PipelineExtraction,
  DashboardStats,
  Contact,
  Deal,
  Task,
  Interaction,
  Activity,
} from "./types";

// ── Store Types ─────────────────────────────────────────────────────

interface StoreData {
  extractions: Record<string, StoredExtraction>;
  agent_runs: Record<string, AgentRun>;
  contacts: Record<string, Contact>;
  deals: Record<string, Deal>;
  tasks: Record<string, Task>;
  interactions: Record<string, Interaction>;
  activities: Record<string, Activity>;
  partners?: unknown[];
}

interface StoredExtraction {
  id: string;
  created_at: string;
  source_filename: string;
  source_type: string;
  context_label?: string;
  raw_input_preview?: string;
  agent_id?: string;
  data: Record<string, unknown>;
}

interface AgentRun {
  id: string;
  extraction_id?: string;
  agent_id: string;
  status: string;
  started_at: string;
  completed_at?: string;
  error?: string;
}

const EMPTY_STORE: StoreData = {
  extractions: {},
  agent_runs: {},
  contacts: {},
  deals: {},
  tasks: {},
  interactions: {},
  activities: {},
};

const KV_KEY = "hekla:store";

// ── Storage Backend Detection ───────────────────────────────────────

function isRedis(): boolean {
  return !!(process.env.UPSTASH_REDIS_REST_URL && process.env.UPSTASH_REDIS_REST_TOKEN);
}

// ── File Storage (local dev) ────────────────────────────────────────

function readFileStore(): StoreData {
  try {
    const fs = require("fs");
    const path = require("path");
    const DATA_PATH = path.join(process.cwd(), "pipeline-intel-data.json");
    if (fs.existsSync(DATA_PATH)) {
      const raw = fs.readFileSync(DATA_PATH, "utf-8");
      const data = JSON.parse(raw) as Partial<StoreData>;
      return { ...EMPTY_STORE, ...data };
    }
  } catch (err) {
    console.error("Failed to read file store:", err);
  }
  return { ...EMPTY_STORE };
}

function writeFileStore(data: StoreData): void {
  const fs = require("fs");
  const path = require("path");
  const DATA_PATH = path.join(process.cwd(), "pipeline-intel-data.json");
  fs.writeFileSync(DATA_PATH, JSON.stringify(data, null, 2), "utf-8");
}

// ── Redis Storage (Upstash) ─────────────────────────────────────────

async function readRedisStore(): Promise<StoreData> {
  try {
    const { Redis } = await import("@upstash/redis");
    const redis = new Redis({
      url: process.env.UPSTASH_REDIS_REST_URL!,
      token: process.env.UPSTASH_REDIS_REST_TOKEN!,
    });
    const data = await redis.get<StoreData>(KV_KEY);
    if (data) return { ...EMPTY_STORE, ...data };
  } catch (err) {
    console.error("Failed to read Redis store:", err);
  }
  return { ...EMPTY_STORE };
}

async function writeRedisStore(data: StoreData): Promise<void> {
  try {
    const { Redis } = await import("@upstash/redis");
    const redis = new Redis({
      url: process.env.UPSTASH_REDIS_REST_URL!,
      token: process.env.UPSTASH_REDIS_REST_TOKEN!,
    });
    await redis.set(KV_KEY, data);
  } catch (err) {
    console.error("Failed to write Redis store:", err);
  }
}

// ── Unified Interface (sync for file, async for KV) ─────────────────

export function readStore(): StoreData {
  if (isRedis()) {
    // In KV mode, return empty store synchronously — callers must use async versions
    // This exists for backward compat; prefer readStoreAsync
    console.warn("readStore() called in KV mode — use readStoreAsync() for correct data");
    return { ...EMPTY_STORE };
  }
  return readFileStore();
}

export function writeStore(data: StoreData): void {
  if (isRedis()) {
    // Fire and forget KV write
    writeRedisStore(data).catch(console.error);
    return;
  }
  writeFileStore(data);
}

// ── Async Interface (works with both backends) ──────────────────────

export async function readStoreAsync(): Promise<StoreData> {
  if (isRedis()) return readRedisStore();
  return readFileStore();
}

export async function writeStoreAsync(data: StoreData): Promise<void> {
  if (isRedis()) return writeRedisStore(data);
  writeFileStore(data);
}

// ── Extractions ─────────────────────────────────────────────────────

export async function saveExtraction(extraction: PipelineExtraction): Promise<void> {
  const store = await readStoreAsync();
  const { id, created_at, source_filename, source_type, context_label, raw_input_preview, agent_id, ...data } = extraction;

  store.extractions[id] = {
    id,
    created_at: created_at || new Date().toISOString(),
    source_filename,
    source_type,
    context_label: context_label || undefined,
    raw_input_preview: raw_input_preview || undefined,
    agent_id: agent_id || undefined,
    data,
  };

  await writeStoreAsync(store);
}

export async function getExtraction(id: string): Promise<PipelineExtraction | null> {
  const store = await readStoreAsync();
  const row = store.extractions[id];
  if (!row) return null;

  return {
    id: row.id,
    created_at: row.created_at,
    source_filename: row.source_filename,
    source_type: row.source_type as PipelineExtraction["source_type"],
    context_label: row.context_label,
    raw_input_preview: row.raw_input_preview,
    agent_id: row.agent_id,
    ...row.data,
  } as PipelineExtraction;
}

export async function listExtractions(limit = 50, offset = 0): Promise<PipelineExtraction[]> {
  const store = await readStoreAsync();

  const sorted = Object.values(store.extractions).sort(
    (a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
  );

  return sorted.slice(offset, offset + limit).map((row) => ({
    id: row.id,
    created_at: row.created_at,
    source_filename: row.source_filename,
    source_type: row.source_type as PipelineExtraction["source_type"],
    context_label: row.context_label,
    raw_input_preview: row.raw_input_preview,
    agent_id: row.agent_id,
    ...row.data,
  })) as PipelineExtraction[];
}

export async function deleteExtraction(id: string): Promise<boolean> {
  const store = await readStoreAsync();
  if (!store.extractions[id]) return false;
  delete store.extractions[id];
  await writeStoreAsync(store);
  return true;
}

export async function getDashboardStats(): Promise<DashboardStats> {
  const store = await readStoreAsync();
  const extractions = await listExtractions(1000);

  let total_prospects = 0;
  let hot_prospects = 0;
  let open_actions = 0;
  let high_risks = 0;

  for (const ext of extractions) {
    total_prospects += ext.prospects?.length || 0;
    hot_prospects += ext.prospects?.filter((p) => p.status === "hot").length || 0;
    open_actions += ext.action_items?.filter((a) => a.status === "open" || a.status === "in_progress").length || 0;
    high_risks += ext.risks?.filter((r) => r.severity === "high").length || 0;
  }

  const contacts = Object.values(store.contacts);
  const deals = Object.values(store.deals);
  const tasks = Object.values(store.tasks);

  const activeDeals = deals.filter((d) => d.stage !== "closed_won" && d.stage !== "closed_lost");
  const pipelineValue = activeDeals.reduce((sum, d) => sum + (d.value || 0), 0);
  const pendingTasks = tasks.filter((t) => t.status === "pending" || t.status === "in_progress");

  return {
    total_extractions: extractions.length,
    total_prospects,
    hot_prospects,
    open_actions,
    high_risks,
    active_agents: 0,
    total_contacts: contacts.length,
    active_deals: activeDeals.length,
    pipeline_value: pipelineValue,
    pending_tasks: pendingTasks.length,
  };
}

// ── Contacts ────────────────────────────────────────────────────────

export async function saveContact(contact: Contact): Promise<void> {
  const store = await readStoreAsync();
  store.contacts[contact.id] = contact;
  await writeStoreAsync(store);
}

export async function getContact(id: string): Promise<Contact | null> {
  const store = await readStoreAsync();
  return store.contacts[id] || null;
}

export async function listContacts(): Promise<Contact[]> {
  const store = await readStoreAsync();
  return Object.values(store.contacts).sort(
    (a, b) => b.relationship_strength - a.relationship_strength
  );
}

export async function findContactByNameOrg(name: string, org: string): Promise<Contact | null> {
  const store = await readStoreAsync();
  const nameLower = name.toLowerCase();
  const orgLower = org.toLowerCase();
  return Object.values(store.contacts).find(
    (c) => c.name.toLowerCase() === nameLower && c.organization.toLowerCase() === orgLower
  ) || Object.values(store.contacts).find(
    (c) => c.name.toLowerCase() === nameLower
  ) || null;
}

export async function updateContact(id: string, updates: Partial<Contact>): Promise<Contact | null> {
  const store = await readStoreAsync();
  const contact = store.contacts[id];
  if (!contact) return null;
  const updated = { ...contact, ...updates, updated_at: new Date().toISOString() };
  store.contacts[id] = updated;
  await writeStoreAsync(store);
  return updated;
}

export async function addContactNote(contactId: string, text: string): Promise<Contact | null> {
  const store = await readStoreAsync();
  const contact = store.contacts[contactId];
  if (!contact) return null;
  const notes = contact.notes || [];
  notes.unshift({ id: crypto.randomUUID(), text, created_at: new Date().toISOString() });
  contact.notes = notes;
  contact.updated_at = new Date().toISOString();
  store.contacts[contactId] = contact;
  await writeStoreAsync(store);
  return contact;
}

export async function deleteContactNote(contactId: string, noteId: string): Promise<Contact | null> {
  const store = await readStoreAsync();
  const contact = store.contacts[contactId];
  if (!contact) return null;
  contact.notes = (contact.notes || []).filter((n) => n.id !== noteId);
  contact.updated_at = new Date().toISOString();
  store.contacts[contactId] = contact;
  await writeStoreAsync(store);
  return contact;
}

export async function deleteContact(id: string): Promise<boolean> {
  const store = await readStoreAsync();
  if (!store.contacts[id]) return false;
  delete store.contacts[id];
  await writeStoreAsync(store);
  return true;
}

// ── Deals ───────────────────────────────────────────────────────────

export async function saveDeal(deal: Deal): Promise<void> {
  const store = await readStoreAsync();
  store.deals[deal.id] = deal;
  await writeStoreAsync(store);
}

export async function getDeal(id: string): Promise<Deal | null> {
  const store = await readStoreAsync();
  return store.deals[id] || null;
}

export async function listDeals(): Promise<Deal[]> {
  const store = await readStoreAsync();
  return Object.values(store.deals).sort(
    (a, b) => new Date(b.updated_at).getTime() - new Date(a.updated_at).getTime()
  );
}

export async function updateDeal(id: string, updates: Partial<Deal>): Promise<Deal | null> {
  const store = await readStoreAsync();
  const deal = store.deals[id];
  if (!deal) return null;
  const updated = { ...deal, ...updates, updated_at: new Date().toISOString() };
  store.deals[id] = updated;
  await writeStoreAsync(store);
  return updated;
}

export async function deleteDeal(id: string): Promise<boolean> {
  const store = await readStoreAsync();
  if (!store.deals[id]) return false;
  delete store.deals[id];
  await writeStoreAsync(store);
  return true;
}

// ── Tasks ───────────────────────────────────────────────────────────

export async function saveTask(task: Task): Promise<void> {
  const store = await readStoreAsync();
  store.tasks[task.id] = task;
  await writeStoreAsync(store);
}

export async function getTask(id: string): Promise<Task | null> {
  const store = await readStoreAsync();
  return store.tasks[id] || null;
}

export async function listTasks(): Promise<Task[]> {
  const store = await readStoreAsync();
  return Object.values(store.tasks).sort(
    (a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
  );
}

export async function updateTask(id: string, updates: Partial<Task>): Promise<Task | null> {
  const store = await readStoreAsync();
  const task = store.tasks[id];
  if (!task) return null;
  const updated = { ...task, ...updates, updated_at: new Date().toISOString() };
  store.tasks[id] = updated;
  await writeStoreAsync(store);
  return updated;
}

export async function deleteTask(id: string): Promise<boolean> {
  const store = await readStoreAsync();
  if (!store.tasks[id]) return false;
  delete store.tasks[id];
  await writeStoreAsync(store);
  return true;
}

export async function bulkDeleteTasks(ids: string[]): Promise<number> {
  const store = await readStoreAsync();
  let count = 0;
  for (const id of ids) {
    if (store.tasks[id]) { delete store.tasks[id]; count++; }
  }
  if (count > 0) await writeStoreAsync(store);
  return count;
}

export async function findTasksByTitle(titleFragment: string): Promise<Task[]> {
  const store = await readStoreAsync();
  const lower = titleFragment.toLowerCase();
  return Object.values(store.tasks).filter(
    (t) => t.title.toLowerCase().includes(lower)
  );
}

// ── Interactions ────────────────────────────────────────────────────

export async function saveInteraction(interaction: Interaction): Promise<void> {
  const store = await readStoreAsync();
  store.interactions[interaction.id] = interaction;
  await writeStoreAsync(store);
}

export async function listInteractionsByContact(contactId: string): Promise<Interaction[]> {
  const store = await readStoreAsync();
  return Object.values(store.interactions)
    .filter((i) => i.contact_id === contactId)
    .sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());
}

// ── Activities ──────────────────────────────────────────────────────

export async function logActivity(activity: Omit<Activity, "id" | "created_at">): Promise<void> {
  const store = await readStoreAsync();
  const id = crypto.randomUUID();
  store.activities[id] = {
    ...activity,
    id,
    created_at: new Date().toISOString(),
  };
  await writeStoreAsync(store);
}

export async function listActivities(limit = 50, offset = 0): Promise<Activity[]> {
  const store = await readStoreAsync();
  return Object.values(store.activities)
    .sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime())
    .slice(offset, offset + limit);
}

// ── Agent Runs ──────────────────────────────────────────────────────

export async function saveAgentRun(run: { id: string; extraction_id?: string; agent_id: string; status: string; error?: string }) {
  const store = await readStoreAsync();
  store.agent_runs[run.id] = {
    id: run.id,
    extraction_id: run.extraction_id || undefined,
    agent_id: run.agent_id,
    status: run.status,
    started_at: new Date().toISOString(),
    error: run.error || undefined,
  };
  await writeStoreAsync(store);
}

export async function updateAgentRun(id: string, status: string, error?: string) {
  const store = await readStoreAsync();
  const run = store.agent_runs[id];
  if (!run) return;

  run.status = status;
  if (status === "completed" || status === "error") {
    run.completed_at = new Date().toISOString();
  }
  if (error) run.error = error;
  await writeStoreAsync(store);
}
