---
title: "Instruments (playable MIDI instruments)"
id: "instruments"
order: 60
description: "Playable, polyphonic instruments driven by a programmatic Note On / Note Off API on a deterministic sample-accurate voice engine."
---

# Instruments (playable MIDI instruments)

ToneForge plays fixed, one-shot sound events; **instruments** are the
playable counterpart — a family of pitch-driven voices you can hold, release
and retrigger live. Each instrument is a schema-valid
[ToneGraph-shaped](../tonegraph.md) definition (oscillator + ADSR envelope +
optional filter) driven by a structured `midiNoteOn` / `midiNoteOff` message
API on a deterministic, sample-accurate voice engine that runs in both Node
(`node-web-audio-api`) and the browser (native Web Audio).

> **Scope boundary:** this item ships the **programmatic Note On / Note Off
> API only**. There is no raw MIDI byte decoder and no Web MIDI API hardware
> binding (those are recorded follow-ups) in this item. MIDI **file** playback
> ships separately — see [MIDI file import](midi-import.md). Refer to the
> intake decisions in the parent epic TF-0MV9PIBNV008C00R.

## Quick start

The shipped API lives under `src/instruments/`, re-exported from
`src/instruments/index.ts`:

```ts
import {
  renderInstrument,
  createRealtimeInstrument,
  midiNoteToFrequency,
  velocityToGain,
  listInstruments,
  getInstrument,
} from "../instruments/index.js";
```

| Export | Purpose |
| --- | --- |
| `renderInstrument(definition, events, options?)` | Deterministic offline render to samples |
| `createRealtimeInstrument(definition, options?)` | Real-time playable instrument (browser or Node) |
| `midiNoteOn(note, velocity, time?)` / `midiNoteOff(note, velocity?, time?)` | Structured message builders (`MidiNoteOnMessage` / `MidiNoteOffMessage`) |
| `midiNoteToFrequency(note)` / `velocityToGain(velocity)` | Note → Hz and velocity → gain mappings |
| `AdsrEnvelope` | Sample-accurate attack/decay/sustain/release state machine |
| `VoiceManager` | Polyphonic allocation, voice limit and stealing |
| `listInstruments()` / `getInstrument(id)` | Discover the starter preset family |
| `validateInstrumentDefinition(value)` | Schema validation for instrument definitions |

## Note On / Note Off API and message types

An instrument implements the `Instrument` interface:

```ts
interface Instrument {
  readonly id: string;
  noteOn(midiNote: number, velocity: number, time?: number): void;
  noteOff(midiNote: number, time?: number): void;
}
```

The structured message types are the data contract:

```ts
interface MidiNoteOnMessage {
  readonly type: "midiNoteOn";
  readonly note: number;     // 0–127
  readonly velocity: number; // 0–127
  readonly time: number;     // seconds, 0 = "as soon as possible"
}

interface MidiNoteOffMessage {
  readonly type: "midiNoteOff";
  readonly note: number;
  readonly velocity: number; // release velocity, default 0
  readonly time: number;
}
```

Build them with `midiNoteOn(note, velocity, time)` / `midiNoteOff(note, velocity?, time?)`,
which validate the MIDI range and throw a `RangeError` for invalid input.

### Mapping formulas

- **Note → frequency (equal temperament, A4 = 440 Hz):**
  `freq = 440 * 2^((note − 69) / 12)`. Note 69 → exactly 440 Hz; note 60
  (middle C) → ≈ 261.63 Hz.
- **Velocity → gain (linear):** `gain = velocity / 127`. Velocity 127 → 1.0,
  velocity 0 → 0. Out-of-range velocities (including `NaN` / `±Infinity`) are
  clamped deterministically to `[0, 1]`.

## ADSR envelope semantics

`AdsrEnvelope` is a pure, unit-testable sample generator (no Web Audio
context required). Note On runs **attack → decay → sustain-hold**; Note Off
runs **release** from whatever level the envelope currently holds, so a note
released mid-attack releases from its current level rather than the peak.

- Attack/decay/release are non-negative seconds; sustain is a gain in `[0, 1]`.
- Zero-length stages jump cleanly to the next stage (no divide-by-zero).
- The envelope begins at 0, holds sustain indefinitely until `release()`, and
  reaches exactly 0 at the end of the release tail.
- Stage transitions are **sample-accurate** at the supplied sample rate, and
  output is deterministic for a given config + note sequence.

