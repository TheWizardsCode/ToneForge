/**
 * Instrument definition schema and validation.
 *
 * An instrument definition is ToneGraph-shaped: an oscillator plus an ADSR
 * envelope and an optional filter. Definitions are validated by
 * {@link validateInstrumentDefinition}, which throws an `Error` with an
 * actionable message (naming the offending field and the expected values)
 * for every malformed input.
 *
 * The oscillator is a discriminated union: the four classic waveforms
 * (`sine`/`square`/`sawtooth`/`triangle`, with an optional `detune`) or a
 * seeded noise generator (`type: "noise"` with a `color` and optional
 * integer `seed`). Both feed the same envelope and filter wiring in the
 * engine.
 *
 * An optional per-note `voices` map turns one definition into a multi-timbral
 * instrument (a drum kit, for example): each entry overrides the oscillator,
 * envelope and (optionally) filter for one MIDI note, while notes with no
 * entry are ignored by the engine. A definition without `voices` keeps the
 * original single-voice behaviour byte-for-byte.
 *
 * Three optional voice-level facilities let percussive voices sound like a real
 * kit instead of a single fixed tone:
 *
 * - **`pitch`** sweeps a waveform oscillator's frequency from an initial
 *   offset down to the played note — the fast pitch drop of a kick drum.
 * - **`layers`** mix one or more additional oscillator/envelope/filter
 *   components over the main voice — a click transient on a kick, the noise
 *   body of a snare, or the staggered short bursts of a hand clap. Each layer
 *   is a full voice in miniature (with an optional mix `gain` and `delay`).
 * - **`oneShot`** marks a percussive voice that always plays its full
 *   attack→decay and ignores note-off, so a short MIDI note never truncates
 *   a drum hit. One-shot voices must decay to silence (`sustain: 0`).
 *
 * All three are strictly optional; a definition that uses none of them keeps
 * the original single-voice behaviour byte-for-byte, and every committed
 * golden hash therefore stays unchanged.
 *
 * No Web Audio usage here — this module establishes the data contract that
 * the envelope engine and instrument engine build on.
 */

import { NOISE_COLORS, isNoiseColor, type NoiseColor } from "../audio/noise.js";
import { MIDI_NOTE_MAX, MIDI_NOTE_MIN } from "./instrument.js";

/** Supported oscillator waveforms. */
export type OscillatorWave = "sine" | "square" | "sawtooth" | "triangle";

/** Supported filter types. */
export type FilterType = "lowpass" | "highpass" | "bandpass";

/**
 * The fixed noise seed used when an instrument omits `oscillator.seed`.
 *
 * A fixed default keeps noise output reproducible without requiring every
 * definition to declare a seed.
 */
export const DEFAULT_NOISE_SEED = 42;

/** Smallest accepted noise seed (inclusive). */
export const NOISE_SEED_MIN = 0;

/** Largest accepted noise seed (inclusive): the 32-bit unsigned maximum. */
export const NOISE_SEED_MAX = 0xffffffff;

/** The waveform (pitched) oscillator section of an instrument definition. */
export interface InstrumentWaveOscillator {
  /** Waveform shape. */
  type: OscillatorWave;
  /** Detune in cents (default 0). */
  detune?: number;
}

/** The noise oscillator section of an instrument definition. */
export interface InstrumentNoiseOscillator {
  /** Noise generator discriminant. */
  type: "noise";
  /** Noise colour: white (flat), pink (1/f) or brown (1/f²). */
  color: NoiseColor;
  /** Seeded RNG seed (integer, defaults to {@link DEFAULT_NOISE_SEED}). */
  seed?: number;
}

/** The oscillator section of an instrument definition (discriminated union). */
export type InstrumentOscillator = InstrumentWaveOscillator | InstrumentNoiseOscillator;

/** The ADSR envelope of an instrument definition. */
export interface InstrumentEnvelope {
  /** Attack time in seconds (>= 0). */
  attack: number;
  /** Decay time in seconds (>= 0). */
  decay: number;
  /** Sustain level as a gain in [0, 1]. */
  sustain: number;
  /** Release time in seconds (>= 0). */
  release: number;
}

