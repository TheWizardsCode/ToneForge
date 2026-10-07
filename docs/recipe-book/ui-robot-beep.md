---
title: "Ui Robot Beep"
id: "ui-robot-beep"
order: 39
description: "Robotic FM beep"
---

# Ui Robot Beep

**Category: UI** · Tags: casual, fun, ui

## Sound design

### Overview

`ui-robot-beep` provides robotic fm beep. It belongs to the casual recipe family (casual, fun, ui) and is designed to be short, characterful and easy to layer.

### Synthesis

It is built from an FM (fmPattern) voice, shaped by an amplitude envelope (attack 0.002s, decay 0.12s, sustain 0), which opens quickly and then settles. No additional processing is required, so it renders quickly and deterministically.

### Parameters

The declared parameters (`carrierFreq`, `modulatorFreq`, `modIndex`, `attack`, `decay`) expose the pitch contour endpoints and the envelope timing. Override a contour endpoint to change the direction or span of the sweep, or adjust the decay to make the event snappier or more resonant.

### Seed behaviour & musical intent

With a fixed seed (e.g. `--seed 42`) this recipe renders byte-identical audio on every platform and run. A lightweight, joyful game sound intended as a placeholder that a sound designer can immediately vary through the CLI.

## ToneForge CLI

<!-- CLI_BLOCK_START — regenerate with: tsx scripts/recipe-book/generate-cli-blocks.ts ui-robot-beep -->
```bash
# Generate the recipe with a specific seed
toneforge generate --recipe ui-robot-beep --seed 42 --output ui-robot-beep.wav
```
```bash
# Show the recipe metadata
toneforge show --recipe ui-robot-beep
```
```bash
# List all recipes, filtered by casual tag
toneforge list recipes --tags casual
```
```bash
# Generate with default seed
toneforge generate --recipe ui-robot-beep --output ui-robot-beep-default.wav
```
<!-- CLI_BLOCK_END -->

## Parameters

| Parameter | Type | Range | Default |
|-----------|------|-------|---------|
| `carrierFreq` | number | 220–792 Hz | 440 Hz |
| `modulatorFreq` | number | 440–1584 Hz | 880 Hz |
| `modIndex` | number | 1–12 ratio | 5 ratio |
| `attack` | number | 0.001–0.03 s | 0.002 s |
| `decay` | number | 0.036–0.156 s | 0.12 s |

## See also

- [Recipe Book Index](./index.md)
- [ToneGraph Schema](../../tonegraph.md)
