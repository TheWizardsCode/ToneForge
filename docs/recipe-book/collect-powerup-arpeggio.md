---
title: "Collect Powerup Arpeggio"
id: "collect-powerup-arpeggio"
order: 56
description: "Power-up arpeggio"
---

# Collect Powerup Arpeggio

**Category: Collect** · Tags: casual, joy, collect

## At a glance

| Field | Value |
|-------|-------|
| **Title** | Collect Powerup Arpeggio |
| **Common uses** | Power-ups, ability unlocks, buff pickups |
| **Default frequency** | 262 Hz |
| **Default duration** | 0.77 s |
| **Tier** | 4 — Melodic motifs |
| **Category** | Collect |
| **Tags** | casual, joy, collect |

## Sound design

### Overview

`collect-powerup-arpeggio` provides power-up arpeggio. It belongs to the casual recipe family (casual, joy, collect) and is designed to be short, characterful and easy to layer.

### Synthesis

It is built from a single square tone, shaped by a compact amplitude envelope. The pitch steps through a 4-note figure (262 Hz → 330 Hz → 392 Hz → 523 Hz) via scheduled set events on the frequency AudioParam, while a gain gate shapes each note into a short articulated motif.

### Parameters

The declared parameters (`note1`, `note2`, `note3`, `note4`) expose the pitch contour endpoints and the envelope timing. Override a contour endpoint to change the direction or span of the sweep, or adjust the decay to make the event snappier or more resonant.

### Seed behaviour & musical intent

With a fixed seed (e.g. `--seed 42`) this recipe renders byte-identical audio on every platform and run. A lightweight, joyful game sound intended as a placeholder that a sound designer can immediately vary through the CLI.

## ToneForge CLI

<!-- CLI_BLOCK_START — regenerate with: tsx scripts/recipe-book/generate-cli-blocks.ts collect-powerup-arpeggio -->
```bash
# Generate the recipe with a specific seed
toneforge generate --recipe collect-powerup-arpeggio --seed 42 --output collect-powerup-arpeggio.wav
```
```bash
# Show the recipe metadata
toneforge show --recipe collect-powerup-arpeggio
```
```bash
# List all recipes, filtered by casual tag
toneforge list recipes --tags casual
```
```bash
# Generate with default seed
toneforge generate --recipe collect-powerup-arpeggio --output collect-powerup-arpeggio-default.wav
```
<!-- CLI_BLOCK_END -->

## Parameters

| Parameter | Type | Range | Default |
|-----------|------|-------|---------|
| `note1` | number | 183–366 Hz | 262 Hz |
| `note2` | number | 230–461 Hz | 330 Hz |
| `note3` | number | 274–548 Hz | 392 Hz |
| `note4` | number | 366–732 Hz | 523 Hz |

## See also

- [Recipe Book Index](./index.md)
- [ToneGraph Schema](../../tonegraph.md)
