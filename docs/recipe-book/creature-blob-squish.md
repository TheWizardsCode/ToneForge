---
title: "Creature Blob Squish"
id: "creature-blob-squish"
order: 64
description: "Blob squish"
---

# Creature Blob Squish

**Category: Creature** · Tags: casual, fun, creature

## Sound design

### Overview

A gooey squish for a soft-bodied creature — a wet, downward thump with no pitched layer.

### Synthesis

Pink noise through a resonant lowpass (Q 6) sweeps from 900 Hz down to 180 Hz, so the texture darkens and thickens as it closes. All of the character is in the filter movement, not a tonal carrier.

### Parameters

`startFreq`/`endFreq` set the squash depth; `attack`/`decay` set how quickly the blob collapses.

### Seed behaviour & musical intent

With a fixed seed (e.g. `--seed 42`) this recipe renders byte-identical audio on every platform and run. A tactile, squishy impact for blobs, slimes and jelly enemies.

## ToneForge CLI

<!-- CLI_BLOCK_START — regenerate with: tsx scripts/recipe-book/generate-cli-blocks.ts creature-blob-squish -->
```bash
# Generate the recipe with a specific seed
toneforge generate --recipe creature-blob-squish --seed 42 --output creature-blob-squish.wav
```
```bash
# Show the recipe metadata
toneforge show --recipe creature-blob-squish
```
```bash
# List all recipes, filtered by casual tag
toneforge list recipes --tags casual
```
```bash
# Generate with default seed
toneforge generate --recipe creature-blob-squish --output creature-blob-squish-default.wav
```
<!-- CLI_BLOCK_END -->

## Parameters

| Parameter | Type | Range | Default |
|-----------|------|-------|---------|
| `startFreq` | number | 500–1300 Hz | 900 Hz |
| `endFreq` | number | 100–320 Hz | 180 Hz |
| `attack` | number | 0.001–0.02 s | 0.004 s |
| `decay` | number | 0.1–0.3 s | 0.2 s |

## See also

- [Recipe Book Index](./index.md)
- [ToneGraph Schema](../../tonegraph.md)
