---
title: "Creature Bird Chirp"
id: "creature-bird-chirp"
order: 67
description: "Bird chirp"
---

# Creature Bird Chirp

**Category: Creature** · Tags: casual, joy, creature

## Sound design

### Overview

A quick, stepped bird chirp — three or four tiny notes that rise and fall like birdsong.

### Synthesis

A sine begins at 2200 Hz, steps up to 3200 Hz, dips to 2400 Hz and finally rises to 3000 Hz via `set`/`linearRamp` automation. The stepped contour, rather than a smooth glide, is what makes it read as a chirp.

### Parameters

`chirpLow`/`chirpHigh` set the register and the birdsong range; `attack`/`decay` set the note length.

### Seed behaviour & musical intent

With a fixed seed (e.g. `--seed 42`) this recipe renders byte-identical audio on every platform and run. A bright, friendly bird call for forest and meadow critters.

## ToneForge CLI

<!-- CLI_BLOCK_START — regenerate with: tsx scripts/recipe-book/generate-cli-blocks.ts creature-bird-chirp -->
```bash
# Generate the recipe with a specific seed
toneforge generate --recipe creature-bird-chirp --seed 42 --output creature-bird-chirp.wav
```
```bash
# Show the recipe metadata
toneforge show --recipe creature-bird-chirp
```
```bash
# List all recipes, filtered by casual tag
toneforge list recipes --tags casual
```
```bash
# Generate with default seed
toneforge generate --recipe creature-bird-chirp --output creature-bird-chirp-default.wav
```
<!-- CLI_BLOCK_END -->

## Parameters

| Parameter | Type | Range | Default |
|-----------|------|-------|---------|
| `chirpLow` | number | 1600–2600 Hz | 2200 Hz |
| `chirpHigh` | number | 2600–3800 Hz | 3200 Hz |
| `attack` | number | 0.002–0.015 s | 0.004 s |
| `decay` | number | 0.1–0.3 s | 0.2 s |

## See also

- [Recipe Book Index](./index.md)
- [ToneGraph Schema](../../tonegraph.md)
