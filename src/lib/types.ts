// ── Core Pipeline Types ──────────────────────────────────────────────

export interface PipelineExtraction {
  id: string;
  created_at: string;
  source_filename: string;
  source_type: "whatsapp" | "slack" | "email" | "transcript" | "other";
  context_label?: string;
  prospects: Prospect[];
  agreements: Agreement[];
  ideas: Idea[];
  action_items: ActionItem[];
  pricing: PricingTerm[];
  milestones: Milestone[];
  relationships: Relationship[];
  risks: Risk[];
  followups: Followup[];
  executive_summary: string;
  raw_input_preview?: string;
  agent_id?: string;
}

export interface Prospect {
  prospect: string;
  contact_person: string;
  source: string;
  status: "cold" | "warm" | "hot" | "closed";
  next_action: string;
  owner: string;
  deadline: string;
  notes: string;
}

export interface Agreement {
  decision: string;
  who_agreed: string;
  date_context: string;
  binding: "yes" | "no" | "soft";
  dependencies: string;
}

export interface Idea {
  idea: string;
  proposed_by: string;
  category: string;
  priority_signal: "high" | "medium" | "low" | "unclear";
  status: string;
  potential_value: string;
}

export interface ActionItem {
  action: string;
  owner: string;
  deadline: string;
  status: "open" | "in_progress" | "done" | "unclear";
  depends_on: string;
  source_quote: string;
}

export interface PricingTerm {
  item: string;
  proposed_terms: string;
  who_proposed: string;
  agreed: string;
  notes: string;
}

export interface Milestone {
  milestone: string;
  target_date: string;
  owner: string;
  status: string;
  dependencies: string;
}

export interface Relationship {
  person: string;
  organization: string;
  role: string;
  relationship_to_us: string;
  notes: string;
}

export interface Risk {
  risk: string;
  raised_by: string;
  severity: "high" | "medium" | "low";
  mitigation: string;
  status: string;
}

export interface Followup {
  topic: string;
  between_whom: string;
  why_deferred: string;
  suggested_next_step: string;
}

// ── CRM Types ───────────────────────────────────────────────────────

export type RelationshipType = "client" | "partner" | "gatekeeper" | "referral" | "competitor" | "internal";

export type EngagementStatus = "active" | "warming" | "cooling" | "cold" | "strategic_pause";

export interface ContactNote {
  id: string;
  text: string;
  created_at: string;
}

export interface ContactIntelligence {
  strategic_summary: string;
  engagement_score: number; // 0-100
  engagement_status: EngagementStatus;
  relationship_strength_label: "weak" | "moderate" | "strong" | "urgent";
  next_actions: { action: string; priority: "low" | "medium" | "high" | "urgent"; context: string }[];
  key_topics: string[];
  value_provided?: string;
  value_received?: string;
  risk_level: "low" | "medium" | "high" | "critical";
  trend: "improving" | "stable" | "declining";
  days_since_contact: number;
}

export interface Contact {
  id: string;
  name: string;
  organization: string;
  role: string;
  relationship_type: RelationshipType;
  email?: string;
  phone?: string;
  linkedin_url?: string;
  trust: number; // 1-5 stars
  relationship_strength: number; // 0-100
  engagement_score: number; // 0-100
  engagement_status: EngagementStatus;
  last_interaction: string; // ISO date
  tags: string[];
  notes: ContactNote[];
  source_extractions: string[];
  merged_from?: string[];
  intelligence?: ContactIntelligence;
  created_at: string;
  updated_at: string;
}

export type DealStage = "lead" | "qualified" | "proposal" | "negotiation" | "closed_won" | "closed_lost";

export interface Deal {
  id: string;
  title: string;
  contact_ids: string[];
  stage: DealStage;
  value?: number;
  currency: string;
  win_probability: number; // 0-100
  owner: string;
  next_action: string;
  deadline: string;
  source_extractions: string[];
  pricing_terms: PricingTerm[];
  agreements: Agreement[];
  created_at: string;
  updated_at: string;
}

export type TaskStatus = "pending" | "in_progress" | "completed" | "cancelled";
export type TaskPriority = "high" | "medium" | "low";
export type TaskSource = "extraction" | "manual" | "agent" | "auto_action";

export interface Task {
  id: string;
  title: string;
  description: string;
  status: TaskStatus;
  priority: TaskPriority;
  owner: string;
  deadline: string;
  contact_id?: string;
  deal_id?: string;
  extraction_id?: string;
  assigned_agent?: string;
  tags?: string[];
  source: TaskSource;
  created_at: string;
  updated_at: string;
}

export interface Interaction {
  id: string;
  contact_id: string;
  deal_id?: string;
  type: string;
  summary: string;
  extraction_id?: string;
  created_at: string;
}

export type ActivityType = "extraction" | "contact_created" | "contact_updated" | "deal_created" | "deal_updated" | "deal_stage_changed" | "task_created" | "task_completed" | "agent_action" | "scan" | "alert";

export interface Activity {
  id: string;
  type: ActivityType;
  title: string;
  description: string;
  entity_type?: "contact" | "deal" | "task" | "extraction";
  entity_id?: string;
  created_at: string;
}

// ── TinyClaw Agent Types ─────────────────────────────────────────────

export interface TinyClawAgent {
  id: string;
  name: string;
  provider: string;
  model: string;
  status: "idle" | "processing" | "error";
  system_prompt?: string;
  working_directory?: string;
}

export interface TinyClawTeam {
  id: string;
  name: string;
  agents: string[];
  leader_agent: string;
}

export interface TinyClawMessage {
  id: string;
  agent_id: string;
  content: string;
  status: "pending" | "processing" | "completed" | "dead";
  created_at: string;
  completed_at?: string;
  response?: string;
}

export interface TinyClawEvent {
  type: string;
  agent_id?: string;
  team_id?: string;
  data: Record<string, unknown>;
  timestamp: string;
}

// ── Dashboard Types ──────────────────────────────────────────────────

export interface DashboardStats {
  total_extractions: number;
  total_prospects: number;
  hot_prospects: number;
  open_actions: number;
  high_risks: number;
  active_agents: number;
  total_contacts: number;
  active_deals: number;
  pipeline_value: number;
  pending_tasks: number;
}
