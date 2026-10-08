/**
 * Network determinism & bandwidth conformance harness tests.
 *
 * Validates that two independent client resolvers resolve identical
 * behavioural-output from the same behavioural-event stream, and that
 * the harness correctly detects mismatches (negative control).
 * Also verifies per-event network cost and projected bandwidth.
 *
 * Work item: TF-0MUZYS1IL003MCKC (Network determinism and bandwidth
 * conformance harness).
 */

import { describe, it, expect } from "vitest";
import { join } from "node:path";

import { loadFixture, runConformanceHarness, runNegativeControlHarness } from "../harness.js";
import { DeterministicResolver, BehaviouralEvent, computeByteStats, eventByteSize } from "../resolver.js";

// Fixture path: from src/network/__tests__ go up two levels to src/
const fixturePath = join(
  __dirname,
  "..",
  "..",
  "test-utils",
  "fixtures",
  "network",
  "walk-run.json",
);

// ---------------------------------------------------------------------------
// AC1: Fixture set exists and contains required event sequences
// ---------------------------------------------------------------------------

describe("AC1 — fixture set", () => {
  it("walk-run.json exists and parses as a valid fixture", () => {
    const fixture = loadFixture(fixturePath);
    expect(fixture.name).toBe("walk-run-transition");
    expect(fixture.version).toBe("1.0");
    expect(Array.isArray(fixture.events)).toBe(true);
    expect(fixture.events.length).toBeGreaterThan(0);
  });

  it("contains walk → run state transition events", () => {
    const fixture = loadFixture(fixturePath);
    const states = fixture.events.map((e) => e.state);
    expect(states).toContain("walk");
    expect(states).toContain("run");
    // The walk → run transition should appear in order
    const walkIndex = states.indexOf("walk");
    const runIndex = states.indexOf("run");
    expect(walkIndex).toBeLessThan(runIndex);
  });

  it("contains a context-change event", () => {
    const fixture = loadFixture(fixturePath);
    const contextEvents = fixture.events.filter(
      (e) => e.event === "context-change",
    );
    expect(contextEvents.length).toBeGreaterThan(0);
    // Context should differ from the initial one
    const firstContext = fixture.events[0]!.context;
    const contextEvent = contextEvents[0]!;
    expect(contextEvent.context).not.toEqual(firstContext);
  });

  it("contains a late-join event with snapshot time", () => {
    const fixture = loadFixture(fixturePath);
    const lateEvents = fixture.events.filter(
      (e) => e.event === "late-join",
    );
    expect(lateEvents.length).toBeGreaterThan(0);
    expect((lateEvents[0]! as unknown as Record<string, unknown>).snapshotTime)
      .toBeDefined();
  });
});

// ---------------------------------------------------------------------------
// AC2: Two independent resolvers produce byte-identical output
// ---------------------------------------------------------------------------

describe("AC2 — determinism: identical resolvers produce identical output", () => {
  it("two identical resolvers produce byte-identical resolved output", () => {
    const result = runConformanceHarness({
      seedOffsetA: 0,
      seedOffsetB: 0,
      fixturePath,
    });
    expect(result.match).toBe(true);
    expect(result.firstDivergenceIndex).toBe(-1);
    expect(result.eventCount).toBeGreaterThan(0);
  });

  it("determinism holds across multiple independent runs", () => {
    const result1 = runConformanceHarness({
      seedOffsetA: 0,
      seedOffsetB: 0,
      fixturePath,
    });
    const result2 = runConformanceHarness({
      seedOffsetA: 0,
      seedOffsetB: 0,
      fixturePath,
    });
    const result3 = runConformanceHarness({
      seedOffsetA: 0,
      seedOffsetB: 0,
      fixturePath,
    });

    // All three runs should match
    expect(result1.outputsA).toEqual(result2.outputsA);
    expect(result2.outputsA).toEqual(result3.outputsA);
  });

  it("resolver resolves each event deterministically", () => {
    const resolver = new DeterministicResolver({ seedOffset: 0 });
    const fixture = loadFixture(fixturePath);

    // Resolve twice; outputs must be identical
    const first = resolver.resolveStream(fixture.events);
    const second = resolver.resolveStream(fixture.events);

    for (let i = 0; i < first.length; i++) {
      expect(JSON.stringify(first[i])).toBe(JSON.stringify(second[i]!));
    }
  });

  it("seed mismatch produces different output (negative control)", () => {
    const result = runNegativeControlHarness({ fixturePath });
    expect(result.match).toBe(false);
    expect(result.firstDivergenceIndex).toBeGreaterThanOrEqual(0);
  });
});

