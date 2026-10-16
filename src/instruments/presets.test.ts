/**
 * Tests for the starter instrument family (`presets/instruments/*.yaml` +
 * `presets.ts`).
 *
 * Verifies the family is discoverable and schema-valid, that the required
 * presets are present with distinct envelopes/oscillators, and that each
 * preset renders deterministic, non-silent audio at the expected pitch and
 * velocity (per-preset offline-render snapshot).
 */

import { describe, it, expect, beforeAll } from "vitest";
import {
  loadBundledInstrumentPresets,
  listInstruments,
  getInstrument,
  instrumentRegistry,
} from "./presets.js";
import { ENGINE_SAMPLE_RATE, renderInstrument, type InstrumentEvent } from "./engine.js";
import { validateInstrumentDefinition } from "./schema.js";
import { compareBuffers } from "../test-utils/buffer-compare.js";
import { computeRms, estimateDominantFrequency, isSilent } from "./__tests__/helpers.js";

/** The five required starter presets. */
const REQUIRED = ["pluck", "pad", "bass", "bell", "string-lead"] as const;

const HOLD = 0.4;
const TAIL = 0.3;

/** Render a preset's held note and return the samples. */
async function renderPreset(
  id: string,
  note: number,
  velocity: number,
): Promise<Float32Array> {
  const preset = getInstrument(id);
  if (!preset) {
    throw new Error(`preset "${id}" is not registered`);
  }
  const events: InstrumentEvent[] = [
    { type: "midiNoteOn", note, velocity, time: 0 },
    { type: "midiNoteOff", note, velocity, time: HOLD },
  ];
  const rendered = await renderInstrument(preset.definition, events, {
    sampleRate: ENGINE_SAMPLE_RATE,
    tail: TAIL,
  });
  return rendered.samples;
}

describe("instrument family: discovery and schema", () => {
  beforeAll(async () => {
    await loadBundledInstrumentPresets();
  });

  it("registers at least the five required presets", () => {
    for (const id of REQUIRED) {
      expect(instrumentRegistry.has(id), `missing required preset "${id}"`).toBe(true);
    }
    expect(listInstruments().length).toBeGreaterThanOrEqual(5);
  });

  it("is discoverable via the public API with id, name and category", () => {
    const summaries = instrumentRegistry.listSummaries();
    for (const id of REQUIRED) {
      const summary = summaries.find((s) => s.id === id);
      expect(summary, `no summary for "${id}"`).toBeDefined();
      expect(summary!.name.length).toBeGreaterThan(0);
      expect(summary!.category.length).toBeGreaterThan(0);
    }
  });

  it("has schema-valid definitions for every preset", () => {
    for (const preset of instrumentRegistry.listSummaries()) {
      const entry = getInstrument(preset.id);
      expect(() => validateInstrumentDefinition(entry!.definition)).not.toThrow();
    }
  });

  it("gives each preset distinct oscillator and/or envelope values", () => {
    const seen = new Set<string>();
    for (const id of REQUIRED) {
      const { definition } = getInstrument(id)!;
      const fingerprint = JSON.stringify({
        oscillator: definition.oscillator,
        envelope: definition.envelope,
      });
      expect(seen.has(fingerprint), `preset "${id}" duplicates another's shape`).toBe(false);
      seen.add(fingerprint);
    }
  });

  it("shapes pluck observably differently from pad", () => {
    const pluck = getInstrument("pluck")!.definition;
    const pad = getInstrument("pad")!.definition;
    expect(pluck.envelope.attack).toBeLessThan(pad.envelope.attack);
    expect(pluck.envelope.release).toBeLessThan(pad.envelope.release);
    expect(pluck.envelope.sustain).toBeLessThan(pad.envelope.sustain);
    expect(pluck.oscillator.type).not.toBe(pad.oscillator.type);
  });
});

describe("instrument family: offline render snapshots", () => {
  beforeAll(async () => {
    await loadBundledInstrumentPresets();
  });

  it.each(REQUIRED)(
    "renders %s non-silent, at the expected pitch and velocity-scaled",
    async (id) => {
      const samples = await renderPreset(id, 69, 100);

      // Non-silent during the sustain window.
      const window = [
        Math.round(0.15 * ENGINE_SAMPLE_RATE),
        Math.round(0.3 * ENGINE_SAMPLE_RATE),
      ];
      const sustain = samples.slice(window[0], window[1]);
      expect(isSilent(sustain), `${id} rendered silence`).toBe(false);
      expect(computeRms(sustain)).toBeGreaterThan(0.005);

      // Expected pitch: A4 = 440 Hz (within a generous ±5% for filtered timbres).
      const dominant = estimateDominantFrequency(samples, ENGINE_SAMPLE_RATE);
      expect(dominant, `${id} fundamental`).toBeGreaterThan(440 * 0.95);
      expect(dominant).toBeLessThan(440 * 1.05);

      // Velocity scales loudness monotonically.
      const quiet = await renderPreset(id, 69, 40);
      const loudRms = computeRms(sustain);
      const quietRms = computeRms(quiet.slice(window[0], window[1]));
      expect(loudRms, `${id} velocity scaling`).toBeGreaterThan(quietRms);
    },
  );

  it.each(REQUIRED)("renders %s deterministically", async (id) => {
    const first = await renderPreset(id, 60, 100);
    const second = await renderPreset(id, 60, 100);
    expect(compareBuffers(first, second).identical).toBe(true);
  });

  it("renders each preset to distinct output", async () => {
    const renders: Array<[string, Float32Array]> = [];
    for (const id of REQUIRED) {
      renders.push([id, await renderPreset(id, 60, 100)]);
    }
    for (let i = 0; i < renders.length; i++) {
      for (let j = i + 1; j < renders.length; j++) {
        const [idA, a] = renders[i]!;
        const [idB, b] = renders[j]!;
        expect(
          compareBuffers(a, b).identical,
          `presets "${idA}" and "${idB}" render identical audio`,
        ).toBe(false);
      }
    }
  });
});
