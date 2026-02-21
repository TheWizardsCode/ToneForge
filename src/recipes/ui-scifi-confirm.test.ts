import { describe, it, expect } from "vitest";
import { createRng } from "../core/rng.js";
import { getUiSciFiConfirmParams } from "./ui-scifi-confirm.js";
import { registry } from "./index.js";

describe("ui-scifi-confirm recipe", () => {
  describe("parameter variation", () => {
    it("produces different parameters for different seeds", () => {
      const seeds = [1, 2, 3, 4, 5];
      const paramSets = seeds.map((seed) =>
        getUiSciFiConfirmParams(createRng(seed)),
      );

      // Count how many of the 4 parameters vary across the 5 seeds
      let varyingCount = 0;

      const keys = ["frequency", "attack", "decay", "filterCutoff"] as const;
      for (const key of keys) {
        const values = new Set(paramSets.map((p) => p[key]));
        if (values.size > 1) {
          varyingCount++;
        }
      }

      // AC4: at least 3 of 4 parameters must differ across 5 seeds
      expect(varyingCount).toBeGreaterThanOrEqual(3);
    });

    it("is deterministic for the same seed", () => {
      const params1 = getUiSciFiConfirmParams(createRng(42));
      const params2 = getUiSciFiConfirmParams(createRng(42));

      expect(params1).toEqual(params2);
    });

    it("produces frequency in [400, 1200) Hz", () => {
      for (let seed = 0; seed < 50; seed++) {
        const params = getUiSciFiConfirmParams(createRng(seed));
        expect(params.frequency).toBeGreaterThanOrEqual(400);
        expect(params.frequency).toBeLessThan(1200);
      }
    });

    it("produces attack in [0.001, 0.01) seconds", () => {
      for (let seed = 0; seed < 50; seed++) {
        const params = getUiSciFiConfirmParams(createRng(seed));
        expect(params.attack).toBeGreaterThanOrEqual(0.001);
        expect(params.attack).toBeLessThan(0.01);
      }
    });

    it("produces decay in [0.05, 0.3) seconds", () => {
      for (let seed = 0; seed < 50; seed++) {
        const params = getUiSciFiConfirmParams(createRng(seed));
        expect(params.decay).toBeGreaterThanOrEqual(0.05);
        expect(params.decay).toBeLessThan(0.3);
      }
    });

    it("produces filterCutoff in [800, 4000) Hz", () => {
      for (let seed = 0; seed < 50; seed++) {
        const params = getUiSciFiConfirmParams(createRng(seed));
        expect(params.filterCutoff).toBeGreaterThanOrEqual(800);
        expect(params.filterCutoff).toBeLessThan(4000);
      }
    });
  });

  describe("registry integration", () => {
    it("is registered as 'ui-scifi-confirm'", () => {
      const factory = registry.getRecipe("ui-scifi-confirm");
      expect(factory).toBeDefined();
    });

    it("getRecipe('nonexistent') returns undefined without crashing", () => {
      expect(() => registry.getRecipe("nonexistent")).not.toThrow();
      expect(registry.getRecipe("nonexistent")).toBeUndefined();
    });
  });
});
