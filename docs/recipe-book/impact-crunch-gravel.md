---
title: "Impact Crunch Gravel"
id: "impact-crunch-gravel"
order: 31
description: "Gravel crunch impact"
---

# Impact Crunch Gravel

**Category: Impact** · Tags: casual, fun, impact

## Sound design

### Overview

`impact-crunch-gravel` provides gravel crunch impact. It belongs to the casual recipe family (casual, fun, impact) and is designed to be short, characterful and easy to layer.

### Synthesis

It is built from a brown-noise source through a bandpass filter (Q=4), shaped by an amplitude envelope (attack 0.002s, decay 0.18s, sustain 0), which opens quickly and then settles. No additional processing is required, so it renders quickly and deterministically.

### Parameters

The declared parameters (`filterFreq`, `attack`, `decay`) expose the pitch contour endpoints and the envelope timing. Override a contour endpoint to change the direction or span of the sweep, or adjust the decay to make the event snappier or more resonant.

### Seed behaviour & musical intent

With a fixed seed (e.g. `--seed 42`) this recipe renders byte-identical audio on every platform and run. A lightweight, joyful game sound intended as a placeholder that a sound designer can immediately vary through the CLI.

## ToneForge CLI

<!-- CLI_BLOCK_START — regenerate with: tsx scripts/recipe-book/generate-cli-blocks.ts impact-crunch-gravel -->
```bash
# Generate the recipe with a specific seed
toneforge generate --recipe impact-crunch-gravel --seed 42 --output impact-crunch-gravel.wav
```
```bash
# Show the recipe metadata
toneforge show --recipe impact-crunch-gravel
```
```bash
# List all recipes, filtered by casual tag
toneforge list recipes --tags casual
```
```bash
# Generate with default seed
toneforge generate --recipe impact-crunch-gravel --output impact-crunch-gravel-default.wav
```
<!-- CLI_BLOCK_END -->

## Parameters

| Parameter | Type | Range | Default |
|-----------|------|-------|---------|
| `filterFreq` | number | 450–1620 Hz | 900 Hz |
| `attack` | number | 0.001–0.02 s | 0.002 s |
| `decay` | number | 0.054–0.234 s | 0.18 s |

## See also

- [Recipe Book Index](./index.md)
- [ToneGraph Schema](../../tonegraph.md)
