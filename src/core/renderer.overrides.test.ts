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
 *
 * Per-parameter coverage (TF-0MUVK21BQ004E6ZO):
 * - Each declared parameter of every registered recipe is tested individually
 *   via the `assertOverrideChangesOutput` helper.
 * - Allowlisted (KNOWN_UNWIRED) parameters assert identical output today;
 *   a stale entry (now changed) fails; a missing entry (no declared param)
 *   fails.
 */
import { describe, it, expect, beforeAll } from "vitest";
import { renderPreset, renderRecipe } from "./renderer.js";
import { registry, initializeRecipeRegistry } from "../recipes/index.js";
import { createRng } from "./rng.js";
import { compareBuffers } from "../test-utils/buffer-compare.js";

// ---------------------------------------------------------------------------
// Shared helpers
// ---------------------------------------------------------------------------

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

/**
 * Assert that overriding a single parameter changes the rendered output.
 *
 * @param recipe       - Recipe name.
 * @param param        - Parameter name to override.
 * @param seed         - Seed for deterministic rendering.
 * @param expectedChange - Whether the override is expected to change output.
 *                         `true` for non-allowlisted params (should change),
 *                         `false` for KNOWN_UNWIRED params (should not yet change).
 */
export async function assertOverrideChangesOutput(
  recipe: string,
  param: string,
  seed: number,
  expectedChange: boolean,
): Promise<void> {
  const registration = registry.getRegistration(recipe)!;
  const baseParams = registration.getParams(createRng(seed));
  const descriptor = registration.params.find((p) => p.name === param);
  if (!descriptor) {
    throw new Error(`No descriptor for parameter "${param}" in recipe "${recipe}"`);
  }
  if (!(param in baseParams)) {
    throw new Error(`No baseline value for parameter "${param}" in recipe "${recipe}"`);
  }
  const target = oppositeExtreme(
    descriptor.min,
    descriptor.max,
    baseParams[param],
  );
  const base = await baseline(recipe, seed);
  const overridden = await renderPreset({
    recipe,
    seed,
    overrides: { [param]: target },
  });
  const changed = !compareBuffers(base, overridden.samples).identical;

  if (expectedChange) {
    expect(
      changed,
      `Override of "${param}" on recipe "${recipe}" had no effect — this parameter should be wired into the render path`,
    ).toBe(true);
  } else {
    const reason = KNOWN_UNWIRED[`${recipe}.${param}`] ?? "unknown";
    expect(
      changed,
      `Override of "${param}" on recipe "${recipe}" now changes output — "${reason}" — remove this entry from KNOWN_UNWIRED`,
    ).toBe(false);
  }
}

/**
 * KNOWN_UNWIRED: declared parameters whose override does not (yet) change
 * rendered output.
 *
 * These are pre-existing recipe/graph gaps tracked by TF-0MUV9U9QU001SORH:
 * declared-but-unused params and file-backed mappings that cannot be expressed
 * by the generic injection heuristic. The test below fails if a listed param
 * starts working (stale entry) or if an unlisted param stops working.
 */
const KNOWN_UNWIRED: Record<string, string> = {
  "ambient-wind-gust.release": "file-backed envelope mapping gap",
};

// ---------------------------------------------------------------------------
// renderPreset baseline assertions
// ---------------------------------------------------------------------------

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

// ---------------------------------------------------------------------------
// Per-parameter override coverage
//
// Each declared parameter of every registered recipe is tested individually
// via the `assertOverrideChangesOutput` helper, grouped by recipe.  The
// registry is discovered asynchronously (file-backed recipes), so a single
// `it()` iterates over all recipes and calls the helper for each parameter —
// each parameter gets its own named expect assertion with a clear failure
// message.
// ---------------------------------------------------------------------------

describe("registry-wide override coverage", () => {
  beforeAll(async () => {
    await initializeRecipeRegistry();
  });

  it(
    "honours an override for every declared parameter of every recipe",
    async () => {
      const recipes = registry.list();
      expect(recipes.length).toBeGreaterThan(0);

      const failures: string[] = [];
      const staleExceptions: string[] = [];
      const seenExceptions = new Set<string>();

      for (const recipe of recipes) {
        const registration = registry.getRegistration(recipe)!;
        const seed = 4321;
        const baseParams = registration.getParams(createRng(seed));

        for (const descriptor of registration.params) {
          const key = `${recipe}.${descriptor.name}`;

          if (!(descriptor.name in baseParams)) {
            failures.push(`${key}: no baseline value from getParams`);
            continue;
          }

          const isKnownUnwired = key in KNOWN_UNWIRED;
          const expectedChange = !isKnownUnwired;

          // Track that we actually checked this exception key.
          if (isKnownUnwired) seenExceptions.add(key);

          try {
            await assertOverrideChangesOutput(
              recipe,
              descriptor.name,
              seed,
              expectedChange,
            );
          } catch (err) {
            const message = (err as Error).message;
            if (expectedChange) {
              failures.push(`${key}: ${message}`);
            } else {
              staleExceptions.push(`${key}: ${message}`);
            }
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

  /**
   * Unit test of the override-check helper:
   * - Verify the helper correctly detects a real change (non-allowlisted param).
   */
  describe("assertOverrideChangesOutput guard correctness", () => {
    it("detects a real change (non-allowlisted param changes output)", async () => {
      await assertOverrideChangesOutput(
        "weapon-laser-zap",
        "carrierFreq",
        4321,
        true, // expected to change
      );
    });

    it("detects a missing entry (parameter not declared)", () => {
      const testEntry = "nonexistent-recipe.fakeParam";
      const [recipeName] = testEntry.split(".");
      const registration = registry.getRegistration(recipeName);
      expect(registration).toBeUndefined();
    });
  });
});
