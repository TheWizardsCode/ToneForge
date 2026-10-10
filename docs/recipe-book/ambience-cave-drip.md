---
title: "Ambience Cave Drip"
id: "ambience-cave-drip"
order: 74
description: "Cave drip ambience"
---

# Ambience Cave Drip

**Category: Ambience** · Tags: casual, fun, ambience

## At a glance

| Field | Value |
|-------|-------|
| **Title** | Ambience Cave Drip |
| **Common uses** | Caves, underground levels, damp environments |
| **Default frequency** | 90 Hz |
| **Default duration** | 1.7 s |
| **Tier** | 6 — Ambience & loops |
| **Category** | Ambience |
| **Tags** | casual, fun, ambience |

## Sound design

### Overview

A dark cave bed with a low drone and periodic resonant drips.

### Synthesis

A 90 Hz sine drone is joined by a small white-noise layer through a bandpass whose centre is swept by a 3 Hz LFO (±400 Hz), producing the repeating drip resonance. A long sustain keeps the cave open.

### Parameters

`droneFreq` sets the rumble; `noiseLevel` the drip material; `dripRate`/`dripDepth` the drip spacing and brightness; `attack`/`release` the fade.

### Seed behaviour & musical intent

With a fixed seed (e.g. `--seed 42`) this recipe renders byte-identical audio on every platform and run. An echoing underground loop with occasional water.

## ToneForge CLI

<!-- CLI_BLOCK_START — regenerate with: tsx scripts/recipe-book/generate-cli-blocks.ts ambience-cave-drip -->
```bash
# Generate the recipe with a specific seed
toneforge generate --recipe ambience-cave-drip --seed 42 --output ambience-cave-drip.wav
```
```bash
# Show the recipe metadata
toneforge show --recipe ambience-cave-drip
```
```bash
# List all recipes, filtered by casual tag
toneforge list recipes --tags casual
```
```bash
# Generate with default seed
toneforge generate --recipe ambience-cave-drip --output ambience-cave-drip-default.wav
```
<!-- CLI_BLOCK_END -->

## Parameters

| Parameter | Type | Range | Default |
|-----------|------|-------|---------|
| `droneFreq` | number | 55–140 Hz | 90 Hz |
| `noiseLevel` | number | 0.05–0.35 amplitude | 0.15 amplitude |
| `dripRate` | number | 1–6 Hz | 3 Hz |
| `dripDepth` | number | 200–700 Hz | 400 Hz |
| `attack` | number | 0.15–0.5 s | 0.3 s |
| `release` | number | 0.2–0.6 s | 0.5 s |

## See also

- [Recipe Book Index](./index.md)
- [ToneGraph Schema](../../tonegraph.md)
