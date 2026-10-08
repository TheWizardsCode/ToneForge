/**
 * ToneForge Intelligence — memory-aware historical context.
 *
 * When `--use-memory` is supplied, Intelligence derives an additive
 * {@link MemoryContextSummary} from the project-local Memory store: seeds
 * that are over-represented and intents that were previously rejected. The
 * context grounds recommendations without changing the no-flag output
 * (PRD_INTELLIGENCE §10 determinism; MEMORY_PRD §5.1).
 */

import type { MemoryRecord } from "../memory/types.js";

/** Default generation count at or above which a seed is over-represented. */
export const OVER_REPRESENTED_THRESHOLD = 3;

/** Additive historical context derived from Memory. */
export interface MemoryContextSummary {
  /** Source of the context (the memory file location). */
  source: string;

  /** Total records considered. */
  totalRecords: number;

  /** Seeds generated at least {@link OVER_REPRESENTED_THRESHOLD} times. */
  overRepresentedSeeds: Array<{ recipe: string; seed: number; count: number }>;

  /** Previously rejected intents with reasons. */
  rejectedIntents: Array<{ intent: string; reason: string }>;
}

/**
 * Derive a deterministic memory context from records.
 *
 * @param records - Memory records (any order).
 * @param source - Memory file location (for attribution in the report).
 * @param threshold - Over-representation threshold (default 3).
 */
export function deriveMemoryContext(
  records: MemoryRecord[],
  source: string,
  threshold: number = OVER_REPRESENTED_THRESHOLD,
): MemoryContextSummary {
  const seedCounts = new Map<string, { recipe: string; seed: number; count: number }>();
  const rejected = new Map<string, { intent: string; reason: string }>();

  for (const record of records) {
    if (record.event === "generation") {
      const recipe = record.details["recipe"];
      const seed = record.details["seed"];
      if (typeof recipe === "string" && typeof seed === "number") {
        const key = `${recipe}\u0000${seed}`;
        const existing = seedCounts.get(key);
        if (existing) existing.count++;
        else seedCounts.set(key, { recipe, seed, count: 1 });
      }
    }
    if (record.event === "rejection") {
      const intent = record.details["intent"];
      const reason = record.details["reason"];
      if (typeof intent === "string" && typeof reason === "string") {
        rejected.set(`${intent}\u0000${reason}`, { intent, reason });
      }
    }
  }

  const overRepresentedSeeds = [...seedCounts.values()]
    .filter((entry) => entry.count >= threshold)
    .sort((a, b) => {
      if (b.count !== a.count) return b.count - a.count;
      if (a.recipe !== b.recipe) return a.recipe.localeCompare(b.recipe);
      return a.seed - b.seed;
    });

  const rejectedIntents = [...rejected.values()].sort((a, b) => {
    if (a.intent !== b.intent) return a.intent.localeCompare(b.intent);
    return a.reason.localeCompare(b.reason);
  });

  return {
    source,
    totalRecords: records.length,
    overRepresentedSeeds,
    rejectedIntents,
  };
}

/** Stable key for an over-represented seed. */
function seedKey(recipe: string, seed: number): string {
  return `${recipe}\u0000${seed}`;
}

/**
 * Compute historical notes for one library entry.
 *
 * @param entry - Library entry (recipe + seed).
 * @param context - Derived memory context.
 */
export function memoryNotesForEntry(
  entry: { recipe: string; seed: number },
  context: MemoryContextSummary,
): string[] {
  const notes: string[] = [];
  const over = context.overRepresentedSeeds.find(
    (item) => seedKey(item.recipe, item.seed) === seedKey(entry.recipe, entry.seed),
  );
  if (over) {
    notes.push(
      `seed ${over.seed} of '${over.recipe}' is over-represented (generated ${over.count} times)`,
    );
  }
  return notes;
}

/**
 * Whether an entry's seed is over-represented (used to apply a deterministic
 * ranking penalty under `--use-memory`).
 */
export function isOverRepresented(
  entry: { recipe: string; seed: number },
  context: MemoryContextSummary,
): boolean {
  return context.overRepresentedSeeds.some(
    (item) => seedKey(item.recipe, item.seed) === seedKey(entry.recipe, entry.seed),
  );
}