/** The optional filter section of an instrument definition. */
export interface InstrumentFilter {
  /** Filter response shape. */
  type: FilterType;
  /** Cutoff/resonant frequency in Hz (> 0). */
  frequency: number;
  /** Filter Q factor (> 0, optional). */
  Q?: number;
}

/**
 * An optional pitch sweep applied to a waveform oscillator at note-on.
 *
 * The oscillator starts `fromCents` above the played note and falls
 * exponentially to the note over `time` seconds — the classic kick-drum
 * pitch drop. Noise oscillators have no pitch and reject a sweep.
 */
export interface InstrumentPitchSweep {
  /** Initial offset in cents above the played note (e.g. 1200 = one octave). */
  fromCents: number;
  /** Sweep duration in seconds (> 0). */
  time: number;
}

/**
 * An additional synthesis component mixed over a voice's main oscillator.
 *
 * A layer is a full voice in miniature: its own oscillator, ADSR envelope and
 * optional filter, plus a per-layer mix `gain` and a `delay` after note-on.
 * Layers let a single note combine multiple sound sources deterministically
 * (a kick's click transient, a snare's noise body, a clap's staggered
 * bursts).
 */
export interface InstrumentVoiceLayer {
  /** Oscillator section for this layer. */
  oscillator: InstrumentOscillator;
  /** ADSR envelope section for this layer. */
  envelope: InstrumentEnvelope;
  /** Optional filter section for this layer. */
  filter?: InstrumentFilter;
  /** Mix gain for this layer relative to the main voice (default 1). */
  gain?: number;
  /** Seconds after note-on before this layer starts (default 0). */
  delay?: number;
  /**
   * Play this layer as a one-shot: always run its full attack→decay and
   * ignore note-off. Requires `envelope.sustain: 0` (default false).
   */
  oneShot?: boolean;
  /** Optional pitch sweep for a waveform oscillator layer. */
  pitch?: InstrumentPitchSweep;
}

/**
 * A single per-note voice: the oscillator, envelope and optional filter that
 * replace the definition's top-level sections for one MIDI note, plus the
 * optional `pitch` sweep and `layers` described above.
 */
export interface InstrumentVoice {
  /** Oscillator section for this note. */
  oscillator: InstrumentOscillator;
  /** ADSR envelope section for this note. */
  envelope: InstrumentEnvelope;
  /** Optional filter section for this note. */
  filter?: InstrumentFilter;
  /** Mix gain for the main oscillator relative to the layers (default 1). */
  gain?: number;
  /**
   * Play the main oscillator as a one-shot: always run its full attack→decay
   * and ignore note-off. Requires `envelope.sustain: 0` (default false).
   */
  oneShot?: boolean;
  /**
   * Optional pitch sweep for a waveform oscillator: the voice starts above
   * the note and falls to it exponentially (kick-drum pitch drop).
   */
  pitch?: InstrumentPitchSweep;
  /** Optional extra synthesis components mixed over the main oscillator. */
  layers?: InstrumentVoiceLayer[];
}

/**
 * A per-note voice map: MIDI note number (0–127, integer keys) → voice.
 *
 * Keys are integers at runtime; YAML and JSON inevitably spell them as
 * strings, so validation accepts the canonical integer spelling only and
 * rejects anything else (for example `"kick"`, `"36.5"` or `"128"`).
 */
export type InstrumentVoiceMap = Record<number, InstrumentVoice>;

/**
 * A schema-valid instrument definition: oscillator + ADSR + optional filter.
 */
