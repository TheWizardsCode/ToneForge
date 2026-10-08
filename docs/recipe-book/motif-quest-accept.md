---
title: "Motif Quest Accept"
id: "motif-quest-accept"
order: 57
description: "Quest-accept motif"
---

# Motif Quest Accept

**Category: UI** · Tags: casual, joy, motif

## At a glance

| Field | Value |
|-------|-------|
| **Title** | Motif Quest Accept |
| **Common uses** | Quest acceptance, mission start, objective pickup |
| **Default frequency** | 349 Hz |
| **Default duration** | 0.59 s |
| **Tier** | 4 — Melodic motifs |
| **Category** | UI |
| **Tags** | casual, joy, motif |

## Sound design

### Overview

`motif-quest-accept` provides quest-accept motif. It belongs to the casual recipe family (casual, joy, motif) and is designed to be short, characterful and easy to layer.

### Synthesis

It is built from a single triangle tone, shaped by a compact amplitude envelope. The pitch steps through a 3-note figure (349 Hz → 440 Hz → 523 Hz) via scheduled set events on the frequency AudioParam, while a gain gate shapes each note into a short articulated motif.

### Parameters

The declared parameters (`note1`, `note2`, `note3`) expose the pitch contour endpoints and the envelope timing. Override a contour endpoint to change the direction or span of the sweep, or adjust the decay to make the event snappier or more resonant.

### Seed behaviour & musical intent

With a fixed seed (e.g. `--seed 42`) this recipe renders byte-identical audio on every platform and run. A lightweight, joyful game sound intended as a placeholder that a sound designer can immediately vary through the CLI.

## ToneForge CLI

<!-- CLI_BLOCK_START — regenerate with: tsx scripts/recipe-book/generate-cli-blocks.ts motif-quest-accept -->
```bash
# Generate the recipe with a specific seed
toneforge generate --recipe motif-quest-accept --seed 42 --output motif-quest-accept.wav
```
```bash
# Show the recipe metadata
toneforge show --recipe motif-quest-accept
```
```bash
# List all recipes, filtered by casual tag
toneforge list recipes --tags casual
```
```bash
# Generate with default seed
toneforge generate --recipe motif-quest-accept --output motif-quest-accept-default.wav
```
<!-- CLI_BLOCK_END -->

## Parameters

| Parameter | Type | Range | Default |
|-----------|------|-------|---------|
| `note1` | number | 244–488 Hz | 349 Hz |
| `note2` | number | 308–616 Hz | 440 Hz |
| `note3` | number | 366–732 Hz | 523 Hz |

## See also

- [Recipe Book Index](./index.md)
- [ToneGraph Schema](../../tonegraph.md)
