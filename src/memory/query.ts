/**
 * ToneForge Memory — deterministic query engine.
 *
 * Builds a structured, scope-filtered, time-scoped report from Memory
 * records (PRD §7). The engine is pure with respect to the store: it reads
 * records and never writes (read-only guarantee).
 *
 * All ordering is deterministic so identical inputs produce byte-identical
 * reports.
 */

import type { MemoryStore } from "./store.js";
import {
  MEMORY_VERSION,
} from "./types.js";
import type {
  MemoryQueryOptions,
  MemoryQueryReport,
  MemoryRecord,
  QualityTrendPoint,
  RecurringIssueSummary,
  RejectedIntentSummary,
  SeedUsageSummary,
} from "./types.js";

/** Round to fixed decimals for deterministic output. */
function round(value: number, decimals = 4): number {
  const factor = 10 ** decimals;
  return Math.round(value * factor) / factor;
}

/** Whether a record falls inside the optional time range (inclusive). */
function withinTimeRange(record: MemoryRecord, options: MemoryQueryOptions): boolean {
  const range = options.timeRange;
  if (!range) return true;
  const ts = Date.parse(record.timestamp);
  if (range.from !== undefined && ts < Date.parse(range.from)) return false;
  if (range.to !== undefined && ts > Date.parse(range.to)) return false;
  return true;
}

/**
 * Build a deterministic Memory report from in-memory records (pure; no I/O).
 */
export function buildMemoryReport(
  records: MemoryRecord[],
  options: MemoryQueryOptions = {},
): MemoryQueryReport {
  const filtered = records.filter(
    (record) =>
      (options.scope === undefined || record.scope === options.scope) &&
      withinTimeRange(record, options),
  );

  let generated = 0;
  let promoted = 0;
  let rejected = 0;
  let overrides = 0;

  const seedCounts = new Map<string, SeedUsageSummary>();
  const rejectedIntents: RejectedIntentSummary[] = [];
  const qualityByDay = new Map<string, { count: number; confidenceSum: number }>();
  const issueCounts = new Map<string, number>();

  for (const record of filtered) {
    switch (record.event) {
      case "generation": {
        generated++;
        const recipe = record.details["recipe"];
        const seed = record.details["seed"];
        if (typeof recipe === "string" && typeof seed === "number") {
          const key = `${recipe}\u0000${seed}`;
          const existing = seedCounts.get(key);
          if (existing) existing.count++;
          else seedCounts.set(key, { recipe, seed, count: 1 });
        }
        break;
      }
      case "promotion":
        promoted++;
        break;
      case "rejection": {
        rejected++;
        const intent = record.details["intent"];
        const reason = record.details["reason"];
        if (typeof intent === "string" && typeof reason === "string") {
          rejectedIntents.push({ intent, scope: record.scope, reason, timestamp: record.timestamp });
        }
        break;
      }
      case "override":
        overrides++;
        break;
      default:
        break;
    }

    if (record.category === "quality") {
      const day = record.timestamp.slice(0, 10);
      const bucket = qualityByDay.get(day) ?? { count: 0, confidenceSum: 0 };
      bucket.count++;
      bucket.confidenceSum += record.confidence;
      qualityByDay.set(day, bucket);
    }

    const issue = record.details["issue"];
    if (typeof issue === "string" && issue.length > 0) {
      issueCounts.set(issue, (issueCounts.get(issue) ?? 0) + 1);
    }
  }

  const mostUsedSeeds = [...seedCounts.values()].sort((a, b) => {
    if (b.count !== a.count) return b.count - a.count;
    if (a.recipe !== b.recipe) return a.recipe.localeCompare(b.recipe);
    return a.seed - b.seed;
  });

  rejectedIntents.sort((a, b) => {
    if (a.timestamp !== b.timestamp) return a.timestamp < b.timestamp ? 1 : -1;
    return a.intent.localeCompare(b.intent);
  });

  const qualityTrend: QualityTrendPoint[] = [...qualityByDay.entries()]
    .map(([date, bucket]) => ({
      date,
      count: bucket.count,
      averageConfidence: round(bucket.confidenceSum / bucket.count),
    }))
    .sort((a, b) => a.date.localeCompare(b.date));

  const recurringIssues: RecurringIssueSummary[] = [...issueCounts.entries()]
    .map(([issue, count]) => ({ issue, count }))
    .sort((a, b) => {
      if (b.count !== a.count) return b.count - a.count;
      return a.issue.localeCompare(b.issue);
    });

  return {
    command: "memory query",
    version: MEMORY_VERSION,
    readOnly: true,
    scope: options.scope ?? null,
    timeRange: {
      from: options.timeRange?.from ?? null,
      to: options.timeRange?.to ?? null,
    },
    total: filtered.length,
    counts: { generated, promoted, rejected, overrides },
    mostUsedSeeds,
    rejectedIntents,
    qualityTrend,
    recurringIssues,
  };
}

/**
 * Query the store and build a report. Read-only: never mutates the store.
 */
export async function queryMemory(
  store: MemoryStore,
  options: MemoryQueryOptions = {},
): Promise<MemoryQueryReport> {
  const records = await store.readAll();
  return buildMemoryReport(records, options);
}

/** Explicit export of every record (read-only). */
export async function exportMemory(store: MemoryStore): Promise<MemoryRecord[]> {
  return store.export();
}

/** Explicitly clear the store. */
export async function clearMemory(store: MemoryStore): Promise<void> {
  await store.clear();
}
