/**
 * Six-voice drum kit — a single instrument that dispatches by MIDI note.
 *
 * The kit follows the General MIDI percussion map for its six core voices,
 * so GM drum patterns render like a real kit instead of one tuned sine:
 *
 * | Note | GM drum      | Voice                          |
 * | ---- | ------------ | ------------------------------ |
 * | 36   | Kick drum 1  | pitched pitch-drop body + click|
 * | 38   | Acoustic snare| pitched body + noise           |
 * | 39   | Hand clap    | staggered noise bursts + tail  |
 * | 42   | Closed hi-hat| filtered noise, short decay    |
 * | 46   | Open hi-hat  | filtered noise, longer decay   |
 * | 49   | Crash cymbal 1| bright filtered noise, longest decay |
 *
 * Every voice is a schema-valid definition override: the schema's `pitch`
 * sweep gives the kick its falling body, and its `layers` combine the
 * different sound sources (kick click, snare noise, clap bursts). All noise
 * comes from the shared seeded generator with per-voice seeds, so a kit hit
 * renders byte-identically for a given note and definition — no clocks, no
 * `Math.random`.
 *
 * The definition here is the single source of truth for the kit's synthesis;
 * `presets/instruments/drum-kit.yaml` mirrors it for the preset loader, and
 * `drum-kit.test.ts` asserts the two stay in lockstep.
 */

import type {
  InstrumentDefinition,
  InstrumentVoice,
  InstrumentVoiceMap,
} from "./schema.js";

/** The six kit voices' GM note numbers. */
export const DRUM_KIT_NOTES: readonly number[] = [36, 38, 42, 46, 49, 39] as const;

/** Named GM notes the kit voices, keyed for readability in code and tests. */
export const DRUM_KIT_NOTE_MAP = {
  kick: 36,
  snare: 38,
  clap: 39,
  closedHat: 42,
  openHat: 46,
  crash: 49,
} as const;

/** The kit's registered preset id. */
export const DRUM_KIT_PRESET_ID = "drum-kit";

/**
 * Kick (GM 36): a pitched body with a fast pitch drop plus a short click.
 *
 * The body is a sine swept down two octaves in 45 ms (the classic kick
 * "thump") and decayed to silence through a low-pass filter, so the
 * fundamental dominates the tail. A short, high-passed noise layer adds the
 * beater click at the very onset — synthesised separately from the body
 * (with its own seed) so the transient stays crisp and deterministic.
 */
const KICK: InstrumentVoice = {
  oscillator: { type: "sine" },
  envelope: { attack: 0.001, decay: 0.3, sustain: 0, release: 0.06 },
  filter: { type: "lowpass", frequency: 180, Q: 0.7 },
  oneShot: true,
  // The body starts two octaves above the note and falls to ~65 Hz in 45 ms.
  pitch: { fromCents: 2400, time: 0.045 },
  layers: [
    {
      oscillator: { type: "noise", color: "white", seed: 101 },
      envelope: { attack: 0.0005, decay: 0.006, sustain: 0, release: 0.004 },
      filter: { type: "highpass", frequency: 2500 },
      gain: 0.35,
      oneShot: true,
    },
  ],
};

/**
 * Snare (GM 38): a pitched body plus noise.
 *
 * The body is a triangle tone pitched ~3 octaves above the note (detune
 * +1900 cents ≈ 220 Hz — a typical snare shell ring) with a fast decay,
 * low-pass rounded so it reads as a body rather than a tone. Over it, a
 * white-noise layer high-passed at 1.8 kHz supplies the rattling "crack".
 * Distinct from the clap: the clap is band-passed around 1 kHz with several
 * staggered bursts, while the snare has both a low body and a continuous
 * bright noise tail.
 */
const SNARE: InstrumentVoice = {
  oscillator: { type: "triangle", detune: 1900 },
  envelope: { attack: 0.001, decay: 0.1, sustain: 0, release: 0.03 },
  filter: { type: "lowpass", frequency: 600, Q: 0.6 },
  oneShot: true,
  layers: [
    {
      oscillator: { type: "noise", color: "white", seed: 202 },
      envelope: { attack: 0.001, decay: 0.14, sustain: 0, release: 0.02 },
      filter: { type: "highpass", frequency: 1800 },
      gain: 0.9,
      oneShot: true,
    },
  ],
};

/**
 * Closed hi-hat (GM 42): short, bright filtered noise.
 *
 * White noise high-passed at 7 kHz with a very fast decay — the classic
 * "tick". Compared with the open hat it shares the bright band but dies away
 * in ~45 ms instead of ringing.
 */
const CLOSED_HAT: InstrumentVoice = {
  oscillator: { type: "noise", color: "white", seed: 303 },
  envelope: { attack: 0.0005, decay: 0.045, sustain: 0, release: 0.01 },
  filter: { type: "highpass", frequency: 7000, Q: 0.7 },
  oneShot: true,
};

/**
 * Open hi-hat (GM 46): filtered noise with a longer decay.
 *
 * The same bright white-noise recipe as the closed hat but with a much longer
 * decay (~0.32 s), so the cymbal rings after the stroke instead of ticking.
 * Its own seed guarantees the render differs from the closed hat even before
 * the envelopes diverge.
 */
