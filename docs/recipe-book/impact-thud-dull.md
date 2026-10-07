---
title: "Impact Thud Dull"
id: "impact-thud-dull"
order: 21
description: "Dull thud for soft impacts"
---

# Impact Thud Dull

**Category: Impact** · Tags: casual, fun, impact

## Sound design

### Overview

`impact-thud-dull` provides dull thud for soft impacts. It belongs to the casual recipe family (casual, fun, impact) and is designed to be short, characterful and easy to layer.

### Synthesis

It is built from a single sine tone, shaped by an amplitude envelope (attack 0.002s, decay 0.15s, sustain 0), which opens quickly and then settles. The pitch follows a exponential falling contour (200 Hz → 80 Hz) scheduled on the frequency AudioParam, so the sound bends rather than holding a fixed pitch.

### Parameters

The declared parameters (`startFreq`, `endFreq`, `attack`, `decay`) expose the pitch contour endpoints and the envelope timing. Override a contour endpoint to change the direction or span of the sweep, or adjust the decay to make the event snappier or more resonant.

### Seed behaviour & musical intent

With a fixed seed (e.g. `--seed 42`) this recipe renders byte-identical audio on every platform and run. A lightweight, joyful game sound intended as a placeholder that a sound designer can immediately vary through the CLI.

## ToneForge CLI

<!-- CLI_BLOCK_START — regenerate with: tsx scripts/recipe-book/generate-cli-blocks.ts impact-thud-dull -->
```bash
# Generate the recipe with a specific seed
toneforge generate --recipe impact-thud-dull --seed 42 --output impact-thud-dull.wav
```
```bash
# Show the recipe metadata
toneforge show --recipe impact-thud-dull
```
```bash
# List all recipes, filtered by casual tag
toneforge list recipes --tags casual
```
```bash
# Generate with default seed
toneforge generate --recipe impact-thud-dull --output impact-thud-dull-default.wav
```
<!-- CLI_BLOCK_END -->

## Parameters

| Parameter | Type | Range | Default |
|-----------|------|-------|---------|
| `startFreq` | number | 120–320 Hz | 200 Hz |
| `endFreq` | number | 48–128 Hz | 80 Hz |
| `attack` | number | 0.001–0.03 s | 0.002 s |
| `decay` | number | 0.03–0.4 s | 0.15 s |

## See also

- [Recipe Book Index](./index.md)
- [ToneGraph Schema](../../tonegraph.md)
