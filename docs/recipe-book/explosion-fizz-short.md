---
title: "Explosion Fizz Short"
id: "explosion-fizz-short"
order: 35
description: "Short fizzing explosion tail"
---

# Explosion Fizz Short

**Category: Impact** · Tags: casual, fun, impact

## Sound design

### Overview

`explosion-fizz-short` provides short fizzing explosion tail. It belongs to the casual recipe family (casual, fun, impact) and is designed to be short, characterful and easy to layer.

### Synthesis

It is built from a white-noise source through a highpass filter (Q=1), shaped by an amplitude envelope (attack 0.001s, decay 0.35s, sustain 0), which opens quickly and then settles. No additional processing is required, so it renders quickly and deterministically.

### Parameters

The declared parameters (`filterFreq`, `attack`, `decay`) expose the pitch contour endpoints and the envelope timing. Override a contour endpoint to change the direction or span of the sweep, or adjust the decay to make the event snappier or more resonant.

### Seed behaviour & musical intent

With a fixed seed (e.g. `--seed 42`) this recipe renders byte-identical audio on every platform and run. A lightweight, joyful game sound intended as a placeholder that a sound designer can immediately vary through the CLI.

## ToneForge CLI

<!-- CLI_BLOCK_START — regenerate with: tsx scripts/recipe-book/generate-cli-blocks.ts explosion-fizz-short -->
```bash
# Generate the recipe with a specific seed
toneforge generate --recipe explosion-fizz-short --seed 42 --output explosion-fizz-short.wav
```
```bash
# Show the recipe metadata
toneforge show --recipe explosion-fizz-short
```
```bash
# List all recipes, filtered by casual tag
toneforge list recipes --tags casual
```
```bash
# Generate with default seed
toneforge generate --recipe explosion-fizz-short --output explosion-fizz-short-default.wav
```
<!-- CLI_BLOCK_END -->

## Parameters

| Parameter | Type | Range | Default |
|-----------|------|-------|---------|
| `filterFreq` | number | 1100–3960 Hz | 2200 Hz |
| `attack` | number | 0.001–0.02 s | 0.001 s |
| `decay` | number | 0.105–0.455 s | 0.35 s |

## See also

- [Recipe Book Index](./index.md)
- [ToneGraph Schema](../../tonegraph.md)
