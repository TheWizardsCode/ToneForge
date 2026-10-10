---
title: "Ambience Waterfall Soft"
id: "ambience-waterfall-soft"
order: 76
description: "Soft waterfall ambience"
---

# Ambience Waterfall Soft

**Category: Ambience** · Tags: casual, fun, ambience

## At a glance

| Field | Value |
|-------|-------|
| **Title** | Ambience Waterfall Soft |
| **Common uses** | Waterfalls, rivers, watery environments |
| **Default frequency** | 2500 Hz (filter) |
| **Default duration** | 1.7 s |
| **Tier** | 6 — Ambience & loops |
| **Category** | Ambience |
| **Tags** | casual, fun, ambience |

## Sound design

### Overview

A steady soft waterfall — broad white noise rounded by a gentle lowpass.

### Synthesis

White noise through a 2500 Hz lowpass (Q 0.7) gives a full, uncoloured rush; a long sustain and relaxed release make it a continuous bed rather than an event.

### Parameters

`filterFreq` sets brightness; `noiseLevel` sets loudness; `attack`/`release` shape the fade.

### Seed behaviour & musical intent

With a fixed seed (e.g. `--seed 42`) this recipe renders byte-identical audio on every platform and run. A continuous water loop for caves, grottos and gardens.

## ToneForge CLI

<!-- CLI_BLOCK_START — regenerate with: tsx scripts/recipe-book/generate-cli-blocks.ts ambience-waterfall-soft -->
```bash
# Generate the recipe with a specific seed
toneforge generate --recipe ambience-waterfall-soft --seed 42 --output ambience-waterfall-soft.wav
```
```bash
# Show the recipe metadata
toneforge show --recipe ambience-waterfall-soft
```
```bash
# List all recipes, filtered by casual tag
toneforge list recipes --tags casual
```
```bash
# Generate with default seed
toneforge generate --recipe ambience-waterfall-soft --output ambience-waterfall-soft-default.wav
```
<!-- CLI_BLOCK_END -->

## Parameters

| Parameter | Type | Range | Default |
|-----------|------|-------|---------|
| `filterFreq` | number | 1400–3600 Hz | 2500 Hz |
| `noiseLevel` | number | 0.6–1 amplitude | 0.85 amplitude |
| `attack` | number | 0.15–0.5 s | 0.35 s |
| `release` | number | 0.2–0.6 s | 0.5 s |

## See also

- [Recipe Book Index](./index.md)
- [ToneGraph Schema](../../tonegraph.md)
