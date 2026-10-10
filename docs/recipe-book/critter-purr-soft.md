---
title: "Critter Purr Soft"
id: "critter-purr-soft"
order: 70
description: "Soft critter purr"
---

# Critter Purr Soft

**Category: Critter** · Tags: casual, joy, critter

## At a glance

| Field | Value |
|-------|-------|
| **Title** | Critter Purr Soft |
| **Common uses** | Pet creatures, friendly critters, cosy companions |
| **Default frequency** | 90 Hz |
| **Default duration** | 0.75 s |
| **Tier** | 5 — Character & critter voices |
| **Category** | Critter |
| **Tags** | casual, joy, critter |

## Sound design

### Overview

A warm, continuous purr — a low rumble with a gentle amplitude flutter.

### Synthesis

A 90 Hz sine and pink noise through a 450 Hz lowpass are summed, and the mix gain is modulated by a 24 Hz LFO, so the purr pulses rather than hisses. A slow 80 ms attack and a long 450 ms decay make it feel sustained.

### Parameters

`toneFreq` sets the rumble pitch; `noiseLevel` balances breath; `filterFreq` darkens the texture; `purrRate`/`purrDepth` set the flutter; `attack`/`decay` shape the swell.

### Seed behaviour & musical intent

With a fixed seed (e.g. `--seed 42`) this recipe renders byte-identical audio on every platform and run. A comforting, contented purr for friendly critters and companions.

## ToneForge CLI

<!-- CLI_BLOCK_START — regenerate with: tsx scripts/recipe-book/generate-cli-blocks.ts critter-purr-soft -->
```bash
# Generate the recipe with a specific seed
toneforge generate --recipe critter-purr-soft --seed 42 --output critter-purr-soft.wav
```
```bash
# Show the recipe metadata
toneforge show --recipe critter-purr-soft
```
```bash
# List all recipes, filtered by casual tag
toneforge list recipes --tags casual
```
```bash
# Generate with default seed
toneforge generate --recipe critter-purr-soft --output critter-purr-soft-default.wav
```
<!-- CLI_BLOCK_END -->

## Parameters

| Parameter | Type | Range | Default |
|-----------|------|-------|---------|
| `toneFreq` | number | 60–130 Hz | 90 Hz |
| `noiseLevel` | number | 0.15–0.6 amplitude | 0.3 amplitude |
| `filterFreq` | number | 280–720 Hz | 450 Hz |
| `purrRate` | number | 14–40 Hz | 24 Hz |
| `purrDepth` | number | 0.1–0.45 amplitude | 0.3 amplitude |
| `attack` | number | 0.03–0.15 s | 0.08 s |
| `decay` | number | 0.3–0.6 s | 0.45 s |

## See also

- [Recipe Book Index](./index.md)
- [ToneGraph Schema](../../tonegraph.md)
