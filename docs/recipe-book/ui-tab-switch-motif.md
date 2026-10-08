---
title: "Ui Tab Switch Motif"
id: "ui-tab-switch-motif"
order: 53
description: "Tab-switch motif"
---

# Ui Tab Switch Motif

**Category: UI** · Tags: casual, fun, ui

## At a glance

| Field | Value |
|-------|-------|
| **Title** | Ui Tab Switch Motif |
| **Common uses** | Tab switching, panel changes, navigation feedback |
| **Default frequency** | 294 Hz |
| **Default duration** | 0.41 s |
| **Tier** | 4 — Melodic motifs |
| **Category** | UI |
| **Tags** | casual, fun, ui |

## Sound design

### Overview

`ui-tab-switch-motif` provides tab-switch motif. It belongs to the casual recipe family (casual, fun, ui) and is designed to be short, characterful and easy to layer.

### Synthesis

It is built from a single triangle tone, shaped by a compact amplitude envelope. The pitch steps through a 2-note figure (294 Hz → 349 Hz) via scheduled set events on the frequency AudioParam, while a gain gate shapes each note into a short articulated motif.

### Parameters

The declared parameters (`note1`, `note2`) expose the pitch contour endpoints and the envelope timing. Override a contour endpoint to change the direction or span of the sweep, or adjust the decay to make the event snappier or more resonant.

### Seed behaviour & musical intent

With a fixed seed (e.g. `--seed 42`) this recipe renders byte-identical audio on every platform and run. A lightweight, joyful game sound intended as a placeholder that a sound designer can immediately vary through the CLI.

## ToneForge CLI

<!-- CLI_BLOCK_START — regenerate with: tsx scripts/recipe-book/generate-cli-blocks.ts ui-tab-switch-motif -->
```bash
# Generate the recipe with a specific seed
toneforge generate --recipe ui-tab-switch-motif --seed 42 --output ui-tab-switch-motif.wav
```
```bash
# Show the recipe metadata
toneforge show --recipe ui-tab-switch-motif
```
```bash
# List all recipes, filtered by casual tag
toneforge list recipes --tags casual
```
```bash
# Generate with default seed
toneforge generate --recipe ui-tab-switch-motif --output ui-tab-switch-motif-default.wav
```
<!-- CLI_BLOCK_END -->

## Parameters

| Parameter | Type | Range | Default |
|-----------|------|-------|---------|
| `note1` | number | 205–411 Hz | 294 Hz |
| `note2` | number | 244–488 Hz | 349 Hz |

## See also

- [Recipe Book Index](./index.md)
- [ToneGraph Schema](../../tonegraph.md)
