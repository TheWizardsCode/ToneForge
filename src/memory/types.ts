/**
 * ToneForge Memory — record schema and validation.
 *
 * Memory is the long-term, project-local recall layer: it records *what
 * happened and what mattered* as append-only, versioned, timestamped and
 * attributable entries. It never makes decisions and never mutates library
 * assets.
 *
 * Record shape follows `docs/prd/MEMORY_PRD.md` §6 (append-only, versioned,
 * timestamped, attributable) and §4.2 (usage / preference / quality /
 * evolution / contextual categories).
 */

/** Current Memory schema version. */
export const MEMORY_VERSION = "1.0";

/** Repository-relative directory that holds the project-local memory store. */
export const MEMORY_DIR_PARTS = [".toneforge", "memory"] as const;

/** Append-only memory file name (one JSON object per line). */
export const MEMORY_FILE_NAME = "memory.jsonl";

/** The five Memory categories from the PRD (§4.2). */
export const MEMORY_CATEGORIES = [
  "usage",
  "preference",
  "quality",
  "evolution",
  "contextual",
] as const;

/** A Memory category. */
export type MemoryCategory = (typeof MEMORY_CATEGORIES)[number];

/** Controlled Memory event vocabulary. */
export const MEMORY_EVENTS = [
  "generation",
  "promotion",
  "rejection",
  "override",
  "usage",
  "evaluation",
  "evolution",
  "context",
] as const;

/** A Memory event kind. */
export type MemoryEvent = (typeof MEMORY_EVENTS)[number];

/** A primitive detail value (keeps records JSON-serialisable and inspectable). */
export type MemoryDetailValue = string | number | boolean | null;

/** A single append-only Memory record. */
export interface MemoryRecord {
  /** Schema version. */
  version: string;

  /** Deterministic record id. */
  id: string;

  /** ISO-8601 UTC timestamp of the event. */
  timestamp: string;

  /** Originating module (`explore`, `library`, `intent`, …). */
  module: string;

  /** Event kind. */
  event: MemoryEvent;

  /** Memory category. */
  category: MemoryCategory;

  /** Scope the event applies to (category, recipe, project, …). */
  scope: string;

  /** Event-specific details. */
  details: Record<string, MemoryDetailValue>;

  /** Confidence in the closed interval [0, 1]. */
  confidence: number;

  /** Who or what produced the record. */
  attribution: string;
}

/** Optional inclusive time range for a Memory query. */
export interface MemoryTimeRange {
  /** Inclusive lower bound (ISO-8601). */
  from?: string;

  /** Inclusive upper bound (ISO-8601). */
  to?: string;
}

/** Query options for a Memory report. */
export interface MemoryQueryOptions {
  /** Scope filter; when omitted every scope is included. */
  scope?: string;

  /** Inclusive time range filter. */
  timeRange?: MemoryTimeRange;
}

/** Rejected-intent summary row. */
export interface RejectedIntentSummary {
  /** Intent id that was rejected. */
  intent: string;

  /** Scope the rejection applies to. */
  scope: string;

  /** Human-readable rejection reason. */
  reason: string;

  /** ISO-8601 timestamp of the rejection. */
  timestamp: string;
}

/** Most-used seed row. */
export interface SeedUsageSummary {
  /** Recipe the seed belongs to. */
  recipe: string;

  /** Seed value. */
  seed: number;

  /** Number of times the seed was generated. */
  count: number;
}

/** Quality trend row (per UTC day). */
export interface QualityTrendPoint {
  /** UTC day (`YYYY-MM-DD`). */
  date: string;

  /** Number of quality events recorded that day. */
  count: number;

  /** Mean confidence of those events. */
  averageConfidence: number;
}

/** Recurring issue row. */
export interface RecurringIssueSummary {
  /** Issue label. */
  issue: string;

  /** Number of occurrences. */
  count: number;
}

/** Deterministic, scope- and time-filtered Memory report. */
export interface MemoryQueryReport {
  /** Command discriminator. */
  command: "memory query";

  /** Schema version. */
  version: string;

