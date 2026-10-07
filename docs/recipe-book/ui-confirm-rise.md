---
title: "Ui Confirm Rise"
id: "ui-confirm-rise"
order: 23
description: "Rising confirmation tone"
---

# Ui Confirm Rise

**Category: UI** · Tags: casual, joy, ui

## Sound design

### Overview

`ui-confirm-rise` provides rising confirmation tone. It belongs to the casual recipe family (casual, joy, ui) and is designed to be short, characterful and easy to layer.

### Synthesis

It is built from a single sine tone, shaped by an amplitude envelope (attack 0.005s, decay 0.15s, sustain 0), which opens quickly and then settles. The pitch follows a linear rising contour (500 Hz → 900 Hz) scheduled on the frequency AudioParam, so the sound bends rather than holding a fixed pitch.

### Parameters

The declared parameters (`startFreq`, `endFreq`, `attack`, `decay`) expose the pitch contour endpoints and the envelope timing. Override a contour endpoint to change the direction or span of the sweep, or adjust the decay to make the event snappier or more resonant.

### Seed behaviour & musical intent

With a fixed seed (e.g. `--seed 42`) this recipe renders byte-identical audio on every platform and run. A lightweight, joyful game sound intended as a placeholder that a sound designer can immediately vary through the CLI.

## ToneForge CLI

<!-- CLI_BLOCK_START — regenerate with: tsx scripts/recipe-book/generate-cli-blocks.ts ui-confirm-rise -->
```bash
# Generate the recipe with a specific seed
toneforge generate --recipe ui-confirm-rise --seed 42 --output ui-confirm-rise.wav
```
```bash
# Show the recipe metadata
toneforge show --recipe ui-confirm-rise
```
```bash
# List all recipes, filtered by casual tag
toneforge list recipes --tags casual
```
```bash
# Generate with default seed
toneforge generate --recipe ui-confirm-rise --output ui-confirm-rise-default.wav
```
<!-- CLI_BLOCK_END -->

## Parameters

| Parameter | Type | Range | Default |
|-----------|------|-------|---------|
| `startFreq` | number | 300–800 Hz | 500 Hz |
| `endFreq` | number | 540–1440 Hz | 900 Hz |
| `attack` | number | 0.001–0.03 s | 0.005 s |
| `decay` | number | 0.03–0.4 s | 0.15 s |

## See also

- [Recipe Book Index](./index.md)
- [ToneGraph Schema](../../tonegraph.md)
