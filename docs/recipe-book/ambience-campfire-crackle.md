---
title: "Ambience Campfire Crackle"
id: "ambience-campfire-crackle"
order: 77
description: "Campfire crackle ambience"
---

# Ambience Campfire Crackle

**Category: Ambience** · Tags: casual, fun, ambience

## Sound design

### Overview

A campfire bed — warm noise with periodic crackles.

### Synthesis

White noise through a bandpass at 2200 Hz (Q 2) with a 6 Hz LFO (±900 Hz) creates the flutter and pops of flame; a moderate sustain keeps it alive while the release prevents a hard stop.

### Parameters

`filterFreq` sets the warmth; `crackleRate`/`crackleDepth` set the pop frequency and intensity; `attack`/`release` the fade.

### Seed behaviour & musical intent

With a fixed seed (e.g. `--seed 42`) this recipe renders byte-identical audio on every platform and run. A cosy fire loop for camps and taverns.

## ToneForge CLI

<!-- CLI_BLOCK_START — regenerate with: tsx scripts/recipe-book/generate-cli-blocks.ts ambience-campfire-crackle -->
```bash
# Generate the recipe with a specific seed
toneforge generate --recipe ambience-campfire-crackle --seed 42 --output ambience-campfire-crackle.wav
```
```bash
# Show the recipe metadata
toneforge show --recipe ambience-campfire-crackle
```
```bash
# List all recipes, filtered by casual tag
toneforge list recipes --tags casual
```
```bash
# Generate with default seed
toneforge generate --recipe ambience-campfire-crackle --output ambience-campfire-crackle-default.wav
```
<!-- CLI_BLOCK_END -->

## Parameters

| Parameter | Type | Range | Default |
|-----------|------|-------|---------|
| `filterFreq` | number | 1200–3200 Hz | 2200 Hz |
| `crackleRate` | number | 2–12 Hz | 6 Hz |
| `crackleDepth` | number | 400–1400 Hz | 900 Hz |
| `attack` | number | 0.1–0.4 s | 0.25 s |
| `release` | number | 0.2–0.6 s | 0.5 s |

## See also

- [Recipe Book Index](./index.md)
- [ToneGraph Schema](../../tonegraph.md)
