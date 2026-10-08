---
title: "Casual Character Jump Stack"
id: "casual_character_jump_stack"
order: 104
description: "Casual character-jump stack: a rising hop blip, a character jump voice and an air swish whoosh layered into a lively jump."
---

# Casual Character Jump Stack

**Capstone Stack** · presets/stacks

## At a glance

| Field | Value |
|-------|-------|
| **Title** | Casual Character Jump Stack |
| **Common uses** | Character jumps, platforming movement, hops |
| **Default frequency** | 180–500 Hz |
| **Default duration** | 0.46 s |
| **Type** | Stack (3 voices) |
| **Recipes** | `jump-hop-blip`, `character-jump-voice`, `whoosh-air-swish` |

## Sound design

### Overview

A lively jump layering a rising hop blip, a character jump voice and an air swish whoosh.

### Layered structure

`jump-hop-blip` carries the pitch lift, `character-jump-voice` adds a vocal \"hup\" 30 ms in, and `whoosh-air-swish` supplies the air movement. Timing the whoosh slightly after the voice keeps the jump readable.

### Voices

| Recipe | Start | Gain |
|--------|-------|------|
| `jump-hop-blip` | 0.00 s | 1.00 |
| `character-jump-voice` | 0.03 s | 0.75 |
| `whoosh-air-swish` | 0.02 s | 0.55 |

### Seed behaviour & musical intent

With a fixed seed the whole arrangement renders byte-identical audio on every platform and run; changing the seed varies the texture while preserving the structure. A characterful movement cue for jumps, hops and double-jumps.

## ToneForge CLI

```bash
# Inspect the layered structure
toneforge stack inspect --preset presets/stacks/casual_character_jump_stack.json
```
```bash
# Render the stack at a fixed seed
toneforge stack render --preset presets/stacks/casual_character_jump_stack.json --seed 42 --output casual_character_jump_stack.wav
```
```bash
# List every stack preset
toneforge list stacks
```

## See also

- [Recipe Book Index](./index.md)
- [Stack PRD](../../prd/STACK_PRD.md)
- [Sequencer PRD](../../prd/SEQUENCER_PRD.md)
