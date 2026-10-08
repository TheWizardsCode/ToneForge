---
title: "Creature Dragon Huff"
id: "creature-dragon-huff"
order: 72
description: "Dragon huff"
---

# Creature Dragon Huff

**Category: Creature** · Tags: casual, fun, creature

## At a glance

| Field | Value |
|-------|-------|
| **Title** | Creature Dragon Huff |
| **Common uses** | Dragon enemies, boss creatures, large beast breathing |
| **Default frequency** | 80 Hz |
| **Default duration** | 0.64 s |
| **Tier** | 5 — Character & critter voices |
| **Category** | Creature |
| **Tags** | casual, fun, creature |

## Sound design

### Overview

A low, rasping dragon huff — a short breathy growl from a large creature.

### Synthesis

An 80 Hz sawtooth and brown noise through a 400 Hz lowpass (Q 2) are summed, and the filter sweeps down to 150 Hz, so the huff darkens and settles. The low register conveys size and weight.

### Parameters

`toneFreq` sets the growl pitch; `noiseLevel` balances the huff; `filterStart`/`filterEnd` set the darkening sweep; `attack`/`decay` trim the breath.

### Seed behaviour & musical intent

With a fixed seed (e.g. `--seed 42`) this recipe renders byte-identical audio on every platform and run. A weighty, imposing creature breath for dragons and beasts.

## ToneForge CLI

<!-- CLI_BLOCK_START — regenerate with: tsx scripts/recipe-book/generate-cli-blocks.ts creature-dragon-huff -->
```bash
# Generate the recipe with a specific seed
toneforge generate --recipe creature-dragon-huff --seed 42 --output creature-dragon-huff.wav
```
```bash
# Show the recipe metadata
toneforge show --recipe creature-dragon-huff
```
```bash
# List all recipes, filtered by casual tag
toneforge list recipes --tags casual
```
```bash
# Generate with default seed
toneforge generate --recipe creature-dragon-huff --output creature-dragon-huff-default.wav
```
<!-- CLI_BLOCK_END -->

## Parameters

| Parameter | Type | Range | Default |
|-----------|------|-------|---------|
| `toneFreq` | number | 55–120 Hz | 80 Hz |
| `noiseLevel` | number | 0.25–0.85 amplitude | 0.6 amplitude |
| `filterStart` | number | 250–650 Hz | 400 Hz |
| `filterEnd` | number | 90–240 Hz | 150 Hz |
| `attack` | number | 0.006–0.04 s | 0.02 s |
| `decay` | number | 0.3–0.6 s | 0.45 s |

## See also

- [Recipe Book Index](./index.md)
- [ToneGraph Schema](../../tonegraph.md)
