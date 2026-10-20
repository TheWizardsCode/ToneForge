/**
 * Author the two 8-bar leitmotif game sequences as Standard MIDI Files.
 *
 * This script is the **single source of truth** for the deliverable files
 * under `assets/music/`:
 *
 * - `leitmotif-menu.mid`   — 8 bars @ 84 BPM, calm menu underscore (loopable:
 *   resolves to the tonic at bar 8).
 * - `leitmotif-action.mid` — 8 bars @ 132 BPM, driving in-session action cue
 *   (through-composed with an energy curve).
 *
 * Both derive their theme from the `motif-waves-end` leitmotif
 * (TF-0MV9OLWO6005ZI8E): the G–C–E relief phrase with its raised-4th F# worry
 * tail (G4 C5 E5 F#5 = MIDI 67 72 76 78).
 *
 * **Determinism:** the composition is fully specified here — there is no
 * randomness, no clock, no OS-dependent value. Running this script always
 * produces byte-identical `.mid` files (a stronger guarantee than a fixed
 * seed), and `src/midi/writer.ts` pins the serialisation options the same
 * way. The companion test asserts the committed bytes match a fresh run.
 *
 * Run:
 * ```bash
 * npm run regenerate:leitmotif-music
 * ```
 *
 * The musical decisions (form, harmony, voicing, tempo, MIDI mapping) are
 * documented in `docs/guides/midi-sequences-howto.md`.
 *
 * Work item: TF-0MVDQP78X007OZNA.
 */

