---
title: "Sequence Level End"
id: "sequence-level-end"
order: 112
description: "Level-end leitmotif: motif-waves-end with sting-level-complete layered at the resolution point for a bigger, more final feel."
---

# Sequence Level End

**Capstone Sequence** · presets/sequences

## At a glance

| Field | Value |
|-------|-------|
| **Title** | Sequence Level End |
| **Common uses** | Level completion, stage endings, finale moments |
| **Default frequency** | 392–523 Hz |
| **Default duration** | 1.4 s |
| **Type** | Sequence (2 events) |
| **Recipes** | `motif-waves-end`, `sting-level-complete` |

## Sound design

### Overview

A bigger, more final level-end variant that layers a multi-voice sting onto the same leitmotif at its resolution point.

### Layered structure

`motif-waves-end` starts at 0 ms with the relief phrase; `sting-level-complete` lands at 440 ms, exactly where the motif resolves its major third, adding FM brightness and a harmony line so the ending reads as final. The raised-4th worry tail still sounds after the sting, keeping the "almost done… but there is more" arc intact.

### Voices

| Recipe | Time | Seed offset | Gain |
|--------|------|-------------|------|
| `motif-waves-end` | 0.00 s | 0 | 1.00 |
| `sting-level-complete` | 0.44 s | 1 | 0.70 |

### Seed behaviour & musical intent

With a fixed seed the whole arrangement renders byte-identical audio on every platform and run; changing the seed varies the texture while preserving the structure. The definitive level-end cue for completing a stage.

## ToneForge CLI

<!-- CLI_BLOCK_START — regenerate with: tsx scripts/recipe-book/generate-capstones.ts sequence-level-end -->
```bash
# Simulate the event schedule
toneforge sequence simulate --preset presets/sequences/sequence-level-end.json --seed 42
```
```bash
# Render the sequence at a fixed seed
toneforge sequence generate --preset presets/sequences/sequence-level-end.json --seed 42 --output sequence-level-end.wav
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
