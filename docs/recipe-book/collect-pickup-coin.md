---
title: "Collect Pickup Coin"
id: "collect-pickup-coin"
order: 11
description: "Bright coin pickup sparkle"
---

# Collect Pickup Coin

**Category: Collect** · Tags: casual, joy, collect

## Sound design

### Overview

A bright coin pickup sparkle. It is one of the highest and shortest collect sounds in Tier 1, designed to fire rapidly during coin runs.

### Synthesis

A sine oscillator at 1560 Hz with a 2 ms attack and an 80 ms decay. The high pure tone reads as a sparkle, and the short decay lets successive pickups overlap without smearing.

### Parameters

`frequency` (1000–2000 Hz) sets the sparkle brightness. `decay` (40–160 ms) controls the tail; shorter decays suit rapid-fire collection.

### Seed behaviour & musical intent

With a fixed seed (e.g. `--seed 42`) this recipe renders byte-identical audio on every platform and run. A rewarding, energetic pickup that encourages the player to collect more.

## ToneForge CLI

<!-- CLI_BLOCK_START — regenerate with: tsx scripts/recipe-book/generate-cli-blocks.ts collect-pickup-coin -->
```bash
# Generate the recipe with a specific seed
toneforge generate --recipe collect-pickup-coin --seed 42 --output collect-pickup-coin.wav
```
```bash
# Show the recipe metadata
toneforge show --recipe collect-pickup-coin
```
```bash
# List all recipes, filtered by casual tag
toneforge list recipes --tags casual
```
```bash
# Generate with default seed
toneforge generate --recipe collect-pickup-coin --output collect-pickup-coin-default.wav
```
<!-- CLI_BLOCK_END -->

## Parameters

| Parameter | Type | Range | Default |
|-----------|------|-------|---------|
| `frequency` | number | 1000–2000 Hz | 1560 Hz |
| `attack` | number | 0.001–0.02 s | 0.002 s |
| `decay` | number | 0.04–0.16 s | 0.08 s |

## See also

- [Recipe Book Index](./index.md)
- [ToneGraph Schema](../../tonegraph.md)
