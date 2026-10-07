---
title: "Ui Toggle Off"
id: "ui-toggle-off"
order: 14
description: "Toggle-off confirmation blip"
---

# Ui Toggle Off

**Category: UI** · Tags: casual, fun, ui

## Sound design

### Overview

A toggle-off confirmation blip for switches and settings that turn off. It pairs with the toggle-on blip at a lower pitch to feel like a power-down.

### Synthesis

A square oscillator at 440 Hz with a 3 ms attack and a 40 ms decay. The lower register and square harmonics give the blip a grounded, closing character.

### Parameters

`frequency` (250–650 Hz) sets the pitch. `decay` (20–90 ms) controls the snap; matching the toggle-on decay keeps the pair coherent.

### Seed behaviour & musical intent

With a fixed seed (e.g. `--seed 42`) this recipe renders byte-identical audio on every platform and run. A clear, neutral confirmation that a setting has been disabled.

## ToneForge CLI

<!-- CLI_BLOCK_START — regenerate with: tsx scripts/recipe-book/generate-cli-blocks.ts ui-toggle-off -->
```bash
# Generate the recipe with a specific seed
toneforge generate --recipe ui-toggle-off --seed 42 --output ui-toggle-off.wav
```
```bash
# Show the recipe metadata
toneforge show --recipe ui-toggle-off
```
```bash
# List all recipes, filtered by casual tag
toneforge list recipes --tags casual
```
```bash
# Generate with default seed
toneforge generate --recipe ui-toggle-off --output ui-toggle-off-default.wav
```
<!-- CLI_BLOCK_END -->

## Parameters

| Parameter | Type | Range | Default |
|-----------|------|-------|---------|
| `frequency` | number | 250–650 Hz | 440 Hz |
| `attack` | number | 0.001–0.02 s | 0.003 s |
| `decay` | number | 0.02–0.09 s | 0.04 s |

## See also

- [Recipe Book Index](./index.md)
- [ToneGraph Schema](../../tonegraph.md)
