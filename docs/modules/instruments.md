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
> API only**. There is no raw MIDI byte decoder, no Web MIDI API hardware
> binding and no MIDI file playback (those are recorded follow-ups). See the
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

## Starter preset family

Five purpose-crafted presets ship as YAML files in `presets/instruments/`
(schema-valid, following the recipe-preset convention), discoverable through:

```ts
import { loadBundledInstrumentPresets, listInstruments, getInstrument } from "../instruments/presets.js";

await loadBundledInstrumentPresets();      // Node only (browser: no-op)
listInstruments();                          // ["pluck", "pad", "bass", "bell", "string-lead"]
getInstrument("pluck")?.definition.envelope; // { attack, decay, sustain, release }
```

| Preset | Oscillator | Envelope character |
| --- | --- | --- |
| `pluck` | triangle | Fast attack, quick decay, low sustain, short release |
| `pad` | sawtooth | Slow attack, gentle decay, high sustain, long release |
| `bass` | square | Fast attack, medium decay, solid sustain |
| `bell` | sine | Near-instant attack, long decay, very low sustain |
| `string-lead` | sawtooth | Medium attack, warm sustain, expressive release |

Each preset renders deterministic, non-silent audio (verified per-preset by
`src/instruments/presets.test.ts`), and pluck is observably distinct from pad
in envelope shape.

## Limitations and follow-ups

- Programmatic API only — no raw MIDI bytes, Web MIDI hardware, MIDI files,
  pitch bend, channel pressure, or aftertouch in this item.
- Real-time Web Audio requires a live audio sink (headless Node environments
  fall back to offline rendering in tests).
- The starter family can grow through follow-up items; the registry and
  preset loader are ready for additional YAML presets.
