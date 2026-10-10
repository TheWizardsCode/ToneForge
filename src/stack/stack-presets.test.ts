/**
 * Golden Fixture Test Harness for Stack Presets
 *
 * Loads each preset from presets/stacks/, validates schema and recipe
 * references, and verifies 10-run audio determinism.
 *
 * Work item: TF-0MM79GCTT1CPF9F3
 */

import { describe, it, expect } from "vitest";
import { mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { resolve, dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { loadPreset } from "./preset-loader.js";
import { listPresetFiles } from "../sequence/preset-discovery.js";
import { renderStack } from "./renderer.js";
import { compareBuffers, formatCompareResult } from "../test-utils/buffer-compare.js";

const __dirname = dirname(fileURLToPath(import.meta.url));
const STACKS_DIR = resolve(__dirname, "../../presets/stacks");
const GOLDEN_SEED = 42;

/**
 * Discover all preset files in `dir` (defaults to presets/stacks/).
 *
 * Delegates to the shared `listPresetFiles()` helper so `__`-prefixed test
 * artefacts are never discovered — a leaked/in-flight fixture cannot register
 * an `it.each` case for this harness.
 */
function discoverStackPresets(dir: string = STACKS_DIR): string[] {
  return listPresetFiles(dir);
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

// ── Discovery Isolation Regression Tests ─────────────────────────

describe("stack presets — discovery excludes test artefacts", () => {
  it("a __-prefixed malformed JSON in a preset directory yields no it.each case", async () => {
    const dir = await mkdtemp(join(tmpdir(), "toneforge-stack-discovery-"));
    try {
      await writeFile(join(dir, "real.json"), "{}");
      const malformed = join(dir, "__malformed_test__.json");
      await writeFile(malformed, "{ this is not valid json");

      // The artefact is genuinely unparseable, so discovering it would fail...
      await expect(loadPreset(malformed)).rejects.toThrow();

      // ...but discovery ignores it, so no `it.each` case is registered for it.
      expect(discoverStackPresets(dir)).toEqual(["real.json"]);
    } finally {
      await rm(dir, { recursive: true, force: true });
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
