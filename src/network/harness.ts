/**
 * Network conformance harness.
 *
 * Replays a behavioural event fixture through two independent client
 * resolvers and asserts byte-identical resolved output.  Also measures
 * per-event network cost and projects bandwidth for a typical gameplay
 * stream.
 *
 * Work item: TF-0MUZYS1IL003MCKC (Network determinism & bandwidth conformance).
 */

import { readFileSync } from "node:fs";
import { join } from "node:path";
import {
  BehaviouralEvent,
  DeterministicResolver,
  ResolvedOutput,
  computeByteStats,
} from "./resolver.js";

// ---------------------------------------------------------------------------
// Harness result types
// ---------------------------------------------------------------------------

/** Result of comparing two resolver outputs. */
export interface ConformanceResult {
  /** Whether the two resolvers produced identical output. */
  match: boolean;
  /** Number of events compared. */
  eventCount: number;
  /** First index where outputs diverged (-1 if identical). */
  firstDivergenceIndex: number;
  /** Byte-identical resolved outputs for every event. */
  outputsA: ResolvedOutput[];
  /** Byte-identical resolved outputs for every event. */
  outputsB: ResolvedOutput[];
  /** Per-event byte statistics. */
  byteStats: {
    avgBytesPerEvent: number;
    projectedBandwidthKbps: number;
  };
}

/** Harness configuration. */
export interface HarnessConfig {
  /** Seed offset for the primary resolver. */
  seedOffsetA: number;
  /** Seed offset for the secondary resolver. */
  seedOffsetB: number;
  /** Optional path to a fixture JSON file. */
  fixturePath?: string;
}

/** Default harness configuration. */
const DEFAULT_CONFIG: HarnessConfig = {
  seedOffsetA: 0,
  seedOffsetB: 0,
};

// ---------------------------------------------------------------------------
// Fixture loading
// ---------------------------------------------------------------------------

/** Shape of a network fixture JSON file. */
interface NetworkFixture {
  name: string;
  description?: string;
  version: string;
  events: BehaviouralEvent[];
}

/**
 * Load a network fixture from a JSON file.
 *
 * @param fixturePath - Absolute path to the fixture file.
 */
export function loadFixture(fixturePath: string): NetworkFixture {
  const raw = readFileSync(fixturePath, "utf-8");
  return JSON.parse(raw) as NetworkFixture;
}

/**
 * Resolve the default fixture path relative to the project root.
 */
function defaultFixturePath(): string {
  const srcDir = join(__dirname, "..", "..", "test-utils", "fixtures", "network");
  return join(srcDir, "walk-run.json");
}

// ---------------------------------------------------------------------------
// Conformance checking
// ---------------------------------------------------------------------------

/**
 * Compare two resolved output arrays for byte-identical equality.
 */
function outputsMatch(a: ResolvedOutput[], b: ResolvedOutput[]): {
  match: boolean;
  firstDivergenceIndex: number;
} {
  if (a.length !== b.length) {
    return { match: false, firstDivergenceIndex: 0 };
  }

  for (let i = 0; i < a.length; i++) {
    const jsonA = JSON.stringify(a[i]!);
    const jsonB = JSON.stringify(b[i]!);
    if (jsonA !== jsonB) {
      return { match: false, firstDivergenceIndex: i };
    }
  }

  return { match: true, firstDivergenceIndex: -1 };
}

// ---------------------------------------------------------------------------
// Harness runner
// ---------------------------------------------------------------------------

/**
 * Run the network conformance harness.
 *
 * Feeds the same event stream (loaded from fixture) through two
 * independent resolvers and compares their outputs.
 *
 * @param config - Optional harness configuration.
 */
export function runConformanceHarness(
  config?: Partial<HarnessConfig>,
): ConformanceResult {
  const { seedOffsetA, seedOffsetB, fixturePath } = {
    ...DEFAULT_CONFIG,
    ...config,
  };

  const path = fixturePath || defaultFixturePath();
  const fixture = loadFixture(path);
  const events = fixture.events;

  // Two independent resolvers with (potentially) different seed offsets
  const resolverA = new DeterministicResolver({ seedOffset: seedOffsetA });
  const resolverB = new DeterministicResolver({ seedOffset: seedOffsetB });

  const outputsA = resolverA.resolveStream(events);
  const outputsB = resolverB.resolveStream(events);

  const { match, firstDivergenceIndex } = outputsMatch(outputsA, outputsB);

  // Byte stats are the same regardless of resolver configuration
  const byteStats = computeByteStats(events);

  return {
    match,
    eventCount: events.length,
    firstDivergenceIndex,
    outputsA,
    outputsB,
    byteStats: {
      avgBytesPerEvent: byteStats.avgBytesPerEvent,
      projectedBandwidthKbps: byteStats.projectedBandwidthKbps,
    },
  };
}

/**
 * Run the negative control harness.
 *
 * Uses two resolvers with *different* seed offsets to prove the harness
 * correctly detects non-matching output.
 *
 * @param config - Optional harness configuration with different offsets.
 */
export function runNegativeControlHarness(
  config?: Partial<HarnessConfig>,
): ConformanceResult {
  return runConformanceHarness({
    seedOffsetA: 0,
    seedOffsetB: 9999, // deliberately different seed offset
    ...config,
  });
}
