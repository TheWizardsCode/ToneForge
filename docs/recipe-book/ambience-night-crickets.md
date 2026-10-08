---
title: "Ambience Night Crickets"
id: "ambience-night-crickets"
order: 80
description: "Night crickets ambience"
---

# Ambience Night Crickets

**Category: Ambience** · Tags: casual, fun, ambience

## At a glance

| Field | Value |
|-------|-------|
| **Title** | Ambience Night Crickets |
| **Common uses** | Night scenes, summer evenings, outdoor night |
| **Default frequency** | 4200 Hz |
| **Default duration** | 1.6 s |
| **Tier** | 6 — Ambience & loops |
| **Category** | Ambience |
| **Tags** | casual, fun, ambience |

## Sound design

### Overview

Night crickets — a chirping high tone over a quiet bed.

### Synthesis

A 4200 Hz sine with a 14 Hz LFO (±300 Hz) produces the cricket chirr; a small pink-noise layer through a 1500 Hz lowpass supplies the night air. The two are summed before a sustained envelope.

### Parameters

`cricketRate`/`cricketDepth` set the chirp speed and warble; `noiseLevel` the bed; `filterFreq` the air; `attack`/`release` the fade.

### Seed behaviour & musical intent

With a fixed seed (e.g. `--seed 42`) this recipe renders byte-identical audio on every platform and run. A warm summer-night loop.

## ToneForge CLI

<!-- CLI_BLOCK_START — regenerate with: tsx scripts/recipe-book/generate-cli-blocks.ts ambience-night-crickets -->
```bash
# Generate the recipe with a specific seed
toneforge generate --recipe ambience-night-crickets --seed 42 --output ambience-night-crickets.wav
```
```bash
# Show the recipe metadata
toneforge show --recipe ambience-night-crickets
```
```bash
# List all recipes, filtered by casual tag
toneforge list recipes --tags casual
```
```bash
# Generate with default seed
toneforge generate --recipe ambience-night-crickets --output ambience-night-crickets-default.wav
```
<!-- CLI_BLOCK_END -->

## Parameters

| Parameter | Type | Range | Default |
|-----------|------|-------|---------|
| `cricketRate` | number | 6–22 Hz | 14 Hz |
| `cricketDepth` | number | 150–500 Hz | 300 Hz |
| `noiseLevel` | number | 0.05–0.3 amplitude | 0.15 amplitude |
| `filterFreq` | number | 800–2200 Hz | 1500 Hz |
| `attack` | number | 0.1–0.4 s | 0.25 s |
| `release` | number | 0.2–0.6 s | 0.5 s |

## See also

- [Recipe Book Index](./index.md)
- [ToneGraph Schema](../../tonegraph.md)
