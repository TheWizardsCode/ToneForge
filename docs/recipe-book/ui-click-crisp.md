---
title: "Ui Click Crisp"
id: "ui-click-crisp"
order: 7
description: "Crisp click for button presses"
---

# Ui Click Crisp

**Category: UI** · Tags: casual, fun, ui

## At a glance

| Field | Value |
|-------|-------|
| **Title** | Ui Click Crisp |
| **Common uses** | Button presses, menu clicks, pointer interactions |
| **Default frequency** | 700 Hz |
| **Default duration** | 0.041 s |
| **Tier** | 1 — Pure tones & blips |
| **Category** | UI |
| **Tags** | casual, fun, ui |

## Sound design

### Overview

A crisp click for button presses and menu actuation. It is deliberately very short and neutral so it can fire on every interaction.

### Synthesis

A square oscillator at 700 Hz with a 1 ms attack and a 20 ms decay. The near-instant envelope makes the click percussive, while the square harmonics give it a mechanical snap.

### Parameters

`frequency` (400–1000 Hz) tunes the click from a dull thock to a sharp tick. `decay` (10–50 ms) controls the snap; the minimum feels like a mouse click.

### Seed behaviour & musical intent

With a fixed seed (e.g. `--seed 42`) this recipe renders byte-identical audio on every platform and run. Immediate, non-fatiguing acknowledgement of a UI interaction.

## ToneForge CLI

<!-- CLI_BLOCK_START — regenerate with: tsx scripts/recipe-book/generate-cli-blocks.ts ui-click-crisp -->
```bash
# Generate the recipe with a specific seed
toneforge generate --recipe ui-click-crisp --seed 42 --output ui-click-crisp.wav
```
```bash
# Show the recipe metadata
toneforge show --recipe ui-click-crisp
```
```bash
# List all recipes, filtered by casual tag
toneforge list recipes --tags casual
```
```bash
# Generate with default seed
toneforge generate --recipe ui-click-crisp --output ui-click-crisp-default.wav
```
<!-- CLI_BLOCK_END -->

## Parameters

| Parameter | Type | Range | Default |
|-----------|------|-------|---------|
| `frequency` | number | 400–1000 Hz | 700 Hz |
| `attack` | number | 0.001–0.02 s | 0.001 s |
| `decay` | number | 0.01–0.05 s | 0.02 s |

## See also

- [Recipe Book Index](./index.md)
- [ToneGraph Schema](../../tonegraph.md)
