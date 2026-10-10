---
title: "Ui Toggle On"
id: "ui-toggle-on"
order: 13
description: "Toggle-on confirmation blip"
---

# Ui Toggle On

**Category: UI** · Tags: casual, fun, ui

## At a glance

| Field | Value |
|-------|-------|
| **Title** | Ui Toggle On |
| **Common uses** | Enabling settings, switching on, activating modes |
| **Default frequency** | 660 Hz |
| **Default duration** | 0.063 s |
| **Tier** | 1 — Pure tones & blips |
| **Category** | UI |
| **Tags** | casual, fun, ui |

## Sound design

### Overview

A toggle-on confirmation blip for switches and settings that turn on. It is pitched higher than its off counterpart to feel energising.

### Synthesis

A square oscillator at 660 Hz with a 3 ms attack and a 40 ms decay. The square harmonics give the blip a positive, clicky character that suits a switch snapping on.

### Parameters

`frequency` (400–950 Hz) sets the pitch. `decay` (20–90 ms) controls the snap; a short decay reads as a decisive toggle.

### Seed behaviour & musical intent

With a fixed seed (e.g. `--seed 42`) this recipe renders byte-identical audio on every platform and run. A clear, positive confirmation that a setting has been enabled.

## ToneForge CLI

<!-- CLI_BLOCK_START — regenerate with: tsx scripts/recipe-book/generate-cli-blocks.ts ui-toggle-on -->
```bash
# Generate the recipe with a specific seed
toneforge generate --recipe ui-toggle-on --seed 42 --output ui-toggle-on.wav
```
```bash
# Show the recipe metadata
toneforge show --recipe ui-toggle-on
```
```bash
# List all recipes, filtered by casual tag
toneforge list recipes --tags casual
```
```bash
# Generate with default seed
toneforge generate --recipe ui-toggle-on --output ui-toggle-on-default.wav
```
<!-- CLI_BLOCK_END -->

## Parameters

| Parameter | Type | Range | Default |
|-----------|------|-------|---------|
| `frequency` | number | 400–950 Hz | 660 Hz |
| `attack` | number | 0.001–0.02 s | 0.003 s |
| `decay` | number | 0.02–0.09 s | 0.04 s |

## See also

- [Recipe Book Index](./index.md)
- [ToneGraph Schema](../../tonegraph.md)
