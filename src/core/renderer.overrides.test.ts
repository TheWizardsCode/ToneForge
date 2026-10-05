/**
 * Override-aware deterministic render path tests.
 *
 * ACs (TF-0MUV11RXS003Y6JI):
 * - renderPreset returns a RenderResult and applies overrides.
 * - Determinism: same preset twice → byte-identical samples; a changed
 *   override → different samples.
 * - Registry-wide coverage: every recipe honours an override for every
 *   declared parameter.
 * - Baseline unchanged: empty overrides == renderRecipe.
 */
import { describe, it, expect } from "vitest";
import { renderPreset, renderRecipe } from "./renderer.js";
import { registry, initializeRecipeRegistry } from "../recipes/index.js";
import { createRng } from "./rng.js";
import { compareBuffers } from "../test-utils/buffer-compare.js";

async function baseline(recipe: string, seed: number): Promise<Float32Array> {
  return (await renderRecipe(recipe, seed)).samples;
}

/** A target value guaranteed to differ from the seed-derived baseline. */
function oppositeExtreme(
  min: number,
  max: number,
  baselineValue: number,
): number {
  const midpoint = min + (max - min) / 2;
  return baselineValue <= midpoint ? max : min;
}

describe("renderPreset", () => {
  it("returns a RenderResult", async () => {
    const result = await renderPreset({
      recipe: "ui-scifi-confirm",
      seed: 42,
      overrides: {},
    });
    expect(result.samples).toBeInstanceOf(Float32Array);
    expect(result.samples.length).toBeGreaterThan(0);
    expect(result.sampleRate).toBe(44100);
    expect(result.numberOfChannels).toBe(1);
  });

  it("is byte-identical to renderRecipe when there are no overrides", async () => {
    const withoutOverrides = await renderPreset({
      recipe: "ui-scifi-confirm",
      seed: 42,
      overrides: {},
    });
    const direct = await renderRecipe("ui-scifi-confirm", 42);
    expect(compareBuffers(withoutOverrides.samples, direct.samples).identical).toBe(
      true,
    );
  });

  it("renders the same preset twice byte-identically", async () => {
    const preset = {
      recipe: "weapon-laser-zap",
      seed: 1234,
      overrides: { carrierFreq: 1500 },
    };
    const first = await renderPreset(preset);
    const second = await renderPreset(preset);
    expect(compareBuffers(first.samples, second.samples).identical).toBe(true);
  });

  for (const entry of [
    { recipe: "weapon-laser-zap", seed: 1234, param: "carrierFreq" },
    { recipe: "footstep-stone", seed: 42, param: "filterFreq" },
    { recipe: "ambient-wind-gust", seed: 7, param: "filterFreq" },
  ]) {
    it(`applies an override to change output for ${entry.recipe}`, async () => {
      const registration = registry.getRegistration(entry.recipe);
      expect(registration).toBeDefined();
      const descriptor = registration?.params.find((p) => p.name === entry.param);
      expect(descriptor).toBeDefined();

      const seedRng = createRng(entry.seed);
      await initializeRecipeRegistry();
      const baseParams = registration!.getParams(seedRng);
      const target = oppositeExtreme(
        descriptor!.min,
        descriptor!.max,
        baseParams[entry.param],
      );

      const base = await baseline(entry.recipe, entry.seed);
      const overridden = await renderPreset({
        recipe: entry.recipe,
        seed: entry.seed,
        overrides: { [entry.param]: target },
      });

      expect(compareBuffers(base, overridden.samples).identical).toBe(false);
    });
  }
});

/**
 * Declared parameters whose override does not (yet) change output.
 *
 * These are pre-existing recipe/graph gaps tracked by TF-0MUV9U9QU001SORH:
 * declared-but-unused params and file-backed mappings that cannot be expressed
 * by the generic injection heuristic. The test below fails if a listed param
 * starts working (stale entry) or if an unlisted param stops working.
 */
const KNOWN_UNWIRED: Record<string, string> = {
  "impact-crack.noiseColorMix": "declared but unused by the builder",
  "card-round-complete.sustain": "declared but unused by the builder",
  "ambient-wind-gust.lfoDepth": "file-backed derived mapping",
  "ambient-wind-gust.release": "file-backed envelope mapping gap",
  "card-transform.modRatio": "file-backed derived mapping",
  "weapon-laser-zap.modIndex": "file-backed derived mapping",
};

describe("registry-wide override coverage", () => {
  it(
    "honours an override for every declared parameter of every recipe",
    async () => {
      await initializeRecipeRegistry();
      const recipes = registry.list();
      expect(recipes.length).toBeGreaterThan(0);

      const failures: string[] = [];
      const staleExceptions: string[] = [];
      const seenExceptions = new Set<string>();

      for (const recipe of recipes) {
        const registration = registry.getRegistration(recipe)!;
        const seed = 4321;
        const baseParams = registration.getParams(createRng(seed));
        const base = await baseline(recipe, seed);

        for (const descriptor of registration.params) {
          const key = `${recipe}.${descriptor.name}`;
          if (!(descriptor.name in baseParams)) {
            failures.push(`${key}: no baseline value from getParams`);
            continue;
          }
          const target = oppositeExtreme(
            descriptor.min,
            descriptor.max,
            baseParams[descriptor.name],
          );
          const overridden = await renderPreset({
            recipe,
            seed,
            overrides: { [descriptor.name]: target },
          });
          const changed = !compareBuffers(base, overridden.samples).identical;

          if (key in KNOWN_UNWIRED) {
            seenExceptions.add(key);
            if (changed){
              staleExceptions.push(
                `${key}: now honoured — remove from KNOWN_UNWIRED (${KNOWN_UNWIRED[key]})`,
              );
            }
          } else if (!changed) {
            failures.push(`${key}: override had no effect`);
          }
        }
      }

      const missingExceptions = Object.keys(KNOWN_UNWIRED).filter(
        (key) => !seenExceptions.has(key),
      );

      expect(failures, `Override failures:\n${failures.join("\n")}`).toEqual([]);
      expect(
        staleExceptions,
        `Stale KNOWN_UNWIRED entries:\n${staleExceptions.join("\n")}`,
      ).toEqual([]);
      expect(
        missingExceptions,
        `KNOWN_UNWIRED entries with no matching declared parameter:\n${missingExceptions.join("\n")}`,
      ).toEqual([]);
    },
    180_000,
  );
});