export interface InstrumentDefinition {
  /** Stable, unique identifier (non-empty). */
  id: string;
  /** Human-readable display name (non-empty). */
  name: string;
  /** Oscillator section. */
  oscillator: InstrumentOscillator;
  /** ADSR envelope section. */
  envelope: InstrumentEnvelope;
  /** Optional filter section. */
  filter?: InstrumentFilter;
  /** Optional family/category label (e.g. "pluck", "pad", "bass"). */
  category?: string;
  /** Mix gain for the main oscillator relative to its layers (default 1). */
  gain?: number;
  /**
   * Play the main oscillator as a one-shot (see {@link InstrumentVoice.oneShot}).
   */
  oneShot?: boolean;
  /**
   * Optional pitch sweep for the single-voice path (see {@link InstrumentVoice.pitch}).
   */
  pitch?: InstrumentPitchSweep;
  /**
   * Optional extra synthesis components for the single-voice path (see
   * {@link InstrumentVoice.layers}). Rejected when `voices` is present — a
   * multi-timbral definition must carry pitch/layers per voice entry.
   */
  layers?: InstrumentVoiceLayer[];
  /**
   * Optional per-note voice overrides, keyed by MIDI note number.
   *
   * When present, the engine voices **only** the mapped notes and ignores the
   * others; when absent, every note uses the top-level sections above.
   */
  voices?: InstrumentVoiceMap;
}

/** Top-level keys accepted by an instrument definition. */
const KNOWN_TOP_LEVEL_KEYS = new Set<string>([
  "id",
  "name",
  "oscillator",
  "envelope",
  "filter",
  "category",
  "gain",
  "oneShot",
  "pitch",
  "layers",
  "voices",
]);

/** Keys accepted by one `voices` entry. */
const VOICE_KEYS = new Set<string>([
  "oscillator",
  "envelope",
  "filter",
  "gain",
  "oneShot",
  "pitch",
  "layers",
]);

/** Keys accepted by one `layers` entry. */
const LAYER_KEYS = new Set<string>([
  "oscillator",
  "envelope",
  "filter",
  "gain",
  "delay",
  "oneShot",
  "pitch",
]);

/** Keys accepted by a `pitch` sweep. */
const PITCH_SWEEP_KEYS = new Set<string>(["fromCents", "time"]);

const OSCILLATOR_WAVES: readonly OscillatorWave[] = ["sine", "square", "sawtooth", "triangle"];
const OSCILLATOR_TYPES: readonly string[] = [...OSCILLATOR_WAVES, "noise"];
const WAVE_OSCILLATOR_KEYS = new Set<string>(["type", "detune"]);
const NOISE_OSCILLATOR_KEYS = new Set<string>(["type", "color", "seed"]);
const FILTER_TYPES: readonly FilterType[] = ["lowpass", "highpass", "bandpass"];

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function assertRecord(value: unknown, path: string): asserts value is Record<string, unknown> {
  if (!isRecord(value)) {
    throw new Error(`${path} must be an object.`);
  }
}

function assertString(value: unknown, path: string): asserts value is string {
  if (typeof value !== "string") {
    throw new Error(`${path} must be a string.`);
  }
}

function assertNonEmptyString(value: unknown, path: string): asserts value is string {
  assertString(value, path);
  if (value.trim().length === 0) {
    throw new Error(`${path} must not be empty.`);
  }
}

function assertFiniteNumber(value: unknown, path: string): asserts value is number {
  if (typeof value !== "number" || !Number.isFinite(value)) {
    throw new Error(`${path} must be a finite number.`);
  }
}

function assertInRange(
  value: unknown,
  path: string,
  min: number,
  max: number,
): asserts value is number {
  assertFiniteNumber(value, path);
  if (value < min || value > max) {
    throw new Error(`${path} must be within ${min}–${max}.`);
  }
}

/** Assert a finite number strictly greater than zero. */
function assertPositive(value: unknown, path: string): asserts value is number {
  assertFiniteNumber(value, path);
  if (value <= 0) {
    throw new Error(`${path} must be greater than 0.`);
  }
}

