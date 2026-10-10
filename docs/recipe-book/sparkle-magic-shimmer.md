---
title: "Sparkle Magic Shimmer"
id: "sparkle-magic-shimmer"
order: 36
description: "Magical shimmer sparkle"
---

# Sparkle Magic Shimmer

**Category: Magic** · Tags: casual, joy, sparkle

## At a glance

| Field | Value |
|-------|-------|
| **Title** | Sparkle Magic Shimmer |
| **Common uses** | Magic effects, power-ups, sparkle rewards |
| **Default frequency** | 1800 Hz (FM carrier) |
| **Default duration** | 0.425 s |
| **Tier** | 3 — Textured & filtered |
| **Category** | Magic |
| **Tags** | casual, joy, sparkle |

## Sound design

### Overview

`sparkle-magic-shimmer` provides magical shimmer sparkle. It belongs to the casual recipe family (casual, joy, sparkle) and is designed to be short, characterful and easy to layer.

### Synthesis

It is built from an FM (fmPattern) voice, shaped by an amplitude envelope (attack 0.005s, decay 0.3s, sustain 0), which opens quickly and then settles. No additional processing is required, so it renders quickly and deterministically.

### Parameters

The declared parameters (`carrierFreq`, `modulatorFreq`, `modIndex`, `attack`, `decay`) expose the pitch contour endpoints and the envelope timing. Override a contour endpoint to change the direction or span of the sweep, or adjust the decay to make the event snappier or more resonant.

### Seed behaviour & musical intent

With a fixed seed (e.g. `--seed 42`) this recipe renders byte-identical audio on every platform and run. A lightweight, joyful game sound intended as a placeholder that a sound designer can immediately vary through the CLI.

## ToneForge CLI

<!-- CLI_BLOCK_START — regenerate with: tsx scripts/recipe-book/generate-cli-blocks.ts sparkle-magic-shimmer -->
```bash
# Generate the recipe with a specific seed
toneforge generate --recipe sparkle-magic-shimmer --seed 42 --output sparkle-magic-shimmer.wav
```
```bash
# Show the recipe metadata
toneforge show --recipe sparkle-magic-shimmer
```
```bash
# List all recipes, filtered by casual tag
toneforge list recipes --tags casual
```
```bash
# Generate with default seed
toneforge generate --recipe sparkle-magic-shimmer --output sparkle-magic-shimmer-default.wav
```
<!-- CLI_BLOCK_END -->

## Parameters

| Parameter | Type | Range | Default |
|-----------|------|-------|---------|
| `carrierFreq` | number | 900–3240 Hz | 1800 Hz |
| `modulatorFreq` | number | 1300–4680 Hz | 2600 Hz |
| `modIndex` | number | 1–12 ratio | 3 ratio |
| `attack` | number | 0.001–0.03 s | 0.005 s |
| `decay` | number | 0.09–0.39 s | 0.3 s |

## See also

- [Recipe Book Index](./index.md)
- [ToneGraph Schema](../../tonegraph.md)