  /** Memory is always read-only: queries never mutate the store. */
  readOnly: true;

  /** Scope filter applied (null when unfiltered). */
  scope: string | null;

  /** Time range applied (null bounds when unbounded). */
  timeRange: { from: string | null; to: string | null };

  /** Total records considered. */
  total: number;

  /** Event counts used by the report. */
  counts: {
    generated: number;
    promoted: number;
    rejected: number;
    overrides: number;
  };

  /** Seeds ranked by generation count (descending). */
  mostUsedSeeds: SeedUsageSummary[];

  /** Rejected intents with reasons, newest first. */
  rejectedIntents: RejectedIntentSummary[];

  /** Quality trend by UTC day, oldest first. */
  qualityTrend: QualityTrendPoint[];

  /** Recurring issues, most frequent first. */
  recurringIssues: RecurringIssueSummary[];
}

/** Validate an unknown value as a {@link MemoryRecord}. */
export function validateMemoryRecord(value: unknown): string[] {
  const errors: string[] = [];
  if (typeof value !== "object" || value === null || Array.isArray(value)) {
    return ["record must be an object"];
  }
  const r = value as Record<string, unknown>;

  if (typeof r["version"] !== "string") errors.push("version must be a string");
  if (typeof r["id"] !== "string" || r["id"].length === 0) errors.push("id must be a non-empty string");
  if (typeof r["timestamp"] !== "string" || Number.isNaN(Date.parse(r["timestamp"] as string))) {
    errors.push("timestamp must be an ISO-8601 string");
  }
  if (typeof r["module"] !== "string" || r["module"].length === 0) errors.push("module must be a non-empty string");
  if (typeof r["event"] !== "string" || !(MEMORY_EVENTS as readonly string[]).includes(r["event"])) {
    errors.push(`event must be one of: ${MEMORY_EVENTS.join(", ")}`);
  }
  if (typeof r["category"] !== "string" || !(MEMORY_CATEGORIES as readonly string[]).includes(r["category"])) {
    errors.push(`category must be one of: ${MEMORY_CATEGORIES.join(", ")}`);
  }
  if (typeof r["scope"] !== "string" || r["scope"].length === 0) errors.push("scope must be a non-empty string");
  if (typeof r["confidence"] !== "number" || Number.isNaN(r["confidence"]) || r["confidence"] < 0 || r["confidence"] > 1) {
    errors.push("confidence must be a number in [0, 1]");
  }
  if (typeof r["attribution"] !== "string" || r["attribution"].length === 0) {
    errors.push("attribution must be a non-empty string");
  }
  if (typeof r["details"] !== "object" || r["details"] === null || Array.isArray(r["details"])) {
    errors.push("details must be an object");
  }
  return errors;
}

/**
 * Validate and return a typed {@link MemoryRecord}.
 *
 * @throws {Error} when validation fails, listing every field error.
 */
export function parseMemoryRecord(value: unknown): MemoryRecord {
  const errors = validateMemoryRecord(value);
  if (errors.length > 0) {
    throw new Error(`Invalid memory record: ${errors.join("; ")}`);
  }
  return value as MemoryRecord;
}

/**
 * Serialise a record with a fixed key order so identical inputs produce
 * byte-identical output (determinism).
 */
export function serialiseMemoryRecord(record: MemoryRecord): string {
  const ordered: Record<string, unknown> = {
    version: record.version,
    id: record.id,
    timestamp: record.timestamp,
    module: record.module,
    event: record.event,
    category: record.category,
    scope: record.scope,
    details: sortDetails(record.details),
    confidence: record.confidence,
    attribution: record.attribution,
  };
  return JSON.stringify(ordered);
}

/** Return a shallow copy of a details bag with keys sorted. */
export function sortDetails(
  details: Record<string, MemoryDetailValue>,
): Record<string, MemoryDetailValue> {
  const out: Record<string, MemoryDetailValue> = {};
  for (const key of Object.keys(details).sort()) {
    out[key] = details[key] as MemoryDetailValue;
  }
  return out;
}
