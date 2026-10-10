---
title: "Ui Cancel Blip"
id: "ui-cancel-blip"
order: 10
description: "Downward-feeling cancel blip"
---

# Ui Cancel Blip

**Category: UI** · Tags: casual, fun, ui

## At a glance

| Field | Value |
|-------|-------|
| **Title** | Ui Cancel Blip |
| **Common uses** | Cancel actions, back buttons, dismissal cues |
| **Default frequency** | 420 Hz |
| **Default duration** | 0.073 s |
| **Tier** | 1 — Pure tones & blips |
| **Category** | UI |
| **Tags** | casual, fun, ui |

## Sound design

### Overview

A downward-feeling cancel blip for backing out of menus and dismissing dialogs. It is tuned lower than the selection pop to feel like a step backwards.

### Synthesis

A sine oscillator at 420 Hz with a 3 ms attack and a 50 ms decay. The pure, slightly low tone is neutral rather than harsh, so cancelling does not feel like an error.

### Parameters

`frequency` (260–620 Hz) sets how low and final the cancel feels. `decay` (20–100 ms) controls the weight of the blip.

### Seed behaviour & musical intent

With a fixed seed (e.g. `--seed 42`) this recipe renders byte-identical audio on every platform and run. A gentle, clear cancellation acknowledgement that does not punish the player.

## ToneForge CLI

<!-- CLI_BLOCK_START — regenerate with: tsx scripts/recipe-book/generate-cli-blocks.ts ui-cancel-blip -->
```bash
# Generate the recipe with a specific seed
toneforge generate --recipe ui-cancel-blip --seed 42 --output ui-cancel-blip.wav
```
```bash
# Show the recipe metadata
toneforge show --recipe ui-cancel-blip
```
```bash
# List all recipes, filtered by casual tag
toneforge list recipes --tags casual
```
```bash
# Generate with default seed
toneforge generate --recipe ui-cancel-blip --output ui-cancel-blip-default.wav
```
<!-- CLI_BLOCK_END -->

## Parameters

| Parameter | Type | Range | Default |
|-----------|------|-------|---------|
| `frequency` | number | 260–620 Hz | 420 Hz |
| `attack` | number | 0.001–0.02 s | 0.003 s |
| `decay` | number | 0.02–0.1 s | 0.05 s |

## See also

- [Recipe Book Index](./index.md)
- [ToneGraph Schema](../../tonegraph.md)
