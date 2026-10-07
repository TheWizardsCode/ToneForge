---
title: "Blip Saw Buzz"
id: "blip-saw-buzz"
order: 4
description: "Buzzy sawtooth blip for crisp alerts"
---

# Blip Saw Buzz

**Category: UI** · Tags: casual, fun, ui

## Sound design

### Overview

A buzzy sawtooth blip for crisp alerts. The sawtooth’s dense harmonics give it more bite than the other Tier 1 blips, making it suitable for errors and urgent cues.

### Synthesis

A sawtooth oscillator at 180 Hz with a 2 ms attack and a 50 ms decay. Because the sawtooth is harmonically dense, the low fundamental still carries plenty of high-frequency energy, so the blip cuts through.

### Parameters

`frequency` spans 110–320 Hz — lower is a growl, higher a snarl. `decay` (20–100 ms) controls whether the alert reads as a short blip or a slightly longer rasor.

### Seed behaviour & musical intent

With a fixed seed (e.g. `--seed 42`) this recipe renders byte-identical audio on every platform and run. A sharper, more attention-grabbing blip for warnings and crisp feedback.

## ToneForge CLI

<!-- CLI_BLOCK_START — regenerate with: tsx scripts/recipe-book/generate-cli-blocks.ts blip-saw-buzz -->
```bash
# Generate the recipe with a specific seed
toneforge generate --recipe blip-saw-buzz --seed 42 --output blip-saw-buzz.wav
```
```bash
# Show the recipe metadata
toneforge show --recipe blip-saw-buzz
```
```bash
# List all recipes, filtered by casual tag
toneforge list recipes --tags casual
```
```bash
# Generate with default seed
toneforge generate --recipe blip-saw-buzz --output blip-saw-buzz-default.wav
```
<!-- CLI_BLOCK_END -->

## Parameters

| Parameter | Type | Range | Default |
|-----------|------|-------|---------|
| `frequency` | number | 110–320 Hz | 180 Hz |
| `attack` | number | 0.001–0.02 s | 0.002 s |
| `decay` | number | 0.02–0.1 s | 0.05 s |

## See also

- [Recipe Book Index](./index.md)
- [ToneGraph Schema](../../tonegraph.md)