```ts
import { AdsrEnvelope } from "../instruments/envelope.js";

const env = new AdsrEnvelope(
  { attack: 0.005, decay: 0.05, sustain: 0.6, release: 0.12 },
  44100, // sample rate (Hz)
);
env.noteOn();
env.nextValue(); // one sample of the attack stage
env.noteOff();   // start the release
const tail = env.process(4410); // ~0.1 s of release samples
```

## Voice limit and stealing policy

`VoiceManager` is a pure, injectable allocator (no audio context; the engine
owns the audio graph):

- `maxVoices` is configurable (integer ≥ 1).
- **Same-note retrigger:** retriggering a note that is already sounding
  replaces that note's own voice — never two voices for one note. The voice
  keeps its identity and becomes the *newest* voice.
- **At the limit:** the **oldest sounding voice is stolen first** (the voice
  whose most recent trigger is earliest); the stolen voice is reported on the
  allocation result so the caller can stop its audio.

```ts
import { VoiceManager } from "../instruments/voice-manager.js";

const voices = new VoiceManager({ maxVoices: 3 });
voices.noteOn(60, 100, 0);
voices.noteOn(64, 100, 0.1);
const third = voices.noteOn(67, 100, 0.2); // steals note 60 (oldest)
// third.stolen.note === 60
voices.noteOff(67, 0.5); // frees the slot for reuse
```

## Determinism guarantees

Instrument rendering is deterministic: the same instrument definition plus the
same note/velocity sequence produces **byte-identical offline output** at a
pinned sample rate (`44100 Hz`). This is enforced by the determinism
snapshot suite (`src/instruments/__tests__/determinism.test.ts`), which
compares live renders against committed golden SHA-256 hashes
(`src/instruments/__tests__/fixtures/determinism-hashes.json`).

Regenerate the golden fixtures — the **only** sanctioned way — when a
deliberate engine change alters output:

```bash
npm run regenerate:determinism-fixtures
```

## Node and browser usage

Web Audio is accessed exclusively through `src/audio/web-audio.ts`, which
resolves to the browser's native Web Audio API in browsers and to the Node
`node-web-audio-api` package (lazily, runtime-guarded) in Node. The engine
module itself contains **no direct runtime-specific imports**, so the same
code drives both runtimes.

### Node — offline render

```ts
import { renderInstrument } from "../instruments/engine.js";

const events = [
  { type: "midiNoteOn", note: 60, velocity: 100, time: 0 },
  { type: "midiNoteOff", note: 60, velocity: 100, time: 0.4 },
];
const rendered = await renderInstrument(definition, events, {
  sampleRate: 44100,
  tail: 0.2,
});
// rendered.samples: Float32Array of PCM samples
```

### Node / browser — real-time playback

```ts
import { createRealtimeInstrument } from "../instruments/engine.js";

const instrument = createRealtimeInstrument(definition, { maxVoices: 8 });
instrument.noteOn(60, 100); // attack → decay → sustain
instrument.noteOff(60);     // release
```

In the browser, `createRealtimeInstrument` uses the native `AudioContext`;
the web demo (`web/src/audio.ts`) exposes `playInstrumentNote()` and lazy
`getRealtimeInstrument()` registration for the engine's real-time renderer.

## CLI — demo live MIDI note playback and .mid file playback

The `instrument` command group demos the playable presets from the terminal:
a note started with `noteon` **keeps sounding until `noteoff` is sent with the
same note number**, even though each invocation is a separate process. A small
persistent instrument daemon (`src/instruments/daemon.ts`) owns the real-time
audio engine; every CLI call is a thin client over a local socket.

```bash
# Hold MIDI note 60 (middle C) on the default (pluck) preset.
tf instrument noteon 60
# → Holding note 60 (pluck) at velocity 100.

# A one-shot note: automatic Note Off after 0.6 s.
tf instrument noteon 67 --preset bell --length 0.6

# Release exactly note 60; other held notes are unaffected (polyphonic).
tf instrument noteoff 60

# Inspect / control the daemon.
tf instrument status     # list held notes
tf instrument presets   # pluck, pad, bass, bell, string-lead, percussion
tf instrument stop      # stop the daemon and release everything
```

