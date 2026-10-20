/**
 * Determinism snapshot cases (shared by the determinism test and the golden
 * fixture regeneration script).
 *
 * Each case is a concrete instrument definition + note/velocity sequence that
 * the offline engine renders at the pinned `ENGINE_SAMPLE_RATE`. The SHA-256
 * of the rendered sample bytes is committed in
 * `__tests__/fixtures/determinism-hashes.json`; `determinism.test.ts` asserts
 * the live render still matches, and
 * `scripts/instruments/regenerate-determinism-fixtures.ts` rewrites the
 * registry through the documented command:
 *
 * ```bash
 * npm run regenerate:determinism-fixtures
 * ```
 *
 * (Documentation for the mechanism lives in `docs/modules/instruments.md`,
 * produced by the instruments documentation feature.)
 */

import type { InstrumentDefinition } from "../schema.js";
import type { InstrumentEvent } from "../engine.js";
import { DRUM_KIT_DEFINITION } from "../drum-kit.js";

/** A determinism case: a definition + representative note/velocity sequence. */
export interface DeterminismCase {
  /** Stable unique name; the key in the golden hash registry. */
  name: string;
  /** Seed label identifying this sequence (distinct cases have distinct 1). */
  seed: number;
  /** The instrument definition rendered for this case. */
  definition: InstrumentDefinition;
  /** The note/velocity sequence, in chronological order. */
  events: InstrumentEvent[];
}

/**
 * Tail silence (seconds) appended after the last event by the golden render.
 *
 * Pinned so the regeneration script, the determinism test and any future
 * consumers all render to the same duration.
 */
export const DETERMINISM_TAIL_SECONDS = 0.15;

/** A short pluck-like instrument. */
const PLUCK: InstrumentDefinition = {
  id: "determinism.pluck",
  name: "Determinism Pluck",
  oscillator: { type: "triangle" },
  envelope: { attack: 0.003, decay: 0.06, sustain: 0.45, release: 0.15 },
};

/** A bright bell-like instrument (gain-heavy sustain, longer release). */
const BELL: InstrumentDefinition = {
  id: "determinism.bell",
  name: "Determinism Bell",
  oscillator: { type: "sine" },
  envelope: { attack: 0.001, decay: 0.3, sustain: 0.2, release: 0.4 },
};

/**
 * A noise-only percussion voice: seeded white noise, high-passed, short decay.
 *
 * Exercises the seeded noise-buffer path end to end (white colour, explicit
 * seed, ADSR + filter) without any pitched component.
 */
const NOISE_HAT: InstrumentDefinition = {
  id: "determinism.noise-hat",
  name: "Determinism Noise Hat",
  oscillator: { type: "noise", color: "white", seed: 11 },
  envelope: { attack: 0.0005, decay: 0.05, sustain: 0.0, release: 0.02 },
  filter: { type: "highpass", frequency: 6000, Q: 0.7 },
};

/**
 * The golden cases. Two representative sequences (a three-note chord and a
 * short five-note melody) with different seeds, definitions and velocities.
 */
export const DETERMINISM_CASES: DeterminismCase[] = [
  {
    name: "pluck-chord-seed-42",
    seed: 42,
    definition: PLUCK,
    events: [
      { type: "midiNoteOn", note: 60, velocity: 100, time: 0 },
      { type: "midiNoteOn", note: 64, velocity: 90, time: 0.05 },
      { type: "midiNoteOn", note: 67, velocity: 110, time: 0.1 },
      { type: "midiNoteOff", note: 60, velocity: 100, time: 0.4 },
      { type: "midiNoteOff", note: 64, velocity: 90, time: 0.4 },
      { type: "midiNoteOff", note: 67, velocity: 110, time: 0.4 },
    ],
  },
  {
    name: "bell-melody-seed-7",
    seed: 7,
    definition: BELL,
    events: [
      { type: "midiNoteOn", note: 69, velocity: 100, time: 0 },
      { type: "midiNoteOff", note: 69, velocity: 100, time: 0.2 },
      { type: "midiNoteOn", note: 65, velocity: 95, time: 0.25 },
      { type: "midiNoteOff", note: 65, velocity: 95, time: 0.45 },
      { type: "midiNoteOn", note: 72, velocity: 105, time: 0.5 },
      { type: "midiNoteOff", note: 72, velocity: 105, time: 0.7 },
      { type: "midiNoteOn", note: 67, velocity: 100, time: 0.75 },
      { type: "midiNoteOff", note: 67, velocity: 100, time: 0.95 },
      { type: "midiNoteOn", note: 64, velocity: 92, time: 1.0 },
      { type: "midiNoteOff", note: 64, velocity: 92, time: 1.2 },
    ],
  },
  {
    name: "hat-white-noise-seed-11",
    seed: 11,
    definition: NOISE_HAT,
    events: [
      { type: "midiNoteOn", note: 60, velocity: 100, time: 0 },
      { type: "midiNoteOff", note: 60, velocity: 100, time: 0.08 },
    ],
  },
  {
    name: "kit-six-voices-seed-5",
    seed: 5,
    definition: DRUM_KIT_DEFINITION,
    events: [
      { type: "midiNoteOn", note: 36, velocity: 110, time: 0 },
      { type: "midiNoteOff", note: 36, velocity: 110, time: 0.04 },
      { type: "midiNoteOn", note: 38, velocity: 100, time: 0.12 },
      { type: "midiNoteOff", note: 38, velocity: 100, time: 0.16 },
      { type: "midiNoteOn", note: 42, velocity: 90, time: 0.24 },
      { type: "midiNoteOff", note: 42, velocity: 90, time: 0.28 },
      { type: "midiNoteOn", note: 46, velocity: 90, time: 0.36 },
      { type: "midiNoteOff", note: 46, velocity: 90, time: 0.4 },
      { type: "midiNoteOn", note: 49, velocity: 95, time: 0.48 },
      { type: "midiNoteOff", note: 49, velocity: 95, time: 0.52 },
      { type: "midiNoteOn", note: 39, velocity: 105, time: 0.6 },
      { type: "midiNoteOff", note: 39, velocity: 105, time: 0.64 },
    ],
  },
];
