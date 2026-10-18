/**
 * Standard MIDI File (`.mid`) writing layer.
 *
 * The inverse of `src/midi/smf.ts`: builds a validated, deterministic
 * `SmfDocument` in memory and serialises it to SMF bytes through the
 * `midi-file` `writeMidi` writer. The writer is deliberately a thin,
 * type-safe envelope around the library — it validates every field (channel
 * 0–15, note/program 0–127, non-negative integer deltas, ...), appends the
 * mandatory end-of-track meta event, and pins the serialisation options so
 * the **same document always produces the same bytes** (`running` status
 * compression off, 0x80 note-offs) — the determinism contract the
 * engine-neutral parser already guarantees for the read side.
 *
 * The `midi-file` import boundary, documented in `src/midi/smf.ts`, extends
 * to this module: the writer is the only other production file that touches
 * the library directly.
 *
 * Work item: TF-0MVDQP78X007OZNA.
 */

import { writeMidi, type MidiData, type MidiEvent } from "midi-file";

/** Default PPQ division for ToneForge-authored files (ticks per quarter note). */
export const DEFAULT_PPQ_TICKS_PER_BEAT = 480;

/** SMF format value: 0 (single track) or 1 (simultaneous tracks). */
export type SmfFormat = 0 | 1 | 2;

// ── Event descriptors ─────────────────────────────────────────────

export interface NoteOnEvent {
  readonly type: "noteOn";
  /** Delta time in ticks since the previous event in the track (>= 0). */
  readonly deltaTime: number;
  /** MIDI channel (0–15). */
  readonly channel: number;
  /** MIDI note number (0–127). */
  readonly noteNumber: number;
  /** Key velocity (0–127). */
  readonly velocity: number;
}

export interface NoteOffEvent {
  readonly type: "noteOff";
  readonly deltaTime: number;
  /** MIDI channel (0–15). */
  readonly channel: number;
  /** MIDI note number (0–127). */
  readonly noteNumber: number;
  /** Release velocity (0–127; conventionally 0). */
  readonly velocity: number;
}

export interface ProgramChangeEvent {
  readonly type: "programChange";
  readonly deltaTime: number;
  /** MIDI channel (0–15). */
  readonly channel: number;
  /** GM program number (0–127). */
  readonly programNumber: number;
}

export interface ControllerEvent {
  readonly type: "controller";
  readonly deltaTime: number;
  /** MIDI channel (0–15). */
  readonly channel: number;
  /** Controller number (0–127), e.g. 7 = channel volume, 64 = sustain. */
  readonly controllerType: number;
  /** Controller value (0–127). */
  readonly value: number;
}

export interface SetTempoEvent {
  readonly type: "setTempo";
  readonly deltaTime: number;
  /** Microseconds per quarter note (e.g. 500 000 = 120 BPM). */
  readonly microsecondsPerBeat: number;
}

export interface TimeSignatureEvent {
  readonly type: "timeSignature";
  readonly deltaTime: number;
  /** Numerator (beats per bar, 1–255). */
  readonly numerator: number;
  /** Denominator — a power of two (4/4 is expressed as a literal 4). */
  readonly denominator: number;
  /** MIDI clock clicks per metronome click (default 24). */
  readonly metronome?: number;
  /** 1/32 notes per MIDI quarter (default 8). */
  readonly thirtyseconds?: number;
}

export interface TrackNameEvent {
  readonly type: "trackName";
  readonly deltaTime: number;
  /** Track name text. */
  readonly text: string;
}

export interface EndOfTrackEvent {
  readonly type: "endOfTrack";
  readonly deltaTime: number;
}

/** Any event the writer can serialise. */
export type SmfWriterEvent =
  | NoteOnEvent
  | NoteOffEvent
  | ProgramChangeEvent
  | ControllerEvent
  | SetTempoEvent
  | TimeSignatureEvent
  | TrackNameEvent
  | EndOfTrackEvent;

