---
title: "Sting Celebration Pop"
id: "sting-celebration-pop"
order: 97
description: "Celebration pop sting"
---

# Sting Celebration Pop

**Category: Sting** · Tags: casual, joy, sting

## At a glance

| Field | Value |
|-------|-------|
| **Title** | Sting Celebration Pop |
| **Common uses** | Celebrations, party moments, confetti |
| **Default frequency** | 523 Hz |
| **Default duration** | 0.815 s |
| **Tier** | 7 — Multi-voice stings |
| **Category** | Sting |
| **Tags** | casual, joy, sting |

## Sound design

### Overview

A celebration-pop sting — a fast rising figure with a noise pop.

### Synthesis

A triangle lead runs C5–E5–G5–C6 in 240 ms while a white-noise layer pops alongside it. A very fast 4 ms attack makes it feel explosive.

### Parameters

`noteLow`/`noteHigh` set the run; `noiseLevel` the pop; `attack`/`decay` the punch.

### Seed behaviour & musical intent

With a fixed seed (e.g. `--seed 42`) this recipe renders byte-identical audio on every platform and run. A jubilant reward for big wins and combos.

## ToneForge CLI

<!-- CLI_BLOCK_START — regenerate with: tsx scripts/recipe-book/generate-cli-blocks.ts sting-celebration-pop -->
```bash
# Generate the recipe with a specific seed
toneforge generate --recipe sting-celebration-pop --seed 42 --output sting-celebration-pop.wav
```
```bash
# Show the recipe metadata
toneforge show --recipe sting-celebration-pop
```
```bash
# List all recipes, filtered by casual tag
toneforge list recipes --tags casual
```
```bash
# Generate with default seed
toneforge generate --recipe sting-celebration-pop --output sting-celebration-pop-default.wav
```
<!-- CLI_BLOCK_END -->

## Parameters

| Parameter | Type | Range | Default |
|-----------|------|-------|---------|
| `noteLow` | number | 420–620 Hz | 523 Hz |
| `noteHigh` | number | 880–1300 Hz | 1047 Hz |
| `noiseLevel` | number | 0.1–0.5 amplitude | 0.3 amplitude |
| `attack` | number | 0.002–0.015 s | 0.004 s |
| `decay` | number | 0.25–0.6 s | 0.45 s |

## See also

- [Recipe Book Index](./index.md)
- [ToneGraph Schema](../../tonegraph.md)
