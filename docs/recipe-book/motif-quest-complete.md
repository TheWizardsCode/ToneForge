---
title: "Motif Quest Complete"
id: "motif-quest-complete"
order: 58
description: "Quest-complete fanfare"
---

# Motif Quest Complete

**Category: UI** · Tags: casual, joy, motif

## Sound design

### Overview

`motif-quest-complete` provides quest-complete fanfare. It belongs to the casual recipe family (casual, joy, motif) and is designed to be short, characterful and easy to layer.

### Synthesis

It is built from a single square tone, shaped by a compact amplitude envelope. The pitch steps through a 4-note figure (523 Hz → 392 Hz → 659 Hz → 784 Hz) via scheduled set events on the frequency AudioParam, while a gain gate shapes each note into a short articulated motif.

### Parameters

The declared parameters (`note1`, `note2`, `note3`, `note4`) expose the pitch contour endpoints and the envelope timing. Override a contour endpoint to change the direction or span of the sweep, or adjust the decay to make the event snappier or more resonant.

### Seed behaviour & musical intent

With a fixed seed (e.g. `--seed 42`) this recipe renders byte-identical audio on every platform and run. A lightweight, joyful game sound intended as a placeholder that a sound designer can immediately vary through the CLI.

## ToneForge CLI

<!-- CLI_BLOCK_START — regenerate with: tsx scripts/recipe-book/generate-cli-blocks.ts motif-quest-complete -->
```bash
# Generate the recipe with a specific seed
toneforge generate --recipe motif-quest-complete --seed 42 --output motif-quest-complete.wav
```
```bash
# Show the recipe metadata
toneforge show --recipe motif-quest-complete
```
```bash
# List all recipes, filtered by casual tag
toneforge list recipes --tags casual
```
```bash
# Generate with default seed
toneforge generate --recipe motif-quest-complete --output motif-quest-complete-default.wav
```
<!-- CLI_BLOCK_END -->

## Parameters

| Parameter | Type | Range | Default |
|-----------|------|-------|---------|
| `note1` | number | 366–732 Hz | 523 Hz |
| `note2` | number | 274–548 Hz | 392 Hz |
| `note3` | number | 461–922 Hz | 659 Hz |
| `note4` | number | 548–1097 Hz | 784 Hz |

## See also

- [Recipe Book Index](./index.md)
- [ToneGraph Schema](../../tonegraph.md)
