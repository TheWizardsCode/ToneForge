---
title: "Ambience Desert Wind"
id: "ambience-desert-wind"
order: 85
description: "Desert wind ambience"
---

# Ambience Desert Wind

**Category: Ambience** · Tags: casual, fun, ambience

## At a glance

| Field | Value |
|-------|-------|
| **Title** | Ambience Desert Wind |
| **Common uses** | Deserts, arid levels, dusty winds |
| **Default frequency** | 500 Hz (filter) |
| **Default duration** | 2 s |
| **Tier** | 6 — Ambience & loops |
| **Category** | Ambience |
| **Tags** | casual, fun, ambience |

## Sound design

### Overview

A dry desert wind — brown noise swept by a slow bandpass.

### Synthesis

Brown noise through a bandpass at 500 Hz (Q 1.5) with a 0.3 Hz LFO (±300 Hz) gives a low, dusty gust; brown noise supplies the weight and low-frequency body.

### Parameters

`windRate`/`windDepth` set the gust motion; `filterFreq` the wind body; `attack`/`release` the fade.

### Seed behaviour & musical intent

With a fixed seed (e.g. `--seed 42`) this recipe renders byte-identical audio on every platform and run. A sparse, arid outdoor loop.

## ToneForge CLI

<!-- CLI_BLOCK_START — regenerate with: tsx scripts/recipe-book/generate-cli-blocks.ts ambience-desert-wind -->
```bash
# Generate the recipe with a specific seed
toneforge generate --recipe ambience-desert-wind --seed 42 --output ambience-desert-wind.wav
```
```bash
# Show the recipe metadata
toneforge show --recipe ambience-desert-wind
```
```bash
# List all recipes, filtered by casual tag
toneforge list recipes --tags casual
```
```bash
# Generate with default seed
toneforge generate --recipe ambience-desert-wind --output ambience-desert-wind-default.wav
```
<!-- CLI_BLOCK_END -->

## Parameters

| Parameter | Type | Range | Default |
|-----------|------|-------|---------|
| `windRate` | number | 0.1–0.8 Hz | 0.3 Hz |
| `windDepth` | number | 150–500 Hz | 300 Hz |
| `filterFreq` | number | 300–900 Hz | 500 Hz |
| `attack` | number | 0.2–0.7 s | 0.45 s |
| `release` | number | 0.25–0.7 s | 0.55 s |

## See also

- [Recipe Book Index](./index.md)
- [ToneGraph Schema](../../tonegraph.md)
