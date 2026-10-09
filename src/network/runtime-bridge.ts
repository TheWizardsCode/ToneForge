/**
 * Network → Runtime/State bridge.
 *
 * Turns a stream of received {@link BehaviouralEvent}s into deterministic
 * playback by driving the **Demo 9 runtime/state pipeline** — the same
 * `createRuntime` engine that powers `toneforge runtime` (see
 * `docs/prd/RUNTIME_PRD.md` §19). The bridge never synthesises audio and never
 * forks runtime logic: it reconciles the runtime's state machine and context
 * with the event and lets the runtime resolve the active sequence and its
 * recipes.
 *
 * Two bridges given the same scenario configuration and the same event stream
 * produce the **identical resolved sound sequence** (same recipes, states,
 * sequences and seeds), which is what makes multi-client playback
 * deterministic without streaming audio (NETWORK_PRD §4.2, §6.4).
 *
 * Reference: docs/prd/NETWORK_PRD.md §6.4, §7; docs/network.md.
 *
 * Work item: TF-0MUZYS3UD00657Q3 (Network→Runtime/State integration).
 */

import { createContext } from "../context/context.js";
import { createStateMachine } from "../state/state.js";
import {
  createRuntime,
  type Runtime,
  type RuntimeLogEntry,
} from "../runtime/runtime.js";
import {
  createTemplateRecipeResolver,
  type RuntimeScenario,
} from "../runtime/scenario.js";
import { encodeEvent } from "./events.js";
import type { BehaviouralEvent } from "./types.js";

// ---------------------------------------------------------------------------
// Resolved output
// ---------------------------------------------------------------------------

/**
 * A single resolved sound the runtime decided to play for a received event.
 *
 * It is deliberately declarative (a recipe name plus its deterministic seed and
 * timing), not a buffer: every client resolves the same recipe from the same
 * event, so no audio ever crosses the wire.
 */
export interface ResolvedSoundEvent {
  /** State label active when the sound resolved. */
  state: string;
  /** Name of the sequence that produced the sound. */
  sequence: string;
  /** Resolved recipe name (after context-driven substitution). */
  recipe: string;
  /** Original event name before recipe resolution, e.g. `"footstep"`. */
  originalRecipe: string;
  /** Deterministic synthesis seed for this sound. */
  eventSeed: number;
  /** Gain multiplier declared by the sequence. */
  gain: number;
  /** Received-event time in seconds (the network timestamp). */
  time: number;
  /** Offset of the sound within its sequence, in milliseconds. */
  timeMs: number;
  /** Repetition index within the sequence. */
  repetition: number;
}

/** The outcome of executing a single received behavioural event. */
export interface RuntimeExecution {
  /** The received event that was executed. */
  event: BehaviouralEvent;
  /** Sounds the runtime resolved for this event (possibly empty). */
  resolved: ResolvedSoundEvent[];
  /** Whether the event changed the runtime's current state. */
  stateChanged: boolean;
  /** Whether the event changed any context dimension. */
  contextChanged: boolean;
}

// ---------------------------------------------------------------------------
// Options / API
// ---------------------------------------------------------------------------

/** Options for {@link createRuntimeBridge}. */
export interface RuntimeBridgeOptions {
  /** Validated runtime scenario providing state/context/sequences/resolver. */
  scenario: RuntimeScenario;
  /** Base seed override (default: the scenario seed). */
  seed?: number;
  /** Clock for runtime timestamps (default: a virtual clock driven by events). */
  clock?: () => number;
}

/** A runtime bridge: a runtime plus received-event execution. */
export interface RuntimeBridge {
  /** The underlying runtime (for inspection/advanced use). */
  readonly runtime: Runtime;
  /** Start the runtime. Idempotent. */
  start(): void;
  /** Stop the runtime. Idempotent. */
  stop(): void;
  /** Whether the runtime is currently running. */
  isRunning(): boolean;
  /** Execute a received behavioural event through the runtime. */
  apply(event: BehaviouralEvent): RuntimeExecution;
  /** Execute a stream of received behavioural events in order. */
  applyStream(events: readonly BehaviouralEvent[]): RuntimeExecution[];
  /** The cumulative resolved sound sequence across all applied events. */
  resolvedSequence(): ResolvedSoundEvent[];
  /** Stop, clear all resolution state and restart from the scenario initial state. */
  reset(): void;
}

