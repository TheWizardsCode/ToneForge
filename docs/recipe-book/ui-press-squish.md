---
title: "Ui Press Squish"
id: "ui-press-squish"
order: 20
description: "Squishy press shape for button actuation"
---

# Ui Press Squish

**Category: UI** · Tags: casual, fun, ui

## At a glance

| Field | Value |
|-------|-------|
| **Title** | Ui Press Squish |
| **Common uses** | Button actuation, pressure feedback, press confirmations |
| **Default frequency** | 500 Hz |
| **Default duration** | 0.23 s |
| **Tier** | 2 — Shaped events |
| **Category** | UI |
| **Tags** | casual, fun, ui |

## Sound design

### Overview

`ui-press-squish` provides squishy press shape for button actuation. It belongs to the casual recipe family (casual, fun, ui) and is designed to be short, characterful and easy to layer.

### Synthesis

It is built from a single triangle tone, shaped by an amplitude envelope (attack 0.005s, decay 0.1s, sustain 0), which opens quickly and then settles. The pitch follows a exponential falling contour (500 Hz → 250 Hz) scheduled on the frequency AudioParam, so the sound bends rather than holding a fixed pitch.

### Parameters

The declared parameters (`startFreq`, `endFreq`, `attack`, `decay`) expose the pitch contour endpoints and the envelope timing. Override a contour endpoint to change the direction or span of the sweep, or adjust the decay to make the event snappier or more resonant.

### Seed behaviour & musical intent

With a fixed seed (e.g. `--seed 42`) this recipe renders byte-identical audio on every platform and run. A lightweight, joyful game sound intended as a placeholder that a sound designer can immediately vary through the CLI.

## ToneForge CLI

<!-- CLI_BLOCK_START — regenerate with: tsx scripts/recipe-book/generate-cli-blocks.ts ui-press-squish -->
```bash
# Generate the recipe with a specific seed
toneforge generate --recipe ui-press-squish --seed 42 --output ui-press-squish.wav
```
```bash
# Show the recipe metadata
toneforge show --recipe ui-press-squish
```
```bash
# List all recipes, filtered by casual tag
toneforge list recipes --tags casual
```
```bash
# Generate with default seed
toneforge generate --recipe ui-press-squish --output ui-press-squish-default.wav
```
<!-- CLI_BLOCK_END -->

## Parameters

| Parameter | Type | Range | Default |
|-----------|------|-------|---------|
| `startFreq` | number | 300–800 Hz | 500 Hz |
| `endFreq` | number | 150–400 Hz | 250 Hz |
| `attack` | number | 0.001–0.03 s | 0.005 s |
| `decay` | number | 0.03–0.4 s | 0.1 s |

## See also

- [Recipe Book Index](./index.md)
- [ToneGraph Schema](../../tonegraph.md)
