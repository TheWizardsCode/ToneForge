---
title: "Motif Win Two Note"
id: "motif-win-two-note"
order: 45
description: "Two-note victory motif"
---

# Motif Win Two Note

**Category: UI** · Tags: casual, joy, motif

## At a glance

| Field | Value |
|-------|-------|
| **Title** | Motif Win Two Note |
| **Common uses** | Victory jingles, win screens, reward motifs |
| **Default frequency** | 523 Hz |
| **Default duration** | 0.41 s |
| **Tier** | 4 — Melodic motifs |
| **Category** | UI |
| **Tags** | casual, joy, motif |

## Sound design

### Overview

`motif-win-two-note` provides two-note victory motif. It belongs to the casual recipe family (casual, joy, motif) and is designed to be short, characterful and easy to layer.

### Synthesis

It is built from a single triangle tone, shaped by a compact amplitude envelope. The pitch steps through a 2-note figure (523 Hz → 659 Hz) via scheduled set events on the frequency AudioParam, while a gain gate shapes each note into a short articulated motif.

### Parameters

The declared parameters (`note1`, `note2`) expose the pitch contour endpoints and the envelope timing. Override a contour endpoint to change the direction or span of the sweep, or adjust the decay to make the event snappier or more resonant.

### Seed behaviour & musical intent

With a fixed seed (e.g. `--seed 42`) this recipe renders byte-identical audio on every platform and run. A lightweight, joyful game sound intended as a placeholder that a sound designer can immediately vary through the CLI.

## ToneForge CLI

<!-- CLI_BLOCK_START — regenerate with: tsx scripts/recipe-book/generate-cli-blocks.ts motif-win-two-note -->
```bash
# Generate the recipe with a specific seed
toneforge generate --recipe motif-win-two-note --seed 42 --output motif-win-two-note.wav
```
```bash
# Show the recipe metadata
toneforge show --recipe motif-win-two-note
```
```bash
# List all recipes, filtered by casual tag
toneforge list recipes --tags casual
```
```bash
# Generate with default seed
toneforge generate --recipe motif-win-two-note --output motif-win-two-note-default.wav
```
<!-- CLI_BLOCK_END -->

## Parameters

| Parameter | Type | Range | Default |
|-----------|------|-------|---------|
| `note1` | number | 366–732 Hz | 523 Hz |
| `note2` | number | 461–922 Hz | 659 Hz |

## See also

- [Recipe Book Index](./index.md)
- [ToneGraph Schema](../../tonegraph.md)
