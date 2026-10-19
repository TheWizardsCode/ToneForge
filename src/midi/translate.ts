/**
 * SMF → engine-events translator.
 *
 * Turns the parsed SMF structure (`src/midi/smf.ts`) into the instrument
 * engine's structured `midiNoteOn` / `midiNoteOff` messages — the exact
 * `InstrumentEvent[]` {@link renderInstrument} already renders — by resolving
 * each event's absolute tick through the tempo map to seconds and merging
 * every track into one deterministic event stream.
 *
 * Determinism contract: same bytes ⇒ same events. The output is sorted by
 * absolute time with a **documented tie-break** (see
 * {@link compareInstrumentEvents}): releases (`midiNoteOff`) sort before
 * note-ons at the same instant, then note ascending, then velocity ascending.
 * This makes a merged multi-track file byte-for-byte reproducible across
 * platforms and runs.
 *
 * Work item: TF-0MVBDU0RM007QTNR (MIDI file playback).
 */

import type { InstrumentEvent } from "../instruments/engine.js";
import { midiNoteOn, midiNoteOff } from "../instruments/instrument.js";
import { buildTempoMap, parseMidiFile, type ParsedMidi } from "./smf.js";

/**
 * Deterministic sort for merged events.
 *
 * Primary key is absolute time in seconds. Ties are broken so a release at
 * the same instant precedes a retrigger of the same note (musically: the
 * release clears the voice before the new attack), then by MIDI note
 * ascending and finally velocity ascending — every remaining ambiguity is
 * eliminated, so the merge is fully reproducible.
 */
export function compareInstrumentEvents(a: InstrumentEvent, b: InstrumentEvent): number {
  if (a.time !== b.time) {
    return a.time - b.time;
  }
  if (a.type !== b.type) {
    return a.type === "midiNoteOff" ? -1 : 1;
  }
  if (a.note !== b.note) {
    return a.note - b.note;
  }
  return a.velocity - b.velocity;
}

/**
 * Optional voice-isolation filter for {@link smfToInstrumentEvents}.
 *
 * `tracks` selects SMF track indexes (0-based, file order — the same order as
 * the file's track list); `channels` selects MIDI channels (0–15). Both are
 * optional, and multiple values select the union within each axis. When both
 * are given an event must match a selected track **and** a selected channel
 * (intersection).
 *
 * Tempo/meta events are never filtered: the tempo map is always built from the
 * whole file (the conductor track usually carries it), so an isolated voice
 * keeps the file's original tempo map and duration.
 */
export interface MidiVoiceFilter {
  /** Track indexes to keep; omit or leave empty to keep every track. */
  readonly tracks?: readonly number[];
  /** MIDI channels to keep; omit or leave empty to keep every channel. */
  readonly channels?: readonly number[];
}

/** Turn an optional value list into a lookup set (empty ⇒ no restriction). */
function toSelection(values: readonly number[] | undefined): Set<number> | undefined {
  return values === undefined || values.length === 0 ? undefined : new Set(values);
}

/**
 * Translate a parsed SMF file into engine events.
 *
 * Each track's delta-time sequence is accumulated into absolute ticks and
 * resolved to seconds through the file's tempo map (120 BPM default when no
 * `setTempo` event exists; tempo changes honoured at their tick). With a
 * {@link MidiVoiceFilter} the note events are first restricted to the selected
 * tracks/channels — a pure selection step *before* the merge, so a filtered
 * render keeps the file's timing. All tracks are then merged into one stream
 * sorted by absolute time with the documented tie-break
 * ({@link compareInstrumentEvents}).
 *
 * @param parsed - The parsed SMF file.
 * @param filter - Optional track/channel voice-isolation filter.
 * @returns The merged `midiNoteOn` / `midiNoteOff` events, time-sorted.
 */
export function smfToInstrumentEvents(
  parsed: ParsedMidi,
  filter: MidiVoiceFilter = {},
): InstrumentEvent[] {
  // Built from the whole file so a filtered voice keeps the original tempo map
  // (the conductor track's tempo events are never subject to the filter).
  const tempoMap = buildTempoMap(parsed);
  const trackSelection = toSelection(filter.tracks);
  const channelSelection = toSelection(filter.channels);
  const events: InstrumentEvent[] = [];

  parsed.tracks.forEach((track, trackIndex) => {
    if (trackSelection !== undefined && !trackSelection.has(trackIndex)) return;
    let tick = 0;
    for (const { deltaTime, event } of track) {
      tick += deltaTime;
      if (event.type === "noteOn" || event.type === "noteOff") {
        if (channelSelection !== undefined && !channelSelection.has(event.channel)) continue;
        events.push(
          event.type === "noteOn"
            ? midiNoteOn(event.noteNumber, event.velocity, tempoMap.tickToSeconds(tick))
            : midiNoteOff(event.noteNumber, event.velocity, tempoMap.tickToSeconds(tick)),
        );
      }
    }
  });

  return events.sort(compareInstrumentEvents);
}

/**
 * Convenience wrapper: parse raw `.mid` bytes and translate them into engine
 * events in one step.
 *
 * @param bytes - The raw SMF bytes.
 * @param filter - Optional track/channel voice-isolation filter.
 * @returns The merged engine events, time-sorted.
 * @throws {TypeError} If `bytes` is not a `Uint8Array`.
 * @throws {Error} If the bytes are not a valid SMF file.
 */
export function parseMidiToInstrumentEvents(
  bytes: Uint8Array,
  filter?: MidiVoiceFilter,
): InstrumentEvent[] {
  return smfToInstrumentEvents(parseMidiFile(bytes), filter);
}
