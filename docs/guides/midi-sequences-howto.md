---
title: "Authoring leitmotif game sequences as MIDI"
description: "End-to-end how-to for composing two 8-bar game loops — a calm menu underscore and a driving action cue — from the shared motif-waves-end leitmotif, covering motif analysis, form, harmony, arrangement, voicing, MIDI implementation and regeneration."
---

# Authoring leitmotif game sequences as MIDI

This guide walks through the complete creation of two 8-bar game sequences
derived from one melodic idea, delivered as standard MIDI files:

| File | Feel | Tempo | Form | Use |
| --- | --- | --- | --- | --- |
| [`assets/music/leitmotif-menu.mid`](../../assets/music/leitmotif-menu.mid) | Calm underscore | 84 BPM | 8 bars, loopable (resolves to I) | Menu screens *between* play sessions |
| [`assets/music/leitmotif-action.mid`](../../assets/music/leitmotif-action.mid) | Driving cue | 132 BPM | 8 bars, through-composed with an energy curve | In-session gameplay |

Both are **Format 1** Standard MIDI Files at **480 PPQ**, carrying a General
MIDI program change and channel volume per voice, and both are **regenerated
byte-for-byte** from one in-repo script — the single source of truth.

> **Prerequisites:** familiarity with the
> [instruments](../modules/instruments.md) and
> [MIDI file import](../modules/midi-import.md) modules. The
> `motif-waves-end` leitmotif itself is the Tier 4 melody from the
> [Casual Game Recipe Book](../recipe-book/index.md).

## 1. Start from one motif

A leitmotif is a short, memorable figure that can be *recoloured* rather than
replaced: the same notes become calm or anxious depending on tempo, harmony,
orchestration and register. Both sequences below quote the **same** motif so
they read as "the same game".

`motif-waves-end` (work item **TF-0MV9OLWO6005ZI8E**, `presets/recipes/motif-waves-end.yaml`)
is a four-note C-major figure:

| Step | Note | MIDI | Semitone move | Role |
| --- | --- | --- | --- | --- |
| 1 | G4 | 67 | — | leap up a fourth |
| 2 | C5 | 72 | +5 | tonic — **relief** |
| 3 | E5 | 76 | +4 | major third, the triad closes |
| 4 | F#5 | 78 | +2 | **raised fourth — worry tail** |

The first three notes outline a C major triad (`G–C–E`), which sounds
resolved and safe; the final `F#` is the raised fourth of C (a Lydian colour)
that leans upward and refuses to settle. That single chromatic note is what
makes the motif read as *relief, then a flicker of worry*. Everything else in
this guide is elaboration around those four notes.

Keep the motif recognisable by quoting it **literally at least once per
sequence** — the menu states it whole in bar 1, and the action cue does the
same in bar 1, so a player who hears the menu then the game recognises the
tune instantly.

## 2. Choose an 8-bar form and a harmonic plan

Eight bars of 4/4 is the sweet spot for a game loop: long enough to establish
a key and a phrase, short enough to loop without fatigue. Split it into two
four-bar phrases, and decide the **cadence** of each:

- **Phrase 1** ends on a non-final chord (half cadence) to keep the music
  moving.
- **Phrase 2** ends where you want the loop to restart from.

### Menu: a loopable arc

The menu loops while the player sits on a screen, so bar 8 must resolve to the
tonic (I) for a seamless return to bar 1.

| Bar | Chord | Roman | Voiced (bottom → top) |
| --- | --- | --- | --- |
| 1 | C | I | C4 E4 G4 |
| 2 | Am | vi | A3 C4 E4 |
| 3 | F | IV | F3 A3 C4 |
| 4 | G | V | G3 B3 D4 |
| 5 | C | I | C4 E4 G4 |
| 6 | Fmaj7 | IVmaj7 | F3 A3 C4 E4 |
| 7 | Am | vi | A3 C4 E4 |
| 8 | C | I | C4 E4 G4 C5 |

Phrase 1 (`I–vi–IV–V`) ends on the dominant at bar 4. Phrase 2
(`I–IVmaj7–vi–I`) floats through the major-seventh colour and lands back on
C, so the loop point is invisible. The final bar doubles the root at the
octave to signal "arrival" without adding a new idea.

### Action: a driving arc with an energy curve