/** Assert an integer within `[min, max]` (inclusive), naming the range. */
function assertIntegerInRange(
  value: unknown,
  path: string,
  min: number,
  max: number,
): asserts value is number {
  if (typeof value !== "number" || !Number.isInteger(value)) {
    throw new Error(`${path} must be an integer within ${min}–${max} (received ${String(value)}).`);
  }
  if (value < min || value > max) {
    throw new Error(`${path} must be within ${min}–${max} (received ${value}).`);
  }
}

/** Reject any object key outside `allowed`, naming the first offender. */
function assertKnownKeys(
  value: Record<string, unknown>,
  path: string,
  allowed: ReadonlySet<string>,
): void {
  for (const key of Object.keys(value)) {
    if (!allowed.has(key)) {
      throw new Error(`${path} contains an unknown field "${key}".`);
    }
  }
}

function assertOneOf(
  value: unknown,
  path: string,
  allowed: readonly string[],
): asserts value is string {
  assertString(value, path);
  if (!allowed.includes(value)) {
    throw new Error(`${path} must be one of: ${allowed.join(", ")}.`);
  }
}

function validateOscillator(value: unknown, path = "oscillator"): InstrumentOscillator {
  assertRecord(value, path);

  assertOneOf(value.type, `${path}.type`, OSCILLATOR_TYPES);

  if (value.type === "noise") {
    assertKnownKeys(value, path, NOISE_OSCILLATOR_KEYS);

    if (value.color === undefined) {
      throw new Error(`${path}.color is required when oscillator type is "noise".`);
    }
    assertOneOf(value.color, `${path}.color`, NOISE_COLORS);

    let seed: number = DEFAULT_NOISE_SEED;
    if (value.seed !== undefined) {
      assertIntegerInRange(value.seed, `${path}.seed`, NOISE_SEED_MIN, NOISE_SEED_MAX);
      seed = value.seed;
    }

    return { type: "noise", color: value.color as NoiseColor, seed };
  }

  assertKnownKeys(value, path, WAVE_OSCILLATOR_KEYS);

  let detune: number | undefined;
  if (value.detune !== undefined) {
    assertFiniteNumber(value.detune, `${path}.detune`);
    detune = value.detune;
  }

  return { type: value.type as OscillatorWave, detune: detune ?? 0 };
}

function validateEnvelope(value: unknown, path = "envelope"): InstrumentEnvelope {
  assertRecord(value, path);

  // Every stage is required.
  for (const stage of ["attack", "decay", "sustain", "release"] as const) {
    if (value[stage] === undefined) {
      throw new Error(`${path}.${stage} is required.`);
    }
  }

  // attack/decay/release are non-negative seconds; sustain is a gain in [0, 1].
  assertInRange(value.attack, `${path}.attack`, 0, Number.POSITIVE_INFINITY);
  assertInRange(value.decay, `${path}.decay`, 0, Number.POSITIVE_INFINITY);
  assertInRange(value.sustain, `${path}.sustain`, 0, 1);
  assertInRange(value.release, `${path}.release`, 0, Number.POSITIVE_INFINITY);

  return {
    attack: value.attack,
    decay: value.decay,
    sustain: value.sustain,
    release: value.release,
  };
}

function validateFilter(value: unknown, path = "filter"): InstrumentFilter {
  assertRecord(value, path);

  assertOneOf(value.type, `${path}.type`, FILTER_TYPES);
  assertPositive(value.frequency, `${path}.frequency`);

  let q: number | undefined;
  if (value.Q !== undefined) {
    assertFiniteNumber(value.Q, `${path}.Q`);
    q = value.Q;
  }

  return {
    type: value.type as FilterType,
    frequency: value.frequency,
    ...(q !== undefined ? { Q: q } : {}),
  };
}

/**
 * Validate an optional pitch sweep.
 *
 * A sweep on a noise oscillator is rejected: noise has no pitch to sweep, so
 * silently ignoring it would hide an authoring mistake.
 */
