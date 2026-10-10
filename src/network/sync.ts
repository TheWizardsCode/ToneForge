/**
 * Timestamp correction, deterministic ordering and bounded drift compensation
 * for ToneForge Network.
 *
 * The network layer shares *behavioural intent*, not audio. Clients therefore
 * still need to keep their local playout perceptually aligned when frames
 * arrive late, out of order, or with jitter. This module supplies three
 * independent, deterministic primitives plus a composed pipeline:
 *
 * - {@link TimestampCorrector} — converts host session time into an estimate of
 *   local clock time using a smoothed, **bounded** offset (never more than
 *   {@link DEFAULT_MAX_CLOCK_OFFSET_SECONDS}).
 * - {@link EventSequencer} — releases events in ascending timestamp order using
 *   a bounded reorder window. Events that arrive after their slot has already
 *   been released are dropped (graceful degradation) rather than replayed out
 *   of order.
 * - {@link DriftCompensator} — turns a desired playout time into a bounded
 *   timing adjustment. The adjustment never exceeds
 *   {@link DEFAULT_MAX_DRIFT_SECONDS}; beyond that the result is flagged
 *   `degraded` so callers can skip rather than jump.
 *
 * All three are pure functions of their inputs: given the same delivered event
 * order they produce byte-identical results (no wall-clock reads, no hidden
 * randomness).
 *
 * Reference: docs/prd/NETWORK_PRD.md §8 (latency & drift handling), §9
 * (bounded divergence); docs/network.md.
 *
 * Work item: TF-0MUZYS377005ZSDT (Late-join snapshot and drift/latency handling).
 */

import type { BehaviouralEvent } from "./types.js";

// ---------------------------------------------------------------------------
// Documented tolerances
// ---------------------------------------------------------------------------

/**
 * How long (seconds) an event may be held back to allow a missing earlier
 * event to arrive before the buffer is drained. Also the window within which an
 * out-of-order event can still be ordered; older events are dropped.
 */
export const DEFAULT_REORDER_WINDOW_SECONDS = 0.1;

/** Maximum clock-offset correction applied in either direction (seconds). */
export const DEFAULT_MAX_CLOCK_OFFSET_SECONDS = 2;

/** Exponential smoothing factor for clock-offset estimation, in `(0, 1]`. */
export const DEFAULT_CLOCK_SMOOTHING = 0.25;

/**
 * Maximum per-event drift compensation (seconds).
 *
 * Clients are considered perceptually aligned within this bound; beyond it the
 * compensator clamps and reports `degraded` (bounded divergence).
 */
export const DEFAULT_MAX_DRIFT_SECONDS = 0.25;

/** Tolerance used by the jitter-alignment harness to judge clients aligned. */
export const DEFAULT_ALIGNMENT_TOLERANCE_SECONDS = 0.25;

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}

// ---------------------------------------------------------------------------
// Timestamp correction
// ---------------------------------------------------------------------------

/** Options for {@link TimestampCorrector}. */
export interface TimestampCorrectorOptions {
  /** Smoothing factor in `(0, 1]`; higher tracks samples faster. */
  smoothing?: number;
  /** Maximum offset magnitude (seconds) applied either way. */
  maxOffsetSeconds?: number;
}

/**
 * Estimates and applies the offset between host session time and local time.
 *
 * A reference observation (for example the snapshot received on join, or a
 * periodic sync ping) is passed to {@link observe}; the corrector smooths the
 * raw offset with an exponential moving average and clamps it to a bounded
 * magnitude, so a single bad sample can never shift playout arbitrarily.
 */
export class TimestampCorrector {
  private readonly smoothing: number;
  private readonly maxOffsetSeconds: number;
  private offsetEstimate: number | undefined;
  private sampleCount = 0;

  constructor(options: TimestampCorrectorOptions = {}) {
    this.smoothing = clamp(options.smoothing ?? DEFAULT_CLOCK_SMOOTHING, 0, 1);
    this.maxOffsetSeconds = Math.max(
      0,
      options.maxOffsetSeconds ?? DEFAULT_MAX_CLOCK_OFFSET_SECONDS,
    );
  }

