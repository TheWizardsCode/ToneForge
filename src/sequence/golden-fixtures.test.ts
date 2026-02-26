/**
 * Golden Fixture Test Harness for Sequence Simulator
 *
 * Loads each preset from presets/sequences/, runs simulate() with a fixed
 * seed, and compares the formatted timeline JSON against saved golden files.
 *
 * Set UPDATE_GOLDEN=1 to regenerate golden files:
 *   UPDATE_GOLDEN=1 npx vitest run src/sequence/golden-fixtures.test.ts
 *
 * Also verifies 10-run audio determinism for each preset.
 *
 * Work item: TF-0MM196J0E0WHMTSQ
 */

import { describe, it, expect } from "vitest";
import { readFileSync, writeFileSync, existsSync, readdirSync } from "node:fs";
import { resolve, dirname, basename } from "node:path";
import { fileURLToPath } from "node:url";
import { loadSequencePreset } from "./preset-loader.js";
import { simulate, formatTimeline } from "./simulator.js";
import { renderSequence } from "./renderer.js";
import { compareBuffers, formatCompareResult } from "../test-utils/buffer-compare.js";

const __dirname = dirname(fileURLToPath(import.meta.url));
const PRESETS_DIR = resolve(__dirname, "../../presets/sequences");
const GOLDEN_DIR = resolve(__dirname, "../test-utils/fixtures/golden-sequences");
const UPDATE_GOLDEN = process.env["UPDATE_GOLDEN"] === "1";
const GOLDEN_SEED = 42;

/** Discover all preset files in presets/sequences/. */
function discoverPresets(): string[] {
  return readdirSync(PRESETS_DIR)
    .filter((f) => f.endsWith(".json"))
    .sort();
}

/** Path to the golden JSON file for a given preset. */
function goldenPath(presetFile: string): string {
  const name = basename(presetFile, ".json");
  return resolve(GOLDEN_DIR, `${name}.golden.json`);
}

// ── Golden Simulation Tests ──────────────────────────────────────

describe("golden fixtures — simulation timeline", () => {
  const presets = discoverPresets();

  it.each(presets)("preset %s produces expected simulation timeline", async (presetFile) => {
    const presetPath = resolve(PRESETS_DIR, presetFile);
    const definition = await loadSequencePreset(presetPath);
    const result = simulate(definition, GOLDEN_SEED);
    const timeline = formatTimeline(result);
    const actualJson = JSON.stringify(timeline, null, 2) + "\n";

    const golden = goldenPath(presetFile);

    if (UPDATE_GOLDEN) {
      writeFileSync(golden, actualJson, "utf-8");
      // Still pass so the update run succeeds
      return;
    }

    if (!existsSync(golden)) {
      throw new Error(
        `Golden file not found: ${golden}\n` +
        `Run with UPDATE_GOLDEN=1 to generate:\n` +
        `  UPDATE_GOLDEN=1 npx vitest run src/sequence/golden-fixtures.test.ts`,
      );
    }

    const expectedJson = readFileSync(golden, "utf-8");
    expect(actualJson).toBe(expectedJson);
  });
});

// ── Audio Determinism Tests ──────────────────────────────────────

describe("golden fixtures — 10-run audio determinism", () => {
  const presets = discoverPresets();

  it.each(presets)("preset %s produces byte-identical audio across 10 runs", async (presetFile) => {
    const presetPath = resolve(PRESETS_DIR, presetFile);
    const definition = await loadSequencePreset(presetPath);

    // Baseline run
    const baseSim = simulate(definition, GOLDEN_SEED);
    const baseline = await renderSequence(baseSim);

    // 9 subsequent runs must be identical
    for (let i = 0; i < 9; i++) {
      const sim = simulate(definition, GOLDEN_SEED);
      const run = await renderSequence(sim);
      const comparison = compareBuffers(baseline.samples, run.samples);
      expect(
        comparison.identical,
        `Run ${i + 1} diverged from baseline for ${presetFile}: ${formatCompareResult(comparison)}`,
      ).toBe(true);
    }
  });
});

// ── Simulation Determinism Tests ─────────────────────────────────

describe("golden fixtures — simulation determinism", () => {
  const presets = discoverPresets();

  it.each(presets)("preset %s produces identical simulation across 10 runs", async (presetFile) => {
    const presetPath = resolve(PRESETS_DIR, presetFile);
    const definition = await loadSequencePreset(presetPath);

    const baseResult = simulate(definition, GOLDEN_SEED);
    const baseJson = JSON.stringify(formatTimeline(baseResult));

    for (let i = 0; i < 9; i++) {
      const result = simulate(definition, GOLDEN_SEED);
      const json = JSON.stringify(formatTimeline(result));
      expect(json).toBe(baseJson);
    }
  });
});
