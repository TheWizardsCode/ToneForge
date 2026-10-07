---
title: "Casual Level Complete Sequence"
id: "casual_level_complete_sequence"
order: 108
description: "Casual level complete: a quest-complete motif, a level-up jingle and a level-complete sting closing a stage with a flourish."
---

# Casual Level Complete Sequence

**Capstone Sequence** · presets/sequences

## Sound design

### Overview

A quest-complete motif, a level-up jingle and a level-complete sting closing a stage with a flourish.

### Layered structure

`motif-quest-complete` starts at 0 ms, `jingle-level-up` reinforces it at 250 ms and `sting-level-complete` resolves at 600 ms. The three recipes share an upward contour, so the sequence reads as one continuous fanfare.

### Voices

| Recipe | Time | Seed offset | Gain |
|--------|------|-------------|------|
| `motif-quest-complete` | 0.00 s | 0 | 0.90 |
| `jingle-level-up` | 0.25 s | 1 | 0.90 |
| `sting-level-complete` | 0.60 s | 2 | 1.00 |

### Seed behaviour & musical intent

With a fixed seed the whole arrangement renders byte-identical audio on every platform and run; changing the seed varies the texture while preserving the structure. The end-of-level celebration for completing a stage.

## ToneForge CLI

```bash
# Simulate the event schedule
toneforge sequence simulate --preset presets/sequences/casual_level_complete_sequence.json --seed 42
```
```bash
# Render the sequence at a fixed seed
toneforge sequence generate --preset presets/sequences/casual_level_complete_sequence.json --seed 42 --output casual_level_complete_sequence.wav
```
```bash
# List every sequence preset
toneforge list sequences
```

## See also

- [Recipe Book Index](./index.md)
- [Stack PRD](../../prd/STACK_PRD.md)
- [Sequencer PRD](../../prd/SEQUENCER_PRD.md)
