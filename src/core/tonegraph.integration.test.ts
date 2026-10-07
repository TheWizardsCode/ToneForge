import { describe, it, expect } from "vitest";
import { OfflineAudioContext } from "node-web-audio-api";
import { resolve, dirname, join } from "node:path";
import { tmpdir } from "node:os";
import { mkdtemp, rm, writeFile, readFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import yaml from "js-yaml";
import { createRng, rr } from "./rng.js";
import { compareBuffers, formatCompareResult } from "../test-utils/buffer-compare.js";
import { RecipeRegistry, discoverFileBackedRecipes, type RecipeRegistration } from "./recipe.js";
import { validateToneGraph, type ToneGraphDocument } from "./tonegraph-schema.js";
import { loadToneGraph } from "./tonegraph.js";

const PRESETS_DIR = resolve(dirname(fileURLToPath(import.meta.url)), "..", "..", "presets", "recipes");
const SAMPLE_RATE = 44100;
const DETERMINISM_RUNS = 3;
const SEED = 42;
const PEAK_FLOOR = 0.01; // -40 dBFS

const MIGRATED = [
  "ui-scifi-confirm",
  "weapon-laser-zap",
  "footstep-gravel",
  "ambient-wind-gust",
  "card-transform",
  "frequency-sweep-demo",
] as const;

interface RenderResult {
  samples: Float32Array;
  duration: number;
  peak: number;
}

/**
 * Frozen historical reference: the removed TypeScript `ui-scifi-confirm`
 * graph builder (`uiSciFiConfirmOfflineGraph` in `src/recipes/index.ts`,
 * deleted when the recipe was migrated to file-backed ToneGraph in
 * TF-0MN0XQ1AN111ZB8F).
 *
 * This is a deliberate characterisation reference, not production logic: it
 * is intentionally self-contained so the parity test can prove the migrated
 * `presets/recipes/ui-scifi-confirm.yaml` reproduces the historical graph
 * byte-for-byte. It uses the same seed-derived parameter ranges and the same
 * Web Audio API calls as the original implementation.
 */
async function renderHistoricalUiSciFiConfirm(seed: number): Promise<Float32Array> {
  const rng = createRng(seed);
  const frequency = rr(rng, 400, 1200);
  const attack = rr(rng, 0.001, 0.01);
  const decay = rr(rng, 0.05, 0.3);
  const filterCutoff = rr(rng, 800, 4000);
  const duration = attack + decay;

  const frameCount = Math.ceil(SAMPLE_RATE * duration);
  const ctx = new OfflineAudioContext(1, frameCount, SAMPLE_RATE);

  const osc = ctx.createOscillator();
  osc.type = "sine";
  osc.frequency.value = frequency;

  const filter = ctx.createBiquadFilter();
  filter.type = "lowpass";
  filter.frequency.value = filterCutoff;

  const gain = ctx.createGain();
  gain.gain.setValueAtTime(0, 0);
  gain.gain.linearRampToValueAtTime(1, attack);
  gain.gain.linearRampToValueAtTime(0, attack + decay);

  osc.connect(filter);
  filter.connect(gain);
  gain.connect(ctx.destination);

  osc.start(0);
  osc.stop(duration);

  const rendered = await ctx.startRendering();
  return new Float32Array(rendered.getChannelData(0));
}

async function renderRegistration(registration: RecipeRegistration, seed: number): Promise<RenderResult> {
  const duration = registration.getDuration(createRng(seed));
  const ctx = new OfflineAudioContext(1, Math.ceil(SAMPLE_RATE * duration), SAMPLE_RATE);
  await registration.buildOfflineGraph(createRng(seed), ctx, duration);
  const rendered = await ctx.startRendering();
  const samples = new Float32Array(rendered.getChannelData(0));

  let peak = 0;
  for (const sample of samples) {
    const abs = Math.abs(sample);
    if (abs > peak) {
      peak = abs;
    }
  }

  return { samples, duration, peak };
}

describe("ToneGraph integration parity", () => {
  it("discovers all migrated recipes as file-backed registrations", async () => {
    const fileBackedRegistry = new RecipeRegistry();
    const discovered = await discoverFileBackedRecipes(fileBackedRegistry, { recipeDirectory: PRESETS_DIR });
    // The migrated recipes are a subset of everything discovered from
    // `presets/recipes/`; the recipe book (TF-0MUY9H7QZ000UX5W) adds more
    // file-backed recipes alongside them, so assert containment rather than
    // exact equality.
    for (const recipeName of MIGRATED) {
      expect(discovered).toContain(recipeName);
    }
  });

  it("all migrated file-backed recipes are deterministic across three renders", async () => {
    const fileBackedRegistry = new RecipeRegistry();
    await discoverFileBackedRecipes(fileBackedRegistry, { recipeDirectory: PRESETS_DIR });

    for (const recipeName of MIGRATED) {
      const fileBacked = fileBackedRegistry.getRegistration(recipeName);
      expect(fileBacked, `${recipeName} should be discoverable from presets/recipes`).toBeDefined();

      const renders: Float32Array[] = [];
      for (let i = 0; i < DETERMINISM_RUNS; i += 1) {
        const render = await renderRegistration(fileBacked!, SEED);
        renders.push(render.samples);
      }

      const reference = renders[0]!;
      for (let i = 1; i < renders.length; i += 1) {
        const comparison = compareBuffers(reference, renders[i]!);
        expect(
          comparison.identical,
          `${recipeName} run ${i + 1} diverged from run 1:\n${formatCompareResult(comparison)}`,
        ).toBe(true);
      }
    }
  });

  it("ui-scifi-confirm renders byte-identical to the historical TypeScript implementation at seed 42", async () => {
    const fileBackedRegistry = new RecipeRegistry();
    await discoverFileBackedRecipes(fileBackedRegistry, { recipeDirectory: PRESETS_DIR });

    const fileBacked = fileBackedRegistry.getRegistration("ui-scifi-confirm");
    expect(fileBacked, "ui-scifi-confirm should be discovered from presets/recipes").toBeDefined();

    const reference = await renderHistoricalUiSciFiConfirm(SEED);
    const migrated = (await renderRegistration(fileBacked!, SEED)).samples;

    // AC1: raw samples must match byte-for-byte.
    const comparison = compareBuffers(reference, migrated);
    expect(
      comparison.identical,
      `ui-scifi-confirm ToneGraph output diverged from the historical TypeScript implementation at seed ${SEED}:\n${formatCompareResult(comparison)}`,
    ).toBe(true);

    // AC4: repeated runs on the same platform stay deterministic.
    const referenceAgain = await renderHistoricalUiSciFiConfirm(SEED);
    const migratedAgain = (await renderRegistration(fileBacked!, SEED)).samples;
    expect(compareBuffers(reference, referenceAgain).identical).toBe(true);
    expect(compareBuffers(migrated, migratedAgain).identical).toBe(true);
  });

  it("reports the first divergent sample when buffers differ", () => {
    // AC2: a mismatch must produce actionable diagnostics — not a bare failure.
    const expected = new Float32Array([0, 0.1, 0.2, 0.3]);
    const actual = new Float32Array([0, 0.1, 0.9, 0.3]);

    const comparison = compareBuffers(expected, actual);

    expect(comparison.identical).toBe(false);
    expect(comparison.firstDivergentIndex).toBe(2);
    expect(comparison.valueA).toBeCloseTo(0.2);
    expect(comparison.valueB).toBeCloseTo(0.9);
    expect(formatCompareResult(comparison)).toContain("sample 2");
  });

  it("preserves node automation through the file-backed path so it changes output", async () => {
    const tempDir = await mkdtemp(join(tmpdir(), "tonegraph-automation-"));
    try {
      const baseGraph = {
        version: "0.1",
        meta: { name: "automation-fixture", duration: 0.3 },
        nodes: {
          osc: { kind: "oscillator", params: { type: "sine", frequency: 220 } },
          gain: { kind: "gain", params: { gain: 0.2 } },
          out: { kind: "destination" },
        },
        routing: [{ chain: ["osc", "gain", "out"] }],
      };

      const automationGraph = JSON.parse(JSON.stringify(baseGraph)) as typeof baseGraph;
      (automationGraph.nodes.osc as Record<string, unknown>).automation = {
        frequency: [
          { kind: "set", time: 0, value: 220 },
          { kind: "linearRamp", time: 0.15, value: 880 },
          { kind: "exponentialRamp", time: 0.3, value: 60 },
        ],
      };

      await writeFile(join(tempDir, "automation-fixture.json"), JSON.stringify(automationGraph));
      await writeFile(join(tempDir, "static-fixture.json"), JSON.stringify(baseGraph));

      const registry = new RecipeRegistry();
      const discovered = await discoverFileBackedRecipes(registry, { recipeDirectory: tempDir });
      expect(discovered).toContain("automation-fixture");
      expect(discovered).toContain("static-fixture");

      const automated = registry.getRegistration("automation-fixture")!;
      const statically = registry.getRegistration("static-fixture")!;

      const automatedFirst = await renderRegistration(automated, SEED);
      const automatedSecond = await renderRegistration(automated, SEED);
      const staticRender = await renderRegistration(statically, SEED);

      // AC5: same recipe + seed twice is byte-identical.
      expect(compareBuffers(automatedFirst.samples, automatedSecond.samples).identical).toBe(true);
      expect(automatedFirst.peak).toBeGreaterThan(PEAK_FLOOR);

      // AC1/AC2: automation survives validation, so the swept render differs
      // from a static-frequency render of the same graph.
      expect(automatedFirst.samples.length).toBe(staticRender.samples.length);
      const identical = automatedFirst.samples.every(
        (sample, index) => sample === staticRender.samples[index],
      );
      expect(identical).toBe(false);
    } finally {
      await rm(tempDir, { recursive: true, force: true });
    }
  });

  it("discovers a file-backed recipe that uses sequences and renders it deterministically", async () => {
    const tempDir = await mkdtemp(join(tmpdir(), "tonegraph-seq-"));
    try {
      const graph = {
        version: "0.1",
        meta: {
          name: "sequence-fixture",
          duration: 0.25,
          parameters: [
            { name: "frequency", type: "number", min: 200, max: 800, default: 220 },
          ],
        },
        nodes: {
          osc: { kind: "oscillator", params: { type: "sine", frequency: 220 } },
          amp: { kind: "gain", params: { gain: 0.25 } },
          out: { kind: "destination" },
        },
        routing: [{ chain: ["osc", "amp", "out"] }],
        sequences: [
          {
            node: "osc",
            param: "frequency",
            events: [
              { kind: "set", time: 0, value: 220 },
              { kind: "linearRamp", time: 0.25, value: 660 },
            ],
          },
        ],
      };

      await writeFile(join(tempDir, "sequence-fixture.json"), JSON.stringify(graph));

      const registry = new RecipeRegistry();
      const discovered = await discoverFileBackedRecipes(registry, { recipeDirectory: tempDir });
      expect(discovered).toContain("sequence-fixture");

      const registration = registry.getRegistration("sequence-fixture");
      expect(registration).toBeDefined();

      const first = await renderRegistration(registration!, SEED);
      const second = await renderRegistration(registration!, SEED);

      expect(compareBuffers(first.samples, second.samples).identical).toBe(true);
      expect(first.peak).toBeGreaterThan(PEAK_FLOOR);
    } finally {
      await rm(tempDir, { recursive: true, force: true });
    }
  });

  it("migrated recipes remain structurally valid", async () => {
    const fileBackedRegistry = new RecipeRegistry();
    await discoverFileBackedRecipes(fileBackedRegistry, { recipeDirectory: PRESETS_DIR });

    for (const recipeName of MIGRATED) {
      if (recipeName === "ui-scifi-confirm") {
        continue;
      }

      const fileBacked = fileBackedRegistry.getRegistration(recipeName);
      expect(fileBacked).toBeDefined();

      const fileRender = await renderRegistration(fileBacked!, SEED);

      expect(fileRender.samples.some((sample) => sample !== 0)).toBe(true);
      expect(fileRender.peak).toBeGreaterThan(PEAK_FLOOR);
      expect(fileRender.duration).toBeGreaterThan(0);
    }
  });

  /**
   * AC5 (TF-0MUVK21Q9003PW21): `ambient-wind-gust` and `card-transform` declare
   * inline node automation. Validation must preserve it so the rendered output
   * is actually time-varying (not the static parameter value), and the render
   * must remain deterministic.
   */
  it.each(["ambient-wind-gust", "card-transform"])(
    "honours inline node automation for %s",
    async (recipeName) => {
      const source = await readFile(join(PRESETS_DIR, `${recipeName}.yaml`), "utf-8");
      const graph = validateToneGraph(yaml.load(source));

      // The validated graph must carry at least one node-level automation map.
      const automatedNodes = Object.entries(graph.nodes).filter(
        ([, node]) => (node as { automation?: unknown }).automation !== undefined,
      );
      expect(
        automatedNodes.length,
        `${recipeName} should have at least one node with inline automation after validation`,
      ).toBeGreaterThan(0);

      async function renderGraph(candidate: ToneGraphDocument): Promise<Float32Array> {
        const duration = candidate.meta?.duration ?? 0.5;
        const ctx = new OfflineAudioContext(1, Math.ceil(SAMPLE_RATE * duration), SAMPLE_RATE);
        const handle = await loadToneGraph(candidate, ctx, createRng(SEED));
        handle.start(0);
        handle.stop(handle.duration);
        const rendered = await ctx.startRendering();
        return new Float32Array(rendered.getChannelData(0));
      }

      // Strip the automation from a clone to obtain the static-graph baseline.
      const staticGraph = JSON.parse(JSON.stringify(graph)) as ToneGraphDocument;
      for (const node of Object.values(staticGraph.nodes)) {
        delete (node as { automation?: unknown }).automation;
      }

      const automated = await renderGraph(graph);
      const staticRender = await renderGraph(staticGraph);

      // Time-varying: automation must change the samples versus the static graph.
      expect(automated.length).toBe(staticRender.length);
      expect(
        compareBuffers(automated, staticRender).identical,
        `${recipeName} inline automation should change the rendered output`,
      ).toBe(false);

      // Determinism: the same graph + seed twice is byte-identical.
      const repeat = await renderGraph(graph);
      expect(compareBuffers(automated, repeat).identical).toBe(true);
    },
  );
});