// ---------------------------------------------------------------------------
// Implementation
// ---------------------------------------------------------------------------

/** Extract resolved sounds from the runtime log appended since `fromIndex`. */
function collectResolvedSounds(
  log: readonly RuntimeLogEntry[],
  fromIndex: number,
  eventTime: number,
): ResolvedSoundEvent[] {
  const resolved: ResolvedSoundEvent[] = [];
  for (let i = fromIndex; i < log.length; i++) {
    const entry = log[i]!.event;
    if (entry.type !== "event_fire") continue;
    const detail = entry.detail;
    resolved.push({
      state: String(detail["state"] ?? ""),
      sequence: String(detail["sequence"] ?? ""),
      recipe: String(detail["resolvedRecipe"]),
      originalRecipe: String(detail["originalRecipe"]),
      eventSeed: Number(detail["eventSeed"]),
      gain: Number(detail["gain"] ?? 1),
      time: eventTime,
      timeMs: Number(detail["time_ms"] ?? 0),
      repetition: Number(detail["repetition"] ?? 0),
    });
  }
  return resolved;
}

/**
 * Create a network → runtime bridge for a validated runtime scenario.
 *
 * The bridge reuses the Demo 9 runtime pipeline unchanged: received events
 * reconcile the runtime's state and context, and the runtime resolves and
 * fires the active sequence's recipes. The same scenario configuration and
 * event stream always yield the same {@link ResolvedSoundEvent} sequence.
 *
 * @param options - Bridge configuration.
 * @returns A {@link RuntimeBridge}.
 */
export function createRuntimeBridge(
  options: RuntimeBridgeOptions,
): RuntimeBridge {
  const { scenario } = options;
  const seed = options.seed ?? scenario.seed;

  // A virtual clock keeps runtime timestamps deterministic and independent of
  // the host wall clock; it advances to each received event's time.
  let nowMs = 0;
  const clock = options.clock ?? ((): number => nowMs);

  const stateMachine = createStateMachine(scenario.stateMachine, { clock });
  const context = createContext({
    ...(scenario.context?.dimensions !== undefined
      ? { dimensions: scenario.context.dimensions }
      : {}),
    ...(scenario.context?.initial !== undefined
      ? { initial: scenario.context.initial }
      : {}),
    clock,
  });

  const runtime = createRuntime({
    stateMachine,
    context,
    sequences: scenario.sequences,
    seed,
    clock,
    recipeResolver: createTemplateRecipeResolver(scenario.recipeResolver),
  });

  let running = false;
  const resolved: ResolvedSoundEvent[] = [];

  function apply(event: BehaviouralEvent): RuntimeExecution {
    if (!running) {
      throw new Error(
        "Runtime bridge is not running. Call start() before applying events.",
      );
    }

    nowMs = Math.round(event.time * 1000);
    const before = runtime.log().length;
    const inspection = runtime.inspect();

    const stateChanged =
      inspection.state !== null && inspection.state.currentState !== event.state;

    let contextChanged = false;
    const updates: Record<string, string> = {};
    for (const [dimension, value] of Object.entries(event.context)) {
      if (inspection.context[dimension] !== value) {
        updates[dimension] = value;
        contextChanged = true;
      }
    }

    // Context first, so a state transition fired below resolves its recipes
    // against the event's environment (NETWORK_PRD §6.3, §6.4).
    if (contextChanged) runtime.setContext(updates);
    if (stateChanged) runtime.setState(event.state);

    // A discrete event (state and context unchanged) still represents intent:
    // re-fire the active sequence once, seeded by the event, so each received
    // footstep produces exactly one deterministic sound.
    if (runtime.log().length === before) {
      runtime.refireActive(event.seed - seed);
    }

    const executionResolved = collectResolvedSounds(
      runtime.log(),
      before,
      event.time,
    );
    resolved.push(...executionResolved);
    return {
      event,
      resolved: executionResolved,
      stateChanged,
      contextChanged,
    };
  }

  return {
    runtime,

    start(): void {
      if (running) return;
      runtime.start();
      running = true;
    },

    stop(): void {
      if (!running) return;
      runtime.stop();
      running = false;
    },

    isRunning(): boolean {
      return running;
    },

    apply,

    applyStream(events: readonly BehaviouralEvent[]): RuntimeExecution[] {
      return events.map(apply);
    },

    resolvedSequence(): ResolvedSoundEvent[] {
      return [...resolved];
    },

    reset(): void {
      running = false;
      resolved.length = 0;
      runtime.reset();
      runtime.start();
      running = true;
      nowMs = 0;
    },
  };
}

