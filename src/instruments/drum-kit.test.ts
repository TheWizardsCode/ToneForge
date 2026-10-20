/**
 * Tests for the six-voice drum kit (`drum-kit.ts` + `presets/instruments/drum-kit.yaml`).
 *
 * The kit is a single instrument whose `voices` map dispatches the six core GM
 * percussion notes to distinct voices. These tests cover the work item's
 * acceptance criteria:
 *
 * - the definition and the YAML preset declare the same six voices and stay in
 *   lockstep (the desktop preset loader registers `drum-kit`);
 * - each voice follows its documented synthesis recipe (kick pitch-drop body +
 *   click, snare body + noise, hat/crash filtered noise with increasing decay,
 *   clap staggered bursts);
 * - every voice renders non-silent and is measurably distinct from the others
 *   (band energy + spectral centroid + decay time, via the shared helpers);
 * - per-note dispatch works end to end, unmapped notes are silent, and a
 *   same-note retrigger follows the engine's documented replacement semantics.
 *
 * All renders use the pinned 44100 Hz offline engine. Noise is seeded per
 * voice, so every assertion is deterministic.
 */

import { describe, it, expect, beforeAll } from "vitest";
import {
  DRUM_KIT_DEFINITION,
  DRUM_KIT_NOTE_MAP,
  DRUM_KIT_NOTES,
  DRUM_KIT_PRESET_ID,
} from "./drum-kit.js";
import { ENGINE_SAMPLE_RATE, renderInstrument, type InstrumentEvent } from "./engine.js";
import { validateInstrumentDefinition } from "./schema.js";
import type { InstrumentOscillator, InstrumentVoice } from "./schema.js";
import { getInstrument, loadBundledInstrumentPresets } from "./presets.js";
import { compareBuffers } from "../test-utils/buffer-compare.js";
import {
  computeBandEnergy,
  computeDecayTime,
  computeRms,
  describeSpectralDifference,
  estimateDominantFrequency,
  isSilent,
  SPECTRAL_BANDS,
} from "./__tests__/helpers.js";

/** Default hold used when rendering a drum hit, in seconds. */
const HIT_HOLD = 0.05;

/** Default silence appended after the hit, in seconds. */
const HIT_TAIL = 0.3;

/** Render one kit note (note-on → short note-off) and return the samples. */
async function renderHit(
  note: number,
  options: { hold?: number; tail?: number; velocity?: number } = {},
): Promise<Float32Array> {
  const velocity = options.velocity ?? 110;
  const events: InstrumentEvent[] = [
    { type: "midiNoteOn", note, velocity, time: 0 },
    { type: "midiNoteOff", note, velocity, time: options.hold ?? HIT_HOLD },
  ];
  const rendered = await renderInstrument(DRUM_KIT_DEFINITION, events, {
    sampleRate: ENGINE_SAMPLE_RATE,
    tail: options.tail ?? HIT_TAIL,
  });
  return rendered.samples;
}

/** Render every kit note once, keyed by GM note number. */
async function renderAllVoices(): Promise<Map<number, Float32Array>> {
  const renders = new Map<number, Float32Array>();
  for (const note of DRUM_KIT_NOTES) {
    renders.set(note, await renderHit(note));
  }
  return renders;
}

/** The kit voice for a note, asserting it exists (keeps tests type-safe). */
function voiceFor(note: number): InstrumentVoice {
  const voice = DRUM_KIT_DEFINITION.voices?.[note];
  if (!voice) {
    throw new Error(`kit has no voice for note ${note}`);
  }
  return voice;
}

/**
 * Count the distinct envelope humps of a percussive hit.
 *
 * The envelope is the RMS over a centred 6 ms window, sampled every 1 ms over
 * the first 60 ms. Two successive local maxima count as separate humps only
 * when the trough between them falls below 75% of the quieter maximum and
 * they are at least 6 ms apart. A single strike therefore reports one hump,
 * while a clap's staggered bursts report several. This is a structural
 * measurement of the burst envelope, not a re-implementation of the
 * synthesiser (which is what the render itself provides).
 */
