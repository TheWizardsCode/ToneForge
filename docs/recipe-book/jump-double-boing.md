---
title: "Jump Double Boing"
id: "jump-double-boing"
order: 16
description: "Double-bounce jump with a springy pitch hop"
---

# Jump Double Boing

**Category: Character** · Tags: casual, fun, jump

## At a glance

| Field | Value |
|-------|-------|
| **Title** | Jump Double Boing |
| **Common uses** | Double jumps, springy hops, bounce pads |
| **Default frequency** | 250 Hz |
| **Default duration** | 0.39 s |
| **Tier** | 2 — Shaped events |
| **Category** | Character |
| **Tags** | casual, fun, jump |

## Sound design

### Overview

`jump-double-boing` provides double-bounce jump with a springy pitch hop. It belongs to the casual recipe family (casual, fun, jump) and is designed to be short, characterful and easy to layer.

### Synthesis

It is built from a single sine tone, shaped by an amplitude envelope (attack 0.005s, decay 0.2s, sustain 0), which opens quickly and then settles. The pitch follows a linear rising contour (250 Hz → 500 Hz → 350 Hz) scheduled on the frequency AudioParam, so the sound bends rather than holding a fixed pitch.

### Parameters

The declared parameters (`startFreq`, `midFreq`, `endFreq`, `attack`, `decay`) expose the pitch contour endpoints and the envelope timing. Override a contour endpoint to change the direction or span of the sweep, or adjust the decay to make the event snappier or more resonant.

### Seed behaviour & musical intent

With a fixed seed (e.g. `--seed 42`) this recipe renders byte-identical audio on every platform and run. A lightweight, joyful game sound intended as a placeholder that a sound designer can immediately vary through the CLI.

## ToneForge CLI

<!-- CLI_BLOCK_START — regenerate with: tsx scripts/recipe-book/generate-cli-blocks.ts jump-double-boing -->
```bash
# Generate the recipe with a specific seed
toneforge generate --recipe jump-double-boing --seed 42 --output jump-double-boing.wav
```
```bash
# Show the recipe metadata
toneforge show --recipe jump-double-boing
```
```bash
# List all recipes, filtered by casual tag
toneforge list recipes --tags casual
```
```bash
# Generate with default seed
toneforge generate --recipe jump-double-boing --output jump-double-boing-default.wav
```
<!-- CLI_BLOCK_END -->

## Parameters

| Parameter | Type | Range | Default |
|-----------|------|-------|---------|
| `startFreq` | number | 150–400 Hz | 250 Hz |
| `midFreq` | number | 350–700 Hz | 500 Hz |
| `endFreq` | number | 210–560 Hz | 350 Hz |
| `attack` | number | 0.001–0.03 s | 0.005 s |
| `decay` | number | 0.03–0.4 s | 0.2 s |

## See also

- [Recipe Book Index](./index.md)
- [ToneGraph Schema](../../tonegraph.md)
