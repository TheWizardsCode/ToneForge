---
title: "MIDI file import (parse .mid into instrument note events)"
id: "midi-import"
order: 61
description: "Import standard MIDI files (.mid) by parsing SMF and translating track events into the instruments engine's midiNoteOn/midiNoteOff messages, with deterministic tempo-map timing."
---

# MIDI file import (parse `.mid` into instrument note events)

ToneForge imports standard **`midi-file`** (Standard MIDI File `.mid`)
playback into the [instruments](instruments.md) engine: parse the SMF binary,
resolve each event's delta time (PPQ ticks → seconds via the **tempo map**)
and translate the result into the exact `midiNoteOn` / `midiNoteOff`
`InstrumentEvent[]` messages `renderInstrument` already renders. No new
synthesis — the engine plays the import like any other note sequence.

> **Scope boundary:** this module ships **file import only** — parsing an SMF
> file into engine events. Web MIDI API hardware binding
> (`navigator.requestMIDIAccess`), velocity curves and pitch bend / CC /
> aftertouch transport are separate follow-ups, not this slice. Writing files
> is covered by the new `src/midi/writer.ts` util (`writeSmfBytes`) and the
> [MIDI sequences how-to guide](midi-sequences-howto.md).

## Quick start

The import path lives under `src/midi/`, with no engine or bundle coupling:

```ts
import { readFileSync } from "node:fs";
import { parseMidiToInstrumentEvents } from "toneforge/dist/midi/translate.js";
// TypeScript source imports (in-repo):
// import { parseMidiToInstrumentEvents } from "../midi/translate.js";
import { renderInstrument, getInstrument } from "./instruments/index.js";

const bytes = new Uint8Array(readFileSync("melody.mid"));
const events = parseMidiToInstrumentEvents(bytes);   // → InstrumentEvent[]

const rendered = await renderInstrument(
  getInstrument("pluck")!.definition,
  events,
  { sampleRate: 44100 },
);
```

| Export (from `src/midi/smf.ts`) | Purpose |
| --- | --- |
| `parseMidiFile(bytes)` | Parse SMF bytes into the engine-neutral `ParsedMidi` (header + delta-timed note/tempo events) |
| `buildTempoMap(parsed)` | Deterministic PPQ tick → seconds resolver honouring every `setTempo` event (default 120 BPM) |
| `TempoMap.tickToSeconds(tick)` | Absolute seconds for an absolute tick |

| Export (from `src/midi/translate.ts`) | Purpose |
| --- | --- |
| `smfToInstrumentEvents(parsed)` | Translate a parsed file into time-sorted `midiNoteOn` / `midiNoteOff` `InstrumentEvent[]` |
| `parseMidiToInstrumentEvents(bytes)` | Parse + translate in one step |
| `compareInstrumentEvents(a, b)` | The documented deterministic sort |

## How it works

- **Parsing** — SMF bytes are parsed by the pinned, MIT-licensed
  `midi-file` dependency (pure array-based JavaScript, zero dependencies, no
  Node built-ins), wrapped behind `src/midi/smf.ts` (parser) and
  `src/midi/writer.ts` (writer) so nothing else in the codebase touches the
  library directly.
- **Tempo map** — every `setTempo` meta event across all tracks is gathered in
  absolute-tick order; between tempo changes the tempo is constant, so
  `seconds = segmentStart + (tick − segmentStartTick) × µsPerBeat /
  ticksPerBeat / 1e6`. Files without tempo events play at the default 120 BPM.
  PPQ requires a positive division; SMPTE-timed files are rejected by
  `buildTempoMap` with a clear error.
- **Translation** — note events become structured `midiNoteOn` / `midiNoteOff`
  messages via the standard builders (validated to MIDI range 0–127). A
  `noteOn` with velocity 0 is normalised to a `noteOff` by the SMF parser, as
  the spec allows.
- **Multi-track merge** — every track is flattened into one event stream
  sorted by absolute time. At equal times the tie-break is deterministic and
  documented: `midiNoteOff` before `midiNoteOn` (so a release clears the voice
  before a same-instant retrigger), then note ascending, then velocity
  ascending.
- **Determinism** — parsing and translation read no clock and touch no global
  state: the same `.mid` bytes always produce byte-identical events and
  renders (verified by the committed-fixture tests at a pinned 44100 Hz).

## Fixtures and tests

Committed hand-authored fixtures live in `src/test-utils/fixtures/midi/`
(regenerate with `npm run regenerate:midi-fixtures`):

- `chord.mid` — format 0: a simultaneous C major chord (C4/E4/G4), used for
  polyphony, release-to-silence and byte-identical renders.
- `melody.mid` — format 1, three tracks: a 120 → 60 BPM tempo change, a
  C5 D5 E5 F5 A4 melody (the A4 spans the tempo change) and a C3 bass track,
  used for tempo-map timing, deterministic multi-track merge and pitch
  assertions.

The tests assert observable behaviour only: parse results against the raw
header/track data, exact event ordering after the merge, rendered pitch via
dominant-frequency estimation, and byte-identical output for identical input.

## CLI playback surface

`toneforge instrument play <file.mid>` (TF-0MVCSYRQM008P812) plays a `.mid`
file through the instruments engine: parse → events → offline WAV render
(`--output`), offline pre-render + system player (`--fallback`) or live
streaming through the real-time instrument daemon (default). The parse →
events translation in this module is reused as-is — no new parser and no
new engine work — and the same determinism guarantee (same file + same preset
⇒ byte-identical WAV) holds. If the real-time daemon becomes unreachable
mid-stream, playback stops with an actionable daemon error (suggesting
`--output` / `--fallback`) rather than a misleading missing-file message
(TF-0MVEYTTJ10067O90). See [Instruments — CLI](instruments.md#cli--demo-live-midi-note-playback-and-mid-file-playback).

## Limitations and follow-ups

- File import only — no Web MIDI hardware binding, velocity curves, pitch
  bend, CC or aftertouch in this slice (recorded follow-ups from the parent
  epic TF-0MV9PIBNV008C00R intake).
- Chords and notes sound through the instrument's fixed velocity→gain mapping;
  per-note expressive control is future work.
- The CLI surface for playing a `.mid` file (`toneforge instrument play`) ships
  in TF-0MVCSYRQM008P812 — this item is the parse → events layer only.