function countEnvelopeHumps(samples: Float32Array): number {
  const sampleRate = ENGINE_SAMPLE_RATE;
  const windowSeconds = 0.006;
  const windowSamples = Math.round(windowSeconds * sampleRate);
  const half = Math.floor(windowSamples / 2);
  const length = Math.min(samples.length, Math.round(0.06 * sampleRate));

  const prefix = new Float64Array(length + 1);
  for (let i = 0; i < length; i++) {
    prefix[i + 1] = prefix[i]! + samples[i]! * samples[i]!;
  }
  const envelope: number[] = [];
  for (let i = 0; i < length; i += Math.round(0.001 * sampleRate)) {
    const start = Math.max(0, i - half);
    const end = Math.min(length - 1, i + half);
    envelope.push(Math.sqrt((prefix[end + 1]! - prefix[start]!) / (end - start + 1)));
  }

  const peak = Math.max(...envelope);
  if (peak <= 0) {
    return 0;
  }

  let humps = 0;
  let lastMax = Number.NEGATIVE_INFINITY;
  let lastIndex = Number.NEGATIVE_INFINITY;
  for (let i = 1; i < envelope.length - 1; i++) {
    const isMaximum =
      envelope[i]! >= envelope[i - 1]!
      && envelope[i]! > envelope[i + 1]!
      && envelope[i]! > 0.2 * peak;
    if (!isMaximum) {
      continue;
    }
    const level = envelope[i]!;
    if (lastIndex === Number.NEGATIVE_INFINITY) {
      humps++;
      lastMax = level;
      lastIndex = i;
      continue;
    }
    if (i - lastIndex < 6) {
      if (level > lastMax) {
        lastMax = level;
        lastIndex = i;
      }
      continue;
    }
    let trough = Number.POSITIVE_INFINITY;
    for (let k = lastIndex; k <= i; k++) {
      trough = Math.min(trough, envelope[k]!);
    }
    if (trough < 0.75 * Math.min(lastMax, level)) {
      humps++;
      lastMax = level;
      lastIndex = i;
    } else if (level > lastMax) {
      lastMax = level;
      lastIndex = i;
    }
  }
  return humps;
}

/**
 * Relative RMS difference between two equally long buffers: the RMS of the
 * sample-wise difference expressed as a fraction of the first buffer's RMS.
 * Used where a comparison is expected to agree to within rendering rounding
 * rather than byte-for-byte.
 */
function relativeRmsDifference(a: Float32Array, b: Float32Array): number {
  const length = Math.min(a.length, b.length);
  let differenceEnergy = 0;
  let signalEnergy = 0;
  for (let i = 0; i < length; i++) {
    differenceEnergy += (a[i]! - b[i]!) ** 2;
    signalEnergy += a[i]! ** 2;
  }
  if (signalEnergy === 0) {
    return differenceEnergy === 0 ? 0 : Number.POSITIVE_INFINITY;
  }
  return Math.sqrt(differenceEnergy / signalEnergy);
}

/** Collect every noise oscillator in a voice (main oscillator plus layers). */
function noiseOscillators(voice: InstrumentVoice): InstrumentOscillator[] {
  const oscillators: InstrumentOscillator[] = [voice.oscillator];
  for (const layer of voice.layers ?? []) {
    oscillators.push(layer.oscillator);
  }
  return oscillators.filter((oscillator) => oscillator.type === "noise");
}