const OPEN_HAT: InstrumentVoice = {
  oscillator: { type: "noise", color: "white", seed: 404 },
  envelope: { attack: 0.001, decay: 0.32, sustain: 0, release: 0.03 },
  filter: { type: "highpass", frequency: 6500, Q: 0.7 },
  oneShot: true,
};

/**
 * Crash cymbal (GM 49): bright filtered noise with the longest decay.
 *
 * Two layers of bright noise (white high-passed at 4.5 kHz plus a softer pink
 * wash at 8 kHz) decay over more than a second — longer than any other kit
 * voice. Layer gains stay below unity so the summed crash does not clip.
 */
const CRASH: InstrumentVoice = {
  oscillator: { type: "noise", color: "white", seed: 505 },
  envelope: { attack: 0.002, decay: 1.1, sustain: 0, release: 0.1 },
  filter: { type: "highpass", frequency: 4500, Q: 0.7 },
  oneShot: true,
  layers: [
    {
      oscillator: { type: "noise", color: "pink", seed: 506 },
      envelope: { attack: 0.002, decay: 0.9, sustain: 0, release: 0.1 },
      filter: { type: "highpass", frequency: 8000 },
      gain: 0.4,
      oneShot: true,
    },
  ],
};

/**
 * Hand clap (GM 39): a noise burst envelope with several short bursts.
 *
 * A quiet band-passed noise tail (~1.1 kHz, 0.22 s) supplies the room
 * ambience, while four short band-passed bursts — staggered 0, 10, 20 and
 * 32 ms apart — supply the flam of a real hand clap. Each burst has its own
 * seed and a crisp 5 ms decay, so the structure is deterministic and
 * measurably distinct from the snare (one continuous noise tail plus a low
 * body). The low tail gain keeps the summed voice inside [-1, 1].
 */
const CLAP: InstrumentVoice = {
  oscillator: { type: "noise", color: "white", seed: 606 },
  envelope: { attack: 0.001, decay: 0.22, sustain: 0, release: 0.05 },
  filter: { type: "bandpass", frequency: 1100, Q: 0.9 },
  gain: 0.3,
  oneShot: true,
  layers: [
    {
      oscillator: { type: "noise", color: "white", seed: 607 },
      envelope: { attack: 0.0005, decay: 0.005, sustain: 0, release: 0.004 },
      filter: { type: "bandpass", frequency: 1200, Q: 1.2 },
      gain: 0.7,
      oneShot: true,
      delay: 0,
    },
    {
      oscillator: { type: "noise", color: "white", seed: 608 },
      envelope: { attack: 0.0005, decay: 0.005, sustain: 0, release: 0.004 },
      filter: { type: "bandpass", frequency: 1300, Q: 1.2 },
      gain: 0.7,
      oneShot: true,
      delay: 0.01,
    },
    {
      oscillator: { type: "noise", color: "white", seed: 609 },
      envelope: { attack: 0.0005, decay: 0.005, sustain: 0, release: 0.004 },
      filter: { type: "bandpass", frequency: 1400, Q: 1.2 },
      gain: 0.7,
      oneShot: true,
      delay: 0.02,
    },
    {
      oscillator: { type: "noise", color: "white", seed: 610 },
      envelope: { attack: 0.0005, decay: 0.005, sustain: 0, release: 0.004 },
      filter: { type: "bandpass", frequency: 1200, Q: 1.2 },
      gain: 0.7,
      oneShot: true,
      delay: 0.032,
    },
  ],
};

/** The six kit voices keyed by GM note number. */
export const DRUM_KIT_VOICES: InstrumentVoiceMap = {
  [DRUM_KIT_NOTE_MAP.kick]: KICK,
  [DRUM_KIT_NOTE_MAP.snare]: SNARE,
  [DRUM_KIT_NOTE_MAP.closedHat]: CLOSED_HAT,
  [DRUM_KIT_NOTE_MAP.openHat]: OPEN_HAT,
  [DRUM_KIT_NOTE_MAP.crash]: CRASH,
  [DRUM_KIT_NOTE_MAP.clap]: CLAP,
};

/**
 * The kit as a schema-valid instrument definition.
 *
 * The top-level oscillator/envelope are never used: every note in the kit's
 * GM map is voiced by its `voices` entry, and every other note is ignored
 * deterministically (rendering a melodic MIDI file through the kit yields
 * silence for non-kit notes — useful for auditioning the drum track alone).
 *
 * Retrigger and polyphony follow the engine's existing voice rules: a Note On
 * for a kit note that is still sounding replaces that note's own voice (never
 * a second voice for the same note), and simultaneous different kit notes are
 * independent voices up to the voice limit. Each voice is a one-shot, so a
 * short MIDI note-off never truncates a hit.
 *
 * Registering: load `presets/instruments/drum-kit.yaml` via
 * {@link loadBundledInstrumentPresets} (Node), or register this definition
 * directly with {@link registerInstrumentPreset}.
 */
export const DRUM_KIT_DEFINITION: InstrumentDefinition = {
  id: DRUM_KIT_PRESET_ID,
  name: "Drum Kit",
  category: "Drums",
  oscillator: { type: "sine" },
  envelope: { attack: 0.001, decay: 0.1, sustain: 0, release: 0.05 },
  voices: DRUM_KIT_VOICES,
};
