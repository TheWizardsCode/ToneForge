/**
 * Unit tests for the browser file-backed recipe registry initialiser.
 *
 * These verify the behaviour that fixes the browser rendering smoke test:
 * file-backed recipes (migrated from `presets/recipes/*.yaml`) must resolve in
 * the registry the browser bundle uses. The Node discovery path is a no-op in
 * the browser, so `registerBrowserRecipes` is the mechanism that makes the
 * recipe available.
 *
 * Work item: TF-0MUVK0MGO001P2OF.
 */
import { describe, it, expect } from "vitest";
import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { RecipeRegistry, discoverFileBackedRecipes } from "../../src/core/recipe.js";
import { createRng } from "../../src/core/rng.js";
import { registry } from "../../src/recipes/index.js";
import {
  registerBrowserRecipes,
  initializeBrowserRecipeRegistry,
} from "../src/browser-recipe-registry.js";

const PRESETS_DIR = resolve(
  dirname(fileURLToPath(import.meta.url)),
  "..",
  "..",
  "presets",
  "recipes",
);

/** Recipes migrated from TypeScript to file-backed ToneGraph YAML. */
const MIGRATED = [
  "ui-scifi-confirm",
  "weapon-laser-zap",
  "footstep-gravel",
  "ambient-wind-gust",
  "card-transform",
] as const;

describe("registerBrowserRecipes", () => {
  it("registers every migrated file-backed recipe into a fresh registry", () => {
    const browserRegistry = new RecipeRegistry();

    const registered = registerBrowserRecipes(browserRegistry);

    expect(registered.sort()).toEqual([...MIGRATED].sort());
    for (const name of MIGRATED) {
      expect(
        browserRegistry.getRegistration(name),
        `${name} should be registered from the inlined bundle`,
      ).toBeDefined();
    }
  });

  it("makes ui-scifi-confirm resolvable and renderable in the browser registry", () => {
    const browserRegistry = new RecipeRegistry();
    registerBrowserRecipes(browserRegistry);

    const registration = browserRegistry.getRegistration("ui-scifi-confirm");
    expect(registration).toBeDefined();

    // getDuration reflects the recipe's declared meta.duration.
    expect(registration!.getDuration(createRng(1))).toBeCloseTo(
      0.08468207950044473,
      10,
    );

    // Declared parameters are surfaced (the wizard/editor rely on these).
    const paramNames = registration!.params.map((p) => p.name).sort();
    expect(paramNames).toEqual(
      ["attack", "decay", "filterCutoff", "frequency"].sort(),
    );
  });

  it("produces a registration equivalent to the Node discovery path", async () => {
    const browserRegistry = new RecipeRegistry();
    registerBrowserRecipes(browserRegistry);

    const nodeRegistry = new RecipeRegistry();
    await discoverFileBackedRecipes(nodeRegistry, {
      recipeDirectory: PRESETS_DIR,
    });

    for (const name of MIGRATED) {
      const browser = browserRegistry.getRegistration(name);
      const node = nodeRegistry.getRegistration(name);
      expect(browser, `${name} missing from browser registry`).toBeDefined();
      expect(node, `${name} missing from Node registry`).toBeDefined();

      // Duration and declared parameter shape must match the on-disk recipe.
      expect(browser!.getDuration(createRng(42))).toBeCloseTo(
        node!.getDuration(createRng(42)),
        10,
      );
      expect(browser!.params).toEqual(node!.params);
      expect(browser!.category).toBe(node!.category);
    }
  });
});

describe("initializeBrowserRecipeRegistry", () => {
  it("populates the shared registry and resolves with the recipe names", async () => {
    const names = await initializeBrowserRecipeRegistry();

    for (const name of MIGRATED) {
      expect(names).toContain(name);
      expect(registry.getRegistration(name)).toBeDefined();
    }
  });

  it("is idempotent — repeated calls return the cached result", async () => {
    const first = await initializeBrowserRecipeRegistry();
    const second = await initializeBrowserRecipeRegistry();

    expect(second).toBe(first);
  });
});
