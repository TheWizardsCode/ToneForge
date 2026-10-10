---
title: "Whoosh Cloth Flap"
id: "whoosh-cloth-flap"
order: 33
description: "Cloth flap whoosh"
---

# Whoosh Cloth Flap

**Category: Impact** · Tags: casual, fun, whoosh

## At a glance

| Field | Value |
|-------|-------|
| **Title** | Whoosh Cloth Flap |
| **Common uses** | Cloth movement, cape flaps, soft transitions |
| **Default frequency** | 2500 Hz (sweep start) |
| **Default duration** | 0.3 s |
| **Tier** | 3 — Textured & filtered |
| **Category** | Impact |
| **Tags** | casual, fun, whoosh |

## Sound design

### Overview

`whoosh-cloth-flap` provides cloth flap whoosh. It belongs to the casual recipe family (casual, fun, whoosh) and is designed to be short, characterful and easy to layer.

### Synthesis

It is built from a pink-noise source through a lowpass filter (Q=2), shaped by an amplitude envelope (attack 0.01s, decay 0.2s, sustain 0), which opens quickly and then settles. The pitch follows a linear falling contour (2500 Hz → 600 Hz) scheduled on the frequency AudioParam, so the sound bends rather than holding a fixed pitch.

### Parameters

The declared parameters (`startFreq`, `endFreq`, `attack`, `decay`) expose the pitch contour endpoints and the envelope timing. Override a contour endpoint to change the direction or span of the sweep, or adjust the decay to make the event snappier or more resonant.

### Seed behaviour & musical intent

With a fixed seed (e.g. `--seed 42`) this recipe renders byte-identical audio on every platform and run. A lightweight, joyful game sound intended as a placeholder that a sound designer can immediately vary through the CLI.

## ToneForge CLI

<!-- CLI_BLOCK_START — regenerate with: tsx scripts/recipe-book/generate-cli-blocks.ts whoosh-cloth-flap -->
```bash
# Generate the recipe with a specific seed
toneforge generate --recipe whoosh-cloth-flap --seed 42 --output whoosh-cloth-flap.wav
```
```bash
# Show the recipe metadata
toneforge show --recipe whoosh-cloth-flap
```
```bash
# List all recipes, filtered by casual tag
toneforge list recipes --tags casual
```
```bash
# Generate with default seed
toneforge generate --recipe whoosh-cloth-flap --output whoosh-cloth-flap-default.wav
```
<!-- CLI_BLOCK_END -->

## Parameters

| Parameter | Type | Range | Default |
|-----------|------|-------|---------|
| `startFreq` | number | 1250–4000 Hz | 2500 Hz |
| `endFreq` | number | 360–1080 Hz | 600 Hz |
| `attack` | number | 0.001–0.05 s | 0.01 s |
| `decay` | number | 0.06–0.26 s | 0.2 s |

## See also

- [Recipe Book Index](./index.md)
- [ToneGraph Schema](../../tonegraph.md)
