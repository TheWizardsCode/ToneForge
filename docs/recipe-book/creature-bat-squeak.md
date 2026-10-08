---
title: "Creature Bat Squeak"
id: "creature-bat-squeak"
order: 65
description: "Bat squeak"
---

# Creature Bat Squeak

**Category: Creature** · Tags: casual, fun, creature

## At a glance

| Field | Value |
|-------|-------|
| **Title** | Creature Bat Squeak |
| **Common uses** | Bat creatures, small flyers, cave critters |
| **Default frequency** | 1800 Hz |
| **Default duration** | 0.315 s |
| **Tier** | 5 — Character & critter voices |
| **Category** | Creature |
| **Tags** | casual, fun, creature |

## Sound design

### Overview

A high, warbling bat squeak produced by rapid pitch modulation.

### Synthesis

A sine at 1800 Hz is modulated by a 35 Hz LFO with ±500 Hz depth, giving a fast vibrato that reads as a squeak rather than a steady tone. A very short 3 ms attack and 180 ms decay keep it in the high, chattery register.

### Parameters

`lfoRate` sets the chatter speed; `lfoDepth` sets the warble width; `lfoOffset` shifts the whole squeak up or down; `attack`/`decay` trim the burst.

### Seed behaviour & musical intent

With a fixed seed (e.g. `--seed 42`) this recipe renders byte-identical audio on every platform and run. A nimble critter cry for small flying creatures.

## ToneForge CLI

<!-- CLI_BLOCK_START — regenerate with: tsx scripts/recipe-book/generate-cli-blocks.ts creature-bat-squeak -->
```bash
# Generate the recipe with a specific seed
toneforge generate --recipe creature-bat-squeak --seed 42 --output creature-bat-squeak.wav
```
```bash
# Show the recipe metadata
toneforge show --recipe creature-bat-squeak
```
```bash
# List all recipes, filtered by casual tag
toneforge list recipes --tags casual
```
```bash
# Generate with default seed
toneforge generate --recipe creature-bat-squeak --output creature-bat-squeak-default.wav
```
<!-- CLI_BLOCK_END -->

## Parameters

| Parameter | Type | Range | Default |
|-----------|------|-------|---------|
| `lfoRate` | number | 18–55 Hz | 35 Hz |
| `lfoDepth` | number | 200–800 Hz | 500 Hz |
| `lfoOffset` | number | 1300–2300 Hz | 1800 Hz |
| `attack` | number | 0.002–0.015 s | 0.003 s |
| `decay` | number | 0.1–0.3 s | 0.18 s |

## See also

- [Recipe Book Index](./index.md)
- [ToneGraph Schema](../../tonegraph.md)
