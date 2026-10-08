---
title: "Impact Punch Flesh"
id: "impact-punch-flesh"
order: 29
description: "Fleshy punch impact"
---

# Impact Punch Flesh

**Category: Impact** · Tags: casual, fun, impact

## At a glance

| Field | Value |
|-------|-------|
| **Title** | Impact Punch Flesh |
| **Common uses** | Melee hits, punch impacts, combat feedback |
| **Default frequency** | 250 Hz (filter) |
| **Default duration** | 0.188 s |
| **Tier** | 3 — Textured & filtered |
| **Category** | Impact |
| **Tags** | casual, fun, impact |

## Sound design

### Overview

`impact-punch-flesh` provides fleshy punch impact. It belongs to the casual recipe family (casual, fun, impact) and is designed to be short, characterful and easy to layer.

### Synthesis

It is built from a brown-noise source through a lowpass filter (Q=1), shaped by an amplitude envelope (attack 0.002s, decay 0.12s, sustain 0), which opens quickly and then settles. No additional processing is required, so it renders quickly and deterministically.

### Parameters

The declared parameters (`filterFreq`, `attack`, `decay`) expose the pitch contour endpoints and the envelope timing. Override a contour endpoint to change the direction or span of the sweep, or adjust the decay to make the event snappier or more resonant.

### Seed behaviour & musical intent

With a fixed seed (e.g. `--seed 42`) this recipe renders byte-identical audio on every platform and run. A lightweight, joyful game sound intended as a placeholder that a sound designer can immediately vary through the CLI.

## ToneForge CLI

<!-- CLI_BLOCK_START — regenerate with: tsx scripts/recipe-book/generate-cli-blocks.ts impact-punch-flesh -->
```bash
# Generate the recipe with a specific seed
toneforge generate --recipe impact-punch-flesh --seed 42 --output impact-punch-flesh.wav
```
```bash
# Show the recipe metadata
toneforge show --recipe impact-punch-flesh
```
```bash
# List all recipes, filtered by casual tag
toneforge list recipes --tags casual
```
```bash
# Generate with default seed
toneforge generate --recipe impact-punch-flesh --output impact-punch-flesh-default.wav
```
<!-- CLI_BLOCK_END -->

## Parameters

| Parameter | Type | Range | Default |
|-----------|------|-------|---------|
| `filterFreq` | number | 125–450 Hz | 250 Hz |
| `attack` | number | 0.001–0.02 s | 0.002 s |
| `decay` | number | 0.036–0.156 s | 0.12 s |

## See also

- [Recipe Book Index](./index.md)
- [ToneGraph Schema](../../tonegraph.md)
