---
title: "Ambience Forest Breeze"
id: "ambience-forest-breeze"
order: 75
description: "Forest breeze ambience"
---

# Ambience Forest Breeze

**Category: Ambience** · Tags: casual, joy, ambience

## At a glance

| Field | Value |
|-------|-------|
| **Title** | Ambience Forest Breeze |
| **Common uses** | Forests, wooded levels, nature scenes |
| **Default frequency** | 600 Hz (filter) |
| **Default duration** | 1.9 s |
| **Tier** | 6 — Ambience & loops |
| **Category** | Ambience |
| **Tags** | casual, joy, ambience |

## Sound design

### Overview

A leafy forest breeze — filtered pink noise gently swept by a very slow LFO.

### Synthesis

Pink noise passes a bandpass at 600 Hz (Q 1.5) whose centre is modulated by a 0.5 Hz LFO (±250 Hz); the filter and LFO offset are linked so changing `filterFreq` moves the whole breeze.

### Parameters

`filterFreq` sets the breeze's base; `breezeRate`/`breezeDepth` set the gust speed and width; `attack`/`release` shape the swell.

### Seed behaviour & musical intent

With a fixed seed (e.g. `--seed 42`) this recipe renders byte-identical audio on every platform and run. A soft, natural outdoor loop.

## ToneForge CLI

<!-- CLI_BLOCK_START — regenerate with: tsx scripts/recipe-book/generate-cli-blocks.ts ambience-forest-breeze -->
```bash
# Generate the recipe with a specific seed
toneforge generate --recipe ambience-forest-breeze --seed 42 --output ambience-forest-breeze.wav
```
```bash
# Show the recipe metadata
toneforge show --recipe ambience-forest-breeze
```
```bash
# List all recipes, filtered by casual tag
toneforge list recipes --tags casual
```
```bash
# Generate with default seed
toneforge generate --recipe ambience-forest-breeze --output ambience-forest-breeze-default.wav
```
<!-- CLI_BLOCK_END -->

## Parameters

| Parameter | Type | Range | Default |
|-----------|------|-------|---------|
| `filterFreq` | number | 350–900 Hz | 600 Hz |
| `breezeRate` | number | 0.1–1.2 Hz | 0.5 Hz |
| `breezeDepth` | number | 120–450 Hz | 250 Hz |
| `attack` | number | 0.2–0.6 s | 0.4 s |
| `release` | number | 0.25–0.7 s | 0.55 s |

## See also

- [Recipe Book Index](./index.md)
- [ToneGraph Schema](../../tonegraph.md)
