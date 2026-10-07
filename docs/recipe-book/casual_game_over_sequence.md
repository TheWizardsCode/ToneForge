---
title: "Casual Game Over Sequence"
id: "casual_game_over_sequence"
order: 109
description: "Casual game over: a soft defeat sting, a gentle game-over sting and a falling cancel tone that end a run kindly."
---

# Casual Game Over Sequence

**Capstone Sequence** · presets/sequences

## Sound design

### Overview

A soft defeat sting, a gentle game-over sting and a falling cancel tone that end a run kindly.

### Layered structure

`sting-defeat-soft` opens the sequence at 0 ms, `sting-game-over-gentle` deepens it at 350 ms and `ui-cancel-fall` closes with a falling sigh at 900 ms. The descending gestures keep the mood gentle rather than punishing.

### Voices

| Recipe | Time | Seed offset | Gain |
|--------|------|-------------|------|
| `sting-defeat-soft` | 0.00 s | 0 | 0.90 |
| `sting-game-over-gentle` | 0.35 s | 1 | 0.90 |
| `ui-cancel-fall` | 0.90 s | 2 | 0.70 |

### Seed behaviour & musical intent

With a fixed seed the whole arrangement renders byte-identical audio on every platform and run; changing the seed varies the texture while preserving the structure. A kind, unhurried end-of-run cue.

## ToneForge CLI

```bash
# Simulate the event schedule
toneforge sequence simulate --preset presets/sequences/casual_game_over_sequence.json --seed 42
```
```bash
# Render the sequence at a fixed seed
toneforge sequence generate --preset presets/sequences/casual_game_over_sequence.json --seed 42 --output casual_game_over_sequence.wav
```
```bash
# List every sequence preset
toneforge list sequences
```

## See also

- [Recipe Book Index](./index.md)
- [Stack PRD](../../prd/STACK_PRD.md)
- [Sequencer PRD](../../prd/SEQUENCER_PRD.md)
