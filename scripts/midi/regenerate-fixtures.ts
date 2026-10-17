/**
 * Regenerate the SMF (.mid) fixtures under `src/test-utils/fixtures/midi/`.
 *
 * The fixtures are hand-authored **Standard MIDI Files** (format 0 and 1),
 * written by this dependency-free builder so the committed bytes never depend
 * on the `midi-file` library under test — a bug in the library cannot mask
 * itself by also generating the reference data. Running this script is the
 * only sanctioned way to change the fixtures.
 *
 * Run:
 * ```bash
 * npm run regenerate:midi-fixtures
 * ```
 *
 * Fixtures:
 * - `chord.mid`   — format 0, one track: a simultaneous C major chord
 *   (C4/E4/G4, MIDI 60/64/67) struck at tick 0 and all released after a
 *   two-beat hold (960 ticks = 1.0 s at 120 BPM, PPQ 480). Used for
 *   polyphony, non-silence, release-to-silence and byte-identical
 *   determinism assertions.
 * - `melody.mid`  — format 1, three tracks: a conductor track with a tempo
 *   change (120 → 60 BPM at tick 1920), a melody track (C5 D5 E5 F5 A4 — an
 *   A4 held across the tempo change) and a bass track (C3). Used for tempo-map
 *   tick→seconds resolution, multi-track deterministic merge and pitch
 *   assertions on the rendered audio.
 */
import { mkdirSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";

const FIXTURES_DIR = resolve(import.meta.dirname, "../../src/test-utils/fixtures/midi");

/** PPQ division shared by both fixtures (ticks per quarter note). */
const PPQ_TICKS_PER_BEAT = 480;

/** 120 BPM tempo = 500 000 µs per beat. */
const TEMPO_120_BPM = 500_000;

/** 60 BPM tempo = 1 000 000 µs per beat. */
const TEMPO_60_BPM = 1_000_000;

// ---------------------------------------------------------------------------
// SMF binary encoding (dependency-free)
// ---------------------------------------------------------------------------

interface ChannelNoteEvent {
  delta: number;
  kind: "noteOn" | "noteOff";
  channel: number;
  note: number;
  velocity: number;
}

interface TempoEvent {
  delta: number;
  kind: "tempo";
  microsecondsPerBeat: number;
}

type TrackEvent = ChannelNoteEvent | TempoEvent;

/** Encode a non-negative integer as a MIDI variable-length quantity. */
function encodeVarint(value: number): number[] {
  const bytes = [value & 0x7f];
  let remaining = value >> 7;
  while (remaining > 0) {
    bytes.unshift((remaining & 0x7f) | 0x80);
    remaining >>= 7;
  }
  return bytes;
}

/** Serialize one track's events (each with a delta time) into MTrk data. */
function trackData(events: TrackEvent[]): number[] {
  const bytes: number[] = [];
  for (const event of events) {
    bytes.push(...encodeVarint(event.delta));
    if (event.kind === "noteOn" || event.kind === "noteOff") {
      const status = event.kind === "noteOn" ? 0x90 : 0x80;
      bytes.push(status | event.channel, event.note, event.velocity);
    } else {
      const microseconds = event.microsecondsPerBeat;
      bytes.push(
        0xff, 0x51, 0x03, // setTempo meta (FF 51 03)
        (microseconds >> 16) & 0xff,
        (microseconds >> 8) & 0xff,
        microseconds & 0xff,
      );
    }
  }
  // End-of-track meta event (FF 2F 00), delta 0.
  bytes.push(0x00, 0xff, 0x2f, 0x00);
  return bytes;
}

/** Serialize a complete SMF (MThd header + MTrk chunks) to bytes. */
function buildSmf(format: number, tracks: TrackEvent[][]): Uint8Array {
  const header = [
    0x4d, 0x54, 0x68, 0x64, // "MThd"
    0x00, 0x00, 0x00, 0x06, // header length
    (format >> 8) & 0xff, format & 0xff, // format 0/1
    (tracks.length >> 8) & 0xff, tracks.length & 0xff, // number of tracks
    (PPQ_TICKS_PER_BEAT >> 8) & 0xff, PPQ_TICKS_PER_BEAT & 0xff, // division (PPQ)
  ];
  const chunks: number[] = [];
  for (const track of tracks) {
    const data = trackData(track);
    chunks.push(
      0x4d, 0x54, 0x72, 0x6b, // "MTrk"
      (data.length >>> 24) & 0xff,
      (data.length >>> 16) & 0xff,
      (data.length >>> 8) & 0xff,
      data.length & 0xff,
      ...data,
    );
  }
  return new Uint8Array([...header, ...chunks]);
}

// ---------------------------------------------------------------------------
// Fixture content
// ---------------------------------------------------------------------------

/**
 * Format 0 chord: C4/E4/G4 on together at tick 0, all off at tick 960
 * (a two-beat hold → 2.0 s at 120 BPM).
 */
function chordFixture(): Uint8Array {
  const track: TrackEvent[] = [
    { delta: 0, kind: "noteOn", channel: 0, note: 60, velocity: 100 },
    { delta: 0, kind: "noteOn", channel: 0, note: 64, velocity: 100 },
    { delta: 0, kind: "noteOn", channel: 0, note: 67, velocity: 100 },
    { delta: 960, kind: "noteOff", channel: 0, note: 60, velocity: 0 },
    { delta: 0, kind: "noteOff", channel: 0, note: 64, velocity: 0 },
    { delta: 0, kind: "noteOff", channel: 0, note: 67, velocity: 0 },
  ];
  return buildSmf(0, [track]);
}

/**
 * Format 1 melody over three tracks:
 *
 * - Track 0 (conductor): 120 BPM at tick 0, 60 BPM at tick 1920.
 * - Track 1 (melody): C5(72) D5(74) E5(76) F5(77) one quarter note each,
 *   then A4(69) held across the tempo change: ticks 1920 → 2880, which is
 *   2.0 s → 4.0 s in absolute seconds (the 960-tick hold is 1.0 s at 120 BPM
 *   but 2.0 s at 60 BPM).
 * - Track 2 (bass): C3(48) at tick 0, released at tick 960 (1.0 s).
 */
function melodyFixture(): Uint8Array {
  const conductor: TrackEvent[] = [
    { delta: 0, kind: "tempo", microsecondsPerBeat: TEMPO_120_BPM },
    { delta: 1920, kind: "tempo", microsecondsPerBeat: TEMPO_60_BPM },
  ];
  const melody: TrackEvent[] = [
    { delta: 0, kind: "noteOn", channel: 1, note: 72, velocity: 100 },
    { delta: 240, kind: "noteOff", channel: 1, note: 72, velocity: 0 },
    { delta: 240, kind: "noteOn", channel: 1, note: 74, velocity: 100 },
    { delta: 240, kind: "noteOff", channel: 1, note: 74, velocity: 0 },
    { delta: 240, kind: "noteOn", channel: 1, note: 76, velocity: 100 },
    { delta: 240, kind: "noteOff", channel: 1, note: 76, velocity: 0 },
    { delta: 240, kind: "noteOn", channel: 1, note: 77, velocity: 100 },
    { delta: 240, kind: "noteOff", channel: 1, note: 77, velocity: 0 },
    { delta: 240, kind: "noteOn", channel: 1, note: 69, velocity: 100 },
    { delta: 960, kind: "noteOff", channel: 1, note: 69, velocity: 0 },
  ];
  const bass: TrackEvent[] = [
    { delta: 0, kind: "noteOn", channel: 2, note: 48, velocity: 100 },
    { delta: 960, kind: "noteOff", channel: 2, note: 48, velocity: 0 },
  ];
  return buildSmf(1, [conductor, melody, bass]);
}

// ---------------------------------------------------------------------------
// Write
// ---------------------------------------------------------------------------

const FIXTURES: Array<{ name: string; bytes: Uint8Array; description: string }> = [
  { name: "chord.mid", bytes: chordFixture(), description: "format 0, C major chord (C4/E4/G4), 120 BPM" },
  {
    name: "melody.mid",
    bytes: melodyFixture(),
    description: "format 1, 3 tracks: tempo change 120→60 BPM, C5 D5 E5 F5 A4 melody + C3 bass",
  },
];

mkdirSync(FIXTURES_DIR, { recursive: true });
for (const fixture of FIXTURES) {
  const destination = resolve(FIXTURES_DIR, fixture.name);
  writeFileSync(destination, Buffer.from(fixture.bytes));
  console.log(`Wrote ${fixture.name} (${fixture.bytes.length} bytes) — ${fixture.description}`);
}
console.log(`\nWrote ${FIXTURES.length} fixtures to ${FIXTURES_DIR}`);
