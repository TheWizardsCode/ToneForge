/**
 * Pipeline validation for the two authored leitmotif sequences
 * (`assets/music/leitmotif-{menu,action}.mid`).
 *
 * Both files must be parseable and playable by the existing read-side
 * pipeline (`src/midi/smf.ts` + `src/midi/translate.ts`): correct format,
 * PPQ division and tempo (≈84 BPM menu, ≈132 BPM action), non-empty
 * multi-voice content that carries the shared motif (G4 C5 E5 F#5) and, per
 * track, a GM program change + channel volume (CC7) so the files sound right
 * in any DAW, not just through ToneForge presets.
 *
 * Work item: TF-0MVDQP78X007OZNA.
 */

import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { parseMidi } from "midi-file";

import { parseMidiFile, buildTempoMap } from "./smf.js";
import { parseMidiToInstrumentEvents } from "./translate.js";

const MUSIC_DIR = resolve(import.meta.dirname, "../../assets/music");

const MOTIF_NOTES = [67, 72, 76, 78]; // G4 C5 E5 F#5 from motif-waves-end

type LoadedSequence = {
  name: string;
  bytes: Uint8Array;
};

function loadSequence(name: string): LoadedSequence {
  return { name, bytes: new Uint8Array(readFileSync(resolve(MUSIC_DIR, name))) };
}

describe("leitmotif-menu.mid (84 BPM menu underscore)", () => {
  const file = loadSequence("leitmotif-menu.mid");

  it("parses as a format 1, PPQ 480, 5-track file", () => {
    const parsed = parseMidiFile(file.bytes);
    expect(parsed.format).toBe(1);
    expect(parsed.ticksPerBeat).toBe(480);
    expect(parsed.numTracks).toBe(5);
  });

  it("declares ~84 BPM and resolves ticks deterministically", () => {
    const parsed = parseMidiFile(file.bytes);
    const tempoMap = buildTempoMap(parsed);
    // Conductor track's first tempo event: 84 BPM ≈ 714 286 µs/beat.
    const tempo = parsed.tracks[0]!.find((entry) => entry.event.type === "tempo");
    expect(tempo).toBeDefined();
    if (tempo && tempo.event.type === "tempo") {
      expect(Math.round(60_000_000 / tempo.event.microsecondsPerBeat)).toBe(84);
    }
    // 32 beats (8 bars) at 84 BPM ≈ 22.86 s.
    const duration = tempoMap.tickToSeconds(8 * 4 * 480);
    expect(duration).toBeCloseTo(22.857, 2);
  });

  it("plays through the engine pipeline and carries the shared motif", () => {
    const events = parseMidiToInstrumentEvents(file.bytes);
    const notes = events.filter((event) => event.type === "midiNoteOn");
    expect(notes.length).toBeGreaterThan(20);

    const parsed = parseMidiFile(file.bytes);
    // Melody track (channel 2): the full motif statement G C E F# is present.
    const melodyNotes = parsed.tracks[2]!
      .filter((entry) => entry.event.type === "noteOn" && entry.event.channel === 2)
      .map((entry) => entry.event.noteNumber);
    for (const motifNote of MOTIF_NOTES) {
      expect(melodyNotes).toContain(motifNote);
    }
  });

  it("carries a GM program change and volume controller on every voice channel", () => {
    const raw = parseMidi(file.bytes);
    for (const track of raw.tracks.slice(1)) {
      expect(track.some((event) => event.type === "programChange")).toBe(true);
      expect(track.some((event) => event.type === "controller"
        && event.controllerType === 7)).toBe(true);
    }
  });
});

describe("leitmotif-action.mid (132 BPM action cue)", () => {
  const file = loadSequence("leitmotif-action.mid");

  it("parses as a format 1, PPQ 480, 6-track file (incl. percussion)", () => {
    const parsed = parseMidiFile(file.bytes);
    expect(parsed.format).toBe(1);
    expect(parsed.ticksPerBeat).toBe(480);
    expect(parsed.numTracks).toBe(6);
  });

  it("declares ~132 BPM and resolves ticks deterministically", () => {
    const parsed = parseMidiFile(file.bytes);
    const tempoMap = buildTempoMap(parsed);
    const tempo = parsed.tracks[0]!.find((entry) => entry.event.type === "tempo");
    expect(tempo).toBeDefined();
    if (tempo && tempo.event.type === "tempo") {
      expect(Math.round(60_000_000 / tempo.event.microsecondsPerBeat)).toBe(132);
    }
    // 32 beats (8 bars) at 132 BPM ≈ 14.55 s.
    const duration = tempoMap.tickToSeconds(8 * 4 * 480);
    expect(duration).toBeCloseTo(14.545, 2);
  });

  it("plays through the engine pipeline, hits more densely than the menu, and keeps the motif", () => {
    const events = parseMidiToInstrumentEvents(file.bytes);
    const notes = events.filter((event) => event.type === "midiNoteOn");
    const menuNotes = parseMidiToInstrumentEvents(loadSequence("leitmotif-menu.mid").bytes)
      .filter((event) => event.type === "midiNoteOn");
    expect(notes.length).toBeGreaterThan(70);
    expect(notes.length).toBeGreaterThan(menuNotes.length);

    const parsed = parseMidiFile(file.bytes);
    // Melody track (channel 2) still states the motif in its opening bar.
    const melodyNotes = parsed.tracks[2]!
      .filter((entry) => entry.event.type === "noteOn" && entry.event.channel === 2)
      .map((entry) => entry.event.noteNumber);
    for (const motifNote of MOTIF_NOTES) {
      expect(melodyNotes).toContain(motifNote);
    }
  });

  it("uses the GM drum channel (9) for percussion plus GM programs on the other voices", () => {
    const raw = parseMidi(file.bytes);
    // Conductor is track 0; percussion track carries channel 9 (GM channel 10).
    const percussion = raw.tracks.find((track) =>
      track.some((event) => event.type === "noteOn" && event.channel === 9));
    expect(percussion).toBeDefined();
    for (const track of raw.tracks.slice(1, 5)) {
      expect(track.some((event) => event.type === "programChange")).toBe(true);
    }
    expect(percussion!.some((event) => event.type === "programChange"
      && event.programNumber === 0)).toBe(true);
  });
});
