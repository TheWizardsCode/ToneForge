---
title: "Collect Coin Arc"
id: "collect-coin-arc"
order: 25
description: "Arcing coin pickup contour"
---

# Collect Coin Arc

**Category: Collect** · Tags: casual, joy, collect

## Sound design

### Overview

`collect-coin-arc` provides arcing coin pickup contour. It belongs to the casual recipe family (casual, joy, collect) and is designed to be short, characterful and easy to layer.

### Synthesis

It is built from a single sine tone, shaped by an amplitude envelope (attack 0.003s, decay 0.15s, sustain 0), which opens quickly and then settles. The pitch follows a linear rising contour (800 Hz → 1400 Hz → 1200 Hz) scheduled on the frequency AudioParam, so the sound bends rather than holding a fixed pitch.

### Parameters

The declared parameters (`startFreq`, `midFreq`, `endFreq`, `attack`, `decay`) expose the pitch contour endpoints and the envelope timing. Override a contour endpoint to change the direction or span of the sweep, or adjust the decay to make the event snappier or more resonant.

### Seed behaviour & musical intent

With a fixed seed (e.g. `--seed 42`) this recipe renders byte-identical audio on every platform and run. A lightweight, joyful game sound intended as a placeholder that a sound designer can immediately vary through the CLI.

## ToneForge CLI

<!-- CLI_BLOCK_START — regenerate with: tsx scripts/recipe-book/generate-cli-blocks.ts collect-coin-arc -->
```bash
# Generate the recipe with a specific seed
toneforge generate --recipe collect-coin-arc --seed 42 --output collect-coin-arc.wav
```
```bash
# Show the recipe metadata
toneforge show --recipe collect-coin-arc
```
```bash
# List all recipes, filtered by casual tag
toneforge list recipes --tags casual
```
```bash
# Generate with default seed
toneforge generate --recipe collect-coin-arc --output collect-coin-arc-default.wav
```
<!-- CLI_BLOCK_END -->

## Parameters

| Parameter | Type | Range | Default |
|-----------|------|-------|---------|
| `startFreq` | number | 480–1280 Hz | 800 Hz |
| `midFreq` | number | 979–1959 Hz | 1400 Hz |
| `endFreq` | number | 720–1920 Hz | 1200 Hz |
| `attack` | number | 0.001–0.03 s | 0.003 s |
| `decay` | number | 0.03–0.4 s | 0.15 s |

## See also

- [Recipe Book Index](./index.md)
- [ToneGraph Schema](../../tonegraph.md)