describe("drum kit definition", () => {
  it("declares preset id, name and category with the six GM voices", () => {
    expect(DRUM_KIT_DEFINITION.id).toBe(DRUM_KIT_PRESET_ID);
    expect(DRUM_KIT_DEFINITION.id).toBe("drum-kit");
    expect(DRUM_KIT_DEFINITION.name).toBe("Drum Kit");
    expect(DRUM_KIT_DEFINITION.category).toBe("Drums");

    const notes = Object.keys(DRUM_KIT_DEFINITION.voices ?? {})
      .map(Number)
      .sort((a, b) => a - b);
    expect(notes).toEqual([36, 38, 39, 42, 46, 49]);
    expect(notes).toEqual([...DRUM_KIT_NOTES].sort((a, b) => a - b));
    expect(DRUM_KIT_NOTE_MAP).toEqual({
      kick: 36,
      snare: 38,
      clap: 39,
      closedHat: 42,
      openHat: 46,
      crash: 49,
    });
  });

  it("validates through validateInstrumentDefinition", () => {
    expect(() => validateInstrumentDefinition(DRUM_KIT_DEFINITION)).not.toThrow();
  });

  it("registers through the bundled preset loader and stays in lockstep with the YAML", async () => {
    await loadBundledInstrumentPresets();

    const preset = getInstrument(DRUM_KIT_PRESET_ID);
    expect(preset, "drum-kit preset was not registered").toBeDefined();
    expect(preset!.category).toBe("Drums");
    expect(preset!.definition.name).toBe("Drum Kit");

    // The YAML is the loader's source of truth; the exported TS definition is
    // the code source of truth. They must describe exactly the same instrument.
    const fromCode = validateInstrumentDefinition(DRUM_KIT_DEFINITION);
    const fromYaml = validateInstrumentDefinition(preset!.definition);
    expect(fromYaml).toEqual({ ...fromCode, category: undefined });

    // Backward compatibility: the legacy single-voice preset stays registered.
    expect(getInstrument("percussion")).toBeDefined();
  });

  it("gives every noise source its own seed", () => {
    const seeds = new Set<number>();
    let noiseCount = 0;
    for (const note of DRUM_KIT_NOTES) {
      for (const oscillator of noiseOscillators(voiceFor(note))) {
        if (oscillator.type === "noise") {
          noiseCount++;
          expect(oscillator.seed, `note ${note} noise voice has no explicit seed`).toBeTypeOf(
            "number",
          );
          expect(seeds.has(oscillator.seed!), `duplicate noise seed ${oscillator.seed}`).toBe(
            false,
          );
          seeds.add(oscillator.seed!);
        }
      }
    }
    // Kick click, snare rattle, clap tail + four bursts, two hats, crash ×2.
    expect(noiseCount).toBeGreaterThanOrEqual(10);
  });

  it("documents the synthesis model of each voice in its parameters", () => {
    // Kick: pitched body with a pitch sweep plus a click transient layer.
    const kick = voiceFor(DRUM_KIT_NOTE_MAP.kick);
    expect(kick.oscillator.type).toBe("sine");
    expect(kick.pitch?.fromCents).toBeGreaterThan(0);
    expect(kick.pitch?.time).toBeLessThan(0.1);
    expect(kick.oneShot).toBe(true);
    expect(kick.layers).toHaveLength(1);
    expect(kick.layers![0]!.oscillator.type).toBe("noise");
    expect(kick.layers![0]!.delay ?? 0).toBe(0);

    // Snare: a pitched (waveform) body plus a noise layer.
    const snare = voiceFor(DRUM_KIT_NOTE_MAP.snare);
    expect(snare.oscillator.type).not.toBe("noise");
    expect(snare.layers!.some((layer) => layer.oscillator.type === "noise")).toBe(true);

    // Hats and crash: filtered noise with increasing decay.
    const closedHat = voiceFor(DRUM_KIT_NOTE_MAP.closedHat);
    const openHat = voiceFor(DRUM_KIT_NOTE_MAP.openHat);
    const crash = voiceFor(DRUM_KIT_NOTE_MAP.crash);
    for (const voice of [closedHat, openHat, crash]) {
      expect(voice.oscillator.type).toBe("noise");
      expect(voice.filter?.type).toBe("highpass");
    }
    expect(closedHat.envelope.decay).toBeLessThan(openHat.envelope.decay);
    expect(openHat.envelope.decay).toBeLessThan(crash.envelope.decay);

    // Clap: a noise tail with several staggered short bursts.
    const clap = voiceFor(DRUM_KIT_NOTE_MAP.clap);
    expect(clap.layers!.length).toBeGreaterThanOrEqual(3);
    const delays = clap.layers!.map((layer) => layer.delay ?? 0);
    expect(delays).toEqual([...delays].sort((a, b) => a - b));
    expect(new Set(delays).size).toBe(delays.length);
  });
});

