---
title: "Impact Bonk Bouncy"
id: "impact-bonk-bouncy"
order: 22
description: "Bouncy bonk for cartoon impacts"
---

# Impact Bonk Bouncy

**Category: Impact** · Tags: casual, fun, impact

## Sound design

### Overview

`impact-bonk-bouncy` provides bouncy bonk for cartoon impacts. It belongs to the casual recipe family (casual, fun, impact) and is designed to be short, characterful and easy to layer.

### Synthesis

It is built from a single square tone shaped by The amplitude envelope runs attack 0.002s, decay 0.12s and sustain 0, so the tone opens quickly and then settles. The pitch follows a linear rising contour (180 Hz → 420 Hz) scheduled on the oscillator's frequency AudioParam, so the note bends rather than holding a fixed pitch.

### Parameters

The declared parameters (`startFreq`, `endFreq`, `attack`, `decay`) expose the pitch contour endpoints and the envelope timing. Override a contour endpoint to change the direction or span of the sweep, or adjust the decay to make the event snappier or more resonant.

### Seed behaviour & musical intent

With a fixed seed (e.g. `--seed 42`) this recipe renders byte-identical audio on every platform and run. A lightweight, joyful game sound intended as a placeholder that a sound designer can immediately vary through the CLI.

## ToneForge CLI

<!-- CLI_BLOCK_START — regenerate with: tsx scripts/recipe-book/generate-cli-blocks.ts impact-bonk-bouncy -->
```bash
# Generate the recipe with a specific seed
toneforge generate --recipe impact-bonk-bouncy --seed 42 --output impact-bonk-bouncy.wav
```
```bash
# Show the recipe metadata
toneforge show --recipe impact-bonk-bouncy
```
```bash
# List all recipes, filtered by casual tag
toneforge list recipes --tags casual
```
```bash
# Generate with default seed
toneforge generate --recipe impact-bonk-bouncy --output impact-bonk-bouncy-default.wav
```
<!-- CLI_BLOCK_END -->

## Parameters

| Parameter | Type | Range | Default |
|-----------|------|-------|---------|
| `startFreq` | number | 108–288 Hz | 180 Hz |
| `endFreq` | number | 252–672 Hz | 420 Hz |
| `attack` | number | 0.001–0.03 s | 0.002 s |
| `decay` | number | 0.03–0.4 s | 0.12 s |

## See also

- [Recipe Book Index](./index.md)
- [ToneGraph Schema](../../tonegraph.md)
