import { describe, it, expect } from "vitest";
import { getCardRoundCompleteParams } from "./card-round-complete-params.js";
import { describeRecipe } from "../test-utils/recipe-test-helper.js";
import { createRng } from "../core/rng.js";
import type { Rng } from "../core/rng.js";
import { renderPreset, renderRecipe } from "../core/renderer.js";
import { compareBuffers } from "../test-utils/buffer-compare.js";

const OVERRIDE_SEED = 4321;
const SAMPLE_RATE = 44100;

/** Root-mean-square amplitude over a half-open sample range. */
function rms(samples: Float32Array, startSample: number, endSample: number): number {
  const start = Math.max(0, startSample);
  const end = Math.min(samples.length, endSample);
  let sum = 0;
  let count = 0;
  for (let i = start; i < end; i++) {
    sum += samples[i] * samples[i];
    count++;
  }
  return count === 0 ? 0 : Math.sqrt(sum / count);
}

describeRecipe(
  "card-round-complete",
  (rng: Rng) => getCardRoundCompleteParams(rng) as unknown as Record<string, number>,
  [
    { name: "frequency", min: 500, max: 900 },
    { name: "attack", min: 0.005, max: 0.02 },
    { name: "sustain", min: 0.3, max: 0.6 },
    { name: "decay", min: 0.1, max: 0.35 },
    { name: "filterCutoff", min: 1500, max: 3500 },
    { name: "level", min: 0.5, max: 0.85 },
  ],
  () => {
    it("honours the sustain override (changes output)", async () => {
      const base = await renderRecipe("card-round-complete", OVERRIDE_SEED);
      const overridden = await renderPreset({
        recipe: "card-round-complete",
        seed: OVERRIDE_SEED,
        overrides: { sustain: 0.6 },
      });

      expect(compareBuffers(base.samples, overridden.samples).identical).toBe(false);
    });

    it("keeps duration consistent with the ADSR envelope", async () => {
      const params = getCardRoundCompleteParams(createRng(OVERRIDE_SEED));
      const result = await renderPreset({
        recipe: "card-round-complete",
        seed: OVERRIDE_SEED,
      });

      // attack -> decay to sustain -> sustain plateau (decay) -> release (decay)
      expect(result.duration).toBeCloseTo(params.attack + params.decay * 3, 6);
    });

    it("holds the sustain level between decay and release", async () => {
      const params = getCardRoundCompleteParams(createRng(OVERRIDE_SEED));
      const decayEnd = params.attack + params.decay;
      const plateauEnd = decayEnd + params.decay;
      const startSample = Math.floor(decayEnd * SAMPLE_RATE);
      const endSample = Math.ceil(plateauEnd * SAMPLE_RATE);

      const low = await renderPreset({
        recipe: "card-round-complete",
        seed: OVERRIDE_SEED,
        overrides: { sustain: 0.3 },
      });
      const high = await renderPreset({
        recipe: "card-round-complete",
        seed: OVERRIDE_SEED,
        overrides: { sustain: 0.6 },
      });

      const lowRms = rms(low.samples, startSample, endSample);
      const highRms = rms(high.samples, startSample, endSample);

      // The plateau amplitude must follow the declared sustain level.
      expect(lowRms).toBeGreaterThan(0);
      expect(highRms).toBeGreaterThan(lowRms);
    });

    it("renders non-silent audio at both sustain extremes", async () => {
      for (const sustain of [0.3, 0.6]) {
        const result = await renderPreset({
          recipe: "card-round-complete",
          seed: OVERRIDE_SEED,
          overrides: { sustain },
        });
        expect(
          result.samples.some((sample) => sample !== 0),
          `sustain=${sustain} should render non-silent audio`,
        ).toBe(true);
      }
    });
  },
);
