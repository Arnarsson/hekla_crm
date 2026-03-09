import type { PipelineExtraction } from "./types";

// ── CSV Export ────────────────────────────────────────────────────────

export function exportProspectsCSV(extraction: PipelineExtraction): string {
  const headers = ["#", "Prospect", "Contact Person", "Source", "Status", "Next Action", "Owner", "Deadline", "Notes"];
  const rows = extraction.prospects.map((p, i) => [
    i + 1, p.prospect, p.contact_person, p.source, p.status, p.next_action, p.owner, p.deadline, p.notes,
  ]);
  return toCSV(headers, rows);
}

export function exportActionItemsCSV(extraction: PipelineExtraction): string {
  const headers = ["#", "Action Item", "Owner", "Deadline", "Status", "Depends On", "Source Quote"];
  const rows = extraction.action_items.map((a, i) => [
    i + 1, a.action, a.owner, a.deadline, a.status, a.depends_on, a.source_quote,
  ]);
  return toCSV(headers, rows);
}

export function exportFullCSV(extraction: PipelineExtraction): string {
  let csv = "=== PROSPECTS ===\n" + exportProspectsCSV(extraction);
  csv += "\n\n=== ACTION ITEMS ===\n" + exportActionItemsCSV(extraction);
  csv += "\n\n=== RISKS ===\n";

  const riskHeaders = ["#", "Risk", "Raised By", "Severity", "Mitigation", "Status"];
  const riskRows = extraction.risks.map((r, i) => [
    i + 1, r.risk, r.raised_by, r.severity, r.mitigation, r.status,
  ]);
  csv += toCSV(riskHeaders, riskRows);

  return csv;
}

function toCSV(headers: string[], rows: (string | number)[][]): string {
  const escape = (val: string | number) => {
    const s = String(val);
    return s.includes(",") || s.includes('"') || s.includes("\n") ? `"${s.replace(/"/g, '""')}"` : s;
  };
  const lines = [headers.map(escape).join(",")];
  for (const row of rows) {
    lines.push(row.map(escape).join(","));
  }
  return lines.join("\n");
}

// ── Linear Issues Export ─────────────────────────────────────────────

export function exportToLinearFormat(extraction: PipelineExtraction): string {
  const issues: string[] = [];

  // Action items as issues
  for (const item of extraction.action_items) {
    const priority = item.status === "open" ? "High" : "Normal";
    issues.push(
      `## ${item.action}\n` +
      `- **Assignee**: ${item.owner}\n` +
      `- **Priority**: ${priority}\n` +
      `- **Due**: ${item.deadline}\n` +
      `- **Status**: ${item.status === "open" ? "Todo" : item.status === "in_progress" ? "In Progress" : "Done"}\n` +
      `- **Context**: ${item.source_quote}\n` +
      `- **Dependencies**: ${item.depends_on || "None"}\n`
    );
  }

  // High-severity risks as issues
  for (const risk of extraction.risks.filter((r) => r.severity === "high")) {
    issues.push(
      `## [RISK] ${risk.risk}\n` +
      `- **Assignee**: ${risk.raised_by}\n` +
      `- **Priority**: Urgent\n` +
      `- **Label**: Risk\n` +
      `- **Mitigation**: ${risk.mitigation}\n`
    );
  }

  return issues.join("\n---\n\n");
}

// ── Notion Database Export ───────────────────────────────────────────

export function exportToNotionFormat(extraction: PipelineExtraction): string {
  const blocks: string[] = [];

  blocks.push(`# Pipeline Extraction: ${extraction.source_filename}`);
  blocks.push(`**Date**: ${extraction.created_at}`);
  blocks.push(`**Source**: ${extraction.source_type}`);
  blocks.push("");
  blocks.push("## Executive Summary");
  blocks.push(extraction.executive_summary);
  blocks.push("");

  // Prospects database
  blocks.push("## Prospects Database");
  blocks.push("| Prospect | Contact | Status | Next Action | Owner | Deadline |");
  blocks.push("|----------|---------|--------|-------------|-------|----------|");
  for (const p of extraction.prospects) {
    const statusEmoji = p.status === "hot" ? "🟢" : p.status === "warm" ? "🟡" : p.status === "closed" ? "✅" : "🔴";
    blocks.push(`| ${p.prospect} | ${p.contact_person} | ${statusEmoji} ${p.status} | ${p.next_action} | ${p.owner} | ${p.deadline} |`);
  }
  blocks.push("");

  // Action items
  blocks.push("## Action Items");
  blocks.push("| Action | Owner | Deadline | Status | Dependencies |");
  blocks.push("|--------|-------|----------|--------|--------------|");
  for (const a of extraction.action_items) {
    const statusEmoji = a.status === "done" ? "✅" : a.status === "in_progress" ? "🔄" : a.status === "unclear" ? "❓" : "🔲";
    blocks.push(`| ${a.action} | ${a.owner} | ${a.deadline} | ${statusEmoji} ${a.status} | ${a.depends_on || "-"} |`);
  }

  return blocks.join("\n");
}

