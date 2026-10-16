/**
 * Unit tests for the offline note renderer (`src/instruments/offline-demo.ts`).
 *
 * This is the pure, device-free core behind `tf instrument noteon --output`
 * and `--fallback`: a single note rendered deterministically through the
 * existing `renderInstrument` engine with a fixed default hold.
 *
 * Work item: TF-0MVBGEDQI008W4VH.
 */

import { describe, it, expect, beforeEach, afterEach } from "vitest";
import {
  renderNoteOffline,
  buildNoteEvents,
  resolveInstrumentDefinition,
  DEFAULT_NOTE_HOLD_SECONDS,
} from "./offline-demo.js";
import { encodeWav } from "../audio/wav-encoder.js";
import {
  registerInstrumentPreset,
  instrumentRegistry,
  loadBundledInstrumentPresets,
} from "./presets.js";
import type { InstrumentDefinition } from "./schema.js";
import { midiNoteToFrequency } from "./instrument.js";
import { compareBuffers } from "../test-utils/buffer-compare.js";
import { computeRms, estimateDominantFrequency } from "./__tests__/helpers.js";

const TEST_PRESET = "offline.pluck";

const TEST_DEFINITION: InstrumentDefinition = {
  id: TEST_PRESET,
  name: "Offline Pluck",
  category: "Pluck",
  oscillator: { type: "triangle" },
  envelope: { attack: 0.002, decay: 0.09, sustain: 0.12, release: 0.12 },
};

beforeEach(async () => {
  instrumentRegistry.clear();
  await loadBundledInstrumentPresets();
  registerInstrumentPreset({ definition: TEST_DEFINITION, category: "Pluck" });
});

afterEach(async () => {
  instrumentRegistry.clear();
  await loadBundledInstrumentPresets();
});

describe("buildNoteEvents / resolveInstrumentDefinition", () => {
  it("builds a note-on at 0 and note-off at the hold time", () => {
    expect(buildNoteEvents(60, 100, 0.5)).toEqual([
      { type: "midiNoteOn", note: 60, velocity: 100, time: 0 },
      { type: "midiNoteOff", note: 60, velocity: 0, time: 0.5 },
    ]);
  });

  it("resolves a registered preset and rejects an unknown one", () => {
    expect(resolveInstrumentDefinition(TEST_PRESET)?.id).toBe(TEST_PRESET);
    expect(resolveInstrumentDefinition("nope")).toBeNull();
  });
});

describe("renderNoteOffline", () => {
  it("renders a non-silent note at the correct pitch with the default hold", async () => {
    const rendered = await renderNoteOffline({
      note: 60,
      velocity: 100,
      presetId: TEST_PRESET,
    });

    expect(rendered.sampleRate).toBe(44100);
    expect(rendered.samples.length).toBeGreaterThan(0);
    expect(computeRms(rendered.samples)).toBeGreaterThan(0.001);

    const dominant = estimateDominantFrequency(rendered.samples, rendered.sampleRate);
    const target = midiNoteToFrequency(60);
    // Funda,ental within a tolerance of a semitone and a half.
    expect(Math.abs(dominant - target) / target).toBeLessThan(0.045);

    // Default hold (1 s) plus release tail is audible.
    expect(rendered.duration).toBeGreaterThanOrEqual(DEFAULT_NOTE_HOLD_SECONDS);
  });

  it("honours an explicit hold and extends the render accordingly", async () => {
    const short = await renderNoteOffline({
      note: 69,
      velocity: 100,
      presetId: TEST_PRESET,
      holdSeconds: 0.25,
    });
    const long = await renderNoteOffline({
      note: 69,
      velocity: 100,
      presetId: TEST_PRESET,
      holdSeconds: 1.5,
    });
    expect(long.duration).toBeGreaterThan(short.duration + 1.0);
    // The dominant frequency is concert A (440 Hz) for note 69.
    const a440 = estimateDominantFrequency(long.samples, long.sampleRate);
    expect(Math.abs(a440 - 440) / 440).toBeLessThan(0.045);
  });

  it("is deterministic: identical input yields a byte-identical WAV", async () => {
    const renderOne = await renderNoteOffline({
      note: 64,
      velocity: 90,
      presetId: TEST_PRESET,
      holdSeconds: 0.3,
    });
    const renderTwo = await renderNoteOffline({
      note: 64,
      velocity: 90,
      presetId: TEST_PRESET,
      holdSeconds: 0.3,
    });
    const result = compareBuffers(
      encodeWav(renderOne.samples, { sampleRate: 44100 }),
      encodeWav(renderTwo.samples, { sampleRate: 44100 }),
    );
    expect(result.identical).toBe(true);
  });

  it("rejects an unknown preset with a clear error", async () => {
    await expect(
      renderNoteOffline({ note: 60, velocity: 100, presetId: "nope" }),
    ).rejects.toThrow(/Unknown instrument preset 'nope'/);
  });
});