  /**
   * Feed a reference sample pairing host time with the local time at which it
   * was observed. Returns the updated offset estimate.
   */
  observe(remoteTime: number, localTime: number): number {
    const raw = clamp(
      localTime - remoteTime,
      -this.maxOffsetSeconds,
      this.maxOffsetSeconds,
    );
    this.offsetEstimate =
      this.offsetEstimate === undefined
        ? raw
        : this.offsetEstimate + this.smoothing * (raw - this.offsetEstimate);
    this.offsetEstimate = clamp(
      this.offsetEstimate,
      -this.maxOffsetSeconds,
      this.maxOffsetSeconds,
    );
    this.sampleCount += 1;
    return this.offsetEstimate;
  }

  /** Convert a host timestamp into the estimated local playout time. */
  correct(remoteTime: number): number {
    return remoteTime + (this.offsetEstimate ?? 0);
  }

  /** Current offset estimate in seconds (`0` before the first sample). */
  offset(): number {
    return this.offsetEstimate ?? 0;
  }

  /** Number of observations applied. */
  samples(): number {
    return this.sampleCount;
  }

  /** Forget all observations. */
  reset(): void {
    this.offsetEstimate = undefined;
    this.sampleCount = 0;
  }
}

// ---------------------------------------------------------------------------
// Event sequencing
// ---------------------------------------------------------------------------

/** An event released by {@link EventSequencer}. */
export interface SequencedEvent {
  /** The original (unmodified) canonical event. */
  event: BehaviouralEvent;
  /**
   * `true` when the event arrived after an event with a greater timestamp had
   * already been seen (that is, it was delivered out of order).
   */
  late: boolean;
}

/** Options for {@link EventSequencer}. */
export interface EventSequencerOptions {
  /** Reorder window in seconds; see {@link DEFAULT_REORDER_WINDOW_SECONDS}. */
  reorderWindowSeconds?: number;
}

/**
 * Buffers events just long enough to release them in ascending timestamp order.
 *
 * The sequencer is deterministic: it only looks at event timestamps, never at
 * wall-clock time, so the same delivered order always yields the same released
 * order. An event whose timestamp is older than the last released event is
 * dropped (it can no longer be ordered) and counted by `droppedLateCount()`.
 */
export class EventSequencer {
  private readonly reorderWindowSeconds: number;
  private buffer: Array<{ event: BehaviouralEvent; late: boolean }> = [];
  private lastReleasedTime: number | undefined;
  private maxSeenTime: number | undefined;
  private droppedLate = 0;

  constructor(options: EventSequencerOptions = {}) {
    this.reorderWindowSeconds = Math.max(
      0,
      options.reorderWindowSeconds ?? DEFAULT_REORDER_WINDOW_SECONDS,
    );
  }

  /**
   * Offer an event. Returns every event that is now safe to release, in
   * ascending timestamp order (possibly empty while the window is open).
   */
  push(event: BehaviouralEvent): SequencedEvent[] {
    if (
      this.lastReleasedTime !== undefined &&
      event.time < this.lastReleasedTime
    ) {
      this.droppedLate += 1;
      return [];
    }

    const late = this.maxSeenTime !== undefined && event.time < this.maxSeenTime;
    this.maxSeenTime =
      this.maxSeenTime === undefined
        ? event.time
        : Math.max(this.maxSeenTime, event.time);
    this.buffer.push({ event, late });
    this.buffer.sort((a, b) => a.event.time - b.event.time);
    return this.releaseReady();
  }

  /** Release every buffered event, in ascending timestamp order. */
  flush(): SequencedEvent[] {
    const released = this.buffer.map((entry) => ({
      event: entry.event,
      late: entry.late,
    }));
    this.buffer = [];
    if (released.length > 0) {
      const newest = released[released.length - 1]!.event.time;
      this.lastReleasedTime =
        this.lastReleasedTime === undefined
          ? newest
          : Math.max(this.lastReleasedTime, newest);
    }
    return released;
  }