/** A complete Standard MIDI File document, ready to serialise. */
export interface SmfDocument {
  /** SMF format (default 1 — simultaneous tracks). */
  readonly format?: SmfFormat;
  /** Ticks per quarter note, PPQ division (default {@link DEFAULT_PPQ_TICKS_PER_BEAT}). */
  readonly ticksPerBeat?: number;
  /** One delta-timed event list per track, in file order. */
  readonly tracks: ReadonlyArray<ReadonlyArray<SmfWriterEvent>>;
}

/** Serialisation options (pinned to deterministic defaults). */
export interface WriteSmfOptions {
  /**
   * Running-status compression (default `false`). Off by default so the
   * output never depends on the preceding event's status byte — identical
   * input always yields identical bytes.
   */
  readonly running?: boolean;
  /**
   * Emit note-offs as Note On with velocity 0 (default `false`: real
   * 0x80 note-offs are written).
   */
  readonly useByte9ForNoteOff?: boolean;
}

// ── Validation helpers ────────────────────────────────────────────

function fail(message: string): never {
  throw new RangeError(message);
}

function assertTrackList(tracks: unknown): asserts tracks is ReadonlyArray<ReadonlyArray<SmfWriterEvent>> {
  if (!Array.isArray(tracks) || tracks.length === 0) {
    const count =
      tracks !== null && typeof tracks === "object" && "length" in tracks
        ? `${(tracks as { length: unknown }).length} tracks`
        : tracks === undefined
          ? "undefined"
          : String(tracks);
    fail(`writeSmfBytes: an SMF document must contain at least one track (got ${count}).`);
  }
}

function assertNonNegativeDelta(delta: number): void {
  if (!Number.isInteger(delta) || delta < 0) {
    fail(`writeSmfBytes: event deltaTime must be a non-negative integer, got ${delta}.`);
  }
}

function assertChannel(channel: number): void {
  if (!Number.isInteger(channel) || channel < 0 || channel > 15) {
    fail(`writeSmfBytes: MIDI channel must be an integer in 0–15, got ${channel}.`);
  }
}

function assertByte(value: number, label: string): void {
  if (!Number.isInteger(value) || value < 0 || value > 127) {
    fail(`writeSmfBytes: ${label} must be an integer in 0–127, got ${value}.`);
  }
}

/** Validate a document and normalise it to the exact shape `writeMidi` needs. */
function toMidiData(document: SmfDocument): MidiData {
  if (typeof document !== "object" || document === null) {
    fail("writeSmfBytes: expected an SmfDocument object.");
  }

  const format = document.format === undefined ? 1 : document.format;
  if (format !== 0 && format !== 1 && format !== 2) {
    fail(`writeSmfBytes: format must be 0, 1 or 2, got ${format}.`);
  }

  const ticksPerBeat =
    document.ticksPerBeat === undefined
      ? DEFAULT_PPQ_TICKS_PER_BEAT
      : document.ticksPerBeat;
  if (!Number.isInteger(ticksPerBeat) || ticksPerBeat <= 0 || ticksPerBeat > 0x7fff) {
    fail(`writeSmfBytes: ticksPerBeat must be a positive integer ≤ 32767, got ${ticksPerBeat}.`);
  }

  assertTrackList(document.tracks);

  const tracks: MidiEvent[][] = document.tracks.map((track, trackIndex) => {
    const events: MidiEvent[] = [];
    for (const event of track) {
      if (typeof event !== "object" || event === null || typeof event.type !== "string") {
        fail(`writeSmfBytes: track ${trackIndex} contains an invalid event.`);
      }
      assertNonNegativeDelta(event.deltaTime);
      events.push(validateEvent(event, trackIndex));
    }
    // The SMF spec requires every track to end with end-of-track (FF 2F 00).
    if (events.length === 0 || events[events.length - 1]!.type !== "endOfTrack") {
      events.push({ type: "endOfTrack", deltaTime: 0 });
    }
    return events;
  });

  return { header: { format, numTracks: tracks.length, ticksPerBeat }, tracks };
}

