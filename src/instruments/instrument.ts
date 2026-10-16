/**
 * Instrument contracts: the note API surface, the structured MIDI message
 * types and the note→frequency / velocity→gain mappings.
 *
 * This module is intentionally free of Web Audio and engine wiring: it
 * establishes the pure, deterministic contract that the envelope engine,
 * voice manager and instrument engine build on (parent epic
 * TF-0MV9PIBNV008C00R, child TF-0MV9WXLN10014OT3).
 */

// ── Constants ─────────────────────────────────────────────────────

/** Concert A4 frequency in Hz (the tuning reference). */
export const A4_FREQUENCY = 440;

/** MIDI note number of concert A4. */
export const A4_MIDI_NOTE = 69;

/** Lowest valid MIDI note number. */
export const MIDI_NOTE_MIN = 0;

/** Highest valid MIDI note number. */
export const MIDI_NOTE_MAX = 127;

/** Lowest valid MIDI velocity. */
export const MIDI_VELOCITY_MIN = 0;

/** Highest valid MIDI velocity. */
export const MIDI_VELOCITY_MAX = 127;

// ── Pitch / loudness mapping ──────────────────────────────────────

/**
 * Map a MIDI note number to its equal-tempered frequency in Hz.
 *
 * Formula: `A4_FREQUENCY * 2^((note - A4_MIDI_NOTE) / 12)` — concert A4
 * (note 69) is 440 Hz and each semitone is a factor of 2^(1/12). Note 60
 * (middle C) therefore maps to ~261.6256 Hz and an octave leap doubles the
 * frequency.
 *
 * The formula is total: it accepts any finite note number, which keeps it
 * useful as a pure reference mapper. Callers that need strict MIDI range
 * enforcement use {@link midiNoteOn} / {@link midiNoteOff}.
 *
 * @param note - MIDI note number (0–127; the formula accepts any finite value).
 * @returns The frequency in Hz.
 */
export function midiNoteToFrequency(note: number): number {
  return A4_FREQUENCY * 2 ** ((note - A4_MIDI_NOTE) / 12);
}

/**
 * Map a MIDI velocity (0–127) to a linear loudness in [0, 1].
 *
 * Velocity 127 maps to unity gain (1.0) and velocity 0 to silence; the
 * mapping is a pure linear `velocity / 127` — strictly monotonic and
 * deterministic. Out-of-range velocities are **clamped** to [0, 127] before
 * the division, so any input (including NaN and ±Infinity) yields a value
 * inside [0, 1] and never a NaN.
 *
 * @param velocity - MIDI velocity (0–127; out-of-range values are clamped).
 * @returns A linear gain in [0, 1].
 */
export function velocityToGain(velocity: number): number {
  const clamped = Math.min(MIDI_VELOCITY_MAX, Math.max(MIDI_VELOCITY_MIN, velocity));
  if (Number.isNaN(clamped)) {
    return 0;
  }
  return clamped / MIDI_VELOCITY_MAX;
}

// ── Structured MIDI messages ──────────────────────────────────────

/**
 * A structured MIDI Note On message.
 *
 * `note` and `velocity` are validated to the MIDI range (0–127); `time` is
 * a non-negative audio-context time in seconds (0 = "as soon as possible").
 */
export interface MidiNoteOnMessage {
  readonly type: "midiNoteOn";
  /** MIDI note number (0–127). */
  readonly note: number;
  /** MIDI velocity (0–127). */
  readonly velocity: number;
  /** Note-on time in seconds (default 0). */
  readonly time: number;
}

/**
 * A structured MIDI Note Off message.
 *
 * `note` is validated to the MIDI range (0–127); `velocity` is the release
 * velocity (default 0) and `time` a non-negative audio-context time.
 */
export interface MidiNoteOffMessage {
  readonly type: "midiNoteOff";
  /** MIDI note number (0–127). */
  readonly note: number;
  /** Release velocity (0–127, default 0). */
  readonly velocity: number;
  /** Note-off time in seconds (default 0). */
  readonly time: number;
}

function assertMidiNote(note: number, message: string): void {
  if (!Number.isFinite(note) || note < MIDI_NOTE_MIN || note > MIDI_NOTE_MAX) {
    throw new RangeError(
      `${message}: note ${note} out of range ${MIDI_NOTE_MIN}–${MIDI_NOTE_MAX}.`,
    );
  }
}

function assertMessageTime(time: number): void {
  if (!Number.isFinite(time) || time < 0) {
    throw new RangeError(`time ${time} must be a non-negative number of seconds.`);
  }
}

/**
 * Build a structured MIDI Note On message.
 *
 * @param note - MIDI note number (0–127).
 * @param velocity - MIDI velocity (0–127, default 100).
 * @param time - None-on time in seconds (default 0).
 * @returns The message.
 * @throws {RangeError} If note is outside 0–127 or time is negative.
 */
export function midiNoteOn(
  note: number,
  velocity: number = 100,
  time: number = 0,
): MidiNoteOnMessage {
  assertMidiNote(note, "midiNoteOn");
  if (!Number.isFinite(velocity) || velocity < MIDI_VELOCITY_MIN || velocity > MIDI_VELOCITY_MAX) {
    throw new RangeError(
      `midiNoteOn: velocity ${velocity} out of range ${MIDI_VELOCITY_MIN}–${MIDI_VELOCITY_MAX}.`,
    );
  }
  assertMessageTime(time);
  return { type: "midiNoteOn", note, velocity, time };
}

/**
 * Build a structured MIDI Note Off message.
 *
 * @param note - MIDI note number (0–127).
 * @param velocity - Release velocity (0–127, default 0).
 * @param time - None-off time in seconds (default 0).
 * @returns The message.
 * @throws {RangeError} If note is outside 0–127 or time is negative.
 */
export function midiNoteOff(
  note: number,
  velocity: number = 0,
  time: number = 0,
): MidiNoteOffMessage {
  assertMidiNote(note, "midiNoteOff");
  if (!Number.isFinite(velocity) || velocity < MIDI_VELOCITY_MIN || velocity > MIDI_VELOCITY_MAX) {
    throw new RangeError(
      `midiNoteOff: velocity ${velocity} out of range ${MIDI_VELOCITY_MIN}–${MIDI_VELOCITY_MAX}.`,
    );
  }
  assertMessageTime(time);
  return { type: "midiNoteOff", note, velocity, time };
}

// ── Instrument interface ──────────────────────────────────────────

/**
 * A playable instrument backed by a schema-validated definition
 * (see {@link validateInstrumentDefinition} in `schema.ts`).
 *
 * Implementations own their audio graph and voice lifecycle: `noteOn`
 * starts a voice for the note at the given velocity (with optional time
 * scheduling), `noteOff` releases it. The engine that realises this
 * interface is implemented in a later child of the parent epic
 * (TF-0MV9PIBV008C00R).
 */
export interface Instrument {
  /** Stable identifier matching the instrument definition's `id`. */
  readonly id: string;
  /**
   * Start a note.
   *
   * @param midiNote - MIDI note number (0–127).
   * @param velocity - MIDI velocity (0–127).
   * @param time - Optional audio-context time in seconds (0 = now).
   */
  noteOn(midiNote: number, velocity: number, time?: number): void;
  /**
   * Release a note.
   *
   * @param midiNote - MIDI note number (0–127).
   * @param time - Optional audio-context time in seconds (0 = now).
   */
  noteOff(midiNote: number, time?: number): void;
}
