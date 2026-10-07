---
title: "Ui Pop Bubble"
id: "ui-pop-bubble"
order: 19
description: "Bubbly pop for UI reveal"
---

# Ui Pop Bubble

**Category: UI** · Tags: casual, fun, ui

## Sound design

### Overview

`ui-pop-bubble` provides bubbly pop for ui reveal. It belongs to the casual recipe family (casual, fun, ui) and is designed to be short, characterful and easy to layer.

### Synthesis

It is built from a single sine tone shaped by The amplitude envelope runs attack 0.002s, decay 0.08s and sustain 0, so the tone opens quickly and then settles. The pitch follows a exponential rising contour (400 Hz → 800 Hz) scheduled on the oscillator's frequency AudioParam, so the note bends rather than holding a fixed pitch.

### Parameters

The declared parameters (`startFreq`, `endFreq`, `attack`, `decay`) expose the pitch contour endpoints and the envelope timing. Override a contour endpoint to change the direction or span of the sweep, or adjust the decay to make the event snappier or more resonant.

### Seed behaviour & musical intent

With a fixed seed (e.g. `--seed 42`) this recipe renders byte-identical audio on every platform and run. A lightweight, joyful game sound intended as a placeholder that a sound designer can immediately vary through the CLI.

## ToneForge CLI

<!-- CLI_BLOCK_START — regenerate with: tsx scripts/recipe-book/generate-cli-blocks.ts ui-pop-bubble -->
```bash
# Generate the recipe with a specific seed
toneforge generate --recipe ui-pop-bubble --seed 42 --output ui-pop-bubble.wav
```
```bash
# Show the recipe metadata
toneforge show --recipe ui-pop-bubble
```
```bash
# List all recipes, filtered by casual tag
toneforge list recipes --tags casual
```
```bash
# Generate with default seed
toneforge generate --recipe ui-pop-bubble --output ui-pop-bubble-default.wav
```
<!-- CLI_BLOCK_END -->

## Parameters

| Parameter | Type | Range | Default |
|-----------|------|-------|---------|
| `startFreq` | number | 240–640 Hz | 400 Hz |
| `endFreq` | number | 480–1280 Hz | 800 Hz |
| `attack` | number | 0.001–0.03 s | 0.002 s |
| `decay` | number | 0.03–0.4 s | 0.08 s |

## See also

- [Recipe Book Index](./index.md)
- [ToneGraph Schema](../../tonegraph.md)
