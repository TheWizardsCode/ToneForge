---
title: "Blip Triangle Soft"
id: "blip-triangle-soft"
order: 3
description: "Soft triangle-wave blip for gentle cues"
---

# Blip Triangle Soft

**Category: UI** · Tags: casual, joy, ui

## At a glance

| Field | Value |
|-------|-------|
| **Title** | Blip Triangle Soft |
| **Common uses** | Gentle notifications, cosy menus, soft toggles |
| **Default frequency** | 350 Hz |
| **Default duration** | 0.086 s |
| **Tier** | 1 — Pure tones & blips |
| **Category** | UI |
| **Tags** | casual, joy, ui |

## Sound design

### Overview

A soft triangle-wave blip for gentle cues. It is the mellowest of the Tier 1 blips, with a rounded, flute-like quality suited to cosy interfaces.

### Synthesis

A triangle oscillator at 350 Hz with a 6 ms attack and a 60 ms decay. The triangle’s gentler harmonic series produces a warmth that the square and sawtooth lack, so it can fire often without fatigue.

### Parameters

`frequency` tunes the softness — lower is a wooden knock, higher a light sparkle. `decay` (20–120 ms) controls how much body the blip has; the triangle tolerates longer decays gracefully.

### Seed behaviour & musical intent

With a fixed seed (e.g. `--seed 42`) this recipe renders byte-identical audio on every platform and run. A gentle, non-aggressive acknowledgement for calm or cosy game moments.

## ToneForge CLI

<!-- CLI_BLOCK_START — regenerate with: tsx scripts/recipe-book/generate-cli-blocks.ts blip-triangle-soft -->
```bash
# Generate the recipe with a specific seed
toneforge generate --recipe blip-triangle-soft --seed 42 --output blip-triangle-soft.wav
```
```bash
# Show the recipe metadata
toneforge show --recipe blip-triangle-soft
```
```bash
# List all recipes, filtered by casual tag
toneforge list recipes --tags casual
```
```bash
# Generate with default seed
toneforge generate --recipe blip-triangle-soft --output blip-triangle-soft-default.wav
```
<!-- CLI_BLOCK_END -->

## Parameters

| Parameter | Type | Range | Default |
|-----------|------|-------|---------|
| `frequency` | number | 200–560 Hz | 350 Hz |
| `attack` | number | 0.001–0.02 s | 0.006 s |
| `decay` | number | 0.02–0.12 s | 0.06 s |

## See also

- [Recipe Book Index](./index.md)
- [ToneGraph Schema](../../tonegraph.md)