The action cue plays *during* the session, so it favours momentum over
resolution. The same I–V–vi–IV loop is repeated twice — a stable harmonic
bed the listener can lock onto while the surface rhythm intensifies:

| Bar | 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8 |
| --- | --- | --- | --- | --- | --- | --- | --- | --- |
| Chord | C | G | Am | F | C | G | Am | C |
| Roman | I | V | vi | IV | I | V | vi | I |
| Energy | ▁ | ▂ | ▂ | ▃ | ▃ | ▄ | ▅ | █ |

The harmony repeats, but the **arrangement** does not: phrase 1 states the
motif in quarter notes, phrase 2 doubles the rhythmic density (eighth-note
melody, eighth-note bass throughout, 16th-note drum build in bars 7–8). That
separation of *what changes* (rhythm, texture) from *what stays put* (harmony)
is the cheapest way to write an escalating cue.

## 3. Decide tempo and fit

Tempo is a compositional decision, not a byte: the same MIDI at 84 and 132 BPM
is the difference between a lullaby and a chase.

| | Menu | Action |
| --- | --- | --- |
| BPM | 84 | 132 |
| Microseconds/beat | 714 286 | 454 545 |
| 4/4 bar length | ≈ 2.857 s | ≈ 1.818 s |
| 8-bar duration | ≈ 22.86 s | ≈ 14.55 s |
| Melodic unit | quarter note | quarter → eighth |
| Loop strategy | resolve to I at bar 8 | through-composed, ends on I |

- **84 BPM** keeps the quarter-note motif unhurried and lets each note ring —
  a calm underscore should feel like it has room to breathe.
- **132 BPM** is fast enough that the eighth-note bass and hats generate
  momentum, but not so fast that the melody blurs. Reaching for a naive
  1.5 × (126 BPM) would sound boxy; 132 gives a rounder, more propulsive feel.
- Keep both at 4/4 so they share a grid and can be cross-faded or beat-matched
  if a game transitions between menu and gameplay.

## 4. Arrange: give each voice a job

A full mix is a division of labour. Every track answers one question:

| Track (menu) | # | MIDI channel | Role | ToneForge preset | GM program |
| --- | --- | --- | --- | --- | --- |
| Conductor | 0 | — | Tempo + metre | — | — |
| Pad | 1 | 1 | Sustained harmony | `pad` | 89 Warm Pad |
| Melody | 2 | 2 | The motif and its answers | `string-lead` | 48 String Ensemble 1 |
| Bass | 3 | 3 | Harmonic foundation | `bass` | 32 Acoustic Bass |
| Bell | 4 | 4 | Sparse sparkle / accents | `bell` | 10 Music Box |

| Track (action) | # | MIDI channel | Role | ToneForge preset | GM program |
| --- | --- | --- | --- | --- | --- |
| Conductor | 0 | — | Tempo + metre | — | — |
| Pad | 1 | 1 | Sustained harmony | `pad` | 89 Warm Pad |
| Melody | 2 | 2 | Motif engine | `pluck` | 45 Pizzicato Strings |
| Bass | 3 | 3 | Driving eighth-note line | `bass` | 38 Synth Bass 1 |
| Bell | 4 | 4 | Octave shimmer | `bell` | 9 Glockenspiel |
| Percussion | 5 | 9 | Kit rhythm | `drum-kit` | 0 Standard Kit (GM channel 10) |

