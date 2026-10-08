---
title: "Footstep Grass Rustle"
id: "footstep-grass-rustle"
order: 42
description: "Grass rustle footstep"
---

# Footstep Grass Rustle

**Category: Footstep** · Tags: casual, joy, footstep

## At a glance

| Field | Value |
|-------|-------|
| **Title** | Footstep Grass Rustle |
| **Common uses** | Footsteps on grass, foliage movement, outdoor walking |
| **Default frequency** | 2500 Hz (filter) |
| **Default duration** | 0.228 s |
| **Tier** | 3 — Textured & filtered |
| **Category** | Footstep |
| **Tags** | casual, joy, footstep |

## Sound design

### Overview

`footstep-grass-rustle` provides grass rustle footstep. It belongs to the casual recipe family (casual, joy, footstep) and is designed to be short, characterful and easy to layer.

### Synthesis

It is built from a pink-noise source through a bandpass filter (Q=3), shaped by an amplitude envelope (attack 0.003s, decay 0.15s, sustain 0), which opens quickly and then settles. No additional processing is required, so it renders quickly and deterministically.

### Parameters

The declared parameters (`filterFreq`, `attack`, `decay`) expose the pitch contour endpoints and the envelope timing. Override a contour endpoint to change the direction or span of the sweep, or adjust the decay to make the event snappier or more resonant.

### Seed behaviour & musical intent

With a fixed seed (e.g. `--seed 42`) this recipe renders byte-identical audio on every platform and run. A lightweight, joyful game sound intended as a placeholder that a sound designer can immediately vary through the CLI.

## ToneForge CLI

<!-- CLI_BLOCK_START — regenerate with: tsx scripts/recipe-book/generate-cli-blocks.ts footstep-grass-rustle -->
```bash
# Generate the recipe with a specific seed
toneforge generate --recipe footstep-grass-rustle --seed 42 --output footstep-grass-rustle.wav
```
```bash
# Show the recipe metadata
toneforge show --recipe footstep-grass-rustle
```
```bash
# List all recipes, filtered by casual tag
toneforge list recipes --tags casual
```
```bash
# Generate with default seed
toneforge generate --recipe footstep-grass-rustle --output footstep-grass-rustle-default.wav
```
<!-- CLI_BLOCK_END -->

## Parameters

| Parameter | Type | Range | Default |
|-----------|------|-------|---------|
| `filterFreq` | number | 1250–4500 Hz | 2500 Hz |
| `attack` | number | 0.001–0.02 s | 0.003 s |
| `decay` | number | 0.045–0.195 s | 0.15 s |

## See also

- [Recipe Book Index](./index.md)
- [ToneGraph Schema](../../tonegraph.md)
