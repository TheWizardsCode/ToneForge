---
title: "Collect Gem Tick"
id: "collect-gem-tick"
order: 12
description: "Short gem collection tick"
---

# Collect Gem Tick

**Category: Collect** · Tags: casual, joy, collect

## At a glance

| Field | Value |
|-------|-------|
| **Title** | Collect Gem Tick |
| **Common uses** | Gem collection, collectible pickup, score ticks |
| **Default frequency** | 1980 Hz |
| **Default duration** | 0.082 s |
| **Tier** | 1 — Pure tones & blips |
| **Category** | Collect |
| **Tags** | casual, joy, collect |

## Sound design

### Overview

A short gem collection tick — the higher, rarer companion to the coin sparkle. Its very high register makes it stand out from coin pickups.

### Synthesis

A triangle oscillator at 1980 Hz with a 2 ms attack and a 60 ms decay. The triangle wave softens the extreme high frequency so the tick sparkles rather than pierces.

### Parameters

`frequency` (1200–2400 Hz) sets the gem’s brightness. `decay` (30–120 ms) controls the tick length; short decays keep it crisp.

### Seed behaviour & musical intent

With a fixed seed (e.g. `--seed 42`) this recipe renders byte-identical audio on every platform and run. A precious, high-register tick that makes rare collectibles feel special.

## ToneForge CLI

<!-- CLI_BLOCK_START — regenerate with: tsx scripts/recipe-book/generate-cli-blocks.ts collect-gem-tick -->
```bash
# Generate the recipe with a specific seed
toneforge generate --recipe collect-gem-tick --seed 42 --output collect-gem-tick.wav
```
```bash
# Show the recipe metadata
toneforge show --recipe collect-gem-tick
```
```bash
# List all recipes, filtered by casual tag
toneforge list recipes --tags casual
```
```bash
# Generate with default seed
toneforge generate --recipe collect-gem-tick --output collect-gem-tick-default.wav
```
<!-- CLI_BLOCK_END -->

## Parameters

| Parameter | Type | Range | Default |
|-----------|------|-------|---------|
| `frequency` | number | 1200–2400 Hz | 1980 Hz |
| `attack` | number | 0.001–0.02 s | 0.002 s |
| `decay` | number | 0.03–0.12 s | 0.06 s |

## See also

- [Recipe Book Index](./index.md)
- [ToneGraph Schema](../../tonegraph.md)
