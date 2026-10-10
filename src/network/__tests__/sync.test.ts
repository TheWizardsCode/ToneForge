/**
 * Late-join snapshot, timestamp ordering and drift/latency handling tests.
 *
 * Covers the four acceptance criteria of TF-0MUZYS377005ZSDT:
 *
 * 1. On join the host sends a snapshot and the late joiner resolves identical
 *    deterministic output to an already-connected peer.
 * 2. Out-of-order/late events are ordered by timestamp; drift compensation is
 *    bounded and reported.
 * 3. Under simulated jitter two clients remain aligned within a documented
 *    tolerance.
 * 4. The suites run offline and deterministically.
 */

import { describe, expect, it } from "vitest";

import { createInMemoryNetwork, createInMemoryTransport } from "../transport.js";
import { host, join } from "../session.js";
import type { BehaviouralEvent } from "../types.js";
import {
  applySnapshot,
  captureSnapshot,
  validateSnapshot,
  type StateSnapshot,
} from "../snapshot.js";
import {
  DEFAULT_ALIGNMENT_TOLERANCE_SECONDS,
  DEFAULT_MAX_DRIFT_SECONDS,
  DriftCompensator,
  EventSequencer,
  SyncPipeline,
  TimestampCorrector,
  runJitterHarness,
  type JitterClientConfig,
} from "../sync.js";
import { DeterministicResolver } from "../resolver.js";

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function event(
  name: string,
  time: number,
  overrides: Partial<Omit<BehaviouralEvent, "event" | "time">> = {},
): BehaviouralEvent {
  return {
    version: 1,
    event: name,
    seed: 42,
    time,
    state: "walk",
    context: { surface: "gravel" },
    ...overrides,
  };
}

function isolatedTransport() {
  return createInMemoryTransport(createInMemoryNetwork());
}

/**
 * Adapt a canonical behavioural event / snapshot to the resolver's input shape.
 * The resolver (`resolver.ts`) predates the canonical model and carries its own
 * `id`-bearing event; the numeric fields are what determine the output.
 */
function toResolverEvent(
  event: { event: string; state: string; seed: number; time: number; context: Record<string, string> },
  id: string,
) {
  return {
    id,
    event: event.event,
    state: event.state,
    seed: event.seed,
    time: event.time,
    context: event.context,
  };
}

function deterministicEventStream(): BehaviouralEvent[] {
  return [
    event("state-transition", 0, { state: "walk", seed: 1 }),
    event("footstep", 1, { state: "walk", seed: 2 }),
    event("state-transition", 2, { state: "run", seed: 3 }),
    event("footstep", 3, { state: "run", seed: 4 }),
    event("context-change", 4, { state: "run", seed: 5, context: { surface: "stone" } }),
    event("footstep", 5, { state: "run", seed: 6, context: { surface: "stone" } }),
  ];
}

// ---------------------------------------------------------------------------
// AC1 — late-join snapshot
// ---------------------------------------------------------------------------

describe("late join — snapshot capture/apply", () => {
  it("captures a canonical snapshot from an emitted event", () => {
    const source = event("state-transition", 3, { state: "run", seed: 7 });
    const snapshot = captureSnapshot(source);
    expect(snapshot).toEqual({
      version: 1,
      event: "state-transition",
      seed: 7,
      time: 3,
      state: "run",
      context: { surface: "gravel" },
    });
  });

  it("rejects a malformed snapshot instead of applying it", () => {
    const result = validateSnapshot({ version: 1, event: "", seed: 1, time: 0, state: "run", context: {} });
    expect(result.valid).toBe(false);
    expect(() => applySnapshot({} as StateSnapshot)).toThrow();
  });

  it("applying a snapshot yields the canonical resolvable event", () => {
    const snapshot: StateSnapshot = captureSnapshot(event("footstep", 5.5, { seed: 11 }));
    expect(applySnapshot(snapshot)).toEqual({
      version: 1,
      event: "footstep",
      seed: 11,
      time: 5.5,
      state: "walk",
      context: { surface: "gravel" },
    });
  });
});

