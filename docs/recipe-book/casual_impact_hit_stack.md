---
title: "Casual Impact Hit Stack"
id: "casual_impact_hit_stack"
order: 105
description: "Casual impact-hit stack: a dull thud, a fleshy punch and a metallic crash layered into a single weighty hit."
---

# Casual Impact Hit Stack

**Capstone Stack** · presets/stacks

## Sound design

### Overview

A weighty hit layering a dull thud, a fleshy punch and a metallic crash.

### Layered structure

`impact-thud-dull` provides the low body at 0 ms, `impact-punch-flesh` adds mid-range texture at 10 ms, and `impact-crash-metal` contributes a resonant tail at 40 ms. The staggered onsets avoid phase cancellation and read as one compound impact.

### Voices

| Recipe | Start | Gain |
|--------|-------|------|
| `impact-thud-dull` | 0.00 s | 1.00 |
| `impact-punch-flesh` | 0.01 s | 0.80 |
| `impact-crash-metal` | 0.04 s | 0.60 |

### Seed behaviour & musical intent

With a fixed seed the whole arrangement renders byte-identical audio on every platform and run; changing the seed varies the texture while preserving the structure. A satisfying hit for combat, collisions and damage feedback.

## ToneForge CLI

```bash
# Inspect the layered structure
toneforge stack inspect --preset presets/stacks/casual_impact_hit_stack.json
```
```bash
# Render the stack at a fixed seed
toneforge stack render --preset presets/stacks/casual_impact_hit_stack.json --seed 42 --output casual_impact_hit_stack.wav
```
```bash
# List every stack preset
toneforge list stacks
```

## See also

- [Recipe Book Index](./index.md)
- [Stack PRD](../../prd/STACK_PRD.md)
- [Sequencer PRD](../../prd/SEQUENCER_PRD.md)