/** Validate one event against the `midi-file` writer's field contract. */
function validateEvent(event: SmfWriterEvent, trackIndex: number): MidiEvent {
  const where = `writeSmfBytes: track ${trackIndex} `;
  switch (event.type) {
    case "noteOn":
    case "noteOff": {
      assertChannel(event.channel);
      assertByte(event.noteNumber, "noteNumber");
      assertByte(event.velocity, "velocity");
      return {
        type: event.type,
        deltaTime: event.deltaTime,
        channel: event.channel,
        noteNumber: event.noteNumber,
        velocity: event.velocity,
      };
    }
    case "programChange": {
      assertChannel(event.channel);
      assertByte(event.programNumber, "programNumber");
      return {
        type: "programChange",
        deltaTime: event.deltaTime,
        channel: event.channel,
        programNumber: event.programNumber,
      };
    }
    case "controller": {
      assertChannel(event.channel);
      assertByte(event.controllerType, "controllerType");
      assertByte(event.value, "value");
      return {
        type: "controller",
        deltaTime: event.deltaTime,
        channel: event.channel,
        controllerType: event.controllerType,
        value: event.value,
      };
    }
    case "setTempo": {
      if (!Number.isInteger(event.microsecondsPerBeat)
        || event.microsecondsPerBeat <= 0
        || event.microsecondsPerBeat > 0xffffff) {
        fail(`${where}microsecondsPerBeat must be an integer in 1–16777215, got ${event.microsecondsPerBeat}.`);
      }
      return {
        type: "setTempo",
        deltaTime: event.deltaTime,
        microsecondsPerBeat: event.microsecondsPerBeat,
      };
    }
    case "timeSignature": {
      if (!Number.isInteger(event.numerator) || event.numerator < 1 || event.numerator > 0xff
        || !Number.isInteger(event.denominator) || event.denominator < 1 || event.denominator > 0xff
        || (event.denominator & (event.denominator - 1)) !== 0) {
        fail(`${where}timeSignature numerator/denominator must be integers with a power-of-two denominator, got ${event.numerator}/${event.denominator}.`);
      }
      return {
        type: "timeSignature",
        deltaTime: event.deltaTime,
        numerator: event.numerator,
        denominator: event.denominator,
        metronome: event.metronome ?? 24,
        thirtyseconds: event.thirtyseconds ?? 8,
      };
    }
    case "trackName": {
      if (typeof event.text !== "string") {
        fail(`${where}trackName text must be a string.`);
      }
      return { type: "trackName", deltaTime: event.deltaTime, text: event.text };
    }
    case "endOfTrack":
      return { type: "endOfTrack", deltaTime: event.deltaTime };
    default:
      fail(`${where}unsupported event type "${(event as { type: string }).type}".`);
  }
}

/**
 * Serialise an {@link SmfDocument} to Standard MIDI File bytes.
 *
 * Deterministic contract: the same document always serialises to the same
 * bytes — running-status compression is off by default and every event is
 * validated before serialisation. The mandatory end-of-track meta event is
 * appended to any track that does not already end with one.
 *
 * @param document - The document to serialise.
 * @param options - Optional serialisation overrides (defaults are deterministic).
 * @returns The raw `.mid` file bytes.
 * @throws {RangeError} If the document is malformed (out-of-range channel,
 *         note, program, velocity, tempo, or a non-integer negative delta).
 */
export function writeSmfBytes(document: SmfDocument, options?: WriteSmfOptions): Uint8Array {
  const data = toMidiData(document);
  const running = options?.running ?? false;
  const useByte9ForNoteOff = options?.useByte9ForNoteOff ?? false;
  const bytes = writeMidi(data, { running, useByte9ForNoteOff });
  return Uint8Array.from(bytes);
}