function validatePitchSweep(
  value: unknown,
  path: string,
  oscillator: InstrumentOscillator,
): InstrumentPitchSweep {
  assertRecord(value, path);
  assertKnownKeys(value, path, PITCH_SWEEP_KEYS);

  if (oscillator.type === "noise") {
    throw new Error(
      `${path} is not supported on a noise oscillator: noise has no pitch. `
        + "Improve the noise colour or filter instead of sweeping pitch.",
    );
  }

  if (value.fromCents === undefined) {
    throw new Error(`${path}.fromCents is required.`);
  }
  assertFiniteNumber(value.fromCents, `${path}.fromCents`);
  if (value.fromCents <= 0) {
    throw new Error(`${path}.fromCents must be greater than 0 (the sweep falls to the note).`);
  }

  if (value.time === undefined) {
    throw new Error(`${path}.time is required.`);
  }
  assertInRange(value.time, `${path}.time`, 0, Number.POSITIVE_INFINITY);
  if (value.time === 0) {
    throw new Error(`${path}.time must be greater than 0 (a sweep needs a duration).`);
  }

  return { fromCents: value.fromCents, time: value.time };
}

/**
 * Validate an optional `oneShot` flag.
 *
 * A one-shot voice ignores note-off and always runs its full attack→decay, so
 * it must decay to silence: a non-zero sustain would never end. Rejecting the
 * combination keeps a drum hit from sustaining forever by accident.
 */
function validateOneShot(
  value: unknown,
  path: string,
  envelope: InstrumentEnvelope,
): boolean {
  if (typeof value !== "boolean") {
    throw new Error(`${path} must be a boolean.`);
  }
  if (value && envelope.sustain !== 0) {
    throw new Error(
      `${path} requires envelope.sustain to be 0: a one-shot voice ignores note-off, `
        + "so a non-zero sustain would never decay to silence.",
    );
  }
  return value;
}

/**
 * Validate one additional synthesis layer, reusing the voice validators.
 *
 * The `path` names the layer's position (for example `voices[36].layers[0]`)
 * so an error points the author straight at the offending entry.
 */
function validateLayer(value: unknown, path: string): InstrumentVoiceLayer {
  assertRecord(value, path);
  assertKnownKeys(value, path, LAYER_KEYS);

  if (value.oscillator === undefined) {
    throw new Error(`${path}.oscillator is required.`);
  }
  const oscillator = validateOscillator(value.oscillator, `${path}.oscillator`);

  if (value.envelope === undefined) {
    throw new Error(`${path}.envelope is required.`);
  }
  const envelope = validateEnvelope(value.envelope, `${path}.envelope`);

  const filter =
    value.filter === undefined ? undefined : validateFilter(value.filter, `${path}.filter`);

  let gain: number | undefined;
  if (value.gain !== undefined) {
    assertInRange(value.gain, `${path}.gain`, 0, Number.POSITIVE_INFINITY);
    gain = value.gain;
  }

  let delay: number | undefined;
  if (value.delay !== undefined) {
    assertInRange(value.delay, `${path}.delay`, 0, Number.POSITIVE_INFINITY);
    delay = value.delay;
  }

  let oneShot: boolean | undefined;
  if (value.oneShot !== undefined) {
    oneShot = validateOneShot(value.oneShot, `${path}.oneShot`, envelope);
  }

  const pitch =
    value.pitch === undefined
      ? undefined
      : validatePitchSweep(value.pitch, `${path}.pitch`, oscillator);

  return {
    oscillator,
    envelope,
    ...(filter !== undefined ? { filter } : {}),
    ...(gain !== undefined ? { gain } : {}),
    ...(delay !== undefined ? { delay } : {}),
    ...(oneShot !== undefined ? { oneShot } : {}),
    ...(pitch !== undefined ? { pitch } : {}),
  };
}

/**
 * Validate an optional `layers` array, naming each layer position in errors.
 */
function validateLayers(value: unknown, path = "layers"): InstrumentVoiceLayer[] {
  if (!Array.isArray(value)) {
    throw new Error(`${path} must be an array of voice layers.`);
  }
  return value.map((layer, index) => validateLayer(layer, `${path}[${index}]`));
}