// ---------------------------------------------------------------------------
// Bandwidth measurement
// ---------------------------------------------------------------------------

/** Default bandwidth budget for a networked gameplay stream (bytes/second). */
export const DEFAULT_BANDWIDTH_BUDGET_BYTES_PER_SECOND = 1024;

/** Byte cost of a single canonical behavioural event. */
export function canonicalEventByteSize(event: BehaviouralEvent): number {
  return new TextEncoder().encode(encodeEvent(event)).length;
}

/** Measured bandwidth for a behavioural-event stream. */
export interface BandwidthReport {
  /** Number of events measured. */
  eventCount: number;
  /** Total canonical wire bytes across the stream. */
  totalBytes: number;
  /** Mean canonical bytes per event. */
  avgBytesPerEvent: number;
  /** Largest canonical event size. */
  maxBytesPerEvent: number;
  /** Event rate the projection assumes (events/second). */
  eventsPerSecond: number;
  /** Projected bytes per second at {@link eventsPerSecond}. */
  bytesPerSecond: number;
  /** Projected kilobytes per second (1024 bytes = 1 KB). */
  kilobytesPerSecond: number;
  /** The budget the report was judged against (bytes/second). */
  budgetBytesPerSecond: number;
  /** `true` when the projected rate fits the budget. */
  withinBudget: boolean;
}

/**
 * Measure the canonical wire cost of a behavioural-event stream and project its
 * bandwidth.
 *
 * Audio is never sent, so the whole stream is a handful of compact events; the
 * projection assumes a configurable event rate (default one event per second,
 * a conservative gameplay upper bound).
 */
export function measureStreamBandwidth(
  events: readonly BehaviouralEvent[],
  options: {
    eventsPerSecond?: number;
    budgetBytesPerSecond?: number;
  } = {},
): BandwidthReport {
  const eventsPerSecond = options.eventsPerSecond ?? 1;
  const budgetBytesPerSecond =
    options.budgetBytesPerSecond ?? DEFAULT_BANDWIDTH_BUDGET_BYTES_PER_SECOND;

  const sizes = events.map(canonicalEventByteSize);
  const eventCount = events.length;
  const totalBytes = sizes.reduce((sum, size) => sum + size, 0);
  const avgBytesPerEvent = eventCount > 0 ? totalBytes / eventCount : 0;
  const maxBytesPerEvent = eventCount > 0 ? Math.max(...sizes) : 0;
  const bytesPerSecond = avgBytesPerEvent * eventsPerSecond;

  return {
    eventCount,
    totalBytes,
    avgBytesPerEvent,
    maxBytesPerEvent,
    eventsPerSecond,
    bytesPerSecond: Math.round(bytesPerSecond * 100) / 100,
    kilobytesPerSecond: Math.round((bytesPerSecond / 1024) * 100) / 100,
    budgetBytesPerSecond,
    withinBudget: bytesPerSecond <= budgetBytesPerSecond,
  };
}