  /** Number of events currently held for reordering. */
  pending(): number {
    return this.buffer.length;
  }

  /** Number of events dropped because they arrived after their slot. */
  droppedLateCount(): number {
    return this.droppedLate;
  }

  /** Forget all buffered events and counters. */
  reset(): void {
    this.buffer = [];
    this.lastReleasedTime = undefined;
    this.maxSeenTime = undefined;
    this.droppedLate = 0;
  }

  private releaseReady(): SequencedEvent[] {
    if (this.buffer.length === 0) return [];
    const newest = this.buffer[this.buffer.length - 1]!.event.time;
    const threshold = newest - this.reorderWindowSeconds;
    const released: SequencedEvent[] = [];
    while (this.buffer.length > 0 && this.buffer[0]!.event.time <= threshold) {
      const entry = this.buffer.shift()!;
      released.push({ event: entry.event, late: entry.late });
    }
    if (released.length > 0) {
      this.lastReleasedTime = released[released.length - 1]!.event.time;
    }
    return released;
  }
}

// ---------------------------------------------------------------------------
// Drift compensation
// ---------------------------------------------------------------------------

/** Result of a drift-compensation decision. */
export interface DriftCompensation {
  /** Raw difference `targetTime - localTime` before clamping (seconds). */
  requested: number;
  /** Bounded timing adjustment actually applied (seconds). */
  adjustment: number;
  /** `true` when the raw request already fitted inside the bound. */
  withinTolerance: boolean;
  /** `true` when the request was clamped (graceful degradation). */
  degraded: boolean;
}

/** Options for {@link DriftCompensator}. */
export interface DriftCompensatorOptions {
  /** Maximum absolute adjustment (seconds). */
  maxDriftSeconds?: number;
}

/**
 * Converts a desired playout time into a bounded timing adjustment.
 *
 * A positive adjustment means "delay the event by this much"; a negative one
 * means "play it this much sooner". The magnitude is never greater than the
 * configured bound, which guarantees bounded divergence: a client that has
 * fallen arbitrarily far behind degrades by clamping instead of jumping.
 */
export class DriftCompensator {
  private readonly maxDriftSeconds: number;

  constructor(options: DriftCompensatorOptions = {}) {
    this.maxDriftSeconds = Math.max(
      0,
      options.maxDriftSeconds ?? DEFAULT_MAX_DRIFT_SECONDS,
    );
  }

  /** Compensate for the drift between `targetTime` and `localTime`. */
  compensate(targetTime: number, localTime: number): DriftCompensation {
    const requested = targetTime - localTime;
    const withinTolerance = Math.abs(requested) <= this.maxDriftSeconds;
    const adjustment = clamp(
      requested,
      -this.maxDriftSeconds,
      this.maxDriftSeconds,
    );
    return {
      requested,
      adjustment,
      withinTolerance,
      degraded: !withinTolerance,
    };
  }

  /** The maximum absolute adjustment this compensator will apply. */
  limit(): number {
    return this.maxDriftSeconds;
  }
}

// ---------------------------------------------------------------------------
// Composed pipeline
// ---------------------------------------------------------------------------

/** A sequenced event with its corrected local playout time and drift decision. */
export interface ScheduledEvent {
  /** The original canonical event. */
  event: BehaviouralEvent;
  /** Estimated local time at which the event should play (seconds). */
  playoutTime: number;
  /** Whether the event arrived out of order. */
  late: boolean;
  /** Bounded drift correction applied for this event. */
  drift: DriftCompensation;
}

/** Options for {@link SyncPipeline}. */
export interface SyncPipelineOptions {
  /** Reorder window in seconds. */
  reorderWindowSeconds?: number;
  /** Clock-offset smoothing factor in `(0, 1]`. */
  clockSmoothing?: number;
  /** Maximum clock-offset correction (seconds). */
  maxClockOffsetSeconds?: number;
  /** Maximum per-event drift adjustment (seconds). */
  maxDriftSeconds?: number;
}