describe("drum kit audibility and distinctness", () => {
  it("renders every voice non-silent", async () => {
    for (const note of DRUM_KIT_NOTES) {
      const samples = await renderHit(note);
      expect(isSilent(samples), `note ${note} rendered silence`).toBe(false);
      expect(computeRms(samples), `note ${note} is too quiet`).toBeGreaterThan(0.01);
      expect(Number.isFinite(estimateDominantFrequency(samples))).toBe(true);
    }
  });

  it("gives the kick the lowest spectral centroid of the kit", async () => {
    const renders = await renderAllVoices();
    const kick = renders.get(DRUM_KIT_NOTE_MAP.kick)!;

    for (const note of DRUM_KIT_NOTES) {
      if (note === DRUM_KIT_NOTE_MAP.kick) {
        continue;
      }
      const comparison = describeSpectralDifference(kick, renders.get(note)!);
      expect(
        comparison.centroidA,
        `kick centroid ${comparison.centroidA.toFixed(0)} Hz is not below note ${note} ` +
          `(${comparison.centroidB.toFixed(0)} Hz)`,
      ).toBeLessThan(comparison.centroidB);
    }
  });

  it("orders the voice decays: closed hat < open hat < crash, kick short, crash longest", async () => {
    const renders = await renderAllVoices();
    const decay = (note: number): number => computeDecayTime(renders.get(note)!);

    const kickDecay = decay(DRUM_KIT_NOTE_MAP.kick);
    const closedDecay = decay(DRUM_KIT_NOTE_MAP.closedHat);
    const openDecay = decay(DRUM_KIT_NOTE_MAP.openHat);
    const crashDecay = decay(DRUM_KIT_NOTE_MAP.crash);

    expect(closedDecay).toBeLessThan(openDecay);
    expect(openDecay).toBeLessThan(crashDecay);
    // Kick has a short decay (well under a second, shorter than the crash).
    expect(kickDecay).toBeGreaterThan(0);
    expect(kickDecay).toBeLessThan(0.6);
    expect(kickDecay).toBeLessThan(crashDecay);

    // The crash is the longest voice in the kit.
    for (const note of DRUM_KIT_NOTES) {
      if (note === DRUM_KIT_NOTE_MAP.crash) {
        continue;
      }
      expect(crashDecay, `crash decay is not longer than note ${note}`).toBeGreaterThan(
        decay(note),
      );
    }
  });

  it("distinguishes the clap from the snare by burst structure and band profile", async () => {
    const clap = await renderHit(DRUM_KIT_NOTE_MAP.clap);
    const snare = await renderHit(DRUM_KIT_NOTE_MAP.snare);

    // Burst structure: the clap has several staggered humps, the snare one.
    const clapHumps = countEnvelopeHumps(clap);
    const snareHumps = countEnvelopeHumps(snare);
    expect(clapHumps, "clap does not show several distinct bursts").toBeGreaterThanOrEqual(3);
    expect(snareHumps, "snare should be a single continuous strike").toBe(1);

    // Band profile: the snare's low body vs the clap's band-passed presence.
    const snareLow = computeBandEnergy(snare, SPECTRAL_BANDS.low.lowHz, SPECTRAL_BANDS.low.highHz);
    const clapLow = computeBandEnergy(clap, SPECTRAL_BANDS.low.lowHz, SPECTRAL_BANDS.low.highHz);
    expect(snareLow).toBeGreaterThan(clapLow * 5);

    // ...and the shared distinctness verdict agrees.
    expect(describeSpectralDifference(clap, snare).distinct).toBe(true);
  });

  it("renders all six voices measurably distinct from each other", async () => {
    const renders = await renderAllVoices();
    const decays = new Map(
      DRUM_KIT_NOTES.map((note) => [note, computeDecayTime(renders.get(note)!)]),
    );

    for (let i = 0; i < DRUM_KIT_NOTES.length; i++) {
      for (let j = i + 1; j < DRUM_KIT_NOTES.length; j++) {
        const noteA = DRUM_KIT_NOTES[i]!;
        const noteB = DRUM_KIT_NOTES[j]!;
        const spectral = describeSpectralDifference(renders.get(noteA)!, renders.get(noteB)!)
          .distinct;
        const decayA = decays.get(noteA)!;
        const decayB = decays.get(noteB)!;
        const decayRatio = Math.max(decayA, decayB) / Math.min(decayA, decayB);
        expect(
          spectral || decayRatio > 1.5,
          `notes ${noteA} and ${noteB} are not measurably distinct ` +
            `(spectral distinct: ${spectral}, decay ratio: ${decayRatio.toFixed(2)})`,
        ).toBe(true);
      }
    }
  });

  it("is deterministic: the same hit renders byte-identical samples", async () => {
    for (const note of DRUM_KIT_NOTES) {
      const first = await renderHit(note);
      const second = await renderHit(note);
      expect(compareBuffers(first, second).identical, `note ${note} is not deterministic`).toBe(
        true,
      );
    }
  });
});

