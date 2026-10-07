/**
 * Capstone Arrangements Test Battery
 *
 * Verifies the ten capstone arrangements that crown the Casual Game Recipe
 * Book (TF-0MUYBDP0L001QIVX):
 *  1. each stack/sequence preset loads and validates against its schema,
 *  2. each renders non-silent audio at a fixed seed,
 *  3. each reuses at least two book recipes delivered in Tiers 1-7,
 *  4. each has a matching docs/recipe-book page,
 *  5. docs/recipe-book/index.md lists every capstone after the 100 recipes.
 *
 * Schema validity and 10-run byte-identical determinism are additionally
 * covered by the auto-discovering `src/stack/stack-presets.test.ts` and
 * `src/sequence/golden-fixtures.test.ts` suites.
 */

import { describe, it, expect } from "vitest";
import { existsSync, readFileSync } from "node:fs";
import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";

import { loadPreset } from "../stack/preset-loader.js";
import { renderStack } from "../stack/renderer.js";
import { loadSequencePreset } from "../sequence/preset-loader.js";
import { simulate } from "../sequence/simulator.js";
import { renderSequence } from "../sequence/renderer.js";
import { recipeRoster } from "./recipe-book/roster.js";

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = resolve(__dirname, "..", "..");
const DOCS_DIR = resolve(ROOT, "docs", "recipe-book");
const INDEX_PATH = resolve(DOCS_DIR, "index.md");
const SEED = 42;

const CAPSTONE_STACKS = [
  "casual_ui_confirm_stack",
  "casual_coin_reward_stack",
  "casual_victory_stack",
  "casual_character_jump_stack",
  "casual_impact_hit_stack",
];

const CAPSTONE_SEQUENCES = [
  "casual_menu_flow_sequence",
  "casual_coin_run_sequence",
  "casual_level_complete_sequence",
  "casual_game_over_sequence",
  "casual_adventure_intro_sequence",
];

const BOOK_RECIPES = new Set(recipeRoster.map((entry) => entry.name));

function isNonSilent(samples: Float32Array): boolean {
  for (let i = 0; i < samples.length; i++) {
    if (samples[i] !== 0) return true;
  }
  return false;
}

function expectCapstonePage(name: string): void {
  const pagePath = resolve(DOCS_DIR, `${name}.md`);
  expect(existsSync(pagePath), `Capstone page ${pagePath} does not exist`).toBe(true);
  if (!existsSync(pagePath)) return;
  const content = readFileSync(pagePath, "utf-8");
  expect(content.startsWith("---")).toBe(true);
  expect(content).toContain(`id: "${name}"`);
  expect(content).toContain("## Sound design");
  expect(content).toContain("## ToneForge CLI");
}

describe("Capstone stacks", () => {
  for (const name of CAPSTONE_STACKS) {
    describe(name, () => {
      it("loads, validates and reuses at least two book recipes", async () => {
        const presetPath = resolve(ROOT, "presets", "stacks", `${name}.json`);
        const definition = await loadPreset(presetPath);
        expect(definition.name).toBe(name);
        expect(definition.layers.length).toBeGreaterThanOrEqual(2);

        const distinctBookRecipes = new Set(
          definition.layers.map((l) => l.recipe).filter((r) => BOOK_RECIPES.has(r)),
        );
        expect(distinctBookRecipes.size).toBeGreaterThanOrEqual(2);
      });

      it("renders non-silent audio at seed 42", async () => {
        const presetPath = resolve(ROOT, "presets", "stacks", `${name}.json`);
        const definition = await loadPreset(presetPath);
        const result = await renderStack(definition, SEED);
        expect(isNonSilent(result.samples)).toBe(true);
      });

      it("has a matching recipe-book page", () => {
        expectCapstonePage(name);
      });
    });
  }

  it("is listed in index.md after the 100 recipes", () => {
    const index = readFileSync(INDEX_PATH, "utf-8");
    const lastRecipeLink = index.lastIndexOf("](./sting-finale-short.md)");
    expect(lastRecipeLink).toBeGreaterThan(-1);
    for (const name of CAPSTONE_STACKS) {
      const link = `[\`${name}\`](./${name}.md)`;
      const at = index.indexOf(link);
      expect(at, `${name} missing from index`).toBeGreaterThan(-1);
      expect(at, `${name} should follow the 100 recipes`).toBeGreaterThan(lastRecipeLink);
    }
  });
});

describe("Capstone sequences", () => {
  for (const name of CAPSTONE_SEQUENCES) {
    describe(name, () => {
      it("loads, validates and reuses at least two book recipes", async () => {
        const presetPath = resolve(ROOT, "presets", "sequences", `${name}.json`);
        const definition = await loadSequencePreset(presetPath);
        expect(definition.name).toBe(name);
        expect(definition.events.length).toBeGreaterThanOrEqual(2);

        const distinctBookRecipes = new Set(
          definition.events.map((e) => e.event).filter((r) => BOOK_RECIPES.has(r)),
        );
        expect(distinctBookRecipes.size).toBeGreaterThanOrEqual(2);
      });

      it("renders non-silent audio at seed 42", async () => {
        const presetPath = resolve(ROOT, "presets", "sequences", `${name}.json`);
        const definition = await loadSequencePreset(presetPath);
        const result = await renderSequence(simulate(definition, SEED));
        expect(isNonSilent(result.samples)).toBe(true);
      });

      it("has a matching recipe-book page", () => {
        expectCapstonePage(name);
      });
    });
  }

  it("is listed in index.md after the 100 recipes", () => {
    const index = readFileSync(INDEX_PATH, "utf-8");
    const lastRecipeLink = index.lastIndexOf("](./sting-finale-short.md)");
    expect(lastRecipeLink).toBeGreaterThan(-1);
    for (const name of CAPSTONE_SEQUENCES) {
      const link = `[\`${name}\`](./${name}.md)`;
      const at = index.indexOf(link);
      expect(at, `${name} missing from index`).toBeGreaterThan(-1);
      expect(at, `${name} should follow the 100 recipes`).toBeGreaterThan(lastRecipeLink);
    }
  });
});
