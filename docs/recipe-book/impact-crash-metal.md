---
title: "Impact Crash Metal"
id: "impact-crash-metal"
order: 30
description: "Metal crash with resonant ring"
---

# Impact Crash Metal

**Category: Impact** · Tags: casual, fun, impact

## At a glance

| Field | Value |
|-------|-------|
| **Title** | Impact Crash Metal |
| **Common uses** | Metal collisions, clangs, destructive impacts |
| **Default frequency** | 3200 Hz (filter) |
| **Default duration** | 0.356 s |
| **Tier** | 3 — Textured & filtered |
| **Category** | Impact |
| **Tags** | casual, fun, impact |

## Sound design

### Overview

`impact-crash-metal` provides metal crash with resonant ring. It belongs to the casual recipe family (casual, fun, impact) and is designed to be short, characterful and easy to layer.

### Synthesis

It is built from a white-noise source through a bandpass filter (Q=8), shaped by an amplitude envelope (attack 0.001s, decay 0.25s, sustain 0), which opens quickly and then settles. No additional processing is required, so it renders quickly and deterministically.

### Parameters

The declared parameters (`filterFreq`, `attack`, `decay`) expose the pitch contour endpoints and the envelope timing. Override a contour endpoint to change the direction or span of the sweep, or adjust the decay to make the event snappier or more resonant.

### Seed behaviour & musical intent

With a fixed seed (e.g. `--seed 42`) this recipe renders byte-identical audio on every platform and run. A lightweight, joyful game sound intended as a placeholder that a sound designer can immediately vary through the CLI.

## ToneForge CLI

<!-- CLI_BLOCK_START — regenerate with: tsx scripts/recipe-book/generate-cli-blocks.ts impact-crash-metal -->
```bash
# Generate the recipe with a specific seed
toneforge generate --recipe impact-crash-metal --seed 42 --output impact-crash-metal.wav
```
```bash
# Show the recipe metadata
toneforge show --recipe impact-crash-metal
```
```bash
# List all recipes, filtered by casual tag
toneforge list recipes --tags casual
```
```bash
# Generate with default seed
toneforge generate --recipe impact-crash-metal --output impact-crash-metal-default.wav
```
<!-- CLI_BLOCK_END -->

## Parameters

| Parameter | Type | Range | Default |
|-----------|------|-------|---------|
| `filterFreq` | number | 1600–5760 Hz | 3200 Hz |
| `attack` | number | 0.001–0.02 s | 0.001 s |
| `decay` | number | 0.075–0.325 s | 0.25 s |

## See also

- [Recipe Book Index](./index.md)
- [ToneGraph Schema](../../tonegraph.md)
