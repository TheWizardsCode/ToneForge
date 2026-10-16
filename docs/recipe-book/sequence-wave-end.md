---
title: "Sequence Wave End"
id: "sequence-wave-end"
order: 111
description: "Wave-end leitmotif: motif-waves-end as a single compact event (~1.4 s) marking a cleared wave."
---

# Sequence Wave End

**Capstone Sequence** · presets/sequences

## At a glance

| Field | Value |
|-------|-------|
| **Title** | Sequence Wave End |
| **Common uses** | Wave completion, stage cleared, tower-defence wave boundaries |
| **Default frequency** | 392 Hz |
| **Default duration** | 1.4 s |
| **Type** | Sequence (1 event) |
| **Recipes** | `motif-waves-end` |

## Sound design

### Overview

A compact single-event wave-end leitmotif: the relief-then-worry motif plays alone so a cleared wave lands as one re-readable moment.

### Layered structure

`motif-waves-end` states the whole leitmotif at 0 ms: a resolved C-major phrase (G–C–E) for relief, then a raised-4th F♯ tail for the worry about the next wave. With a single event the sequence is a pure one-shot — ready to retrigger on every wave boundary without sounding same-y.

### Voices

| Recipe | Time | Seed offset | Gain |
|--------|------|-------------|------|
| `motif-waves-end` | 0.00 s | 0 | 1.00 |

### Seed behaviour & musical intent

With a fixed seed the whole arrangement renders byte-identical audio on every platform and run; changing the seed varies the texture while preserving the structure. The compact wave-complete cue for tower-defence and endless-runner loops.

## ToneForge CLI

<!-- CLI_BLOCK_START — regenerate with: tsx scripts/recipe-book/generate-capstones.ts sequence-wave-end -->
```bash
# Simulate the event schedule
toneforge sequence simulate --preset presets/sequences/sequence-wave-end.json --seed 42
```
```bash
# Render the sequence at a fixed seed
toneforge sequence generate --preset presets/sequences/sequence-wave-end.json --seed 42 --output sequence-wave-end.wav
```
```bash
# List every sequence preset
toneforge list sequences
```
<!-- CLI_BLOCK_END -->

## See also

- [Recipe Book Index](./index.md)
- [Stack PRD](../prd/STACK_PRD.md)
- [Sequencer PRD](../prd/SEQUENCER_PRD.md)
