---
title: "Ui Glitch Digital"
id: "ui-glitch-digital"
order: 38
description: "Digital glitch UI effect"
---

# Ui Glitch Digital

**Category: UI** · Tags: casual, fun, ui

## Sound design

### Overview

`ui-glitch-digital` provides digital glitch ui effect. It belongs to the casual recipe family (casual, fun, ui) and is designed to be short, characterful and easy to layer.

### Synthesis

It is built from an FM (fmPattern) voice, shaped by an amplitude envelope (attack 0.001s, decay 0.08s, sustain 0), which opens quickly and then settles. No additional processing is required, so it renders quickly and deterministically.

### Parameters

The declared parameters (`carrierFreq`, `modulatorFreq`, `modIndex`, `attack`, `decay`) expose the pitch contour endpoints and the envelope timing. Override a contour endpoint to change the direction or span of the sweep, or adjust the decay to make the event snappier or more resonant.

### Seed behaviour & musical intent

With a fixed seed (e.g. `--seed 42`) this recipe renders byte-identical audio on every platform and run. A lightweight, joyful game sound intended as a placeholder that a sound designer can immediately vary through the CLI.

## ToneForge CLI

<!-- CLI_BLOCK_START — regenerate with: tsx scripts/recipe-book/generate-cli-blocks.ts ui-glitch-digital -->
```bash
# Generate the recipe with a specific seed
toneforge generate --recipe ui-glitch-digital --seed 42 --output ui-glitch-digital.wav
```
```bash
# Show the recipe metadata
toneforge show --recipe ui-glitch-digital
```
```bash
# List all recipes, filtered by casual tag
toneforge list recipes --tags casual
```
```bash
# Generate with default seed
toneforge generate --recipe ui-glitch-digital --output ui-glitch-digital-default.wav
```
<!-- CLI_BLOCK_END -->

## Parameters

| Parameter | Type | Range | Default |
|-----------|------|-------|---------|
| `carrierFreq` | number | 150–540 Hz | 300 Hz |
| `modulatorFreq` | number | 600–2160 Hz | 1200 Hz |
| `modIndex` | number | 1–12 ratio | 9 ratio |
| `attack` | number | 0.001–0.03 s | 0.001 s |
| `decay` | number | 0.024–0.104 s | 0.08 s |

## See also

- [Recipe Book Index](./index.md)
- [ToneGraph Schema](../../tonegraph.md)