// ── Markdown Export ──────────────────────────────────────────────────

export function exportToMarkdown(extraction: PipelineExtraction): string {
  const lines: string[] = [];

  lines.push(`# Pipeline Intelligence Report`);
  lines.push(`**Source**: ${extraction.source_filename} (${extraction.source_type})`);
  lines.push(`**Extracted**: ${extraction.created_at}`);
  if (extraction.context_label) lines.push(`**Context**: ${extraction.context_label}`);
  lines.push("");

  lines.push("## Executive Summary");
  lines.push(extraction.executive_summary);
  lines.push("");

  // Prospects
  if (extraction.prospects.length > 0) {
    lines.push("## 1. Prospect & Lead Pipeline");
    lines.push("| # | Prospect | Contact | Status | Next Action | Owner | Deadline |");
    lines.push("|---|----------|---------|--------|-------------|-------|----------|");
    extraction.prospects.forEach((p, i) => {
      const st = p.status === "hot" ? "🟢 Hot" : p.status === "warm" ? "🟡 Warm" : p.status === "closed" ? "✅ Closed" : "🔴 Cold";
      lines.push(`| ${i + 1} | ${p.prospect} | ${p.contact_person} | ${st} | ${p.next_action} | ${p.owner} | ${p.deadline} |`);
    });
    lines.push("");
  }

  // Agreements
  if (extraction.agreements.length > 0) {
    lines.push("## 2. Agreements & Decisions");
    lines.push("| # | Decision | Who Agreed | Context | Binding | Dependencies |");
    lines.push("|---|----------|------------|---------|---------|--------------|");
    extraction.agreements.forEach((a, i) => {
      lines.push(`| ${i + 1} | ${a.decision} | ${a.who_agreed} | ${a.date_context} | ${a.binding} | ${a.dependencies} |`);
    });
    lines.push("");
  }

  // Ideas
  if (extraction.ideas.length > 0) {
    lines.push("## 3. Ideas & Opportunities");
    lines.push("| # | Idea | By | Category | Priority | Status | Value |");
    lines.push("|---|------|-----|----------|----------|--------|-------|");
    extraction.ideas.forEach((idea, i) => {
      lines.push(`| ${i + 1} | ${idea.idea} | ${idea.proposed_by} | ${idea.category} | ${idea.priority_signal} | ${idea.status} | ${idea.potential_value} |`);
    });
    lines.push("");
  }

  // Action items
  if (extraction.action_items.length > 0) {
    lines.push("## 4. Action Items");
    lines.push("| # | Action | Owner | Deadline | Status | Quote |");
    lines.push("|---|--------|-------|----------|--------|-------|");
    extraction.action_items.forEach((a, i) => {
      const st = a.status === "done" ? "✅" : a.status === "in_progress" ? "🔄" : a.status === "unclear" ? "❓" : "🔲";
      lines.push(`| ${i + 1} | ${a.action} | ${a.owner} | ${a.deadline} | ${st} | ${a.source_quote} |`);
    });
    lines.push("");
  }

  // Risks
  if (extraction.risks.length > 0) {
    lines.push("## 8. Risks & Blockers");
    lines.push("| # | Risk | Raised By | Severity | Mitigation | Status |");
    lines.push("|---|------|-----------|----------|------------|--------|");
    extraction.risks.forEach((r, i) => {
      const sev = r.severity === "high" ? "🔴 High" : r.severity === "medium" ? "🟡 Med" : "🟢 Low";
      lines.push(`| ${i + 1} | ${r.risk} | ${r.raised_by} | ${sev} | ${r.mitigation} | ${r.status} |`);
    });
    lines.push("");
  }

  // Followups
  if (extraction.followups.length > 0) {
    lines.push("## 9. Follow-up Conversations Needed");
    lines.push("| # | Topic | Between | Why Deferred | Next Step |");
    lines.push("|---|-------|---------|-------------|-----------|");
    extraction.followups.forEach((f, i) => {
      lines.push(`| ${i + 1} | ${f.topic} | ${f.between_whom} | ${f.why_deferred} | ${f.suggested_next_step} |`);
    });
    lines.push("");
  }

  return lines.join("\n");
}
