/**
 * Determinism helper for SoundEditor tests.
 *
 * Renders a preset-shaped input (`{ recipe, seed, overrides }`) twice through
 * the override-aware offline render path and reports (or asserts) that the two
 * `Float32Array` outputs are byte-identical. This is the executable definition
 * of the editor's determinism guarantee (parent AC 3): the same preset must
 * always reproduce the same audio.
 */

import type { RenderResult } from "../../../src/core/renderer.js";

/** Preset-shaped input accepted by the determinism helper. */
export interface EditorRenderInput {
  /** Registered recipe name. */
  recipe: string;
  /** Deterministic seed. */
  seed: number;
  /** Parameter overrides applied on top of the seed-derived defaults. */
  overrides?: Record<string, number>;
  /** Optional duration override in seconds. */
  duration?: number;
}

/** Result of comparing two rendered sample buffers. */
export interface ComparisonResult {
  /** True when both buffers have the same length and byte-identical samples. */
  identical: boolean;
  /** Index of the first differing sample, when `identical` is false. */
  firstDifference?: number;
  /** Length of the left-hand buffer. */
  lhsLength: number;
  /** Length of the right-hand buffer. */
  rhsLength: number;
}

/** The pair of renders plus their comparison. */
export interface DeterminismResult {
  first: RenderResult;
  second: RenderResult;
  comparison: ComparisonResult;
}

async function renderOnce(input: EditorRenderInput): Promise<RenderResult> {
  // Dynamic import keeps `node-web-audio-api` out of non-Node (happy-dom)
  // test modules that only import this helper for its types.
  const { renderPreset } = await import("../../../src/core/renderer.js");
  return renderPreset(
    { recipe: input.recipe, seed: input.seed, overrides: input.overrides },
    input.duration,
  );
}

/**
 * Compare two sample buffers for byte-level equality.
 *
 * Uses `Object.is` per sample so `NaN` samples compare equal (a byte-identical
 * render should not be reported as different purely because of NaN), matching
 * the two-buffer equality semantics required by the determinism guarantee.
 */
export function compareSamples(
  lhs: Float32Array,
  rhs: Float32Array,
): ComparisonResult {
  const sharedLength = Math.min(lhs.length, rhs.length);

  for (let i = 0; i < sharedLength; i += 1) {
    if (!Object.is(lhs[i], rhs[i])) {
      return {
        identical: false,
        firstDifference: i,
        lhsLength: lhs.length,
        rhsLength: rhs.length,
      };
    }
  }

  if (lhs.length !== rhs.length) {
    return {
      identical: false,
      firstDifference: sharedLength,
      lhsLength: lhs.length,
      rhsLength: rhs.length,
    };
  }

  return { identical: true, lhsLength: lhs.length, rhsLength: rhs.length };
}

/**
 * Render an input twice and return both results with their comparison.
 */
export async function renderPresetTwice(
  input: EditorRenderInput,
): Promise<DeterminismResult> {
  const first = await renderOnce(input);
  const second = await renderOnce(input);
  return { first, second, comparison: compareSamples(first.samples, second.samples) };
}

/**
 * Assert that an input renders byte-identically twice.
 *
 * @returns The first render result.
 * @throws If the two renders differ.
 */
export async function assertDeterministic(
  input: EditorRenderInput,
): Promise<RenderResult> {
  const { first, comparison } = await renderPresetTwice(input);

  if (!comparison.identical) {
    throw new Error(
      `Non-deterministic render for recipe '${input.recipe}' seed ${input.seed}: ` +
        `first difference at sample ${comparison.firstDifference} ` +
        `(lengths ${comparison.lhsLength} vs ${comparison.rhsLength}).`,
    );
  }

  return first;
}
