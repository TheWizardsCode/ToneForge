---
title: "Jump Hop Blip"
id: "jump-hop-blip"
order: 15
description: "Rising hop blip for character jumps"
---

# Jump Hop Blip

**Category: Character** · Tags: casual, fun, jump

## At a glance

| Field | Value |
|-------|-------|
| **Title** | Jump Hop Blip |
| **Common uses** | Character jumps, hops, platforming movement |
| **Default frequency** | 300 Hz |
| **Default duration** | 0.25 s |
| **Tier** | 2 — Shaped events |
| **Category** | Character |
| **Tags** | casual, fun, jump |

## Sound design

### Overview

`jump-hop-blip` provides rising hop blip for character jumps. It belongs to the casual recipe family (casual, fun, jump) and is designed to be short, characterful and easy to layer.

### Synthesis

It is built from a single sine tone, shaped by an amplitude envelope (attack 0.005s, decay 0.12s, sustain 0), which opens quickly and then settles. The pitch follows a linear rising contour (300 Hz → 600 Hz) scheduled on the frequency AudioParam, so the sound bends rather than holding a fixed pitch.

### Parameters

The declared parameters (`startFreq`, `endFreq`, `attack`, `decay`) expose the pitch contour endpoints and the envelope timing. Override a contour endpoint to change the direction or span of the sweep, or adjust the decay to make the event snappier or more resonant.

### Seed behaviour & musical intent

With a fixed seed (e.g. `--seed 42`) this recipe renders byte-identical audio on every platform and run. A lightweight, joyful game sound intended as a placeholder that a sound designer can immediately vary through the CLI.

## ToneForge CLI

<!-- CLI_BLOCK_START — regenerate with: tsx scripts/recipe-book/generate-cli-blocks.ts jump-hop-blip -->
```bash
# Generate the recipe with a specific seed
toneforge generate --recipe jump-hop-blip --seed 42 --output jump-hop-blip.wav
```
```bash
# Show the recipe metadata
toneforge show --recipe jump-hop-blip
```
```bash
# List all recipes, filtered by casual tag
toneforge list recipes --tags casual
```
```bash
# Generate with default seed
toneforge generate --recipe jump-hop-blip --output jump-hop-blip-default.wav
```
<!-- CLI_BLOCK_END -->

## Parameters

| Parameter | Type | Range | Default |
|-----------|------|-------|---------|
| `startFreq` | number | 180–480 Hz | 300 Hz |
| `endFreq` | number | 360–960 Hz | 600 Hz |
| `attack` | number | 0.001–0.03 s | 0.005 s |
| `decay` | number | 0.03–0.4 s | 0.12 s |

## See also

- [Recipe Book Index](./index.md)
- [ToneGraph Schema](../../tonegraph.md)