/**
 * The composed client-side sync pipeline: correct, order, then bound.
 *
 * Usage: seed the clock estimate with {@link observeReference} (the late-join
 * snapshot on join, or a periodic sync ping), then feed every received event to
 * {@link ingest}. The returned {@link ScheduledEvent}s carry the corrected
 * playout time and a bounded drift decision — the caller never sees an
 * unbounded jump.
 */
export class SyncPipeline {
  readonly corrector: TimestampCorrector;
  readonly sequencer: EventSequencer;
  readonly compensator: DriftCompensator;

  constructor(options: SyncPipelineOptions = {}) {
    this.corrector = new TimestampCorrector({
      smoothing: options.clockSmoothing,
      maxOffsetSeconds: options.maxClockOffsetSeconds,
    });
    this.sequencer = new EventSequencer({
      reorderWindowSeconds: options.reorderWindowSeconds,
    });
    this.compensator = new DriftCompensator({
      maxDriftSeconds: options.maxDriftSeconds,
    });
  }

  /** Seed the clock-offset estimate from a host/local reference sample. */
  observeReference(remoteTime: number, localTime: number): number {
    return this.corrector.observe(remoteTime, localTime);
  }

  /** Ingest a received event and return anything now ready to play. */
  ingest(event: BehaviouralEvent, localTime: number): ScheduledEvent[] {
    return this.sequencer
      .push(event)
      .map((entry) => this.schedule(entry, localTime));
  }

  /** Release every buffered event at the given local time. */
  flush(localTime: number): ScheduledEvent[] {
    return this.sequencer
      .flush()
      .map((entry) => this.schedule(entry, localTime));
  }

  /** Number of received events dropped as unrecoverably late. */
  droppedLate(): number {
    return this.sequencer.droppedLateCount();
  }

  private schedule(entry: SequencedEvent, localTime: number): ScheduledEvent {
    const playoutTime = this.corrector.correct(entry.event.time);
    return {
      event: entry.event,
      playoutTime,
      late: entry.late,
      drift: this.compensator.compensate(playoutTime, localTime),
    };
  }
}

// ---------------------------------------------------------------------------
// Jitter alignment harness
// ---------------------------------------------------------------------------

/** Per-client jitter configuration for {@link runJitterHarness}. */
export interface JitterClientConfig {
  /** Constant clock skew between this client's local clock and host time. */
  clockSkewSeconds: number;
  /** Maximum absolute jitter added to each observed timestamp (seconds). */
  jitterSeconds: number;
  /** Seed for the deterministic jitter sequence. */
  seed: number;
}

/** Per-client result from {@link runJitterHarness}. */
export interface JitterClientReport {
  /** Events released by this client, in timestamp order. */
  scheduled: ScheduledEvent[];
  /** Estimated clock offset after correction. */
  offsetEstimate: number;
  /** `|offsetEstimate - clockSkewSeconds|` (seconds). */
  correctionErrorSeconds: number;
}

/** Result of {@link runJitterHarness}. */
export interface JitterAlignmentReport {
  clients: JitterClientReport[];
  /**
   * Maximum pairwise difference in *real* playout time between clients
   * (seconds). Real playout removes each client's known clock skew, so a value
   * of zero means the clients play at the same instant.
   */
  maxAlignmentErrorSeconds: number;
  /** The tolerance the report was judged against. */
  toleranceSeconds: number;
  /** `true` when `maxAlignmentErrorSeconds <= toleranceSeconds`. */
  aligned: boolean;
}

/** Options for {@link runJitterHarness}. */
export interface JitterHarnessOptions {
  /** Number of jittered reference samples used to seed clock correction. */
  referenceSamples?: number;
  /** Alignment tolerance (seconds). */
  toleranceSeconds?: number;
  /** Reorder window used by each client's pipeline (seconds). */
  reorderWindowSeconds?: number;
  /** Maximum drift adjustment used by each client's pipeline (seconds). */
  maxDriftSeconds?: number;
}

