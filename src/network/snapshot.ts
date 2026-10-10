/**
 * Late-join state snapshots for ToneForge Network.
 *
 * A host continuously tracks the behavioural state implied by the events it
 * emits. When a client joins after playback has already started, the host sends
 * it the current {@link StateSnapshot} so the joiner can resolve and play the
 * *current* deterministic output immediately — instead of waiting for the next
 * live event (there is no event replay; see the session tests).
 *
 * A snapshot is the canonical behavioural event that produced the current state
 * (state + context + seed + time), so applying it is a pure, deterministic
 * function: {@link applySnapshot} returns the canonical event a joiner resolves
 * locally. Because every peer resolves the same event the same way, the late
 * joiner lands on byte-identical output to an already-connected client.
 *
 * Reference: docs/prd/NETWORK_PRD.md §4.1 (behavioural event), §8 (late-join
 * resynchronisation); docs/network.md.
 *
 * Work item: TF-0MUZYS377005ZSDT (Late-join snapshot and drift/latency handling).
 */

import {
  BehaviouralEventValidationError,
  validateBehaviouralEvent,
  type BehaviouralEvent,
  type ContextSnapshot,
  type EventValidationError,
} from "./types.js";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

/**
 * A snapshot of the host's current behavioural state.
 *
 * The field set deliberately mirrors the canonical v1 behavioural event
 * ({@link BehaviouralEvent}) so a snapshot is itself a resolvable event — it
 * carries the state, context and seed needed for deterministic local playback.
 */
export interface StateSnapshot {
  /** Schema version of the snapshot (currently the event version, `1`). */
  version: number;
  /** Event type that produced the current state, e.g. `"state-transition"`. */
  event: string;
  /** Deterministic seed for local synthesis of the current state. */
  seed: number;
  /** Session timestamp (seconds) at which the state was captured. */
  time: number;
  /** Current state label, e.g. `"run"`. */
  state: string;
  /** Current context snapshot — flat, string-valued dimensions. */
  context: ContextSnapshot;
}

/** Result of validating an unknown value as a {@link StateSnapshot}. */
export type SnapshotValidationResult =
  | { valid: true; snapshot: StateSnapshot }
  | { valid: false; errors: EventValidationError[] };

// ---------------------------------------------------------------------------
// Capture / validate / apply
// ---------------------------------------------------------------------------

/**
 * Capture the current state from a canonical behavioural event.
 *
 * The event is validated first, so a snapshot is always canonical (keys
 * normalised) and safe to serialise with `canonicalStringify`.
 *
 * @throws {import("./types.js").BehaviouralEventValidationError} when the
 *   event is not a valid behavioural event.
 */
export function captureSnapshot(event: BehaviouralEvent): StateSnapshot {
  const result = validateBehaviouralEvent(event);
  if (!result.valid) {
    // Re-use the canonical event error so callers get one error type.
    throw new BehaviouralEventValidationError(result.errors);
  }
  return result.event;
}

/**
 * Validate an unknown value as a {@link StateSnapshot}.
 *
 * A snapshot shares the canonical behavioural-event shape, so validation is
 * delegated to {@link validateBehaviouralEvent}. Returns a fresh, canonical
 * snapshot on success.
 */
export function validateSnapshot(input: unknown): SnapshotValidationResult {
  const result = validateBehaviouralEvent(input);
  if (!result.valid) {
    return { valid: false, errors: result.errors };
  }
  return { valid: true, snapshot: result.event };
}

/**
 * Apply a snapshot, returning the canonical behavioural event a joiner
 * resolves locally to land on the host's current output.
 *
 * @throws {import("./types.js").BehaviouralEventValidationError} when the
 *   snapshot is not valid.
 */
export function applySnapshot(snapshot: StateSnapshot): BehaviouralEvent {
  const result = validateSnapshot(snapshot);
  if (!result.valid) {
    throw new BehaviouralEventValidationError(result.errors);
  }
  return result.snapshot;
}

// ---------------------------------------------------------------------------
// Host-side tracker
// ---------------------------------------------------------------------------

/**
 * Tracks the latest snapshot a host has captured.
 *
 * The host calls {@link capture} for every authoritative event it emits; the
 * most recent snapshot is attached to each new peer's welcome handshake.
 */
export class SnapshotTracker {
  private current: StateSnapshot | undefined;

  /** Capture and remember the current state from an emitted event. */
  capture(event: BehaviouralEvent): StateSnapshot {
    this.current = captureSnapshot(event);
    return this.current;
  }

  /** The most recently captured snapshot, or `undefined` before any event. */
  latest(): StateSnapshot | undefined {
    return this.current;
  }

  /** Forget the current snapshot. */
  clear(): void {
    this.current = undefined;
  }
}
