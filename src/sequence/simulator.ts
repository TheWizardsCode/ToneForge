/**
 * Sequence Simulator
 *
 * Converts a SequenceDefinition into a deterministic timeline of scheduled
 * events. The simulator expands repeats, applies probability filtering
 * using the seeded RNG, and produces a flat timeline with absolute
 * timestamps and sample offsets.
 *
 * The simulator does NOT produce audio — it produces a schedule that the
 * renderer can use to trigger recipe renders.
 *
 * Reference: docs/prd/SEQUENCER_PRD.md
 */

import { createRng } from "../core/rng.js";
import type { SequenceDefinition, SequenceEvent } from "./schema.js";

// ── Timeline Types ────────────────────────────────────────────────

/** A single scheduled event in the timeline. */
export interface TimelineEvent {
  /** Absolute time in milliseconds from sequence start. */
  time_ms: number;

  /** Absolute time in sample offset at the given sample rate. */
  sampleOffset: number;

  /** Name of the recipe/stack/library entry to trigger. */
  event: string;

  /** The effective seed for this event: baseSeed + seedOffset. */
  eventSeed: number;

  /** The seedOffset from the preset. */
  seedOffset: number;

  /** Gain multiplier for this event. */
  gain: number;

  /** Duration override in seconds, or undefined. */
  duration?: number;

  /** Which repetition this event belongs to (0-indexed). */
  repetition: number;
}

/** The complete simulation output. */
export interface SimulationResult {
  /** The preset name. */
  name: string;

  /** All scheduled events, sorted by time. */
  events: TimelineEvent[];

  /** Sample rate used for sampleOffset calculations. */
  sampleRate: number;

  /** Total duration of the timeline in seconds. */
  totalDuration: number;

  /** Total duration of the timeline in milliseconds. */
  totalDuration_ms: number;

  /** The base seed used. */
  seed: number;
}

// ── Simulator ─────────────────────────────────────────────────────

const DEFAULT_SAMPLE_RATE = 44100;

/**
 * Convert milliseconds to an integer sample offset.
 *
 * Uses Math.round to achieve accuracy within 1 sample at 44.1 kHz
 * (≈0.023ms tolerance), as required by the acceptance criteria.
 *
 * @param ms - Time in milliseconds.
 * @param sampleRate - Sample rate in Hz.
 * @returns Integer sample offset.
 */
export function msToSamples(ms: number, sampleRate: number): number {
  return Math.round((ms / 1000) * sampleRate);
}

/**
 * Simulate a sequence preset into a deterministic timeline.
 *
 * Algorithm:
 * 1. Expand events across repetitions (if repeat is configured)
 * 2. Filter events by probability using a deterministic RNG
 * 3. Compute absolute timestamps and sample offsets
 * 4. Sort by time
 *
 * @param definition - A validated SequenceDefinition.
 * @param seed - Base seed for deterministic simulation.
 * @param options - Optional configuration (sampleRate, maxDuration).
 * @returns A SimulationResult with the complete timeline.
 */
export function simulate(
  definition: SequenceDefinition,
  seed: number,
  options?: {
    sampleRate?: number;
    /** Maximum duration in seconds. Events beyond this are excluded. */
    maxDuration?: number;
  },
): SimulationResult {
  const sampleRate = options?.sampleRate ?? DEFAULT_SAMPLE_RATE;
  const maxDuration = options?.maxDuration;

  // Create deterministic RNG for probability filtering
  const rng = createRng(seed);

  const timeline: TimelineEvent[] = [];

  // Determine number of repetitions
  const repeatCount = definition.repeat ? definition.repeat.count + 1 : 1;
  const repeatInterval = definition.repeat?.interval ?? 0;

  for (let rep = 0; rep < repeatCount; rep++) {
    const repOffsetMs = rep * repeatInterval * 1000;

    for (const evt of definition.events) {
      // Apply probability filter using deterministic RNG
      // We always call rng() to keep the sequence deterministic
      // regardless of which events pass the probability check
      const roll = rng();
      if (roll >= evt.probability) {
        continue;
      }

      const absoluteMs = evt.time_ms + repOffsetMs;
      const absoluteSeconds = absoluteMs / 1000;

      // Apply maxDuration filter
      if (maxDuration !== undefined && absoluteSeconds > maxDuration) {
        continue;
      }

      const eventSeed = seed + evt.seedOffset;

      timeline.push({
        time_ms: absoluteMs,
        sampleOffset: msToSamples(absoluteMs, sampleRate),
        event: evt.event,
        eventSeed,
        seedOffset: evt.seedOffset,
        gain: evt.gain,
        duration: evt.duration,
        repetition: rep,
      });
    }
  }

  // Sort by time (stable sort preserves event order for simultaneous events)
  timeline.sort((a, b) => a.time_ms - b.time_ms || a.seedOffset - b.seedOffset);

  // Compute total duration
  let totalDurationMs = 0;
  if (timeline.length > 0) {
    totalDurationMs = timeline[timeline.length - 1]!.time_ms;
  }

  // If maxDuration is set, use it as the total duration
  if (maxDuration !== undefined) {
    totalDurationMs = maxDuration * 1000;
  }

  return {
    name: definition.name,
    events: timeline,
    sampleRate,
    totalDuration: totalDurationMs / 1000,
    totalDuration_ms: totalDurationMs,
    seed,
  };
}

/**
 * Format a simulation result as a JSON-serializable timeline object.
 *
 * Produces the timeline shape specified in the acceptance criteria:
 * ```json
 * {
 *   "events": [
 *     { "time_ms": 0, "event": "shot", "seedOffset": 0 },
 *     { "time_ms": 120, "event": "shot", "seedOffset": 1 }
 *   ],
 *   "sampleRate": 44100
 * }
 * ```
 */
export function formatTimeline(result: SimulationResult): Record<string, unknown> {
  return {
    name: result.name,
    seed: result.seed,
    sampleRate: result.sampleRate,
    totalDuration: result.totalDuration,
    totalDuration_ms: result.totalDuration_ms,
    events: result.events.map((e) => ({
      time_ms: e.time_ms,
      sampleOffset: e.sampleOffset,
      event: e.event,
      seedOffset: e.seedOffset,
      eventSeed: e.eventSeed,
      gain: e.gain,
      ...(e.duration !== undefined ? { duration: e.duration } : {}),
      repetition: e.repetition,
    })),
  };
}
