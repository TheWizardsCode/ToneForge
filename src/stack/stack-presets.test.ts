/**
 * Golden Fixture Test Harness for Stack Presets
 *
 * Loads each preset from presets/stacks/, validates schema and recipe
 * references, and verifies 10-run audio determinism.
 *
 * Work item: TF-0MM79GCTT1CPF9F3
 */

import { describe, it, expect } from "vitest";
import { readdirSync } from "node:fs";
import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { loadPreset } from "./preset-loader.js";
import { renderStack } from "./renderer.js";
import { compareBuffers, formatCompareResult } from "../test-utils/buffer-compare.js";

const __dirname = dirname(fileURLToPath(import.meta.url));
const STACKS_DIR = resolve(__dirname, "../../presets/stacks");
const GOLDEN_SEED = 42;

/** Discover all preset files in presets/stacks/. */
function discoverStackPresets(): string[] {
  return readdirSync(STACKS_DIR)
    .filter((f) => f.endsWith(".json"))
    .sort();
}

// ── Load and Schema Tests ─────────────────────────────────────────

describe("stack presets — load and schema validation", () => {
  const presets = discoverStackPresets();

  it.each(presets)("preset %s loads and passes schema validation", async (presetFile) => {
    const presetPath = resolve(STACKS_DIR, presetFile);
    const definition = await loadPreset(presetPath);

    expect(definition.name).toBeTruthy();
    expect(definition.layers.length).toBeGreaterThan(0);

    for (const layer of definition.layers) {
      expect(layer.recipe).toBeTruthy();
      expect(layer.startTime).toBeGreaterThanOrEqual(0);
      if (layer.gain !== undefined) {
        expect(layer.gain).toBeGreaterThanOrEqual(0);
      }
    }
  });
});

// ── Audio Determinism Tests ───────────────────────────────────────

describe("stack presets — 10-run audio determinism", () => {
  const presets = discoverStackPresets();

  it.each(presets)("preset %s produces byte-identical audio across 10 runs", async (presetFile) => {
    const presetPath = resolve(STACKS_DIR, presetFile);
    const definition = await loadPreset(presetPath);

    const baseline = await renderStack(definition, GOLDEN_SEED);

    for (let i = 0; i < 9; i++) {
      const run = await renderStack(definition, GOLDEN_SEED);
      const comparison = compareBuffers(baseline.samples, run.samples);
      expect(
        comparison.identical,
        `Run ${i + 1} diverged from baseline for ${presetFile}: ${formatCompareResult(comparison)}`,
      ).toBe(true);
    }
  });
});