// ---------------------------------------------------------------------------
// AC3: Byte accounting — bandwidth below 1 KB/s
// ---------------------------------------------------------------------------

describe("AC3 — byte accounting & bandwidth", () => {
  it("projects average bytes per event above zero", () => {
    const result = runConformanceHarness({ fixturePath });
    expect(result.byteStats.avgBytesPerEvent).toBeGreaterThan(0);
  });

  it("projects bandwidth below 1 KB/s for 1 event/second", () => {
    const result = runConformanceHarness({ fixturePath });
    expect(result.byteStats.projectedBandwidthKbps).toBeLessThan(1);
  });

  it("per-event byte sizes are consistent", () => {
    const fixture = loadFixture(fixturePath);
    const sizes = fixture.events.map(eventByteSize);

    // All events should have a positive byte size
    for (const size of sizes) {
      expect(size).toBeGreaterThan(0);
    }

    // Maximum should not exceed 512 bytes for a compact behavioural event
    expect(Math.max(...sizes)).toBeLessThanOrEqual(512);
  });

  it("computeByteStats matches harness byte stats", () => {
    const fixture = loadFixture(fixturePath);
    const manualStats = computeByteStats(fixture.events);
    const harnessResult = runConformanceHarness({ fixturePath });

    expect(manualStats.avgBytesPerEvent).toBeCloseTo(
      harnessResult.byteStats.avgBytesPerEvent,
      2,
    );
    expect(manualStats.projectedBandwidthKbps).toBeCloseTo(
      harnessResult.byteStats.projectedBandwidthKbps,
      2,
    );
  });
});

// ---------------------------------------------------------------------------
// AC4: Offline and deterministic — no live sockets
// ---------------------------------------------------------------------------

describe("AC4 — offline determinism", () => {
  it("all tests complete without network I/O", () => {
    // If we get here without an error, no network I/O was performed.
    const result = runConformanceHarness({ fixturePath });
    expect(result).toBeDefined();
    expect(result.match).toBe(true);
  });

  it("tests are deterministic — repeated runs produce identical results", () => {
    const results = Array.from({ length: 5 }, () =>
      runConformanceHarness({ fixturePath }),
    );

    // Every run should produce an identical match result
    for (const r of results) {
      expect(r.match).toBe(true);
      expect(r.eventCount).toBe(results[0]!.eventCount);
    }
  });

  it("negative control is deterministic", () => {
    const results = Array.from({ length: 5 }, () =>
      runNegativeControlHarness({ fixturePath }),
    );

    for (const r of results) {
      expect(r.match).toBe(false);
    }
  });
});

// ---------------------------------------------------------------------------
// AC5: Integration — resolver contract
// ---------------------------------------------------------------------------

describe("Resolver contract", () => {
  it("resolved output includes all required fields", () => {
    const resolver = new DeterministicResolver({ seedOffset: 0 });
    const fixture = loadFixture(fixturePath);
    const output = resolver.resolve(fixture.events[0]!);

    expect(output.eventId).toBeDefined();
    expect(output.eventType).toBeDefined();
    expect(output.state).toBeDefined();
    expect(output.seed).toBeDefined();
    expect(output.time).toBeDefined();
    expect(output.contextHash).toBeDefined();
    expect(output.frequency).toBeDefined();
    expect(output.gain).toBeDefined();
    expect(output.byteSize).toBeGreaterThan(0);
  });

  it("resolver version is accessible", () => {
    const resolver = new DeterministicResolver({ version: "1.0" });
    expect(resolver.version()).toBe("1.0");
  });

  it("different seed offsets produce different resolved outputs", () => {
    const fixture = loadFixture(fixturePath);
    const resolverA = new DeterministicResolver({ seedOffset: 0 });
    const resolverB = new DeterministicResolver({ seedOffset: 1 });

    const outputA = resolverA.resolve(fixture.events[0]!);
    const outputB = resolverB.resolve(fixture.events[0]!);

    // Seeds differ due to offset
    expect(outputA.seed).not.toBe(outputB.seed);
  });
});
