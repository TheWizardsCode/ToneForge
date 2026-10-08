/**
 * Buffer Comparison Utilities
 *
 * Provides diagnostic comparison of audio buffers for determinism testing.
 *
 * Also provides SHA-256 directory snapshot helpers used by the Intelligence
 * conformance harness to prove read-only behaviour.
 */

import { createHash } from "node:crypto";
import { readdirSync, readFileSync } from "node:fs";
import { join, relative } from "node:path";

/** Result of comparing two audio buffers. */
export interface BufferCompareResult {
  /** Whether the buffers are identical. */
  identical: boolean;
  /** Index of the first divergent sample (-1 if identical). */
  firstDivergentIndex: number;
  /** Value in buffer A at the first divergent index. */
  valueA: number;
  /** Value in buffer B at the first divergent index. */
  valueB: number;
  /** Absolute difference at the first divergent index. */
  delta: number;
  /** Total number of samples compared. */
  totalSamples: number;
}

/**
 * Compare two Float32Arrays sample-by-sample.
 *
 * Returns diagnostic information including the first divergent sample
 * index and delta value for debugging non-determinism.
 */
export function compareBuffers(
  a: Float32Array,
  b: Float32Array,
): BufferCompareResult {
  const totalSamples = Math.max(a.length, b.length);

  if (a.length !== b.length) {
    return {
      identical: false,
      firstDivergentIndex: Math.min(a.length, b.length),
      valueA: a.length > b.length ? a[b.length]! : 0,
      valueB: b.length > a.length ? b[a.length]! : 0,
      delta: Infinity,
      totalSamples,
    };
  }

  for (let i = 0; i < a.length; i++) {
    if (a[i] !== b[i]) {
      const valA = a[i]!;
      const valB = b[i]!;
      return {
        identical: false,
        firstDivergentIndex: i,
        valueA: valA,
        valueB: valB,
        delta: Math.abs(valA - valB),
        totalSamples,
      };
    }
  }

  return {
    identical: true,
    firstDivergentIndex: -1,
    valueA: 0,
    valueB: 0,
    delta: 0,
    totalSamples,
  };
}

/**
 * Format a BufferCompareResult into a human-readable diagnostic string.
 */
export function formatCompareResult(result: BufferCompareResult): string {
  if (result.identical) {
    return `Buffers are identical (${result.totalSamples} samples)`;
  }
  return [
    `Buffers diverge at sample ${result.firstDivergentIndex} of ${result.totalSamples}`,
    `  A[${result.firstDivergentIndex}] = ${result.valueA}`,
    `  B[${result.firstDivergentIndex}] = ${result.valueB}`,
    `  delta = ${result.delta}`,
  ].join("\n");
}

// ---------------------------------------------------------------------------
// Directory snapshots (read-only conformance checks)
// ---------------------------------------------------------------------------

/** SHA-256 hash of a buffer, as a lowercase hex string. */
export function hashBuffer(buffer: Buffer | Uint8Array): string {
  return createHash("sha256").update(buffer).digest("hex");
}

/** SHA-256 hash of a file's contents. */
export function hashFile(path: string): string {
  return hashBuffer(readFileSync(path));
}

/**
 * Snapshot every file under `dir`, keyed by its path relative to `dir`.
 *
 * Traversal is sorted so the snapshot itself is deterministic.
 */
export function snapshotDirectory(dir: string): Record<string, string> {
  const files: Record<string, string> = {};

  const walk = (current: string): void => {
    const entries = readdirSync(current, { withFileTypes: true }).sort((a, b) =>
      a.name.localeCompare(b.name),
    );
    for (const entry of entries) {
      const full = join(current, entry.name);
      if (entry.isDirectory()) {
        walk(full);
      } else if (entry.isFile()) {
        files[relative(dir, full)] = hashFile(full);
      }
    }
  };

  walk(dir);
  return files;
}

/** Result of comparing two directory snapshots. */
export interface SnapshotDiff {
  equal: boolean;
  added: string[];
  removed: string[];
  changed: string[];
}

/** Compare two snapshots produced by {@link snapshotDirectory}. */
export function compareSnapshots(
  before: Record<string, string>,
  after: Record<string, string>,
): SnapshotDiff {
  const added = Object.keys(after).filter((path) => !(path in before));
  const removed = Object.keys(before).filter((path) => !(path in after));
  const changed = Object.keys(before).filter(
    (path) => path in after && before[path] !== after[path],
  );

  return {
    equal: added.length === 0 && removed.length === 0 && changed.length === 0,
    added,
    removed,
    changed,
  };
}
