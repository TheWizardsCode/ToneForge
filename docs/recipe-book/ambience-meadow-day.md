---
title: "Ambience Meadow Day"
id: "ambience-meadow-day"
order: 73
description: "Daytime meadow ambience"
---

# Ambience Meadow Day

**Category: Ambience** · Tags: casual, joy, ambience

## At a glance

| Field | Value |
|-------|-------|
| **Title** | Ambience Meadow Day |
| **Common uses** | Outdoor daytime scenes, meadows, peaceful levels |
| **Default frequency** | 520 Hz |
| **Default duration** | 2.4 s |
| **Tier** | 6 — Ambience & loops |
| **Category** | Ambience |
| **Tags** | casual, joy, ambience |

## Sound design

### Overview

A warm daytime meadow bed — a soft pitched tone blended with pink noise, suggesting distant birds and rustling grass.

### Synthesis

A 520 Hz sine and pink noise at 0.35 are summed and passed through a 1200 Hz bandpass; a slow 400 ms attack and 500 ms release with a 0.72 sustain keep the texture continuous rather than event-like, so it can loop under a scene.

### Parameters

`toneFreq` sets the pitched layer; `noiseLevel` balances air against tone; `filterFreq` places the texture; `attack`/`decay`/`release` shape the swell and fade.

### Seed behaviour & musical intent

With a fixed seed (e.g. `--seed 42`) this recipe renders byte-identical audio on every platform and run. A calm, sunny outdoor loop for menus and exploration.

## ToneForge CLI

<!-- CLI_BLOCK_START — regenerate with: tsx scripts/recipe-book/generate-cli-blocks.ts ambience-meadow-day -->
```bash
# Generate the recipe with a specific seed
toneforge generate --recipe ambience-meadow-day --seed 42 --output ambience-meadow-day.wav
```
```bash
# Show the recipe metadata
toneforge show --recipe ambience-meadow-day
```
```bash
# List all recipes, filtered by casual tag
toneforge list recipes --tags casual
```
```bash
# Generate with default seed
toneforge generate --recipe ambience-meadow-day --output ambience-meadow-day-default.wav
```
<!-- CLI_BLOCK_END -->

## Parameters

| Parameter | Type | Range | Default |
|-----------|------|-------|---------|
| `toneFreq` | number | 380–720 Hz | 520 Hz |
| `noiseLevel` | number | 0.15–0.6 amplitude | 0.35 amplitude |
| `filterFreq` | number | 800–1800 Hz | 1200 Hz |
| `attack` | number | 0.15–0.5 s | 0.4 s |
| `decay` | number | 0.25–0.7 s | 0.6 s |
| `release` | number | 0.2–0.6 s | 0.5 s |

## See also

- [Recipe Book Index](./index.md)
- [ToneGraph Schema](../../tonegraph.md)