describe("drum kit per-note dispatch", () => {
  it("renders a same-note retrigger as the engine's documented replacement", async () => {
    // Documented engine semantics (VoiceManager): a Note On for a note that is
    // still sounding replaces that voice, so the earlier trigger's pending
    // audio is not heard. For a kit hit this means a retrigger restarts the
    // voice rather than layering two hits.
    const retriggered = await renderInstrument(
      DRUM_KIT_DEFINITION,
      [
        { type: "midiNoteOn", note: DRUM_KIT_NOTE_MAP.kick, velocity: 110, time: 0 },
        { type: "midiNoteOn", note: DRUM_KIT_NOTE_MAP.kick, velocity: 110, time: 0.1 },
      ],
      { sampleRate: ENGINE_SAMPLE_RATE, tail: HIT_TAIL },
    );
    const lone = await renderInstrument(
      DRUM_KIT_DEFINITION,
      [{ type: "midiNoteOn", note: DRUM_KIT_NOTE_MAP.kick, velocity: 110, time: 0.1 }],
      { sampleRate: ENGINE_SAMPLE_RATE, tail: HIT_TAIL },
    );

    const sliceStart = Math.round(0.1 * ENGINE_SAMPLE_RATE);
    // The replaced first trigger is not heard before the retrigger...
    expect(isSilent(retriggered.samples.slice(0, sliceStart - 1))).toBe(true);
    // ...and from the retrigger on, the render matches a lone hit. The match
    // is within rendering rounding (not bit-exact) because the gain curve
    // starts at a non-zero render time; 1% of signal RMS is far below any
    // audible difference and rules out a layered second hit (which would
    // roughly double the energy).
    const fromRetrigger = retriggered.samples.slice(sliceStart);
    const fromLone = lone.samples.slice(0, fromRetrigger.length);
    expect(relativeRmsDifference(fromRetrigger, fromLone)).toBeLessThan(0.01);
  });

  it("renders six different voices for the six GM notes and silence for unmapped notes", async () => {
    const renders = await renderAllVoices();
    for (let i = 0; i < DRUM_KIT_NOTES.length; i++) {
      for (let j = i + 1; j < DRUM_KIT_NOTES.length; j++) {
        const result = compareBuffers(
          renders.get(DRUM_KIT_NOTES[i]!)!,
          renders.get(DRUM_KIT_NOTES[j]!)!,
        );
        expect(
          result.identical,
          `notes ${DRUM_KIT_NOTES[i]} and ${DRUM_KIT_NOTES[j]} rendered identically`,
        ).toBe(false);
      }
    }

    // A melodic note is not in the kit map: it is ignored deterministically.
    const unmapped = await renderHit(60);
    expect(isSilent(unmapped)).toBe(true);
  });

  it("keeps a kit hit playing its full decay after an early note-off (one-shot)", async () => {
    const shortRelease = await renderHit(DRUM_KIT_NOTE_MAP.crash, { hold: 0.01, tail: 0.02 });
    const longRelease = await renderHit(DRUM_KIT_NOTE_MAP.crash, { hold: 0.8, tail: 0.02 });

    // A drum hit is a one-shot: an early note-off must not truncate the crash.
    expect(compareBuffers(shortRelease, longRelease).identical).toBe(true);
    expect(computeDecayTime(shortRelease)).toBeGreaterThan(0.5);
  });
});
