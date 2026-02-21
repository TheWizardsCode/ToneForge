/**
 * Seeded RNG Module
 *
 * Deterministic pseudo-random number generator based on the xorshift algorithm.
 * Same seed always produces the same sequence of values.
 *
 * Reference: docs/prd/CORE_PRD.md Section 4.2
 */

/** A function that returns the next pseudo-random number in [0, 1). */
export type Rng = () => number;

/**
 * Creates a seeded pseudo-random number generator using the xorshift algorithm.
 *
 * @param seed - Integer seed value. If 0 is provided, a default non-zero seed is used
 *               to avoid the xorshift degenerate case.
 * @returns A function that produces deterministic values in [0, 1) on each call.
 */
export function createRng(seed: number): Rng {
  // xorshift requires a non-zero state; use a default if seed is 0
  let x = seed === 0 ? 123456789 : (seed | 0);

  return (): number => {
    x ^= x << 13;
    x ^= x >>> 17;
    x ^= x << 5;
    return (x >>> 0) / 0xFFFFFFFF;
  };
}

/**
 * Returns a random value in [min, max) using the given RNG.
 *
 * @param rng - A seeded RNG function.
 * @param min - Minimum value (inclusive).
 * @param max - Maximum value (exclusive).
 * @returns A deterministic value in [min, max).
 */
export function rr(rng: Rng, min: number, max: number): number {
  return min + (max - min) * rng();
}
