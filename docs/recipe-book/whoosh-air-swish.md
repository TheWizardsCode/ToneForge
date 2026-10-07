---
title: "Whoosh Air Swish"
id: "whoosh-air-swish"
order: 32
description: "Air swish whoosh"
---

# Whoosh Air Swish

**Category: Impact** · Tags: casual, fun, whoosh

## Sound design

### Overview

`whoosh-air-swish` provides air swish whoosh. It belongs to the casual recipe family (casual, fun, whoosh) and is designed to be short, characterful and easy to layer.

### Synthesis

It is built from a white-noise source through a bandpass filter (Q=3), shaped by an amplitude envelope (attack 0.02s, decay 0.3s, sustain 0), which opens quickly and then settles. The pitch follows a linear rising contour (500 Hz → 3000 Hz) scheduled on the frequency AudioParam, so the sound bends rather than holding a fixed pitch.

### Parameters

The declared parameters (`startFreq`, `endFreq`, `attack`, `decay`) expose the pitch contour endpoints and the envelope timing. Override a contour endpoint to change the direction or span of the sweep, or adjust the decay to make the event snappier or more resonant.

### Seed behaviour & musical intent

With a fixed seed (e.g. `--seed 42`) this recipe renders byte-identical audio on every platform and run. A lightweight, joyful game sound intended as a placeholder that a sound designer can immediately vary through the CLI.

## ToneForge CLI

<!-- CLI_BLOCK_START — regenerate with: tsx scripts/recipe-book/generate-cli-blocks.ts whoosh-air-swish -->
```bash
# Generate the recipe with a specific seed
toneforge generate --recipe whoosh-air-swish --seed 42 --output whoosh-air-swish.wav
```
```bash
# Show the recipe metadata
toneforge show --recipe whoosh-air-swish
```
```bash
# List all recipes, filtered by casual tag
toneforge list recipes --tags casual
```
```bash
# Generate with default seed
toneforge generate --recipe whoosh-air-swish --output whoosh-air-swish-default.wav
```
<!-- CLI_BLOCK_END -->

## Parameters

| Parameter | Type | Range | Default |
|-----------|------|-------|---------|
| `startFreq` | number | 250–800 Hz | 500 Hz |
| `endFreq` | number | 1800–5400 Hz | 3000 Hz |
| `attack` | number | 0.001–0.05 s | 0.02 s |
| `decay` | number | 0.09–0.39 s | 0.3 s |

## See also

- [Recipe Book Index](./index.md)
- [ToneGraph Schema](../../tonegraph.md)
