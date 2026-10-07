---
title: "Weapon Pew Soft"
id: "weapon-pew-soft"
order: 27
description: "Soft laser pew with pitch drop"
---

# Weapon Pew Soft

**Category: Weapon** · Tags: casual, fun, weapon

## Sound design

### Overview

`weapon-pew-soft` provides soft laser pew with pitch drop. It belongs to the casual recipe family (casual, fun, weapon) and is designed to be short, characterful and easy to layer.

### Synthesis

It is built from a single sawtooth tone shaped by The amplitude envelope runs attack 0.002s, decay 0.15s and sustain 0, so the tone opens quickly and then settles. The pitch follows a exponential falling contour (900 Hz → 200 Hz) scheduled on the oscillator's frequency AudioParam, so the note bends rather than holding a fixed pitch.

### Parameters

The declared parameters (`startFreq`, `endFreq`, `attack`, `decay`) expose the pitch contour endpoints and the envelope timing. Override a contour endpoint to change the direction or span of the sweep, or adjust the decay to make the event snappier or more resonant.

### Seed behaviour & musical intent

With a fixed seed (e.g. `--seed 42`) this recipe renders byte-identical audio on every platform and run. A lightweight, joyful game sound intended as a placeholder that a sound designer can immediately vary through the CLI.

## ToneForge CLI

<!-- CLI_BLOCK_START — regenerate with: tsx scripts/recipe-book/generate-cli-blocks.ts weapon-pew-soft -->
```bash
# Generate the recipe with a specific seed
toneforge generate --recipe weapon-pew-soft --seed 42 --output weapon-pew-soft.wav
```
```bash
# Show the recipe metadata
toneforge show --recipe weapon-pew-soft
```
```bash
# List all recipes, filtered by casual tag
toneforge list recipes --tags casual
```
```bash
# Generate with default seed
toneforge generate --recipe weapon-pew-soft --output weapon-pew-soft-default.wav
```
<!-- CLI_BLOCK_END -->

## Parameters

| Parameter | Type | Range | Default |
|-----------|------|-------|---------|
| `startFreq` | number | 540–1440 Hz | 900 Hz |
| `endFreq` | number | 120–320 Hz | 200 Hz |
| `attack` | number | 0.001–0.03 s | 0.002 s |
| `decay` | number | 0.03–0.4 s | 0.15 s |

## See also

- [Recipe Book Index](./index.md)
- [ToneGraph Schema](../../tonegraph.md)
