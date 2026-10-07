---
title: "Ui Tap Soft"
id: "ui-tap-soft"
order: 8
description: "Soft tap for light UI interactions"
---

# Ui Tap Soft

**Category: UI** · Tags: casual, joy, ui

## Sound design

### Overview

A soft tap for light UI interactions — hovering a control, toggling a mild setting, or confirming a low-stakes action.

### Synthesis

A triangle oscillator at 300 Hz with a 4 ms attack and a 50 ms decay. The low harmonic content keeps the tap quiet and unobtrusive, so it blends into the interface.

### Parameters

`frequency` (180–460 Hz) sets the warmth; lower is a soft knock, higher a light tap. `decay` (20–100 ms) controls the body of the tap.

### Seed behaviour & musical intent

With a fixed seed (e.g. `--seed 42`) this recipe renders byte-identical audio on every platform and run. Minimal, reassuring feedback for interactions that should not draw attention.

## ToneForge CLI

<!-- CLI_BLOCK_START — regenerate with: tsx scripts/recipe-book/generate-cli-blocks.ts ui-tap-soft -->
```bash
# Generate the recipe with a specific seed
toneforge generate --recipe ui-tap-soft --seed 42 --output ui-tap-soft.wav
```
```bash
# Show the recipe metadata
toneforge show --recipe ui-tap-soft
```
```bash
# List all recipes, filtered by casual tag
toneforge list recipes --tags casual
```
```bash
# Generate with default seed
toneforge generate --recipe ui-tap-soft --output ui-tap-soft-default.wav
```
<!-- CLI_BLOCK_END -->

## Parameters

| Parameter | Type | Range | Default |
|-----------|------|-------|---------|
| `frequency` | number | 180–460 Hz | 300 Hz |
| `attack` | number | 0.001–0.02 s | 0.004 s |
| `decay` | number | 0.02–0.1 s | 0.05 s |

## See also

- [Recipe Book Index](./index.md)
- [ToneGraph Schema](../../tonegraph.md)
