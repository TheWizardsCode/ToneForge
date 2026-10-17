/**
 * Standard MIDI File (`.mid`) parsing layer.
 *
 * Wraps the zero-dependency `midi-file` parser behind the engine-neutral
 * `ParsedMidi` structure and resolves delta times (PPQ ticks) to absolute
 * seconds through a deterministic **tempo map**. The `midi-file` package is
 * pure array-based JavaScript with no Node built-ins, so this module (and
 * anything importing it) stays browser-bundle safe — the import boundary is
 * deliberately confined to this file, mirroring the guarded `js-yaml`
 * pattern in `src/core/recipe.ts` so the rest of the codebase never touches
 * the parser directly.
 *
 * The parser is *pure*: parsing and time resolution read no clock and touch
 * no global state, so identical bytes always produce identical events
 * (platform determinism guarantee).
 *
 * Work item: TF-0MVBDU0RM007QTNR (MIDI file playback).
 */

import {
  parseMidi,
  type MidiData,
  type MidiEvent,
  type MidiNoteOffEvent,
  type MidiNoteOnEvent,
} from "midi-file";

/** Default tempo when the file declares none: 120 BPM = 500 000 µs/beat. */
export const DEFAULT_MICROSECONDS_PER_BEAT = 500_000;

/** A note event, preserved from the SMF track. */
export interface SmfNoteEvent {
  readonly type: "noteOn" | "noteOff";
  /** MIDI channel (0–15). */
  readonly channel: number;
  /** MIDI note number (0–127). */
  readonly noteNumber: number;
  /** Key velocity (0–127). */
  readonly velocity: number;
}

/** A `setTempo` meta event (the tempo map's raw material). */
export interface SmfTempoEvent {
  readonly type: "tempo";
  /** Microseconds per quarter note (e.g. 500 000 = 120 BPM). */
  readonly microsecondsPerBeat: number;
}

/** The union of events the engine can consume after translation. */
export type SmfEvent = SmfNoteEvent | SmfTempoEvent;

/** One event in a track, with its delta time in ticks. */
export interface SmfTrackEvent {
  /** Delta time in ticks since the previous event in the track. */
  readonly deltaTime: number;
  readonly event: SmfEvent;
}

/**
 * A parsed SMF file, normalised to the note/tempo events the engine can
 * consume. Other SMF event kinds (controllers, text, sysEx, …) are not
 * carried — they are transport, not notes.
 */
export interface ParsedMidi {
  /** SMF format: 0 (single track), 1 (one or more simultaneous tracks) or 2. */
  readonly format: 0 | 1 | 2;
  /** Number of tracks declared in the header. */
  readonly numTracks: number;
  /**
   * Ticks per quarter note (PPQ division), or null when the file uses the
   * SMPTE frame division.
   */
  readonly ticksPerBeat: number | null;
  /** SMPTE frames per second, or null for PPQ files. */
  readonly framesPerSecond: number | null;
  /** SMPTE ticks per frame, or null for PPQ files. */
  readonly ticksPerFrame: number | null;
  /** One array of delta-timed events per track, in file order. */
  readonly tracks: ReadonlyArray<ReadonlyArray<SmfTrackEvent>>;
}

function isNoteEvent(event: MidiEvent): event is MidiNoteOnEvent | MidiNoteOffEvent {
  return event.type === "noteOn" || event.type === "noteOff";
}

/** Normalise one parser track into the engine-neutral event list. */
function toSmfTrack(track: readonly MidiEvent[]): SmfTrackEvent[] {
  const events: SmfTrackEvent[] = [];
  for (const event of track) {
    if (isNoteEvent(event)) {
      events.push({
        deltaTime: event.deltaTime,
        event: {
          type: event.type,
          channel: event.channel,
          noteNumber: event.noteNumber,
          velocity: event.velocity,
        },
      });
    } else if (event.type === "setTempo") {
      events.push({
        deltaTime: event.deltaTime,
        event: {
          type: "tempo",
          microsecondsPerBeat: event.microsecondsPerBeat,
        },
      });
    }
  }
  return events;
}

/**
 * Parse raw SMF bytes into the engine-neutral {@link ParsedMidi} structure.
 *
 * @param bytes - The raw `.mid` file contents.
 * @returns The parsed header and delta-timed per-track events.
 * @throws {TypeError} If `bytes` is not a `Uint8Array`.
 * @throws {Error} If the bytes are not a valid SMF file.
 */
export function parseMidiFile(bytes: Uint8Array): ParsedMidi {
  if (!(bytes instanceof Uint8Array)) {
    throw new TypeError("parseMidiFile: expected a Uint8Array of SMF bytes.");
  }

  let data: MidiData;
  try {
    data = parseMidi(bytes);
  } catch (error) {
    const message =
      typeof error === "string"
        ? error
        : error instanceof Error
          ? error.message
          : String(error);
    throw new Error(`parseMidiFile: not a valid SMF file (${message}).`);
  }

  const { header } = data;
  const ticksPerBeat =
    typeof header.ticksPerBeat === "number" && header.ticksPerBeat > 0
      ? header.ticksPerBeat
      : null;

  return {
    format: header.format as ParsedMidi["format"],
    numTracks: header.numTracks,
    ticksPerBeat,
    framesPerSecond:
      typeof header.framesPerSecond === "number" ? header.framesPerSecond : null,
    ticksPerFrame:
      typeof header.ticksPerFrame === "number" ? header.ticksPerFrame : null,
    tracks: data.tracks.map(toSmfTrack),
  };
}