describe("late join — host sends a snapshot on join (AC1)", () => {
  it("delivers the current state to a client that joins after playback started", async () => {
    const transport = isolatedTransport();
    const hostSession = await host({ port: 0, transport });
    await Promise.resolve();

    const lastEvent = {
      event: "context-change",
      seed: 9,
      time: 3.5,
      state: "run",
      context: { surface: "stone" },
    };
    hostSession.emit(event("state-transition", 1, { state: "walk" }));
    hostSession.emit(lastEvent);

    // The late joiner never receives replayed events, only the snapshot.
    const client = await join(hostSession.address, { transport });
    const snapshot = client.snapshot();
    expect(snapshot).toBeDefined();
    expect(snapshot).toMatchObject({
      version: 1,
      event: "context-change",
      seed: 9,
      time: 3.5,
      state: "run",
      context: { surface: "stone" },
    });

    // The joiner resolves the snapshot to byte-identical output to the host's
    // resolution of the same current event.
    const resolver = new DeterministicResolver();
    const joinerOutput = resolver.resolve(
      toResolverEvent(applySnapshot(snapshot!), "current"),
    );
    const hostOutput = resolver.resolve(
      toResolverEvent(captureSnapshot({
        version: 1,
        event: lastEvent.event,
        seed: lastEvent.seed,
        time: lastEvent.time,
        state: lastEvent.state,
        context: lastEvent.context,
      }), "current"),
    );
    expect(joinerOutput).toEqual(hostOutput);

    await client.close();
    await hostSession.close();
  });

  it("invokes a snapshot handler registered after join with the stored snapshot", async () => {
    const transport = isolatedTransport();
    const hostSession = await host({ port: 0, transport });
    hostSession.emit(event("footstep", 2, { seed: 5 }));

    const client = await join(hostSession.address, { transport });
    const observed: StateSnapshot[] = [];
    client.onSnapshot((s) => observed.push(s));

    expect(observed).toHaveLength(1);
    expect(observed[0]).toMatchObject({ event: "footstep", seed: 5, time: 2 });

    await client.close();
    await hostSession.close();
  });

  it("has no snapshot before the host has emitted anything", async () => {
    const transport = isolatedTransport();
    const hostSession = await host({ port: 0, transport });
    const client = await join(hostSession.address, { transport });

    expect(client.snapshot()).toBeUndefined();

    client.onSnapshot(() => {
      throw new Error("handler must not fire without a snapshot");
    });

    // Once the host emits, the client is not retroactively snapshotted (no
    // replay); it simply receives the live event.
    const received: string[] = [];
    client.onReceive((e) => received.push(e.event));
    hostSession.emit(event("live", 1));
    expect(received).toEqual(["live"]);

    await client.close();
    await hostSession.close();
  });

  it("updates the host snapshot as authoritative events are emitted", async () => {
    const transport = isolatedTransport();
    const hostSession = await host({ port: 0, transport });
    hostSession.emit(event("first", 1, { seed: 1 }));
    hostSession.emit(event("second", 2, { seed: 2 }));

    expect(hostSession.snapshot()).toMatchObject({ event: "second", seed: 2, time: 2 });

    await hostSession.close();
  });
});

// ---------------------------------------------------------------------------
// AC2 — timestamp correction, ordering and bounded drift
// ---------------------------------------------------------------------------

describe("timestamp correction (AC2)", () => {
  it("estimates the clock offset from a reference sample and corrects timestamps", () => {
    const corrector = new TimestampCorrector({ smoothing: 1 });
    expect(corrector.correct(10)).toBe(10);
    corrector.observe(10, 12);
    expect(corrector.offset()).toBeCloseTo(2);
    expect(corrector.correct(30)).toBeCloseTo(32);
    expect(corrector.samples()).toBe(1);
  });

  it("smooths successive samples and clamps the offset to the bound", () => {
    const smoothed = new TimestampCorrector({ smoothing: 0.5 });
    smoothed.observe(0, 2);
    smoothed.observe(10, 11);
    // half-way between +2 and +1
    expect(smoothed.offset()).toBeCloseTo(1.5);

    const bounded = new TimestampCorrector({ smoothing: 1, maxOffsetSeconds: 0.5 });
    bounded.observe(0, 100);
    expect(bounded.offset()).toBe(0.5);
  });
});

describe("timestamp ordering (AC2)", () => {
  it("releases out-of-order events in ascending timestamp order", () => {
    const sequencer = new EventSequencer({ reorderWindowSeconds: 0.5 });
    const released: number[] = [];
    const lateFlags: boolean[] = [];

    for (const ev of [event("c", 3), event("a", 1), event("b", 2), event("d", 4)]) {
      for (const item of sequencer.push(ev)) {
        released.push(item.event.time);
        lateFlags.push(item.late);
      }
    }
    for (const item of sequencer.flush()) released.push(item.event.time);

    expect(released).toEqual([1, 2, 3, 4]);
    // The out-of-order events are flagged as late; in-order ones are not.
    expect(lateFlags).toEqual([true, true, false]);
  });

  it("drops events that arrive after their slot has been released", () => {
    const sequencer = new EventSequencer({ reorderWindowSeconds: 0 });
    expect(sequencer.push(event("a", 1))).toHaveLength(1);
    expect(sequencer.push(event("stale", 0.5))).toHaveLength(0);
    expect(sequencer.droppedLateCount()).toBe(1);
    expect(sequencer.flush()).toHaveLength(0);
  });

  it("is deterministic for the same delivered event order", () => {
    const order = [event("c", 3), event("a", 1), event("b", 2), event("d", 4)];
    const run = () => {
      const sequencer = new EventSequencer({ reorderWindowSeconds: 0.5 });
      const out: number[] = [];
      for (const ev of order) for (const item of sequencer.push(ev)) out.push(item.event.time);
      for (const item of sequencer.flush()) out.push(item.event.time);
      return out;
    };
    expect(run()).toEqual(run());
    expect(run()).toEqual([1, 2, 3, 4]);
  });
});

