---
title: "Ambience Snowfall Hush"
id: "ambience-snowfall-hush"
order: 86
description: "Snowfall hush ambience"
---

# Ambience Snowfall Hush

**Category: Ambience** · Tags: casual, joy, ambience

## Sound design

### Overview

A silent snowfall hush — the faintest high noise over a soft low tone.

### Synthesis

White noise through a 4000 Hz highpass leaves a whisper of air, while a 120 Hz sine underpins it. A long attack and release make it as gentle as possible.

### Parameters

`toneFreq` sets the low pad; `noiseLevel` the air; `filterFreq` the hiss tone; `attack`/`release` the fade.

### Seed behaviour & musical intent

With a fixed seed (e.g. `--seed 42`) this recipe renders byte-identical audio on every platform and run. A quiet, still winter loop.

## ToneForge CLI

<!-- CLI_BLOCK_START — regenerate with: tsx scripts/recipe-book/generate-cli-blocks.ts ambience-snowfall-hush -->
```bash
# Generate the recipe with a specific seed
toneforge generate --recipe ambience-snowfall-hush --seed 42 --output ambience-snowfall-hush.wav
```
```bash
# Show the recipe metadata
toneforge show --recipe ambience-snowfall-hush
```
```bash
# List all recipes, filtered by casual tag
toneforge list recipes --tags casual
```
```bash
# Generate with default seed
toneforge generate --recipe ambience-snowfall-hush --output ambience-snowfall-hush-default.wav
```
<!-- CLI_BLOCK_END -->

## Parameters

| Parameter | Type | Range | Default |
|-----------|------|-------|---------|
| `toneFreq` | number | 70–160 Hz | 120 Hz |
| `noiseLevel` | number | 0.1–0.5 amplitude | 0.3 amplitude |
| `filterFreq` | number | 2500–6500 Hz | 4000 Hz |
| `attack` | number | 0.2–0.7 s | 0.45 s |
| `release` | number | 0.25–0.7 s | 0.6 s |

## See also

- [Recipe Book Index](./index.md)
- [ToneGraph Schema](../../tonegraph.md)
