---
title: "Ambience Rain Light"
id: "ambience-rain-light"
order: 78
description: "Light rain ambience"
---

# Ambience Rain Light

**Category: Ambience** · Tags: casual, joy, ambience

## Sound design

### Overview

Light rain — a high, hissing noise bed.

### Synthesis

White noise through a 3000 Hz highpass (Q 0.5) leaves only the fine high-frequency patter of drizzle; a soft envelope keeps it continuous and even.

### Parameters

`filterFreq` sets the rain tone; `noiseLevel` its density; `attack`/`release` the fade.

### Seed behaviour & musical intent

With a fixed seed (e.g. `--seed 42`) this recipe renders byte-identical audio on every platform and run. A gentle rain loop for outdoor scenes.

## ToneForge CLI

<!-- CLI_BLOCK_START — regenerate with: tsx scripts/recipe-book/generate-cli-blocks.ts ambience-rain-light -->
```bash
# Generate the recipe with a specific seed
toneforge generate --recipe ambience-rain-light --seed 42 --output ambience-rain-light.wav
```
```bash
# Show the recipe metadata
toneforge show --recipe ambience-rain-light
```
```bash
# List all recipes, filtered by casual tag
toneforge list recipes --tags casual
```
```bash
# Generate with default seed
toneforge generate --recipe ambience-rain-light --output ambience-rain-light-default.wav
```
<!-- CLI_BLOCK_END -->

## Parameters

| Parameter | Type | Range | Default |
|-----------|------|-------|---------|
| `filterFreq` | number | 1800–4800 Hz | 3000 Hz |
| `noiseLevel` | number | 0.4–0.9 amplitude | 0.7 amplitude |
| `attack` | number | 0.1–0.4 s | 0.25 s |
| `release` | number | 0.2–0.5 s | 0.4 s |

## See also

- [Recipe Book Index](./index.md)
- [ToneGraph Schema](../../tonegraph.md)
