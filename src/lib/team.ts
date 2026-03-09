// ── Team Members ────────────────────────────────────────────────────
// Central team member registry used across the app for assignment,
// tagging, and @mention features.

export interface TeamMember {
  id: string;
  name: string;
  initials: string;
  color: string; // tailwind bg class
  role: string;
}

export const TEAM_MEMBERS: TeamMember[] = [
  { id: "sven", name: "Sven", initials: "SV", color: "bg-blue-600", role: "Lead" },
  { id: "hjalti", name: "Hjalti", initials: "HJ", color: "bg-purple-600", role: "Engineering" },
  { id: "christopher", name: "Christopher", initials: "CJ", color: "bg-green-600", role: "Operations" },
];

// Aliases map messy extraction data to canonical member IDs
const ALIASES: Record<string, string> = {
  sven: "sven",
  hjalti: "hjalti",
  "hjalti jonsson": "hjalti",
  christopher: "christopher",
  "christopher james": "christopher",
  chris: "christopher",
};

export function getMember(idOrName: string): TeamMember | undefined {
  const lower = idOrName.toLowerCase().trim();
  // Direct match
  const direct = TEAM_MEMBERS.find(
    (m) => m.id === lower || m.name.toLowerCase() === lower
  );
  if (direct) return direct;
  // Alias match
  const aliasId = ALIASES[lower];
  if (aliasId) return TEAM_MEMBERS.find((m) => m.id === aliasId);
  return undefined;
}

/**
 * Normalize a raw owner string from extraction data to canonical team member names.
 * "Hjalti Jonsson" → "Hjalti"
 * "Christopher James" → "Christopher"
 * "Sven / Hjalti" → "Sven, Hjalti" (multiple)
 * "All three" → "Sven, Hjalti, Christopher"
 * "Unassigned [AMBIGUOUS]" → "" (unassigned)
 */
export interface NormalizedOwner {
  name: string;
  confidence: number; // 0-1
}

export function normalizeOwner(raw: string): string {
  return normalizeOwnerWithConfidence(raw).name;
}

export function normalizeOwnerWithConfidence(raw: string): NormalizedOwner {
  if (!raw) return { name: "", confidence: 0 };
  const lower = raw.toLowerCase().trim();

  // Handle "all three" / "all"
  if (lower === "all three" || lower === "all") {
    return { name: "All", confidence: 1 };
  }

  // Handle [AMBIGUOUS] markers — try to extract a real name first
  const hasAmbiguous = lower.includes("[ambiguous]");
  const cleaned = raw.replace(/\s*\[AMBIGUOUS\]\s*/g, "").trim();

  if (lower.includes("unassigned") && !cleaned.replace(/unassigned/i, "").trim()) {
    return { name: "", confidence: 0 };
  }

  // Handle multi-person: "Sven / Hjalti", "Sven, Christopher James"
  const separators = /\s*[\/,]\s*/;
  const parts = cleaned.split(separators).filter(Boolean);

  if (parts.length > 1) {
    const resolved = parts
      .map((p) => {
        const clean = p.replace(/\s*\(.*?\)\s*/g, "").trim();
        const member = getMember(clean);
        return member?.name || "";
      })
      .filter(Boolean);
    const unique = Array.from(new Set(resolved));
    if (unique.length === TEAM_MEMBERS.length) {
      return { name: "All", confidence: hasAmbiguous ? 0.6 : 0.9 };
    }
    if (unique.length > 0) {
      return { name: unique.join(", "), confidence: hasAmbiguous ? 0.5 : 0.9 };
    }
    // Could not resolve any — guess from keywords
    return guessMember(cleaned);
  }

  // Single person
  const cleanSingle = cleaned.replace(/\s*\(.*?\)\s*/g, "").trim();
  const member = getMember(cleanSingle);
  if (member) {
    return { name: member.name, confidence: hasAmbiguous ? 0.6 : 1 };
  }

  // No direct match — guess based on keywords
  return guessMember(cleanSingle);
}

/** Guess the most likely team member from free text */
function guessMember(text: string): NormalizedOwner {
  const lower = text.toLowerCase();
  // Check if any member name appears as substring
  for (const m of TEAM_MEMBERS) {
    if (lower.includes(m.name.toLowerCase()) || lower.includes(m.id)) {
      return { name: m.name, confidence: 0.5 };
    }
  }
  // Check aliases
  for (const [alias, memberId] of Object.entries(ALIASES)) {
    if (lower.includes(alias)) {
      const member = TEAM_MEMBERS.find((m) => m.id === memberId);
      if (member) return { name: member.name, confidence: 0.4 };
    }
  }
  // Unknown — return raw text with low confidence
  return { name: text, confidence: 0.2 };
}

/**
 * Extract individual team member names from a (possibly multi-person) owner string.
 * Returns canonical member names only (not free-text).
 */
export function getOwnerMembers(raw: string): TeamMember[] {
  const normalized = normalizeOwner(raw);
  if (!normalized) return [];
  return normalized.split(", ").map((n) => getMember(n)).filter(Boolean) as TeamMember[];
}

export function getMemberColor(name: string): string {
  const member = getMember(name);
  return member?.color || "bg-zinc-600";
}

export function getMemberInitials(name: string): string {
  const member = getMember(name);
  if (member) return member.initials;
  return name.slice(0, 2).toUpperCase();
}

// ── Labels / Tags ──────────────────────────────────────────────────

export interface IssueLabel {
  id: string;
  name: string;
  color: string; // tailwind text + bg classes
}

export const ISSUE_LABELS: IssueLabel[] = [
  { id: "bug", name: "Bug", color: "bg-red-900/30 text-red-400" },
  { id: "feature", name: "Feature", color: "bg-blue-900/30 text-blue-400" },
  { id: "improvement", name: "Improvement", color: "bg-cyan-900/30 text-cyan-400" },
  { id: "urgent", name: "Urgent", color: "bg-orange-900/30 text-orange-400" },
  { id: "blocked", name: "Blocked", color: "bg-yellow-900/30 text-yellow-500" },
  { id: "design", name: "Design", color: "bg-pink-900/30 text-pink-400" },
  { id: "infra", name: "Infra", color: "bg-green-900/30 text-green-400" },
  { id: "research", name: "Research", color: "bg-purple-900/30 text-purple-400" },
];

export function getLabel(id: string): IssueLabel | undefined {
  return ISSUE_LABELS.find((l) => l.id === id);
}