The **#** column is the 0-based SMF track index and the **MIDI channel**
column is the zero-based channel — exactly what `toneforge instrument play
--track <n>` / `--channel <n>` select ([§10](#10-using-the-files)).

Each track sets its **track name to the ToneForge preset it is voiced for**
(e.g. `melody (ToneForge: pluck, GM 45)`), so the same file is both a DAW-ready
MIDI sequence and a description of how to render it through ToneForge presets.
Every voice track also emits a **CC7 (channel volume)** message at tick 0 to
balance the parts without touching the notes.

Arrangement principles used here:

- **One idea per register.** Pad in the middle (C4–C5), melody on top
  (C5–G5), bass at least an octave below the pad, bells higher still. Voices
  that share a register compete; voices that are separated blend.
- **Leave the motif room.** The pad holds whole-bar chords on purpose — if the
  accompaniment moves as much as the melody, the motif stops being the
  foreground.
- **Add energy by density, not volume.** The action cue's escalation is more
  notes (eighth/16th subdivisions), not a bigger velocity push.

## 5. Voicing: make the chords speak

"Voicing" is *how* you spell and stack a chord — it decides whether a
progression sounds smooth, static or muddy, even when the chord symbols never
change. Four decisions cover it: voice-leading, register/spacing, doubling
and chord colour.

### 5.1 Voice-leading

For the pad we deliberately use **parallel (planing) triads**: every voice
moves by the same interval between chords.

```
C   [C4 E4 G4]          bar 1
Am  [A3 C4 E4]   down 3  bar 2   (parallel minor thirds)
F   [F3 A3 C4]   down 3  bar 3
G   [G3 B3 D4]   up   2  bar 4   (parallel tones)
C   [C4 E4 G4]   up   5  bar 5   (parallel fourths)
```

Planing keeps the pad's colour perfectly even — every chord has the same
weight — which is exactly what a background pad wants. The trade-off is that
it sounds static; for a foreground progression you would instead **invert the
chords** so individual voices move by step. Both choices are legitimate; the
technique should follow the role.

### 5.2 Register and spacing

- Keep chord tones in a **close position** inside one octave (the pad spans a
  fifth to a seventh) so the harmony is intelligible.
- **Keep at least a full octave between the bass root and the pad's lowest
  note** (the menu's bass moves C2–F2 against a pad rooted C4–F3) to avoid
  low-register mud.
- Put the melody **above** the pad's top note. In both sequences the pad tops
  out at C5 and the melody lives at C5+, so the tune is never masked.

### 5.3 Doubling

Double sparingly and with intent:

- **Octave doubling at cadences.** Bar 8 of both sequences adds C5 above the
  C4 root — an octave double that thickens the final chord.
- **Bass octave jumps.** The action bass line alternates root and root + 12
  (`R R R+12 R+7 …`); the octave leap is what makes an eighth-note bass feel
  like a hook rather than filler.
- **Bell octave accents.** From bar 5 the action bells double selected melody
  notes at +12 for a metallic glint; they never double *every* note, which
  would turn shimmer into clutter.

### 5.4 Chord colour

Voicing is also where colour notes live:

- **Fmaj7 in menu bar 6.** The E4 is carried over unchanged from the bar-5
  C chord, so the bass moves C→F while the upper voices barely stir — a
  floating major-seventh that never feels abrupt.
- **Suspend the worry.** The motif's F# is voiced as a passing colour over C
  and G, never held as a chord tone, so the "worry" reads as a flicker rather
  than a key change.

## 6. The motif at work, bar by bar

Once the harmony is fixed, place the motif and its transformations against it.

**Menu melody** — state, answer, vary, resolve:

- Bars 1–4: the motif stated literally (bar 1), answered by a descending
  echo (bar 2), reshaped over the subdominant (bar 3), then pushed to the
  half cadence (bar 4).
- Bars 5–8: the motif returns (bar 5), the major-seventh colour softens it
  (bar 6), a stepwise descent `E–D–C–B` prepares the cadence (bar 7), and
  `C–E–G` resolves with the G held into the loop point (bar 8).

**Action melody** — same notes, new engine:

- Bars 1–4: the motif in quarter notes, identical pitches to the menu's
  bar 1, then rising/oscillating paraphrases.
- Bars 5–8: the motif's notes re-cut as eighth notes (`G–E–C–E…`), with
  accents on the off-beats, ending on a high C6 — the same theme at twice the
  rhythmic resolution.

## 7. MIDI implementation

### File structure

Both files are **Format 1** (one conductor track plus one track per voice),
**480 PPQ** (ticks per quarter note). At 480 PPQ:

| Symbol | Ticks |
| --- | --- |
| 16th note | 120 |
| Eighth note | 240 |
| Beat (quarter) | 480 |
| 4/4 bar | 1920 |
| 8 bars | 15 360 |

The **conductor track** carries the `setTempo` (µs/beat) and a `timeSignature`
(4/4) meta event at tick 0. One tempo per file is deliberate — no tempo maps,
no automation — so the timeline is trivially reproducible.

### Channels, programs and controllers

- **GM program changes** are written at tick 0 of each voice track (see the
  tables in [§4](#4-arrange-give-each-voice-a-job)), so the file sounds
  appropriate in any DAW or General MIDI synth.
- **Percussion** uses **channel 9 (zero-based)** — GM channel 10 — where MIDI
  note numbers select the kit: 36 kick, 38 snare, 42 closed hi-hat, 46 open
  hi-hat, 49 crash and 39 clap. ToneForge voices channel 9 through the
  six-voice [`drum-kit`](../../presets/instruments/drum-kit.yaml) preset (see
  [The drum kit](#the-drum-kit)).
  A program change of 0 selects the Standard Kit (GM ignores programs on the
  drum channel, but the message is harmless and some hosts expect it).
- **CC7** sets per-channel volume for a balanced mix.
- Note-offs are written explicitly as `0x80` Note Off events (not Note On
  with velocity 0), and running-status compression is disabled — both choices
  keep the byte stream unambiguous and reproducible.
- ToneForge's engine renders a whole file through one preset when previewed
  from the CLI, so the *same file* can be auditioned through any single
  preset; the drum kit voices channel 9 correctly while ignoring melodic
  notes, and a multi-voice render routes each channel to its own preset
  (channel 9 → `drum-kit`).

### The drum kit

The instrument schema is **oscillator + ADSR + optional filter**, and the
oscillator is either one of the four classic waveforms or a **seeded noise
generator** (`{ type: "noise", color: "white" | "pink" | "brown", seed? }`).
Noise makes believable drums, cymbals and foley possible without shipping
samples.

The [`drum-kit`](../../presets/instruments/drum-kit.yaml) preset is one
instrument whose note-on dispatches to a **per-note voice** (the schema's
`voices` map). It ships the six core General MIDI voices:

| GM note | Voice | Synthesis approach |
| --- | --- | --- |
| 36 | Kick | Pitched sine body with a fast pitch drop plus a high-passed noise click |
| 38 | Snare | Pitched triangle shell tone plus a high-passed white-noise rattle |
| 39 | Clap | Four short band-passed noise bursts spaced a few milliseconds apart, with a longer noise tail |
| 42 | Closed hi-hat | White noise high-passed around 7 kHz with a very fast decay |
| 46 | Open hi-hat | The same bright recipe with a much longer decay |
| 49 | Crash | Bright high-passed noise plus a pink-noise wash, decaying over more than a second |

Every noise source is **seeded** (one fixed seed per voice), so a hit renders
byte-identically on every machine and run — no clocks, no `Math.random`. Each
voice is a **one-shot**: a short MIDI note-off never truncates a hit; it
always decays to silence on its own.

Notes outside the six-voice map are **ignored deterministically**. That is
deliberate: rendering a melodic file through the kit yields silence for the
melodic notes, so a GM drum track can be auditioned on its own. Select the kit
from the CLI with `--preset drum-kit`:

```bash
# Render the action cue's drums (melodic notes are ignored).
toneforge instrument play assets/music/leitmotif-action.mid --preset drum-kit --output drums.wav

# Or audition the drum track alone first (see §10), then render it through the kit.
toneforge instrument play assets/music/leitmotif-action.mid --track 5 --preset drum-kit --output drums.wav

# A single kick hit.
toneforge instrument noteon 36 --preset drum-kit --output kick.wav
```

The action cue's percussion track (channel 9) is voiced by this kit: kick 36,
snare 38, closed hi-hat 42 and crash 49 (the arrangement uses four of the six
voices). The notes, velocities and timings are unchanged from the pre-kit
version — only the instrument that voices them changed.

The legacy single-voice
[`percussion`](../../presets/instruments/percussion.yaml) preset remains
registered as a fallback: one tuned, fast-decaying sine with a low-pass
filter, where low notes land like a kick and high notes read as a hat.

## 8. Write it with the MIDI writer

Files are authored in TypeScript through
[`src/midi/writer.ts`](../../src/midi/writer.ts), a thin, validated,
deterministic wrapper around the `midi-file` `writeMidi` writer:

```ts
import { writeSmfBytes } from "../midi/writer.js";

const bytes = writeSmfBytes({
  format: 1,
  ticksPerBeat: 480,
  tracks: [
    [
      { type: "trackName", deltaTime: 0, text: "Conductor" },
      { type: "setTempo", deltaTime: 0, microsecondsPerBeat: 714286 },
      { type: "timeSignature", deltaTime: 0, numerator: 4, denominator: 4 },
    ],
    [
      { type: "trackName", deltaTime: 0, text: "melody" },
      { type: "programChange", deltaTime: 0, channel: 2, programNumber: 48 },
      { type: "noteOn", deltaTime: 0, channel: 2, noteNumber: 67, velocity: 92 },
      { type: "noteOff", deltaTime: 440, channel: 2, noteNumber: 67, velocity: 0 },
    ],
  ],
});
```

The writer validates every field (channel 0–15, note/program/velocity 0–127,
non-negative integer deltas, positive tempo), appends the mandatory
end-of-track meta event, and pins the serialisation options so identical input
always yields identical bytes. Written files parse straight back through the
[midi-import](midi-import.md) read pipeline (`parseMidiFile` /
`parseMidiToInstrumentEvents`).

## 9. Regenerate the files

The composition lives in
[`scripts/sequences/author-leitmotif.ts`](../../scripts/sequences/author-leitmotif.ts);
the `.mid` files are **build outputs**, never hand-edited binaries.

```bash
npm run regenerate:leitmotif-music
```

**Determinism.** The script contains no randomness, no clock reads and no
OS-dependent values — the entire composition is specified in code. Running it
any number of times produces byte-identical files (a stronger guarantee than
seeding an RNG). Two tests enforce this:

- `scripts/sequences/author-leitmotif.test.ts` regenerates in memory and
  asserts the bytes match the committed files exactly.
- `src/midi/leitmotif-sequences.test.ts` parses both committed files through
  the read pipeline and asserts their format, PPQ, tempo, motif content and
  per-channel GM metadata.

To change the music, edit the script and re-run the command above; commit the
script **and** the regenerated `.mid` files together.

## 10. Using the files

**In a DAW or game engine:** import the `.mid` directly. Format 1 keeps the
voices on separate tracks, the GM program changes choose sensible timbres, and
channel 10 plays drums. Set the loop range to bars 1–8 (menu) for a seamless
loop.

**Through ToneForge (single-preset preview):**

```bash
toneforge instrument play assets/music/leitmotif-menu.mid --preset pad --output menu.wav
toneforge instrument play assets/music/leitmotif-action.mid --preset pluck --output action.wav
```

**Audition one voice at a time:** `instrument play --track <n>` / `--channel <n>`
restricts the note stream to the selected track(s)/channel(s) before the merge,
so a single part can be heard in isolation without a DAW. The track numbers and
channels are in the tables in [§4](#4-arrange-give-each-voice-a-job):

```bash
# Action cue: only the percussion track (track 5, MIDI channel 9).
toneforge instrument play assets/music/leitmotif-action.mid --track 5 --output drums.wav

# The same voice selected by channel instead of track.
toneforge instrument play assets/music/leitmotif-action.mid --channel 9 --output drums.wav

# Several tracks at once (melody + bass), comma-separated or repeated.
toneforge instrument play assets/music/leitmotif-action.mid --track 2,3 --output top-and-bottom.wav

# Menu cue: only the bass line (track 3).
toneforge instrument play assets/music/leitmotif-menu.mid --track 3 --output bass.wav
```

Both flags accept multiple values and, when combined, select the intersection
(a selected track **and** a selected channel). Tempo/metre events on the
conductor track (track 0) are always honoured, so every isolated voice keeps
the file's original tempo and duration. See
[Instruments — Play a Standard MIDI file](../modules/instruments.md#play-a-standard-midi-file)
for the full CLI semantics.

**Multi-voice rendering:** route each MIDI channel to the preset named in its
track title (`pad`, `string-lead`/`pluck`, `bass`, `bell`, `drum-kit`) for
the intended balance. The mapping is in the file itself.

## Reference

- Writer: [`src/midi/writer.ts`](../../src/midi/writer.ts)
- Authoring script: [`scripts/sequences/author-leitmotif.ts`](../../scripts/sequences/author-leitmotif.ts)
- Read pipeline: [MIDI file import](midi-import.md), [`src/midi/smf.ts`](../../src/midi/smf.ts), [`src/midi/translate.ts`](../../src/midi/translate.ts)
- Instruments & presets: [instruments module](../modules/instruments.md)
- Source work items: **TF-0MVDQP78X007OZNA** (this feature), **TF-0MV9OLWO6005ZI8E** (`motif-waves-end`), **TF-0MVBDU0RM007QTNR** (MIDI import), **TF-0MVCSYRQM008P812** (CLI `.mid` playback).
