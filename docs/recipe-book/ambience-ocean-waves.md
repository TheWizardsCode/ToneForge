---
title: "Ambience Ocean Waves"
id: "ambience-ocean-waves"
order: 79
description: "Ocean waves ambience"
---

# Ambience Ocean Waves

**Category: Ambience** · Tags: casual, joy, ambience

## At a glance

| Field | Value |
|-------|-------|
| **Title** | Ambience Ocean Waves |
| **Common uses** | Beaches, oceans, coastal levels |
| **Default frequency** | 1200 Hz (filter) |
| **Default duration** | 1.9 s |
| **Tier** | 6 — Ambience & loops |
| **Category** | Ambience |
| **Tags** | casual, joy, ambience |

## Sound design

### Overview

Ocean waves — a filtered noise bed swelling and receding.

### Synthesis

Pink noise through a 1200 Hz lowpass is amplitude-modulated by a 0.2 Hz LFO (±0.35) on the mix gain, producing the long surge and fall of surf.

### Parameters

`waveRate`/`waveDepth` set the swell timing and strength; `filterFreq` the water tone; `attack`/`release` the fade.

### Seed behaviour & musical intent

With a fixed seed (e.g. `--seed 42`) this recipe renders byte-identical audio on every platform and run. A rolling coastal loop.

## ToneForge CLI

<!-- CLI_BLOCK_START — regenerate with: tsx scripts/recipe-book/generate-cli-blocks.ts ambience-ocean-waves -->
```bash
# Generate the recipe with a specific seed
toneforge generate --recipe ambience-ocean-waves --seed 42 --output ambience-ocean-waves.wav
```
```bash
# Show the recipe metadata
toneforge show --recipe ambience-ocean-waves
```
```bash
# List all recipes, filtered by casual tag
toneforge list recipes --tags casual
```
```bash
# Generate with default seed
toneforge generate --recipe ambience-ocean-waves --output ambience-ocean-waves-default.wav
```
<!-- CLI_BLOCK_END -->

## Parameters

| Parameter | Type | Range | Default |
|-----------|------|-------|---------|
| `waveRate` | number | 0.08–0.5 Hz | 0.2 Hz |
| `waveDepth` | number | 0.15–0.45 amplitude | 0.35 amplitude |
| `filterFreq` | number | 600–1800 Hz | 1200 Hz |
| `attack` | number | 0.2–0.6 s | 0.4 s |
| `release` | number | 0.25–0.7 s | 0.6 s |

## See also

- [Recipe Book Index](./index.md)
- [ToneGraph Schema](../../tonegraph.md)
