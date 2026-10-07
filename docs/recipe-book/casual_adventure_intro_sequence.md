---
title: "Casual Adventure Intro Sequence"
id: "casual_adventure_intro_sequence"
order: 110
description: "Casual adventure intro: an adventure-call sting, a short start-game fanfare and an air swish launching a new journey."
---

# Casual Adventure Intro Sequence

**Capstone Sequence** · presets/sequences

## Sound design

### Overview

An adventure-call sting, a short start-game fanfare and an air swish launching a new journey.

### Layered structure

`sting-adventure-call` announces the start at 0 ms, `motif-start-game-fanfare-short` answers at 350 ms and `whoosh-air-swish` carries the transition at 750 ms. The swish tail leaves space for the first scene to begin.

### Voices

| Recipe | Time | Seed offset | Gain |
|--------|------|-------------|------|
| `sting-adventure-call` | 0.00 s | 0 | 1.00 |
| `motif-start-game-fanfare-short` | 0.35 s | 1 | 0.90 |
| `whoosh-air-swish` | 0.75 s | 2 | 0.70 |

### Seed behaviour & musical intent

With a fixed seed the whole arrangement renders byte-identical audio on every platform and run; changing the seed varies the texture while preserving the structure. An opening cue for new games, worlds and chapters.

## ToneForge CLI

```bash
# Simulate the event schedule
toneforge sequence simulate --preset presets/sequences/casual_adventure_intro_sequence.json --seed 42
```
```bash
# Render the sequence at a fixed seed
toneforge sequence generate --preset presets/sequences/casual_adventure_intro_sequence.json --seed 42 --output casual_adventure_intro_sequence.wav
```
```bash
# List every sequence preset
toneforge list sequences
```

## See also

- [Recipe Book Index](./index.md)
- [Stack PRD](../../prd/STACK_PRD.md)
- [Sequencer PRD](../../prd/SEQUENCER_PRD.md)
