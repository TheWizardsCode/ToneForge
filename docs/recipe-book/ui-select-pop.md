---
title: "Ui Select Pop"
id: "ui-select-pop"
order: 9
description: "Pop-like selection tone"
---

# Ui Select Pop

**Category: UI** · Tags: casual, fun, ui

## Sound design

### Overview

A pop-like selection tone for committing a choice. It is slightly lower and rounder than the click, signalling a confirmed selection rather than mere navigation.

### Synthesis

A square oscillator at 520 Hz with a 2 ms attack and a 45 ms decay. The short, plump envelope reads as a pop, and the square harmonics give it enough presence to feel decisive.

### Parameters

`frequency` (300–760 Hz) sets the pitch of the selection. `decay` (20–90 ms) controls how emphatic the pop feels.

### Seed behaviour & musical intent

With a fixed seed (e.g. `--seed 42`) this recipe renders byte-identical audio on every platform and run. A confident, affirmative selection sound distinct from the lighter click.

## ToneForge CLI

<!-- CLI_BLOCK_START — regenerate with: tsx scripts/recipe-book/generate-cli-blocks.ts ui-select-pop -->
```bash
# Generate the recipe with a specific seed
toneforge generate --recipe ui-select-pop --seed 42 --output ui-select-pop.wav
```
```bash
# Show the recipe metadata
toneforge show --recipe ui-select-pop
```
```bash
# List all recipes, filtered by casual tag
toneforge list recipes --tags casual
```
```bash
# Generate with default seed
toneforge generate --recipe ui-select-pop --output ui-select-pop-default.wav
```
<!-- CLI_BLOCK_END -->

## Parameters

| Parameter | Type | Range | Default |
|-----------|------|-------|---------|
| `frequency` | number | 300–760 Hz | 520 Hz |
| `attack` | number | 0.001–0.02 s | 0.002 s |
| `decay` | number | 0.02–0.09 s | 0.045 s |

## See also

- [Recipe Book Index](./index.md)
- [ToneGraph Schema](../../tonegraph.md)
