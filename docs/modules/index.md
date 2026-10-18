---
title: "Sound Module Index"
id: "modules-index"
order: 0
description: "Every ToneGraph sound-node kind, grouped by primary function, with use cases, availability and reference links."
---

# Sound Module Index

A **sound module** is a ToneGraph *node kind* — one of the DSP building blocks
you wire together in a graph to build a sound. A recipe is a small ToneGraph
document that combines these modules into a reusable effect; this index is the
catalogue you browse before writing or editing one.

Each module below is grouped by its **primary function** and lists a short
use-case description, its availability status, and a link to the authoritative
parameter reference in the [ToneGraph v0.1 Specification](../tonegraph.md).
You route modules together with `routing`, schedule them over time with
`sequences` and node automation, and collect the result at a single
`destination`. Those are graph-level constructs rather than modules, so they
are described in the specification rather than catalogued here.

Looking for the playable, pitch-driven **instruments** capability (Note On /
Note Off voices, ADSR envelopes and polyphony)? See the
[Instruments module](instruments.md) — a distinct, complementary capability to
one-shot recipes.

Importing an existing **Standard MIDI file** (`.mid`) so those instruments can
play it? See the [MIDI file import](midi-import.md) module — SMF parsing with
deterministic tempo-map timing into the same note-event API. Want to **write**
a `.mid` file instead? See the [Authoring leitmotif game sequences as
MIDI](../guides/midi-sequences-howto.md) guide — the `src/midi/writer.ts` util
plus two worked 8-bar sequences.

## Node kinds at a glance

| Primary function | Node kinds |
| --- | --- |
| Generation | `oscillator`, `noise`, `bufferSource`, `fmPattern` |
| Filtering & tone shaping | `biquadFilter` |
| Amplitude shaping & mixing | `envelope`, `gain` |
| Modulation & control | `lfo`, `constant` |
| Output & routing | `destination` |

## Generation

### `oscillator`

Generates a pitched tone from one of four classic waveforms (`sine`, `square`,
`sawtooth`, `triangle`) at a chosen frequency and detune. Reach for it whenever
you need a clear musical pitch, from UI blips and melodic motifs to sustained
pads. Pair it with an `envelope` to shape the note and a `biquadFilter` to
soften harsh harmonics.

**Availability:** Implemented in ToneGraph v0.1.
**Reference:** [Kind parameters](../tonegraph.md#oscillator)

### `noise`

Produces broadband noise in white, pink or brown colouration, which is ideal
for percussive hits, whooshes and texture. Use it for impacts, footsteps, wind
and static where a definite pitch would sound artificial. Because noise has no
fundamental frequency, shape it with a `biquadFilter` and an `envelope` to
build convincing effects.

**Availability:** Implemented in ToneGraph v0.1.
**Reference:** [Kind parameters](../tonegraph.md#noise)

### `bufferSource`

Plays back a referenced audio sample, optionally looping and at a chosen
playback rate. Reach for it when the sound must come from recorded or rendered
material rather than synthesis, such as voice lines or pre-rendered textures.
Adjust `playbackRate` to transpose the sample or to derive pitch-shifted
variants from one asset.

**Availability:** Implemented in ToneGraph v0.1.
**Reference:** [Kind parameters](../tonegraph.md#buffersource)

### `fmPattern`

Synthesises a tone using frequency modulation, with separate carrier and
modulator frequencies plus a modulation index. Use it for metallic, bell-like
or gritty timbres that are hard to achieve with a plain oscillator. Raising the
modulation index produces brighter, more complex spectra, which is useful for
sci-fi and arcade effects.

**Availability:** Implemented in ToneGraph v0.1.
**Reference:** [Kind parameters](../tonegraph.md#fmpattern)

## Filtering & tone shaping

### `biquadFilter`

Shapes a signal's frequency content with a lowpass, highpass or bandpass
filter, with adjustable cutoff, resonance (`Q`) and gain. Reach for it to
remove harsh highs, carve space for other layers, or sweep the cutoff for
movement. It is the standard tool for warming up oscillators and noise without
changing their fundamental character.

**Availability:** Implemented in ToneGraph v0.1.
**Reference:** [Kind parameters](../tonegraph.md#biquadfilter)

## Amplitude shaping & mixing

### `envelope`

Shapes a signal's amplitude over time with the classic attack, decay, sustain
and release stages. Use it to turn a continuous source such as an `oscillator`
or `noise` into a playable, percussive or swelling event. Its release ramp is
scheduled inside the render window, so short envelopes give tight blips while
long ones give evolving pads.

**Availability:** Implemented in ToneGraph v0.1.
**Reference:** [Kind parameters](../tonegraph.md#envelope)

### `gain`

Scales the level of a signal by a fixed factor, from silence to amplification.
Reach for it to mix layers, to balance a sub-mix before the destination, or to
automate a volume swell over time. It is the simplest way to stop a multi-node
patch from clipping while preserving each source's character.

**Availability:** Implemented in ToneGraph v0.1.
**Reference:** [Kind parameters](../tonegraph.md#gain)

## Modulation & control

### `lfo`

Generates a low-frequency oscillation that can drive another node's parameter
for vibrato, tremolo or filter movement. Use it when a static setting sounds
lifeless and you want periodic, cyclical change. Its rate, depth and offset
control how fast and how far the target parameter moves.

**Availability:** Implemented in ToneGraph v0.1.
**Reference:** [Kind parameters](../tonegraph.md#lfo)

### `constant`

Supplies a fixed numeric value that can be routed or automated like any other
control signal. Reach for it as an offset, a threshold, or a stable reference
that other nodes read, especially in generated or templated recipes. It emits
no audible signal on its own and is intended for control and modulation duty.

**Availability:** Implemented in ToneGraph v0.1.
**Reference:** [Kind parameters](../tonegraph.md#constant)

## Output & routing

### `destination`

The terminal node that represents the graph's audio output. Every audible path
should ultimately route to a single destination, where the final mix leaves the
graph. Declare it once and treat it as the sink that collects the blended
signal from the modules above.

**Availability:** Implemented in ToneGraph v0.1.
**Reference:** [Kind parameters](../tonegraph.md#destination)

## See also

- [ToneGraph v0.1 Specification](../tonegraph.md) — routing, buses,
  namespaces, node automation and sequences.
- [Casual Game Recipe Book](../recipe-book/index.md) — 100 worked recipes that
  combine these modules into reusable sounds.
- [Core Module PRD](../prd/CORE_PRD.md) — the recipe and synthesis model the
  node kinds serve.