import { mkdirSync, writeFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

import {
  writeSmfBytes,
  type SmfDocument,
  type SmfWriterEvent,
} from "../../src/midi/writer.js";

// ── Time grid ─────────────────────────────────────────────────────

/** Ticks per quarter note (PPQ) shared with the midi fixtures. */
const PPQ = 480;
/** Ticks per 4/4 bar. */
const BAR = PPQ * 4;
/** Ticks per beat. */
const BEAT = PPQ;

/** Microseconds per beat for a tempo in BPM, rounded to the nearest integer. */
function bpmToMicroseconds(bpm: number): number {
  return Math.round(60_000_000 / bpm);
}

// ── The shared leitmotif (motif-waves-end) ────────────────────────

/** G4 — relief start. */
const MOTIF_G4 = 67;
/** C5 — relief ascent. */
const MOTIF_C5 = 72;
/** E5 — relief peak. */
const MOTIF_E5 = 76;
/** F#5 — the raised-4th worry tail. */
const MOTIF_FS5 = 78;

// ── Authoring helpers ─────────────────────────────────────────────

/** One sounded note in absolute-tick terms. */
interface VoiceNote {
  /** Absolute start tick. */
  readonly tick: number;
  /** Duration in ticks. */
  readonly dur: number;
  /** MIDI note number (0–127). */
  readonly note: number;
  /** Velocity (0–127). */
  readonly vel: number;
}

/**
 * Build a note at `bar` (0-based) offset by `offsetBeats`, defaulting to a
 * quarter note's length.
 */
function n(
  bar: number,
  offsetBeats: number,
  note: number,
  vel: number,
  dur: number = BEAT - 40,
): VoiceNote {
  return { tick: bar * BAR + offsetBeats * BEAT, dur, note, vel };
}

/** The standard 4/4 conductor (tempo + time signature) track. */
function conductorTrack(name: string, bpm: number): SmfWriterEvent[] {
  return [
    { type: "trackName", deltaTime: 0, text: name },
    { type: "setTempo", deltaTime: 0, microsecondsPerBeat: bpmToMicroseconds(bpm) },
    { type: "timeSignature", deltaTime: 0, numerator: 4, denominator: 4 },
  ];
}

/**
 * Serialise one voice (a set of notes) as a track: track name, GM program
 * change, channel volume (CC7) and the delta-timed note on/off events.
 *
 * At a shared tick, note-offs precede note-ons so a release clears the voice
 * before a same-instant retrigger — the same convention the read-side merge
 * documents (`compareInstrumentEvents`).
 */
function voiceTrack(
  name: string,
  notes: readonly VoiceNote[],
  channel: number,
  program: number,
  volume: number,
): SmfWriterEvent[] {
  const events: SmfWriterEvent[] = [
    { type: "trackName", deltaTime: 0, text: name },
    { type: "programChange", deltaTime: 0, channel, programNumber: program },
    { type: "controller", deltaTime: 0, channel, controllerType: 7, value: volume },
  ];

  interface RawEvent {
    readonly tick: number;
    readonly kind: "on" | "off";
    readonly note: number;
    readonly vel: number;
  }
  const raws: RawEvent[] = [];
  for (const note of notes) {
    raws.push({ tick: note.tick, kind: "on", note: note.note, vel: note.vel });
    raws.push({ tick: note.tick + note.dur, kind: "off", note: note.note, vel: 0 });
  }
  // off-before-on at equal ticks; stable tie-break for identical keys.
  raws.sort((a, b) =>
    a.tick - b.tick
    || (a.kind === "off" && b.kind === "on" ? -1 : b.kind === "off" && a.kind === "on" ? 1 : 0)
    || a.note - b.note);

  let previousTick = 0;
  for (const raw of raws) {
    const deltaTime = raw.tick - previousTick;
    if (raw.kind === "on") {
      events.push({ type: "noteOn", deltaTime, channel, noteNumber: raw.note, velocity: raw.vel });
    } else {
      events.push({ type: "noteOff", deltaTime, channel, noteNumber: raw.note, velocity: 0 });
    }
    previousTick = raw.tick;
  }
  return events;
}

// ── Menu sequence — 8 bars @ 84 BPM, calm, loopable ───────────────

/**
 * Menu: a gentle C-major I–vi–IV–V / I–IV–vi–I arc. Phrase 1 ends on the
 * dominant (half cadence); phrase 2 resolves to the tonic at bar 8 so the
 * loop point is seamless. Voicing keeps common tones in place and moves each
 * voice by a small interval (see docs/guides/midi-sequences-howto.md).
 */
export function composeMenuDocument(): SmfDocument {
  const menuBpm = 84;

  // Bar harmony: C, Am, F, G, C, Fmaj7, Am, C.
  const menuChords: ReadonlyArray<readonly number[]> = [
    [60, 64, 67],                // bar 1: C  (C4 E4 G4)
    [57, 60, 64],                // bar 2: Am (A3 C4 E4)
    [53, 57, 60],                // bar 3: F  (F3 A3 C4)
    [55, 59, 62],                // bar 4: G  (G3 B3 D4)
    [60, 64, 67],                // bar 5: C
    [53, 57, 60, 64],            // bar 6: Fmaj7 (F3 A3 C4 E4)
    [57, 60, 64],                // bar 7: Am
    [60, 64, 67, 72],            // bar 8: C (with octave for the cadence)
  ];
  const padNotes: VoiceNote[] = [];
  for (const [bar, chord] of menuChords.entries()) {
    for (const note of chord) {
      padNotes.push(n(bar, 0, note, 62, BAR));
    }
  }

  // Melody: the motif stated, answered, varied, then resolved.
  const melodyNotes: VoiceNote[] = [
    // Bar 1 (C) — full motif statement: G C E F# (relief, then worry).
    n(0, 0, MOTIF_G4, 92), n(0, 1, MOTIF_C5, 92), n(0, 2, MOTIF_E5, 92), n(0, 3, MOTIF_FS5, 88),
    // Bar 2 (Am) — descending answer.
    n(1, 0, MOTIF_E5, 92), n(1, 1, MOTIF_C5, 92), n(1, 2, 69, 92), n(1, 3, MOTIF_C5, 88),
    // Bar 3 (F) — gentle leaf over the subdominant.
    n(2, 0, 69, 92), n(2, 1, 77, 92), n(2, 2, 69, 92), n(2, 3, MOTIF_G4, 88),
    // Bar 4 (G) — push toward the half cadence.
    n(3, 0, 71, 92), n(3, 1, 74, 92), n(3, 2, 71, 92), n(3, 3, 74, 90),
    // Bar 5 (C) — motif echo.
    n(4, 0, MOTIF_G4, 92), n(4, 1, MOTIF_E5, 92), n(4, 2, MOTIF_C5, 92), n(4, 3, MOTIF_E5, 90),
    // Bar 6 (Fmaj7) — the maj7 colour resolves the phrase.
    n(5, 0, 69, 92), n(5, 1, 77, 92), n(5, 2, MOTIF_E5, 92), n(5, 3, MOTIF_C5, 90),
    // Bar 7 (Am) — stepwise descent E D C B toward the cadence.
    n(6, 0, MOTIF_E5, 92), n(6, 1, 74, 92), n(6, 2, MOTIF_C5, 92), n(6, 3, 71, 90),
    // Bar 8 (C) — resolution; G5 rings to the loop point.
    n(7, 0, MOTIF_C5, 92), n(7, 1, MOTIF_E5, 92), n(7, 2, 79, 96, 888),
  ];

  // Bass: whole-bar roots, one octave-and-a-half below the pad.
  const menuBassRoots = [36, 33, 41, 43, 36, 41, 33, 36]; // C2 A1 F2 G2 C2 F2 A1 C2
  const bassNotes: VoiceNote[] = menuBassRoots.map((root, bar) => n(bar, 0, root, 84, BAR));

  // Bells: sparse glints on phrase starts and the final cadence.
  const bellNotes: VoiceNote[] = [
    n(0, 0, 84, 100, 240),   // C6 ping, opening
    n(3, 2, 79, 100, 240),   // G5, end of phrase 1
    n(4, 0, 84, 100, 240),   // C6 ping, phrase 2
    n(7, 0, 79, 100, 240),   // G5
    n(7, 2, 84, 100, 480),   // C6 ring, final glint
  ];

  // Channels: 0 conductor, 1 pad, 2 melody (string-lead), 3 bass, 4 bell.
  // GM programs: 89 Warm Pad, 48 String Ensemble 1, 32 Acoustic Bass, 10 Music Box.
  return {
    format: 1,
    ticksPerBeat: PPQ,
    tracks: [
      conductorTrack("Conductor", menuBpm),
      voiceTrack("pad (ToneForge: pad, GM 89)", padNotes, 1, 89, 80),
      voiceTrack("melody (ToneForge: string-lead, GM 48)", melodyNotes, 2, 48, 100),
      voiceTrack("bass (ToneForge: bass, GM 32)", bassNotes, 3, 32, 90),
      voiceTrack("bell (ToneForge: bell, GM 10)", bellNotes, 4, 10, 95),
    ],
  };
}

// ── Action sequence — 8 bars @ 132 BPM, driving, through-composed ─

/**
 * Action: the same motif over a driving I–V–vi–IV loop with an energy curve —
 * quarters in phrase 1, then eighth-note melody, denser drums (16th-note
 * hats/kicks) and octave bell accents from bar 7. Bar 8 lands on the tonic
 * so the cue also loops cleanly if the game wants an endless fight track.
 */
export function composeActionDocument(): SmfDocument {
  const actionBpm = 132;

  // Bar harmony: C, G, Am, F (×2), with a bigger final tonic.
  const actionChords: ReadonlyArray<readonly number[]> = [
    [60, 64, 67],                // bar 1: C
    [55, 59, 62],                // bar 2: G
    [57, 60, 64],                // bar 3: Am
    [53, 57, 60],                // bar 4: F
    [60, 64, 67],                // bar 5: C
    [55, 59, 62],                // bar 6: G
    [57, 60, 64],                // bar 7: Am
    [60, 64, 67, 72],            // bar 8: C (octave for the finish)
  ];
  const padNotes: VoiceNote[] = [];
  for (const [bar, chord] of actionChords.entries()) {
    for (const note of chord) {
      padNotes.push(n(bar, 0, note, 66, BAR));
    }
  }

  // Bass: driving eighth-note root/octave/fifth line (R R R+12 R+7 R R R+12 R+7).
  const actionBassRoots = [36, 43, 33, 41, 36, 43, 33, 36]; // C2 G2 A1 F2 C2 G2 A1 C2
  const bassNotes: VoiceNote[] = [];
  for (const [bar, root] of actionBassRoots.entries()) {
    const pattern = [
      [0, 0], [0, 0.5], [12, 1], [7, 1.5], [0, 2], [0, 2.5], [12, 3], [7, 3.5],
    ] as const;
    for (const [interval, beat] of pattern) {
      const last = bar === actionBassRoots.length - 1 && beat === 3.5;
      bassNotes.push(n(bar, beat, root + interval, 100, last ? BEAT - 240 : 220));
    }
  }

  // Melody: motif in quarters, then an eighth-note engine in phrase 2.
  const melodyNotes: VoiceNote[] = [
    // Bar 1 (C) — full motif statement, same identity as the menu.
    n(0, 0, MOTIF_G4, 96), n(0, 1, MOTIF_C5, 96), n(0, 2, MOTIF_E5, 96), n(0, 3, MOTIF_FS5, 92),
    // Bar 2 (G) — rising response.
    n(1, 0, 71, 96), n(1, 1, 74, 96), n(1, 2, 79, 96), n(1, 3, MOTIF_E5, 92),
    // Bar 3 (Am).
    n(2, 0, 69, 96), n(2, 1, MOTIF_C5, 96), n(2, 2, MOTIF_E5, 96), n(2, 3, MOTIF_C5, 92),
    // Bar 4 (F).
    n(3, 0, 77, 96), n(3, 1, 69, 96), n(3, 2, MOTIF_C5, 96), n(3, 3, 77, 92),
    // Bar 5 (C) — eighth-note motif engine.
    n(4, 0, MOTIF_G4, 96), n(4, 0.5, MOTIF_E5, 96), n(4, 1, MOTIF_C5, 96), n(4, 1.5, MOTIF_E5, 96),
    n(4, 2, MOTIF_G4, 96), n(4, 2.5, MOTIF_C5, 112), n(4, 3, MOTIF_E5, 96), n(4, 3.5, MOTIF_FS5, 112),
    // Bar 6 (G) — oscillating fifth pattern.
    n(5, 0, 71, 96), n(5, 0.5, 74, 96), n(5, 1, 79, 96), n(5, 1.5, MOTIF_E5, 96),
    n(5, 2, 71, 96), n(5, 2.5, 74, 96), n(5, 3, 79, 96), n(5, 3.5, MOTIF_E5, 96),
    // Bar 7 (Am) — climbing to the finish.
    n(6, 0, 69, 96), n(6, 0.5, MOTIF_C5, 96), n(6, 1, MOTIF_E5, 96), n(6, 1.5, MOTIF_C5, 96),
    n(6, 2, 69, 96), n(6, 2.5, MOTIF_C5, 96), n(6, 3, MOTIF_E5, 96), n(6, 3.5, 79, 112),
    // Bar 8 (C) — up to C6 for the final accent.
    n(7, 0, MOTIF_C5, 96), n(7, 0.5, MOTIF_E5, 96), n(7, 1, 79, 96), n(7, 1.5, 84, 96),
    n(7, 2, MOTIF_E5, 96), n(7, 2.5, 84, 112), n(7, 3, 79, 96), n(7, 3.5, 84, 96, 230),
  ];

  // Percussion — GM channel 9 (index 9 = GM channel 10), voiced by the six-voice
  // ToneForge drum kit (`--preset drum-kit`). This is a re-voicing of the
  // arrangement below, not a re-composition: notes, velocities and ticks are
  // unchanged from the pre-kit version, only the instrument that voices them
  // changed.
  //
  // GM note → drum-kit voice:
  //   36 kick · 38 snare · 39 clap · 42 closed hi-hat · 46 open hi-hat ·
  //   49 crash · (any other note is ignored deterministically by the kit).
  // This cue uses kick 36, snare 38, closed hat 42 and crash 49; the kit's
  // clap (39) and open hat (46) voices are available but not composed here.
  const percussionNotes: VoiceNote[] = [];
  const kick = (bar: number, beat: number, dur = 300): void =>
    percussionNotes.push(n(bar, beat, 36, 110, dur));
  const snare = (bar: number, beat: number, dur = 240): void =>
    percussionNotes.push(n(bar, beat, 38, 104, dur));
  const closedHat = (bar: number, beat: number, dur = 130): void =>
    percussionNotes.push(n(bar, beat, 42, 82, dur));
  const crash = (bar: number, beat: number, dur = 700): void =>
    percussionNotes.push(n(bar, beat, 49, 100, dur));

  for (let bar = 0; bar <= 5; bar += 1) {
    // Backbeat rock: kick on 1 & 3, snare on 2 & 4, closed hats on eighths.
    kick(bar, 0); kick(bar, 2);
    snare(bar, 1); snare(bar, 3);
    for (let beat = 0; beat < 4; beat += 0.5) closedHat(bar, beat);
  }
  crash(0, 0);    // intro hit
  crash(4, 0);    // phrase-2 hit

  // Bar 7 — build: extra kicks, 16th-note hat roll on beats 3–4.
  kick(6, 0); kick(6, 1.5); kick(6, 2); kick(6, 3);
  snare(6, 1);
  for (let beat = 2; beat < 4; beat += 0.25) percussionNotes.push(n(6, beat, 42, 76, 90));

  // Bar 8 — finish: 16th-note kick drive and a full 16th-note hat roll.
  kick(7, 0); kick(7, 2); kick(7, 2.25); kick(7, 3); kick(7, 3.25); kick(7, 3.5);
  snare(7, 1);
  for (let beat = 0; beat < 4; beat += 0.25) percussionNotes.push(n(7, beat, 42, 76, 90));
  crash(7, 0, 800);

  // Bells — metallic shimmer: an opening ping, then octave accents on beats
  // 2 and 4 through phrase 2, with a final C6 chime.
  const bellNotes: VoiceNote[] = [
    n(0, 0, 88, 104, 240),           // E6 ping
    n(4, 1, MOTIF_C5 + 12, 104, 200), n(4, 3, MOTIF_FS5 + 12, 104, 200),
    n(5, 1, 79 + 12, 104, 200), n(5, 3, MOTIF_E5 + 12, 104, 200),
    n(6, 1, MOTIF_E5 + 12, 104, 200), n(6, 3, 79 + 12, 104, 200),
    n(7, 1, 79 + 12, 104, 200), n(7, 3, 84, 104, 400),   // final chime on C6
  ];

  // Channels: 0 conductor, 1 pad, 2 melody (pluck), 3 bass, 4 bell,
  // 9 percussion (GM channel 10 — drums by definition, voiced by the six-voice
  // ToneForge drum kit; program 0 = Standard Kit).
  // GM programs: 89 Warm Pad, 45 Pizzicato Strings, 38 Synth Bass 1,
  // 9 Glockenspiel, 0 Standard Kit (drums).
  return {
    format: 1,
    ticksPerBeat: PPQ,
    tracks: [
      conductorTrack("Conductor", actionBpm),
      voiceTrack("pad (ToneForge: pad, GM 89)", padNotes, 1, 89, 85),
      voiceTrack("melody (ToneForge: pluck, GM 45)", melodyNotes, 2, 45, 100),
      voiceTrack("bass (ToneForge: bass, GM 38)", bassNotes, 3, 38, 92),
      voiceTrack("bell (ToneForge: bell, GM 9)", bellNotes, 4, 9, 95),
      voiceTrack("percussion (ToneForge: drum-kit, GM ch9)", percussionNotes, 9, 0, 90),
    ],
  };
}

// ── Deliverables ──────────────────────────────────────────────────

/** Absolute directory holding the deliverable `.mid` files. */
export const MUSIC_DIR = resolve(
  dirname(fileURLToPath(import.meta.url)),
  "..",
  "..",
  "assets",
  "music",
);

/** The menu file's raw bytes (deterministic). */
export function composeMenuBytes(): Uint8Array {
  return writeSmfBytes(composeMenuDocument());
}

/** The action file's raw bytes (deterministic). */
export function composeActionBytes(): Uint8Array {
  return writeSmfBytes(composeActionDocument());
}

// ── CLI entry ─────────────────────────────────────────────────────

const isMain =
  process.argv[1] !== undefined
  && import.meta.url === pathToFileURL(process.argv[1]).href;

if (isMain) {
  const outputs: Array<{ name: string; bytes: Uint8Array; bpm: number; bars: number }> = [
    { name: "leitmotif-menu.mid", bytes: composeMenuBytes(), bpm: 84, bars: 8 },
    { name: "leitmotif-action.mid", bytes: composeActionBytes(), bpm: 132, bars: 8 },
  ];

  mkdirSync(MUSIC_DIR, { recursive: true });
  for (const output of outputs) {
    const destination = resolve(MUSIC_DIR, output.name);
    writeFileSync(destination, Buffer.from(output.bytes));
    console.log(
      `Wrote ${output.name} (${output.bytes.length} bytes) — `
      + `${output.bars} bars @ ${output.bpm} BPM, format 1, PPQ ${PPQ}`,
    );
  }
  console.log(`\nWrote ${outputs.length} sequences to ${MUSIC_DIR}`);
}
