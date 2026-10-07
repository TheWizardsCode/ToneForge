---
title: "Footstep Sand Crunch"
id: "footstep-sand-crunch"
order: 43
description: "Sand crunch footstep"
---

# Footstep Sand Crunch

**Category: Footstep** · Tags: casual, joy, footstep

## Sound design

### Overview

`footstep-sand-crunch` provides sand crunch footstep. It belongs to the casual recipe family (casual, joy, footstep) and is designed to be short, characterful and easy to layer.

### Synthesis

It is built from a white-noise source through a bandpass filter (Q=5), shaped by an amplitude envelope (attack 0.002s, decay 0.12s, sustain 0), which opens quickly and then settles. No additional processing is required, so it renders quickly and deterministically.

### Parameters

The declared parameters (`filterFreq`, `attack`, `decay`) expose the pitch contour endpoints and the envelope timing. Override a contour endpoint to change the direction or span of the sweep, or adjust the decay to make the event snappier or more resonant.

### Seed behaviour & musical intent

With a fixed seed (e.g. `--seed 42`) this recipe renders byte-identical audio on every platform and run. A lightweight, joyful game sound intended as a placeholder that a sound designer can immediately vary through the CLI.

## ToneForge CLI

<!-- CLI_BLOCK_START — regenerate with: tsx scripts/recipe-book/generate-cli-blocks.ts footstep-sand-crunch -->
```bash
# Generate the recipe with a specific seed
toneforge generate --recipe footstep-sand-crunch --seed 42 --output footstep-sand-crunch.wav
```
```bash
# Show the recipe metadata
toneforge show --recipe footstep-sand-crunch
```
```bash
# List all recipes, filtered by casual tag
toneforge list recipes --tags casual
```
```bash
# Generate with default seed
toneforge generate --recipe footstep-sand-crunch --output footstep-sand-crunch-default.wav
```
<!-- CLI_BLOCK_END -->

## Parameters

| Parameter | Type | Range | Default |
|-----------|------|-------|---------|
| `filterFreq` | number | 700–2520 Hz | 1400 Hz |
| `attack` | number | 0.001–0.02 s | 0.002 s |
| `decay` | number | 0.036–0.156 s | 0.12 s |

## See also

- [Recipe Book Index](./index.md)
- [ToneGraph Schema](../../tonegraph.md)
