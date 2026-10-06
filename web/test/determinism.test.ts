/**
 * Tests for the SoundEditor determinism helper.
 *
 * AC (TF-0MUV11IXS007W29J): a determinism helper renders a
 * `{ recipe, seed, overrides }` input twice via the existing Node render path
 * and returns/asserts byte-identical `Float32Array` output.
 *
 * These run in the default Node environment because the offline render path
 * uses `node-web-audio-api`.
 */
import { describe, it, expect } from "vitest";
import {
  assertDeterministic,
  compareSamples,
  renderPresetTwice,
} from "./helpers/determinism.js";
import { getEditorFixture } from "./fixtures/editor-fixtures.js";

describe("compareSamples", () => {
  it("reports identical for equal buffers", () => {
    const samples = new Float32Array([0, 0.5, -0.5, 1]);
    expect(compareSamples(samples, samples.slice())).toEqual({
      identical: true,
      lhsLength: 4,
      rhsLength: 4,
    });
  });

  it("reports the first differing sample index", () => {
    const lhs = new Float32Array([0, 0.25, 0.5]);
    const rhs = new Float32Array([0, 0.25, 0.75]);
    expect(compareSamples(lhs, rhs)).toMatchObject({
      identical: false,
      firstDifference: 2,
    });
  });

  it("reports a length mismatch as a difference at the shared length", () => {
    const lhs = new Float32Array([0, 1, 2, 3]);
    const rhs = new Float32Array([0, 1, 2]);
    expect(compareSamples(lhs, rhs)).toMatchObject({
      identical: false,
      firstDifference: 3,
      lhsLength: 4,
      rhsLength: 3,
    });
  });

  it("treats NaN samples as equal", () => {
    const lhs = new Float32Array([Number.NaN]);
    const rhs = new Float32Array([Number.NaN]);
    expect(compareSamples(lhs, rhs).identical).toBe(true);
  });
});

describe("assertDeterministic", () => {
  for (const id of ["oscillator-laser", "noise-filter-footstep"]) {
    it(`renders the '${id}' fixture byte-identically twice`, async () => {
      const fixture = getEditorFixture(id);
      const result = await assertDeterministic({
        recipe: fixture.recipe,
        seed: fixture.seed,
      });
      expect(result.samples.length).toBeGreaterThan(0);
      expect(result.numberOfChannels).toBe(1);
    });
  }

  it("returns two identical renders from renderPresetTwice", async () => {
    const fixture = getEditorFixture("oscillator-laser");
    const { first, second, comparison } = await renderPresetTwice({
      recipe: fixture.recipe,
      seed: fixture.seed,
    });

    expect(comparison.identical).toBe(true);
    expect(second.samples.length).toBe(first.samples.length);
    expect(second.samples).toEqual(first.samples);
  });

  it("detects that different seeds produce different audio", async () => {
    const fixture = getEditorFixture("oscillator-laser");
    const a = await assertDeterministic({ recipe: fixture.recipe, seed: 1 });
    const b = await assertDeterministic({ recipe: fixture.recipe, seed: 2 });
    expect(compareSamples(a.samples, b.samples).identical).toBe(false);
  });

  it("renders a preset-shaped input including overrides deterministically", async () => {
    const { first, comparison } = await renderPresetTwice({
      recipe: "footstep-stone",
      seed: 42,
      overrides: { filterFreq: 800 },
    });

    expect(first.samples).toBeInstanceOf(Float32Array);
    expect(comparison.identical).toBe(true);
  });

  it("reflects a parameter override in the rendered audio", async () => {
    const fixture = getEditorFixture("noise-filter-footstep");
    const base = await assertDeterministic({
      recipe: fixture.recipe,
      seed: fixture.seed,
    });
    const overridden = await assertDeterministic({
      recipe: fixture.recipe,
      seed: fixture.seed,
      overrides: { filterFreq: 1999 },
    });

    expect(compareSamples(base.samples, overridden.samples).identical).toBe(
      false,
    );
  });
});
