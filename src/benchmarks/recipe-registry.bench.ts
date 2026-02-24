/**
 * Recipe Registry Benchmark
 *
 * Measures the time for recipe lookup operations in the registry.
 * Tests both single lookups and listing all recipes.
 *
 * Reference: TF-0MM0YUBFR0MCXGLE
 */

import { bench, describe } from "vitest";
import { registry } from "../recipes/index.js";

describe("RecipeRegistry", () => {
  bench("getRegistration (existing recipe)", () => {
    registry.getRegistration("ui-scifi-confirm");
  });

  bench("getRegistration (non-existent recipe)", () => {
    registry.getRegistration("does-not-exist");
  });

  bench("list all recipes", () => {
    registry.list();
  });

  bench("listSummaries", () => {
    registry.listSummaries();
  });
});
