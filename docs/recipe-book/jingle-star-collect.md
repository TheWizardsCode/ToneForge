---
title: "Jingle Star Collect"
id: "jingle-star-collect"
order: 52
description: "Star-collect jingle"
---

# Jingle Star Collect

**Category: Collect** · Tags: casual, joy, jingle

## At a glance

| Field | Value |
|-------|-------|
| **Title** | Jingle Star Collect |
| **Common uses** | Star collection, collect-a-thon rewards, completions |
| **Default frequency** | 440 Hz |
| **Default duration** | 0.59 s |
| **Tier** | 4 — Melodic motifs |
| **Category** | Collect |
| **Tags** | casual, joy, jingle |

## Sound design

### Overview

`jingle-star-collect` provides star-collect jingle. It belongs to the casual recipe family (casual, joy, jingle) and is designed to be short, characterful and easy to layer.

### Synthesis

It is built from a single triangle tone, shaped by a compact amplitude envelope. The pitch steps through a 3-note figure (440 Hz → 523 Hz → 659 Hz) via scheduled set events on the frequency AudioParam, while a gain gate shapes each note into a short articulated motif.

### Parameters

The declared parameters (`note1`, `note2`, `note3`) expose the pitch contour endpoints and the envelope timing. Override a contour endpoint to change the direction or span of the sweep, or adjust the decay to make the event snappier or more resonant.

### Seed behaviour & musical intent

With a fixed seed (e.g. `--seed 42`) this recipe renders byte-identical audio on every platform and run. A lightweight, joyful game sound intended as a placeholder that a sound designer can immediately vary through the CLI.

## ToneForge CLI

<!-- CLI_BLOCK_START — regenerate with: tsx scripts/recipe-book/generate-cli-blocks.ts jingle-star-collect -->
```bash
# Generate the recipe with a specific seed
toneforge generate --recipe jingle-star-collect --seed 42 --output jingle-star-collect.wav
```
```bash
# Show the recipe metadata
toneforge show --recipe jingle-star-collect
```
```bash
# List all recipes, filtered by casual tag
toneforge list recipes --tags casual
```
```bash
# Generate with default seed
toneforge generate --recipe jingle-star-collect --output jingle-star-collect-default.wav
```
<!-- CLI_BLOCK_END -->

## Parameters

| Parameter | Type | Range | Default |
|-----------|------|-------|---------|
| `note1` | number | 308–616 Hz | 440 Hz |
| `note2` | number | 366–732 Hz | 523 Hz |
| `note3` | number | 461–922 Hz | 659 Hz |

## See also

- [Recipe Book Index](./index.md)
- [ToneGraph Schema](../../tonegraph.md)