/** Deterministic 32-bit PRNG (mulberry32) so jitter is reproducible. */
function mulberry32(seed: number): () => number {
  let state = seed >>> 0;
  return () => {
    state = (state + 0x6d2b79f5) >>> 0;
    let t = state;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/**
 * Simulate delivery of one event stream to several jittery clients and assert
 * they remain perceptually aligned within a documented tolerance.
 *
 * Each client runs its own {@link SyncPipeline}. A small number of reference
 * samples (each perturbed by bounded jitter) seed clock correction; the events
 * are then ingested in host order with a jittered local arrival time. Because
 * playout is derived from *corrected event timestamps*, not arrival times, the
 * clients converge to the same real playout instant even under independent
 * jitter.
 *
 * The harness is fully deterministic: the jitter sequence is a pure function of
 * each client's seed.
 */
export function runJitterHarness(
  events: readonly BehaviouralEvent[],
  clientConfigs: readonly JitterClientConfig[],
  options: JitterHarnessOptions = {},
): JitterAlignmentReport {
  const referenceSamples = Math.max(0, options.referenceSamples ?? 5);
  const toleranceSeconds =
    options.toleranceSeconds ?? DEFAULT_ALIGNMENT_TOLERANCE_SECONDS;

  const clients: JitterClientReport[] = [];
  const playoutByClient: Array<Map<BehaviouralEvent, number>> = [];

  for (const config of clientConfigs) {
    const pipeline = new SyncPipeline({
      reorderWindowSeconds: options.reorderWindowSeconds,
      maxDriftSeconds: options.maxDriftSeconds,
    });
    const rng = mulberry32(config.seed);

    // Seed the clock estimate from several jittered reference observations.
    const referenceSpan = events.length > 0 ? events[events.length - 1]!.time : 0;
    for (let i = 0; i < referenceSamples; i += 1) {
      const remoteTime =
        referenceSamples === 1 ? 0 : (referenceSpan * i) / (referenceSamples - 1);
      const jitter = (rng() * 2 - 1) * config.jitterSeconds;
      pipeline.observeReference(
        remoteTime,
        remoteTime + config.clockSkewSeconds + jitter,
      );
    }

    const scheduled: ScheduledEvent[] = [];
    for (const event of events) {
      const jitter = (rng() * 2 - 1) * config.jitterSeconds;
      const arrivalTime = event.time + config.clockSkewSeconds + jitter;
      scheduled.push(...pipeline.ingest(event, arrivalTime));
    }
    scheduled.push(...pipeline.flush(referenceSpan + config.clockSkewSeconds));

    const playout = new Map<BehaviouralEvent, number>();
    for (const item of scheduled) playout.set(item.event, item.playoutTime);
    playoutByClient.push(playout);

    clients.push({
      scheduled,
      offsetEstimate: pipeline.corrector.offset(),
      correctionErrorSeconds: Math.abs(
        pipeline.corrector.offset() - config.clockSkewSeconds,
      ),
    });
  }

  let maxAlignmentErrorSeconds = 0;
  for (let a = 0; a < clientConfigs.length; a += 1) {
    for (let b = a + 1; b < clientConfigs.length; b += 1) {
      const mapA = playoutByClient[a]!;
      const mapB = playoutByClient[b]!;
      for (const [event, playoutA] of mapA) {
        const playoutB = mapB.get(event);
        if (playoutB === undefined) continue;
        const realA = playoutA - clientConfigs[a]!.clockSkewSeconds;
        const realB = playoutB - clientConfigs[b]!.clockSkewSeconds;
        maxAlignmentErrorSeconds = Math.max(
          maxAlignmentErrorSeconds,
          Math.abs(realA - realB),
        );
      }
    }
  }

  return {
    clients,
    maxAlignmentErrorSeconds,
    toleranceSeconds,
    aligned: maxAlignmentErrorSeconds <= toleranceSeconds,
  };
}