describe("bounded drift compensation (AC2)", () => {
  it("applies the requested adjustment when inside the bound", () => {
    const compensator = new DriftCompensator({ maxDriftSeconds: 0.1 });
    const result = compensator.compensate(10.05, 10);
    expect(result.withinTolerance).toBe(true);
    expect(result.degraded).toBe(false);
    expect(result.adjustment).toBeCloseTo(0.05);
  });

  it("clamps and flags degradation when the drift exceeds the bound", () => {
    const compensator = new DriftCompensator({ maxDriftSeconds: 0.1 });
    const ahead = compensator.compensate(10.5, 10);
    expect(ahead.degraded).toBe(true);
    expect(ahead.adjustment).toBeCloseTo(0.1);

    const behind = compensator.compensate(10, 10.5);
    expect(behind.degraded).toBe(true);
    expect(behind.adjustment).toBeCloseTo(-0.1);
  });

  it("never exceeds the configured bound even under extreme drift", () => {
    const compensator = new DriftCompensator({ maxDriftSeconds: DEFAULT_MAX_DRIFT_SECONDS });
    for (const target of [-1000, -1, 0, 1, 1000]) {
      const { adjustment } = compensator.compensate(target, 0);
      expect(Math.abs(adjustment)).toBeLessThanOrEqual(DEFAULT_MAX_DRIFT_SECONDS);
    }
  });
});

// ---------------------------------------------------------------------------
// AC3 — jitter alignment harness
// ---------------------------------------------------------------------------

describe("jitter alignment harness (AC3)", () => {
  const clients: JitterClientConfig[] = [
    { clockSkewSeconds: 0.3, jitterSeconds: 0.08, seed: 1 },
    { clockSkewSeconds: -0.2, jitterSeconds: 0.08, seed: 2 },
  ];

  it("keeps two independently jittery clients aligned within tolerance", () => {
    const report = runJitterHarness(deterministicEventStream(), clients, {
      referenceSamples: 8,
      toleranceSeconds: DEFAULT_ALIGNMENT_TOLERANCE_SECONDS,
    });

    expect(report.aligned).toBe(true);
    expect(report.maxAlignmentErrorSeconds).toBeLessThanOrEqual(
      DEFAULT_ALIGNMENT_TOLERANCE_SECONDS,
    );
    for (const client of report.clients) {
      expect(client.correctionErrorSeconds).toBeLessThanOrEqual(
        DEFAULT_ALIGNMENT_TOLERANCE_SECONDS,
      );
    }
  });

  it("bounds every drift adjustment emitted by the harness", () => {
    const report = runJitterHarness(deterministicEventStream(), clients, {
      referenceSamples: 5,
    });
    for (const client of report.clients) {
      for (const scheduled of client.scheduled) {
        expect(Math.abs(scheduled.drift.adjustment)).toBeLessThanOrEqual(
          DEFAULT_MAX_DRIFT_SECONDS,
        );
      }
    }
  });

  it("is deterministic for a fixed set of client seeds", () => {
    const first = runJitterHarness(deterministicEventStream(), clients, { referenceSamples: 6 });
    const second = runJitterHarness(deterministicEventStream(), clients, { referenceSamples: 6 });
    expect(first.maxAlignmentErrorSeconds).toBe(second.maxAlignmentErrorSeconds);
    expect(first.clients.map((c) => c.offsetEstimate)).toEqual(
      second.clients.map((c) => c.offsetEstimate),
    );
  });
});

// ---------------------------------------------------------------------------
// Composed pipeline
// ---------------------------------------------------------------------------

describe("SyncPipeline", () => {
  it("corrects, orders and bounds in a single pass", () => {
    const pipeline = new SyncPipeline({ reorderWindowSeconds: 0.5, maxDriftSeconds: 0.2 });
    pipeline.observeReference(0, 0.25); // estimated +0.25s offset

    const scheduled = [
      ...pipeline.ingest(event("b", 3), 3.25),
      ...pipeline.ingest(event("a", 1), 1.25),
      ...pipeline.ingest(event("c", 5), 5.25),
      ...pipeline.flush(5.25),
    ];

    expect(scheduled.map((s) => s.event.event)).toEqual(["a", "b", "c"]);
    expect(scheduled.map((s) => s.playoutTime)).toEqual([1.25, 3.25, 5.25]);
    for (const item of scheduled) {
      expect(Math.abs(item.drift.adjustment)).toBeLessThanOrEqual(0.2);
    }
  });

  it("counts unrecoverably late events instead of replaying them", () => {
    const pipeline = new SyncPipeline({ reorderWindowSeconds: 0 });
    pipeline.ingest(event("a", 2), 2);
    pipeline.ingest(event("stale", 1), 2);
    expect(pipeline.droppedLate()).toBe(1);
  });
});
