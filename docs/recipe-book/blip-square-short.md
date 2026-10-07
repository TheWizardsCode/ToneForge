---
title: "Blip Square Short"
id: "blip-square-short"
order: 2
description: "Short square-wave blip for retro feedback"
---

# Blip Square Short

**Category: UI** · Tags: casual, fun, ui

## Sound design

### Overview

A short square-wave blip for retro feedback. It is the 8-bit cousin of the sine ping, using the buzzy odd harmonics of a square wave to read as a classic arcade acknowledgement.

### Synthesis

A square oscillator at 440 Hz with a very fast attack (3 ms) and a short 30 ms decay. The square wave’s rich harmonic content gives the blip an unmistakable chiptune edge while the brief decay keeps it from becoming harsh.

### Parameters

`frequency` moves the blip from a low buzz (220 Hz) to a bright chirp (660 Hz). `attack` should stay near the minimum for an instant onset; `decay` (15–90 ms) sets how clipped the blip feels.

### Seed behaviour & musical intent

With a fixed seed (e.g. `--seed 42`) this recipe renders byte-identical audio on every platform and run. Retro, cheerful confirmation that fits pixel-art and arcade styling.

## ToneForge CLI

<!-- CLI_BLOCK_START — regenerate with: tsx scripts/recipe-book/generate-cli-blocks.ts blip-square-short -->
```bash
# Generate the recipe with a specific seed
toneforge generate --recipe blip-square-short --seed 42 --output blip-square-short.wav
```
```bash
# Show the recipe metadata
toneforge show --recipe blip-square-short
```
```bash
# List all recipes, filtered by casual tag
toneforge list recipes --tags casual
```
```bash
# Generate with default seed
toneforge generate --recipe blip-square-short --output blip-square-short-default.wav
```
<!-- CLI_BLOCK_END -->

## Parameters

| Parameter | Type | Range | Default |
|-----------|------|-------|---------|
| `frequency` | number | 220–660 Hz | 440 Hz |
| `attack` | number | 0.001–0.02 s | 0.003 s |
| `decay` | number | 0.015–0.09 s | 0.03 s |

## See also

- [Recipe Book Index](./index.md)
- [ToneGraph Schema](../../tonegraph.md)