/**
 * Validate one `voices` entry, reusing the top-level section validators.
 *
 * The `path` names the note (for example `voices[36]`) so an error points the
 * author straight at the offending entry.
 */
function validateVoice(value: unknown, path: string): InstrumentVoice {
  assertRecord(value, path);
  assertKnownKeys(value, path, VOICE_KEYS);

  if (value.oscillator === undefined) {
    throw new Error(`${path}.oscillator is required.`);
  }
  const oscillator = validateOscillator(value.oscillator, `${path}.oscillator`);

  if (value.envelope === undefined) {
    throw new Error(`${path}.envelope is required.`);
  }
  const envelope = validateEnvelope(value.envelope, `${path}.envelope`);

  const filter =
    value.filter === undefined ? undefined : validateFilter(value.filter, `${path}.filter`);

  let gain: number | undefined;
  if (value.gain !== undefined) {
    assertInRange(value.gain, `${path}.gain`, 0, Number.POSITIVE_INFINITY);
    gain = value.gain;
  }

  let oneShot: boolean | undefined;
  if (value.oneShot !== undefined) {
    oneShot = validateOneShot(value.oneShot, `${path}.oneShot`, envelope);
  }

  const pitch =
    value.pitch === undefined
      ? undefined
      : validatePitchSweep(value.pitch, `${path}.pitch`, oscillator);

  const layers =
    value.layers === undefined
      ? undefined
      : validateLayers(value.layers, `${path}.layers`);

  return {
    oscillator,
    envelope,
    ...(filter !== undefined ? { filter } : {}),
    ...(gain !== undefined ? { gain } : {}),
    ...(oneShot !== undefined ? { oneShot } : {}),
    ...(pitch !== undefined ? { pitch } : {}),
    ...(layers !== undefined ? { layers } : {}),
  };
}

/**
 * Validate the optional per-note `voices` map.
 *
 * Keys must be canonical integer MIDI note numbers (0–127); every value must
 * validate as a voice override. Errors are actionable UK-English messages
 * naming the offending note and field.
 */
function validateVoices(value: unknown): InstrumentVoiceMap {
  const path = "voices";
  assertRecord(value, path);

  const voices: InstrumentVoiceMap = {};
  for (const [key, entry] of Object.entries(value)) {
    const note = Number(key);
    // Accept the canonical integer spelling only, so "36" is valid while
    // "036", "+36", " 36", "36.5" and "kick" are rejected loudly.
    if (!Number.isInteger(note) || String(note) !== key) {
      throw new Error(
        `${path} contains an invalid MIDI note key "${key}". `
          + "Keys must be canonical integer MIDI note numbers (0–127).",
      );
    }
    if (note < MIDI_NOTE_MIN || note > MIDI_NOTE_MAX) {
      throw new Error(
        `${path} key "${key}" must be within ${MIDI_NOTE_MIN}–${MIDI_NOTE_MAX}.`,
      );
    }
    voices[note] = validateVoice(entry, `${path}[${key}]`);
  }
  return voices;
}

/**
 * Validate an instrument definition and return the validated value.
 *
 * Throws an `Error` with an actionable message — naming the offending field
 * and the accepted values — on any malformed input: unknown top-level keys,
 * missing required fields, wrong types and out-of-range numeric values.
 *
 * @param value - The candidate instrument definition.
 * @returns The validated definition.
 * @throws {Error} On any validation failure.
 */