Options: `--preset <name>` (default `pluck`), `--velocity <1-127>` (default
`100`), `--length <seconds>` (auto Note Off), and `--json` for machine
readable output. Notes ring across invocations; a chord is just several
`noteon` commands before the matching `noteoff`s. The daemon shuts itself
down after an idle period once no notes are held, and honours
`TONEFORGE_INSTRUMENT_SOCKET` for a custom socket path.

### Play a Standard MIDI file

`instrument play <file.mid>` plays a Standard MIDI File through the same
engine ([TF-0MVBDU0RM007QTNR](midi-import.md) shipped the parse → events
layer; this item adds the CLI surface on top):

```bash
# Live playback through the real-time instrument daemon (needs a live device).
tf instrument play song.mid

# Offline deterministic render to a WAV — no audio device needed.
tf instrument play song.mid --output song.wav

# Offline pre-render + system player (works on WSL/headless).
tf instrument play song.mid --fallback

tf instrument play song.mid --preset pad --output pad.wav   # any registered preset
tf instrument play song.mid --json                         # machine-readable output

# Isolate one voice of a multi-track file (audition the bass on its own).
tf instrument play song.mid --track 3 --output bass.wav
tf instrument play song.mid --channel 9 --output drums.wav # by MIDI channel instead
tf instrument play song.mid --track 1,2 --output top.wav    # several tracks
```

The file is parsed with the shipped MIDI import (`src/midi/smf.ts` +
`src/midi/translate.ts`, TF-0MVBDU0RM007QTNR): delta times are resolved
through the **tempo map** (PPQ ticks → seconds, tempo changes honoured) and
multi-track files are merged into one deterministic stream (release-before-
retrigger tie-break). The offline modes render through `renderInstrument` at
a pinned 44100 Hz — same file + same preset ⇒ byte-identical WAV. An invalid
or unreadable file produces a clear UK-English error and non-zero exit, no
stack trace. `--output` and `--fallback` cannot be combined. On machines
without a live audio device the real-time path fails with the same actionable
message as `noteon`, naming the environment and suggesting `--output` /
`--fallback`.

If the daemon becomes unreachable **while the file is playing** — it is killed,
a rival daemon rebinds the socket, or a send times out — playback stops and the
command exits non-zero with an actionable error naming the daemon failure and
suggesting `--output` / `--fallback` (TF-0MVEYTTJ10067O90). Earlier versions
re-dispatched the raw argv through the hand-rolled parser, which dropped the
file positional and reported the misleading
`instrument play requires a MIDI file path (<file.mid>).` Every Note On is sent
with its own auto-release length, so notes already scheduled keep their
daemon-side auto-release and none is left held after the CLI exits.

#### Isolate a single voice: `--track` / `--channel`

Multi-track files merge every track into one stream by default. Two selectors
restrict the **parsed note events** before that merge
(TF-0MVEWJCRP006IXGC, discovered from TF-0MVDQP78X007OZNA):

- `--track <n>` — keep only the given **track index** (0-based, SMF file
  order; track 0 is usually the conductor).
- `--channel <n>` — keep only events on the given **MIDI channel** (0–15).

Both accept several values, comma-separated (`--track 1,3`) or repeated
(`--track 1 --track 3`). Multiple values select the union on each axis;
combining the flags selects the **intersection** — events whose track is
selected *and* whose channel is selected. With neither flag the full mixed
stream is unchanged (byte-identical renders).

The filter is a pure selection step: it happens before the deterministic merge
and never touches the engine, the tempo map or the merge logic. Tempo and
metre events live on the conductor track and are **always honoured**, so a
filtered voice keeps the file's original tempo map and duration. A filter that
leaves no note events (for example `--track 0`, the conductor track) reports
the existing `no note events found in '<file>'` error.

All three output paths — `--output`, `--fallback` and the live daemon — accept
a filtered stream. `--output` keeps the byte-identical determinism guarantee
within a fixed filter: same file + same preset + same selector ⇒ identical
WAV. Validation is explicit and UK-English: an out-of-range track names the
file's track count (`file has 6 tracks (0–5); got 7`), and out-of-range or
non-numeric channels report `expected a MIDI channel between 0 and 15` — never
a stack trace.

