/**
 * ToneForge Memory — record API and event sources.
 *
 * `record()` turns a typed event into an append-only {@link MemoryRecord} and
 * persists it via an injected {@link MemoryStore}. The {@link MemoryRecorder}
 * interface is what other modules (explore, library, intent) depend on, so
 * they are never coupled to the concrete store (no import cycles).
 *
 * A {@link MemoryClock} seam keeps timestamps deterministic in tests
 * (frozen clock) while production uses the system clock.
 */

import { createHash } from "node:crypto";
import {
  MEMORY_VERSION,
  sortDetails,
} from "./types.js";
import type {
  MemoryCategory,
  MemoryDetailValue,
  MemoryEvent,
  MemoryRecord,
} from "./types.js";
import type { MemoryStore } from "./store.js";

/** Injectable clock seam. */
export interface MemoryClock {
  /** Current time. */
  now(): Date;
}

/** Clock backed by the system time. */
export const systemClock: MemoryClock = {
  now: () => new Date(),
};

/** A typed event awaiting persistence. */
export interface MemoryEventInput {
  /** Originating module (`explore`, `library`, `intent`, …). */
  module: string;

  /** Event kind. */
  event: MemoryEvent;

  /** Memory category. */
  category: MemoryCategory;

  /** Scope the event applies to. */
  scope: string;

  /** Optional event details. */
  details?: Record<string, MemoryDetailValue>;

  /** Confidence in [0, 1]. Default: 0.8. */
  confidence?: number;

  /** Who or what produced the record. Default: `toneforge`. */
  attribution?: string;
}

/** Options shared by record creation and the recorder facade. */
export interface MemoryRecorderOptions {
  /** Injectable clock. Defaults to {@link systemClock}. */
  clock?: MemoryClock;

  /** Default attribution for records produced by this recorder. */
  attribution?: string;

  /** Schema version. Defaults to {@link MEMORY_VERSION}. */
  version?: string;
}

/** A recorder other modules can depend on without importing the store. */
export interface MemoryRecorder {
  /** Record one typed event. */
  record(input: MemoryEventInput): Promise<MemoryRecord>;
}

/** Convert an ISO date to a UTC timestamp string. */
function toIso(date: Date): string {
  const millis = date.getTime() - (date.getTime() % 1000);
  return new Date(millis).toISOString();
}

/** Slug helper local to the id derivation (no cross-module import). */
function slug(value: string): string {
  return value.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "");
}

/** Deterministic record id derived from the canonical event content. */
function deriveId(record: Omit<MemoryRecord, "id">): string {
  const canonical = [
    record.version,
    record.timestamp,
    record.module,
    record.event,
    record.category,
    record.scope,
    JSON.stringify(sortDetails(record.details)),
    String(record.confidence),
    record.attribution,
  ].join("|");
  return `mem-${createHash("sha256").update(canonical).digest("hex").slice(0, 16)}`;
}

/**
 * Build a validated, deterministic {@link MemoryRecord} from an event input.
 *
 * @param input - The typed event.
 * @param options - Clock/attribution/version overrides.
 */
export function createMemoryRecord(
  input: MemoryEventInput,
  options: MemoryRecorderOptions = {},
): MemoryRecord {
  const clock = options.clock ?? systemClock;
  const record: Omit<MemoryRecord, "id"> = {
    version: options.version ?? MEMORY_VERSION,
    timestamp: toIso(clock.now()),
    module: input.module,
    event: input.event,
    category: input.category,
    scope: input.scope,
    details: sortDetails(input.details ?? {}),
    confidence: input.confidence ?? 0.8,
    attribution: input.attribution ?? options.attribution ?? "toneforge",
  };
  return { id: deriveId(record), ...record };
}

/**
 * Create a recorder backed by a store.
 *
 * @param store - Append-only Memory store.
 * @param options - Clock/attribution/version overrides.
 */
export function createMemoryRecorder(
  store: MemoryStore,
  options: MemoryRecorderOptions = {},
): MemoryRecorder {
  return {
    async record(input: MemoryEventInput): Promise<MemoryRecord> {
      const record = createMemoryRecord(input, options);
      await store.append(record);
      return record;
    },
  };
}

/** Build a `generation` event input. */
export function generationEvent(params: {
  recipe: string;
  seed: number;
  scope?: string;
  module?: string;
  confidence?: number;
}): MemoryEventInput {
  return {
    module: params.module ?? "explore",
    event: "generation",
    category: "usage",
    scope: params.scope ?? params.recipe,
    details: { recipe: params.recipe, seed: params.seed },
    confidence: params.confidence ?? 0.8,
  };
}

/** Build a `promotion` event input. */
export function promotionEvent(params: {
  entryId: string;
  recipe: string;
  seed: number;
  scope?: string;
  confidence?: number;
}): MemoryEventInput {
  return {
    module: "library",
    event: "promotion",
    category: "evolution",
    scope: params.scope ?? params.recipe,
    details: { entryId: params.entryId, recipe: params.recipe, seed: params.seed },
    confidence: params.confidence ?? 0.9,
  };
}

/** Build a `rejection` event input (e.g. a rejected intent). */
export function rejectionEvent(params: {
  intent: string;
  reason: string;
  scope?: string;
  module?: string;
  confidence?: number;
}): MemoryEventInput {
  return {
    module: params.module ?? "intent",
    event: "rejection",
    category: "preference",
    scope: params.scope ?? "project",
    details: { intent: params.intent, reason: params.reason },
    confidence: params.confidence ?? 0.85,
  };
}

/** Build an `override` event input. */
export function overrideEvent(params: {
  group: string;
  reason: string;
  scope?: string;
  confidence?: number;
}): MemoryEventInput {
  return {
    module: "mixer",
    event: "override",
    category: "preference",
    scope: params.scope ?? params.group,
    details: { group: params.group, reason: params.reason },
    confidence: params.confidence ?? 0.8,
  };
}

/** Build a `quality` event input. */
export function qualityEvent(params: {
  entryId: string;
  issue: string;
  scope?: string;
  confidence: number;
}): MemoryEventInput {
  return {
    module: "validator",
    event: "evaluation",
    category: "quality",
    scope: params.scope ?? params.entryId,
    details: { entryId: params.entryId, issue: params.issue },
    confidence: params.confidence,
  };
}