export function validateInstrumentDefinition(value: unknown): InstrumentDefinition {
  assertRecord(value, "Instrument definition");

  // Reject unknown top-level keys up front so typos are caught loudly.
  for (const key of Object.keys(value)) {
    if (!KNOWN_TOP_LEVEL_KEYS.has(key)) {
      throw new Error(`Instrument definition contains an unknown field "${key}".`);
    }
  }

  if (value.id === undefined) {
    throw new Error(`id is required.`);
  }
  assertNonEmptyString(value.id, "id");

  if (value.name === undefined) {
    throw new Error(`name is required.`);
  }
  assertNonEmptyString(value.name, "name");

  if (value.oscillator === undefined) {
    throw new Error(`oscillator is required.`);
  }
  const oscillator = validateOscillator(value.oscillator);

  if (value.envelope === undefined) {
    throw new Error(`envelope is required.`);
  }
  const envelope = validateEnvelope(value.envelope);

  const filter = value.filter === undefined ? undefined : validateFilter(value.filter);

  let category: string | undefined;
  if (value.category !== undefined) {
    assertNonEmptyString(value.category, "category");
    category = value.category;
  }

  let gain: number | undefined;
  if (value.gain !== undefined) {
    assertInRange(value.gain, "gain", 0, Number.POSITIVE_INFINITY);
    gain = value.gain;
  }

  let oneShot: boolean | undefined;
  if (value.oneShot !== undefined) {
    oneShot = validateOneShot(value.oneShot, "oneShot", envelope);
  }

  const voices = value.voices === undefined ? undefined : validateVoices(value.voices);

  const pitch =
    value.pitch === undefined
      ? undefined
      : validatePitchSweep(value.pitch, "pitch", oscillator);

  const layers =
    value.layers === undefined ? undefined : validateLayers(value.layers, "layers");

  // Pitch/gain/oneShot/layers are single-voice facilities: a multi-timbral
  // definition must declare them per voice entry, so a top-level sweep is
  // never silently ignored for every mapped note.
  if (
    voices !== undefined
    && (pitch !== undefined || layers !== undefined || gain !== undefined || oneShot !== undefined)
  ) {
    throw new Error(
      "pitch, gain, oneShot and layers must be declared inside each voices entry, not at the top "
        + "level when a voices map is present.",
    );
  }

  return {
    id: value.id,
    name: value.name,
    oscillator,
    envelope,
    ...(filter !== undefined ? { filter } : {}),
    ...(category !== undefined ? { category } : {}),
    ...(gain !== undefined ? { gain } : {}),
    ...(oneShot !== undefined ? { oneShot } : {}),
    ...(pitch !== undefined ? { pitch } : {}),
    ...(layers !== undefined ? { layers } : {}),
    ...(voices !== undefined ? { voices } : {}),
  };
}

/**
 * Resolve the voice definition the engine should use for one MIDI note.
 *
 * - A definition **without** a `voices` map has one voice: the definition
 *   itself is returned unchanged (so the single-voice path stays identical).
 * - A definition **with** a `voices` map is multi-timbral: the mapped entry is
 *   returned as a definition-shaped object (inheriting `id`, `name` and
 *   `category` so callers keep a complete definition), or `null` when the note
 *   has no entry — an unmapped note is ignored, never voiced.
 *
 * The returned definition is a new object when a voice entry is resolved, so
 * callers can pass it to the oscillator/envelope/filter builders without
 * mutating the source definition.
 *
 * @param definition - A schema-valid instrument definition.
 * @param note - MIDI note number (0–127).
 * @returns The definition to voice the note, or `null` when it is unmapped.
 */
export function definitionForNote(
  definition: InstrumentDefinition,
  note: number,
): InstrumentDefinition | null {
  if (definition.voices === undefined) {
    return definition;
  }
  const voice = definition.voices[note];
  if (voice === undefined) {
    return null;
  }
  return {
    id: definition.id,
    name: definition.name,
    oscillator: voice.oscillator,
    envelope: voice.envelope,
    ...(voice.filter !== undefined ? { filter: voice.filter } : {}),
    ...(voice.gain !== undefined ? { gain: voice.gain } : {}),
    ...(voice.oneShot !== undefined ? { oneShot: voice.oneShot } : {}),
    ...(voice.pitch !== undefined ? { pitch: voice.pitch } : {}),
    ...(voice.layers !== undefined ? { layers: voice.layers } : {}),
    ...(definition.category !== undefined ? { category: definition.category } : {}),
  };
}