For the shipped leitmotif files the track/channel map is documented in
[MIDI sequences — §4](../../guides/midi-sequences-howto.md#4-arrange-give-each-voice-a-job)
and [§10](../../guides/midi-sequences-howto.md#10-using-the-files): for example
`leitmotif-action.mid` track 5 / channel 9 is the percussion voice (111 notes)
and `leitmotif-menu.mid` track 3 / channel 3 is the bass.

```bash
# Only the percussion voice of the action cue.
tf instrument play assets/music/leitmotif-action.mid --track 5 --output drums.wav
# The same voice, selected by channel.
tf instrument play assets/music/leitmotif-action.mid --channel 9 --output drums.wav

```

### Offline modes: no audio device needed

Real-time playback needs a live output device (`node-web-audio-api`). On WSL,
headless/CI machines or containers where no ALSA/JACK device is reachable,
`noteon` has two **device-free** modes (`src/instruments/offline-demo.ts`,
`TF-0MVBGEDQI008W4VH`):

```bash
# Render this note to a deterministic WAV (play it later with `tf play`).
tf instrument noteon 67 --preset bell --length 0.6 --output chime.wav

# Pre-render then play through the system player (`generate`'s path — the
# one that works on WSL/PulseAudio). Playback starts after a short render delay.
tf instrument noteon 60 --length 0.6 --fallback
```

Both modes render offline through the same deterministic `renderInstrument`
engine (no new synthesis): same note/velocity/preset/length ⇒ byte-identical
WAV. Without `--length` the note holds for 1 s (`DEFAULT_NOTE_HOLD_SECONDS`)
before the automatic Note Off, which keeps renders finite. `--output` and
`--fallback` cannot be combined.

### WSL / device-less detection

At startup the daemon probes real-time audio availability exactly once
(`src/instruments/audio-probe.ts`), attempting to construct the real-time
engine through the injectable factory. When no live output device is reachable
(a missing ALSA card, no JACK/PipeWire, `node-web-audio-api` throwing
`DeviceNotAvailable` / ALSA `Unknown PCM default`), it records
`audioDeviceAvailable: false` and also classifies the environment (WSL is
detected from a Microsoft `/proc/version`, or from `WSL_DISTRO_NAME` /
`WSL_INTEROP`).

So on WSL, in a container or on any headless machine:

```bash
# Fails fast with an actionable message that names the environment and
# suggests both alternatives — no raw cpal/ALSA traceback.
tf instrument noteon 60

# The message suggests these two recoverable alternatives:
tf instrument noteon 60 --output note.wav   # render a WAV to play elsewhere
tf instrument noteon 60 --fallback           # offline pre-render playback

tf instrument status --json   # includes environment, audioDeviceAvailable, notes
```

Metadata commands (`status`, `stop`, `presets`, `noteoff`) never crash on a
missing device; `status` shows a hint when audio is unavailable.

## Starter preset family

Six purpose-crafted presets ship as YAML files in `presets/instruments/`
(schema-valid, following the recipe-preset convention), discoverable through:

```ts
import { loadBundledInstrumentPresets, listInstruments, getInstrument } from "../instruments/presets.js";

await loadBundledInstrumentPresets();      // Node only (browser: no-op)
listInstruments();                          // ["pluck", "pad", "bass", "bell", "string-lead", "percussion"]
getInstrument("pluck")?.definition.envelope; // { attack, decay, sustain, release }
```

| Preset | Oscillator | Envelope character |
| --- | --- | --- |
| `pluck` | triangle | Fast attack, quick decay, low sustain, short release |
| `pad` | sawtooth | Slow attack, gentle decay, high sustain, long release |
| `bass` | square | Fast attack, medium decay, solid sustain |
| `bell` | sine | Near-instant attack, long decay, very low sustain |
| `string-lead` | sawtooth | Medium attack, warm sustain, expressive release |
| `percussion` | sine | Near-instant attack, fast decay to silence, low-passed — a tuned drum voice covering the kit register (low = kick, high = hat) |

Each preset renders deterministic, non-silent audio (verified per-preset by
`src/instruments/presets.test.ts`), and pluck is observably distinct from pad
in envelope shape.

## Limitations and follow-ups

- Programmatic API only — no raw MIDI bytes, Web MIDI hardware, pitch bend,
  channel pressure, or aftertouch in this item (MIDI **file** playback ships in
  the separate [MIDI file import](midi-import.md) module).
- Real-time Web Audio requires a live audio sink (headless Node environments
  fall back to offline rendering in tests).
- The starter family can grow through follow-up items; the registry and
  preset loader are ready for additional YAML presets.
