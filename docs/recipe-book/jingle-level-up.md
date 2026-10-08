---
title: "Jingle Level Up"
id: "jingle-level-up"
order: 49
description: "Level-up jingle"
---

# Jingle Level Up

**Category: UI** · Tags: casual, joy, jingle

## At a glance

| Field | Value |
|-------|-------|
| **Title** | Jingle Level Up |
| **Common uses** | Level-ups, rank increases, progression rewards |
| **Default frequency** | 392 Hz |
| **Default duration** | 0.77 s |
| **Tier** | 4 — Melodic motifs |
| **Category** | UI |
| **Tags** | casual, joy, jingle |

## Sound design

### Overview

`jingle-level-up` provides level-up jingle. It belongs to the casual recipe family (casual, joy, jingle) and is designed to be short, characterful and easy to layer.

### Synthesis

It is built from a single triangle tone, shaped by a compact amplitude envelope. The pitch steps through a 4-note figure (392 Hz → 494 Hz → 587 Hz → 784 Hz) via scheduled set events on the frequency AudioParam, while a gain gate shapes each note into a short articulated motif.

### Parameters

The declared parameters (`note1`, `note2`, `note3`, `note4`) expose the pitch contour endpoints and the envelope timing. Override a contour endpoint to change the direction or span of the sweep, or adjust the decay to make the event snappier or more resonant.

### Seed behaviour & musical intent

With a fixed seed (e.g. `--seed 42`) this recipe renders byte-identical audio on every platform and run. A lightweight, joyful game sound intended as a placeholder that a sound designer can immediately vary through the CLI.

## ToneForge CLI

<!-- CLI_BLOCK_START — regenerate with: tsx scripts/recipe-book/generate-cli-blocks.ts jingle-level-up -->
```bash
# Generate the recipe with a specific seed
toneforge generate --recipe jingle-level-up --seed 42 --output jingle-level-up.wav
```
```bash
# Show the recipe metadata
toneforge show --recipe jingle-level-up
```
```bash
# List all recipes, filtered by casual tag
toneforge list recipes --tags casual
```
```bash
# Generate with default seed
toneforge generate --recipe jingle-level-up --output jingle-level-up-default.wav
```
<!-- CLI_BLOCK_END -->

## Parameters

| Parameter | Type | Range | Default |
|-----------|------|-------|---------|
| `note1` | number | 274–548 Hz | 392 Hz |
| `note2` | number | 345–691 Hz | 494 Hz |
| `note3` | number | 410–821 Hz | 587 Hz |
| `note4` | number | 548–1097 Hz | 784 Hz |

## See also

- [Recipe Book Index](./index.md)
- [ToneGraph Schema](../../tonegraph.md)
