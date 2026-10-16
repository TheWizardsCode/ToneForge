/**
 * Instrument definition schema and validation.
 *
 * An instrument definition is ToneGraph-shaped: an oscillator plus an ADSR
 * envelope and an optional filter. Definitions are validated by
 * {@link validateInstrumentDefinition}, which throws an `Error` with an
 * actionable message (naming the offending field and the expected values)
 * for every malformed input.
 *
 * No Web Audio usage here — this module establishes the data contract that
 * the envelope engine and instrument engine build on.
 */

/** Supported oscillator waveforms. */
export type OscillatorWave = "sine" | "square" | "sawtooth" | "triangle";

/** Supported filter types. */
export type FilterType = "lowpass" | "highpass" | "bandpass";

/** The oscillator section of an instrument definition. */
export interface InstrumentOscillator {
  /** Waveform shape. */
  type: OscillatorWave;
  /** Detune in cents (default 0). */
  detune?: number;
}

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
}

/** Top-level keys accepted by an instrument definition. */
const KNOWN_TOP_LEVEL_KEYS = new Set<string>([
  "id",
  "name",
  "oscillator",
  "envelope",
  "filter",
]);

const OSCILLATOR_WAVES: readonly OscillatorWave[] = ["sine", "square", "sawtooth", "triangle"];
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

function validateOscillator(value: unknown): InstrumentOscillator {
  const path = "oscillator";
  assertRecord(value, path);

  assertOneOf(value.type, `${path}.type`, OSCILLATOR_WAVES);

  let detune: number | undefined;
  if (value.detune !== undefined) {
    assertFiniteNumber(value.detune, `${path}.detune`);
    detune = value.detune;
  }

  return { type: value.type as OscillatorWave, detune: detune ?? 0 };
}

function validateEnvelope(value: unknown): InstrumentEnvelope {
  const path = "envelope";
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

function validateFilter(value: unknown): InstrumentFilter {
  const path = "filter";
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

  return {
    id: value.id,
    name: value.name,
    oscillator,
    envelope,
    ...(filter !== undefined ? { filter } : {}),
  };
}
