---
title: "Ambience Magic Glow"
id: "ambience-magic-glow"
order: 84
description: "Magic glow ambience"
---

# Ambience Magic Glow

**Category: Ambience** · Tags: casual, joy, ambience

## At a glance

| Field | Value |
|-------|-------|
| **Title** | Ambience Magic Glow |
| **Common uses** | Magical areas, enchanted scenes, mysterious rooms |
| **Default frequency** | 900 Hz (FM carrier) |
| **Default duration** | 2 s |
| **Tier** | 6 — Ambience & loops |
| **Category** | Ambience |
| **Tags** | casual, joy, ambience |

## Sound design

### Overview

A magical glow — a shimmering high FM drone.

### Synthesis

An `fmPattern` voice (carrier 900 Hz, modulator 1400 Hz, index 3) produces a bell-like shimmer, highpassed at 500 Hz so it floats above the mix without muddying it.

### Parameters

`carrierFreq`/`modulatorFreq` set the shimmer pitch and ratio; `modIndex` its brightness; `attack`/`release` the fade.

### Seed behaviour & musical intent

With a fixed seed (e.g. `--seed 42`) this recipe renders byte-identical audio on every platform and run. An enchanted, luminous loop for magical places.

## ToneForge CLI

<!-- CLI_BLOCK_START — regenerate with: tsx scripts/recipe-book/generate-cli-blocks.ts ambience-magic-glow -->
```bash
# Generate the recipe with a specific seed
toneforge generate --recipe ambience-magic-glow --seed 42 --output ambience-magic-glow.wav
```
```bash
# Show the recipe metadata
toneforge show --recipe ambience-magic-glow
```
```bash
# List all recipes, filtered by casual tag
toneforge list recipes --tags casual
```
```bash
# Generate with default seed
toneforge generate --recipe ambience-magic-glow --output ambience-magic-glow-default.wav
```
<!-- CLI_BLOCK_END -->

## Parameters

| Parameter | Type | Range | Default |
|-----------|------|-------|---------|
| `carrierFreq` | number | 500–1300 Hz | 900 Hz |
| `modulatorFreq` | number | 800–2200 Hz | 1400 Hz |
| `modIndex` | number | 1–7 ratio | 3 ratio |
| `attack` | number | 0.2–0.7 s | 0.45 s |
| `release` | number | 0.25–0.7 s | 0.55 s |

## See also

- [Recipe Book Index](./index.md)
- [ToneGraph Schema](../../tonegraph.md)