// ── Tempo map: deterministic tick → seconds ───────────────────────

/** A resolved tempo-map segment: from `tick` onward, `microsecondsPerBeat` applies. */
interface TempoChange {
  readonly tick: number;
  /** Absolute seconds at which this segment begins. */
  readonly seconds: number;
  readonly microsecondsPerBeat: number;
}

/**
 * Convert PPQ ticks to absolute seconds using an SMF tempo map.
 *
 * The map is built from every `setTempo` event across all tracks, sorted by
 * absolute tick (stable, so identical files give identical maps). Between two
 * tempo changes the tempo is constant, so `seconds = segmentStart +
 * (tick − segmentStartTick) × µsPerBeat / ticksPerBeat / 1e6`. Files without
 * any tempo event use the default 120 BPM from tick 0.
 *
 * Instances are immutable and total over tick ≥ 0.
 */
export class TempoMap {
  readonly #ticksPerBeat: number;
  readonly #changes: readonly TempoChange[];

  /**
   * @param changes - Tempo events as `{ tick, microsecondsPerBeat }`, in any
   *        order (sorted internally by tick).
   * @param ticksPerBeat - PPQ division (positive).
   * @throws {RangeError} If `ticksPerBeat` is non-positive or a change is
   *         invalid (negative tick, non-positive µs/beat).
   */
  constructor(
    changes: ReadonlyArray<{ tick: number; microsecondsPerBeat: number }>,
    ticksPerBeat: number,
  ) {
    if (!Number.isFinite(ticksPerBeat) || ticksPerBeat <= 0) {
      throw new RangeError(
        `TempoMap: ticksPerBeat must be a positive number, got ${ticksPerBeat}.`,
      );
    }

    const sorted = [...changes].sort((a, b) => a.tick - b.tick);
    const resolved: TempoChange[] = [];
    let seconds = 0;
    let previousTick = 0;
    let previousUs = DEFAULT_MICROSECONDS_PER_BEAT;

    for (const change of sorted) {
      if (
        !Number.isFinite(change.tick)
        || change.tick < 0
        || !Number.isFinite(change.microsecondsPerBeat)
        || change.microsecondsPerBeat <= 0
      ) {
        throw new RangeError(
          `TempoMap: invalid tempo change at tick ${change.tick} `
          + `(microsecondsPerBeat ${change.microsecondsPerBeat}).`,
        );
      }
      seconds += ((change.tick - previousTick) * previousUs) / ticksPerBeat / 1e6;
      resolved.push({
        tick: change.tick,
        seconds,
        microsecondsPerBeat: change.microsecondsPerBeat,
      });
      previousTick = change.tick;
      previousUs = change.microsecondsPerBeat;
    }

    this.#ticksPerBeat = ticksPerBeat;
    this.#changes = resolved;
  }

  /**
   * Resolve an absolute tick to seconds.
   *
   * @param tick - Non-negative tick.
   * @returns Absolute seconds from the render start.
   * @throws {RangeError} If `tick` is negative or not finite.
   */
  tickToSeconds(tick: number): number {
    if (!Number.isFinite(tick) || tick < 0) {
      throw new RangeError(
        `tickToSeconds: tick must be a non-negative number, got ${tick}.`,
      );
    }

    let index = this.#changes.length - 1;
    while (index >= 0 && this.#changes[index]!.tick > tick) {
      index -= 1;
    }

    if (index < 0) {
      // Before the first tempo change: the default 120 BPM from tick 0.
      return (tick * DEFAULT_MICROSECONDS_PER_BEAT) / this.#ticksPerBeat / 1e6;
    }

    const change = this.#changes[index]!;
    return (
      change.seconds
      + ((tick - change.tick) * change.microsecondsPerBeat)
        / this.#ticksPerBeat
        / 1e6
    );
  }
}

/**
 * Build the tempo map for a parsed PPQ file: gather every `setTempo` event
 * from all tracks (in absolute-tick order) and construct a {@link TempoMap}.
 *
 * @throws {Error} If the file uses the SMPTE time division — the tempo map
 *         only applies to PPQ (ticks-per-beat) files.
 */
export function buildTempoMap(parsed: ParsedMidi): TempoMap {
  if (parsed.ticksPerBeat === null) {
    throw new Error(
      "buildTempoMap: file uses the SMPTE time division; a tempo map only "
      + "applies to PPQ (ticks-per-beat) files.",
    );
  }

  const tempoEvents: Array<{ tick: number; microsecondsPerBeat: number }> = [];
  for (const track of parsed.tracks) {
    let tick = 0;
    for (const { deltaTime, event } of track) {
      tick += deltaTime;
      if (event.type === "tempo") {
        tempoEvents.push({
          tick,
          microsecondsPerBeat: event.microsecondsPerBeat,
        });
      }
    }
  }
  return new TempoMap(tempoEvents, parsed.ticksPerBeat);
}
