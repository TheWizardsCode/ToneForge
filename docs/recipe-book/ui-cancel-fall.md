---
title: "Ui Cancel Fall"
id: "ui-cancel-fall"
order: 24
description: "Falling cancellation tone"
---

# Ui Cancel Fall

**Category: UI** · Tags: casual, fun, ui

## Sound design

### Overview

`ui-cancel-fall` provides falling cancellation tone. It belongs to the casual recipe family (casual, fun, ui) and is designed to be short, characterful and easy to layer.

### Synthesis

It is built from a single sine tone shaped by The amplitude envelope runs attack 0.005s, decay 0.15s and sustain 0, so the tone opens quickly and then settles. The pitch follows a exponential falling contour (700 Hz → 300 Hz) scheduled on the oscillator's frequency AudioParam, so the note bends rather than holding a fixed pitch.

### Parameters

The declared parameters (`startFreq`, `endFreq`, `attack`, `decay`) expose the pitch contour endpoints and the envelope timing. Override a contour endpoint to change the direction or span of the sweep, or adjust the decay to make the event snappier or more resonant.

### Seed behaviour & musical intent

With a fixed seed (e.g. `--seed 42`) this recipe renders byte-identical audio on every platform and run. A lightweight, joyful game sound intended as a placeholder that a sound designer can immediately vary through the CLI.

## ToneForge CLI

<!-- CLI_BLOCK_START — regenerate with: tsx scripts/recipe-book/generate-cli-blocks.ts ui-cancel-fall -->
```bash
# Generate the recipe with a specific seed
toneforge generate --recipe ui-cancel-fall --seed 42 --output ui-cancel-fall.wav
```
```bash
# Show the recipe metadata
toneforge show --recipe ui-cancel-fall
```
```bash
# List all recipes, filtered by casual tag
toneforge list recipes --tags casual
```
```bash
# Generate with default seed
toneforge generate --recipe ui-cancel-fall --output ui-cancel-fall-default.wav
```
<!-- CLI_BLOCK_END -->

## Parameters

| Parameter | Type | Range | Default |
|-----------|------|-------|---------|
| `startFreq` | number | 420–1120 Hz | 700 Hz |
| `endFreq` | number | 180–480 Hz | 300 Hz |
| `attack` | number | 0.001–0.03 s | 0.005 s |
| `decay` | number | 0.03–0.4 s | 0.15 s |

## See also

- [Recipe Book Index](./index.md)
- [ToneGraph Schema](../../tonegraph.md)
