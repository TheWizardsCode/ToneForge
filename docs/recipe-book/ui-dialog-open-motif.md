---
title: "Ui Dialog Open Motif"
id: "ui-dialog-open-motif"
order: 54
description: "Dialog-open motif"
---

# Ui Dialog Open Motif

**Category: UI** · Tags: casual, joy, ui

## At a glance

| Field | Value |
|-------|-------|
| **Title** | Ui Dialog Open Motif |
| **Common uses** | Dialog boxes, popups, story text |
| **Default frequency** | 262 Hz |
| **Default duration** | 0.41 s |
| **Tier** | 4 — Melodic motifs |
| **Category** | UI |
| **Tags** | casual, joy, ui |

## Sound design

### Overview

`ui-dialog-open-motif` provides dialog-open motif. It belongs to the casual recipe family (casual, joy, ui) and is designed to be short, characterful and easy to layer.

### Synthesis

It is built from a single triangle tone, shaped by a compact amplitude envelope. The pitch steps through a 2-note figure (262 Hz → 392 Hz) via scheduled set events on the frequency AudioParam, while a gain gate shapes each note into a short articulated motif.

### Parameters

The declared parameters (`note1`, `note2`) expose the pitch contour endpoints and the envelope timing. Override a contour endpoint to change the direction or span of the sweep, or adjust the decay to make the event snappier or more resonant.

### Seed behaviour & musical intent

With a fixed seed (e.g. `--seed 42`) this recipe renders byte-identical audio on every platform and run. A lightweight, joyful game sound intended as a placeholder that a sound designer can immediately vary through the CLI.

## ToneForge CLI

<!-- CLI_BLOCK_START — regenerate with: tsx scripts/recipe-book/generate-cli-blocks.ts ui-dialog-open-motif -->
```bash
# Generate the recipe with a specific seed
toneforge generate --recipe ui-dialog-open-motif --seed 42 --output ui-dialog-open-motif.wav
```
```bash
# Show the recipe metadata
toneforge show --recipe ui-dialog-open-motif
```
```bash
# List all recipes, filtered by casual tag
toneforge list recipes --tags casual
```
```bash
# Generate with default seed
toneforge generate --recipe ui-dialog-open-motif --output ui-dialog-open-motif-default.wav
```
<!-- CLI_BLOCK_END -->

## Parameters

| Parameter | Type | Range | Default |
|-----------|------|-------|---------|
| `note1` | number | 183–366 Hz | 262 Hz |
| `note2` | number | 274–548 Hz | 392 Hz |

## See also

- [Recipe Book Index](./index.md)
- [ToneGraph Schema](../../tonegraph.md)
