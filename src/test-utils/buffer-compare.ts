/**
 * Buffer Comparison Utilities
 *
 * Provides diagnostic comparison of audio buffers for determinism testing.
 */

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
