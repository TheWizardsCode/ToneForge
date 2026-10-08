---
title: "Casual Coin Run Sequence"
id: "casual_coin_run_sequence"
order: 107
description: "Casual coin run: four rapid coin pickups building into an arcing reward, tuned for a satisfying collection streak."
---

# Casual Coin Run Sequence

**Capstone Sequence** · presets/sequences

## At a glance

| Field | Value |
|-------|-------|
| **Title** | Casual Coin Run Sequence |
| **Common uses** | Coin streaks, collection combos, reward loops |
| **Default frequency** | 800–1560 Hz |
| **Default duration** | 0.95 s |
| **Type** | Sequence (5 events) |
| **Recipes** | `collect-pickup-coin`, `collect-pickup-coin`, `collect-pickup-coin`, `collect-pickup-coin`, `collect-coin-arc` |

## Sound design

### Overview

Four rapid coin pickups building into an arcing reward, tuned for a satisfying collection streak.

### Layered structure

`collect-pickup-coin` fires every 140 ms with rising gains and unique seed offsets for a natural streak, then `collect-coin-arc` closes the run at 600 ms. The accelerating gains make the streak feel like it is building.

### Voices

| Recipe | Time | Seed offset | Gain |
|--------|------|-------------|------|
| `collect-pickup-coin` | 0.00 s | 0 | 0.90 |
| `collect-pickup-coin` | 0.14 s | 1 | 0.90 |
| `collect-pickup-coin` | 0.28 s | 2 | 0.95 |
| `collect-pickup-coin` | 0.42 s | 3 | 1.00 |
| `collect-coin-arc` | 0.60 s | 4 | 1.00 |

### Seed behaviour & musical intent

With a fixed seed the whole arrangement renders byte-identical audio on every platform and run; changing the seed varies the texture while preserving the structure. A rewarding collection loop for coin runs and combos.

## ToneForge CLI

```bash
# Simulate the event schedule
toneforge sequence simulate --preset presets/sequences/casual_coin_run_sequence.json --seed 42
```
```bash
# Render the sequence at a fixed seed
toneforge sequence generate --preset presets/sequences/casual_coin_run_sequence.json --seed 42 --output casual_coin_run_sequence.wav
```
```bash
# List every sequence preset
toneforge list sequences
```

## See also

- [Recipe Book Index](./index.md)
- [Stack PRD](../../prd/STACK_PRD.md)
- [Sequencer PRD](../../prd/SEQUENCER_PRD.md)
