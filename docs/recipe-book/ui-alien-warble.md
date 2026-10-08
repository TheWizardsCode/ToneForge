---
title: "Ui Alien Warble"
id: "ui-alien-warble"
order: 40
description: "Alien warbling tone"
---

# Ui Alien Warble

**Category: UI** · Tags: casual, fun, ui

## At a glance

| Field | Value |
|-------|-------|
| **Title** | Ui Alien Warble |
| **Common uses** | Alien voices, sci-fi signals, creature tech |
| **Default frequency** | 500 Hz (FM carrier) |
| **Default duration** | 0.43 s |
| **Tier** | 3 — Textured & filtered |
| **Category** | UI |
| **Tags** | casual, fun, ui |

## Sound design

### Overview

`ui-alien-warble` provides alien warbling tone. It belongs to the casual recipe family (casual, fun, ui) and is designed to be short, characterful and easy to layer.

### Synthesis

It is built from an FM (fmPattern) voice, shaped by an amplitude envelope (attack 0.01s, decay 0.3s, sustain 0), which opens quickly and then settles. No additional processing is required, so it renders quickly and deterministically.

### Parameters

The declared parameters (`carrierFreq`, `modulatorFreq`, `modIndex`, `attack`, `decay`) expose the pitch contour endpoints and the envelope timing. Override a contour endpoint to change the direction or span of the sweep, or adjust the decay to make the event snappier or more resonant.

### Seed behaviour & musical intent

With a fixed seed (e.g. `--seed 42`) this recipe renders byte-identical audio on every platform and run. A lightweight, joyful game sound intended as a placeholder that a sound designer can immediately vary through the CLI.

## ToneForge CLI

<!-- CLI_BLOCK_START — regenerate with: tsx scripts/recipe-book/generate-cli-blocks.ts ui-alien-warble -->
```bash
# Generate the recipe with a specific seed
toneforge generate --recipe ui-alien-warble --seed 42 --output ui-alien-warble.wav
```
```bash
# Show the recipe metadata
toneforge show --recipe ui-alien-warble
```
```bash
# List all recipes, filtered by casual tag
toneforge list recipes --tags casual
```
```bash
# Generate with default seed
toneforge generate --recipe ui-alien-warble --output ui-alien-warble-default.wav
```
<!-- CLI_BLOCK_END -->

## Parameters

| Parameter | Type | Range | Default |
|-----------|------|-------|---------|
| `carrierFreq` | number | 250–900 Hz | 500 Hz |
| `modulatorFreq` | number | 300–1080 Hz | 600 Hz |
| `modIndex` | number | 1–12 ratio | 6 ratio |
| `attack` | number | 0.001–0.03 s | 0.01 s |
| `decay` | number | 0.09–0.39 s | 0.3 s |

## See also

- [Recipe Book Index](./index.md)
- [ToneGraph Schema](../../tonegraph.md)
