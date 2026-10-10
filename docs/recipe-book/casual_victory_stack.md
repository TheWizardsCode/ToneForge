---
title: "Casual Victory Stack"
id: "casual_victory_stack"
order: 103
description: "Casual victory stack: a two-note victory motif, a level-up jingle and a bright multi-voice victory sting layered for a full win fanfare."
---

# Casual Victory Stack

**Capstone Stack** · presets/stacks

## At a glance

| Field | Value |
|-------|-------|
| **Title** | Casual Victory Stack |
| **Common uses** | Victory screens, level wins, triumph celebrations |
| **Default frequency** | 392–523 Hz |
| **Default duration** | 1.42 s |
| **Type** | Stack (3 voices) |
| **Recipes** | `motif-win-two-note`, `jingle-level-up`, `sting-victory-bright` |

## Sound design

### Overview

A full victory fanfare layering a two-note motif, a level-up jingle and a bright multi-voice sting.

### Layered structure

`motif-win-two-note` states the win at 0 ms, `jingle-level-up` extends it at 340 ms, and `sting-victory-bright` crowns the arrangement at 600 ms. The ascending pitches of the three recipes reinforce one another into a single triumphant gesture.

### Voices

| Recipe | Start | Gain |
|--------|-------|------|
| `motif-win-two-note` | 0.00 s | 0.90 |
| `jingle-level-up` | 0.34 s | 0.80 |
| `sting-victory-bright` | 0.60 s | 1.00 |

### Seed behaviour & musical intent

With a fixed seed the whole arrangement renders byte-identical audio on every platform and run; changing the seed varies the texture while preserving the structure. The definitive win cue for level ends and victories.

## ToneForge CLI

```bash
# Inspect the layered structure
toneforge stack inspect --preset presets/stacks/casual_victory_stack.json
```
```bash
# Render the stack at a fixed seed
toneforge stack render --preset presets/stacks/casual_victory_stack.json --seed 42 --output casual_victory_stack.wav
```
```bash
# List every stack preset
toneforge list stacks
```

## See also

- [Recipe Book Index](./index.md)
- [Stack PRD](../../prd/STACK_PRD.md)
- [Sequencer PRD](../../prd/SEQUENCER_PRD.md)
