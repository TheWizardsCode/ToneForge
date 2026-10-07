---
title: "Motif Lose Two Note"
id: "motif-lose-two-note"
order: 46
description: "Two-note losing motif"
---

# Motif Lose Two Note

**Category: UI** · Tags: casual, fun, motif

## Sound design

### Overview

`motif-lose-two-note` provides two-note losing motif. It belongs to the casual recipe family (casual, fun, motif) and is designed to be short, characterful and easy to layer.

### Synthesis

It is built from a single triangle tone, shaped by a compact amplitude envelope. The pitch steps through a 2-note figure (440 Hz → 349 Hz) via scheduled set events on the frequency AudioParam, while a gain gate shapes each note into a short articulated motif.

### Parameters

The declared parameters (`note1`, `note2`) expose the pitch contour endpoints and the envelope timing. Override a contour endpoint to change the direction or span of the sweep, or adjust the decay to make the event snappier or more resonant.

### Seed behaviour & musical intent

With a fixed seed (e.g. `--seed 42`) this recipe renders byte-identical audio on every platform and run. A lightweight, joyful game sound intended as a placeholder that a sound designer can immediately vary through the CLI.

## ToneForge CLI

<!-- CLI_BLOCK_START — regenerate with: tsx scripts/recipe-book/generate-cli-blocks.ts motif-lose-two-note -->
```bash
# Generate the recipe with a specific seed
toneforge generate --recipe motif-lose-two-note --seed 42 --output motif-lose-two-note.wav
```
```bash
# Show the recipe metadata
toneforge show --recipe motif-lose-two-note
```
```bash
# List all recipes, filtered by casual tag
toneforge list recipes --tags casual
```
```bash
# Generate with default seed
toneforge generate --recipe motif-lose-two-note --output motif-lose-two-note-default.wav
```
<!-- CLI_BLOCK_END -->

## Parameters

| Parameter | Type | Range | Default |
|-----------|------|-------|---------|
| `note1` | number | 308–616 Hz | 440 Hz |
| `note2` | number | 244–488 Hz | 349 Hz |

## See also

- [Recipe Book Index](./index.md)
- [ToneGraph Schema](../../tonegraph.md)
