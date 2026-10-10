---
title: "Explosion Pop Bright"
id: "explosion-pop-bright"
order: 34
description: "Bright explosion pop"
---

# Explosion Pop Bright

**Category: Impact** · Tags: casual, fun, explosion

## At a glance

| Field | Value |
|-------|-------|
| **Title** | Explosion Pop Bright |
| **Common uses** | Explosions, bomb blasts, bright impacts |
| **Default frequency** | 5000 Hz (sweep start) |
| **Default duration** | 0.551 s |
| **Tier** | 3 — Textured & filtered |
| **Category** | Impact |
| **Tags** | casual, fun, explosion |

## Sound design

### Overview

`explosion-pop-bright` provides bright explosion pop. It belongs to the casual recipe family (casual, fun, explosion) and is designed to be short, characterful and easy to layer.

### Synthesis

It is built from a white-noise source through a lowpass filter (Q=2), shaped by an amplitude envelope (attack 0.001s, decay 0.4s, sustain 0), which opens quickly and then settles. The pitch follows a linear falling contour (5000 Hz → 200 Hz) scheduled on the frequency AudioParam, so the sound bends rather than holding a fixed pitch.

### Parameters

The declared parameters (`startFreq`, `endFreq`, `attack`, `decay`) expose the pitch contour endpoints and the envelope timing. Override a contour endpoint to change the direction or span of the sweep, or adjust the decay to make the event snappier or more resonant.

### Seed behaviour & musical intent

With a fixed seed (e.g. `--seed 42`) this recipe renders byte-identical audio on every platform and run. A lightweight, joyful game sound intended as a placeholder that a sound designer can immediately vary through the CLI.

## ToneForge CLI

<!-- CLI_BLOCK_START — regenerate with: tsx scripts/recipe-book/generate-cli-blocks.ts explosion-pop-bright -->
```bash
# Generate the recipe with a specific seed
toneforge generate --recipe explosion-pop-bright --seed 42 --output explosion-pop-bright.wav
```
```bash
# Show the recipe metadata
toneforge show --recipe explosion-pop-bright
```
```bash
# List all recipes, filtered by casual tag
toneforge list recipes --tags casual
```
```bash
# Generate with default seed
toneforge generate --recipe explosion-pop-bright --output explosion-pop-bright-default.wav
```
<!-- CLI_BLOCK_END -->

## Parameters

| Parameter | Type | Range | Default |
|-----------|------|-------|---------|
| `startFreq` | number | 2500–8000 Hz | 5000 Hz |
| `endFreq` | number | 120–400 Hz | 200 Hz |
| `attack` | number | 0.001–0.05 s | 0.001 s |
| `decay` | number | 0.12–0.52 s | 0.4 s |

## See also

- [Recipe Book Index](./index.md)
- [ToneGraph Schema](../../tonegraph.md)
