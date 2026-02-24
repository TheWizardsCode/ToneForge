/**
 * Shared Recipe Test Helper
 *
 * Provides a reusable test battery for any recipe: parameter variation,
 * determinism, range bounds, registry integration, and renderer determinism.
 *
 * Usage:
 *   describeRecipe("weapon-laser-zap", getWeaponLaserZapParams, [
 *     { name: "carrierFreq", min: 200, max: 2000 },
 *     ...
 *   ]);
 */

import { describe, it, expect } from "vitest";
import { createRng } from "../core/rng.js";
import type { Rng } from "../core/rng.js";
import { registry } from "../recipes/index.js";
import { renderRecipe } from "../core/renderer.js";
import {
  compareBuffers,
  formatCompareResult,
} from "./buffer-compare.js";

/**
 * Specification for a single seed-varied parameter.
 * Used to verify range bounds and variation across seeds.
 */
export interface ParamSpec {
  /** Parameter name (must be a key on the params object). */
  name: string;
  /** Minimum expected value (inclusive). */
  min: number;
  /** Maximum expected value (exclusive). */
  max: number;
}

/**
 * Run the standard recipe test battery.
 *
 * @param recipeName - The registered recipe name.
 * @param getParams - Function that extracts typed params from an RNG.
 * @param paramSpecs - Array of param range specifications.
 * @param extraTests - Optional callback for recipe-specific additional tests.
 */
export function describeRecipe(
  recipeName: string,
  getParams: (rng: Rng) => Record<string, number>,
  paramSpecs: ParamSpec[],
  extraTests?: () => void,
): void {
  describe(`${recipeName} recipe`, () => {
    describe("parameter variation", () => {
      it("produces different parameters for different seeds", () => {
        const seeds = [1, 2, 3, 4, 5];
        const paramSets = seeds.map((seed) =>
          getParams(createRng(seed)),
        );

        // Count how many parameters vary across the 5 seeds
        let varyingCount = 0;
        for (const spec of paramSpecs) {
          const values = new Set(paramSets.map((p) => p[spec.name]));
          if (values.size > 1) {
            varyingCount++;
          }
        }

        // At least 3 parameters must differ across 5 seeds
        expect(varyingCount).toBeGreaterThanOrEqual(
          Math.min(3, paramSpecs.length),
        );
      });

      it("is deterministic for the same seed", () => {
        const params1 = getParams(createRng(42));
        const params2 = getParams(createRng(42));
        expect(params1).toEqual(params2);
      });

      // Range bound tests for each parameter
      for (const spec of paramSpecs) {
        it(`produces ${spec.name} in [${spec.min}, ${spec.max})`, () => {
          for (let seed = 0; seed < 50; seed++) {
            const params = getParams(createRng(seed));
            const value = params[spec.name];
            expect(value).toBeGreaterThanOrEqual(spec.min);
            expect(value).toBeLessThan(spec.max);
          }
        });
      }
    });

    describe("registry integration", () => {
      it(`is registered as '${recipeName}'`, () => {
        const registration = registry.getRegistration(recipeName);
        expect(registration).toBeDefined();
      });

      it(`has a full registration with offline support`, () => {
        const registration = registry.getRegistration(recipeName);
        expect(registration).toBeDefined();
        expect(typeof registration!.getDuration).toBe("function");
        expect(typeof registration!.buildOfflineGraph).toBe("function");
      });
    });

    describe("renderer determinism", () => {
      it("renders seed 42 ten times with byte-identical output", async () => {
        const buffers: Float32Array[] = [];

        for (let i = 0; i < 10; i++) {
          const result = await renderRecipe(recipeName, 42);
          buffers.push(result.samples);
        }

        const reference = buffers[0]!;
        for (let i = 1; i < buffers.length; i++) {
          const comparison = compareBuffers(reference, buffers[i]!);
          expect(
            comparison.identical,
            `Render ${i} diverged from reference:\n${formatCompareResult(comparison)}`,
          ).toBe(true);
        }
      });

      it("produces different sample data for different seeds", async () => {
        const result1 = await renderRecipe(recipeName, 1, 0.5);
        const result2 = await renderRecipe(recipeName, 2, 0.5);

        const comparison = compareBuffers(result1.samples, result2.samples);
        expect(comparison.identical).toBe(false);
      });

      it("renders non-silent audio", async () => {
        const result = await renderRecipe(recipeName, 42);
        const nonZero = result.samples.filter((s) => s !== 0).length;
        expect(nonZero).toBeGreaterThan(0);
      });
    });

    if (extraTests) {
      describe("recipe-specific tests", extraTests);
    }
  });
}
