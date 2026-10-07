---
title: "Creature Slime Bounce"
id: "creature-slime-bounce"
order: 68
description: "Slime bounce"
---

# Creature Slime Bounce

**Category: Creature** · Tags: casual, fun, creature

## Sound design

### Overview

A bouncy slime hop with a springy pitch contour and a soft filter.

### Synthesis

A 400 Hz sine leaps to 700 Hz in 80 ms and settles back to 300 Hz, tracing the arc of a bounce. A 1200 Hz lowpass (Q 3) rounds off the top end so the bounce stays gooey rather than glassy.

### Parameters

`startFreq`/`peakFreq` set the bounce height; `filterFreq` sets the softness; `attack`/`decay` trim the hop.

### Seed behaviour & musical intent

With a fixed seed (e.g. `--seed 42`) this recipe renders byte-identical audio on every platform and run. A playful movement cue for gelatinous creatures and balls.

## ToneForge CLI

<!-- CLI_BLOCK_START — regenerate with: tsx scripts/recipe-book/generate-cli-blocks.ts creature-slime-bounce -->
```bash
# Generate the recipe with a specific seed
toneforge generate --recipe creature-slime-bounce --seed 42 --output creature-slime-bounce.wav
```
```bash
# Show the recipe metadata
toneforge show --recipe creature-slime-bounce
```
```bash
# List all recipes, filtered by casual tag
toneforge list recipes --tags casual
```
```bash
# Generate with default seed
toneforge generate --recipe creature-slime-bounce --output creature-slime-bounce-default.wav
```
<!-- CLI_BLOCK_END -->

## Parameters

| Parameter | Type | Range | Default |
|-----------|------|-------|---------|
| `startFreq` | number | 260–520 Hz | 400 Hz |
| `peakFreq` | number | 500–950 Hz | 700 Hz |
| `filterFreq` | number | 700–1800 Hz | 1200 Hz |
| `attack` | number | 0.002–0.02 s | 0.005 s |
| `decay` | number | 0.1–0.3 s | 0.2 s |

## See also

- [Recipe Book Index](./index.md)
- [ToneGraph Schema](../../tonegraph.md)
