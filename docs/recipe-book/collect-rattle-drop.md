---
title: "Collect Rattle Drop"
id: "collect-rattle-drop"
order: 44
description: "Rattle-drop collectible"
---

# Collect Rattle Drop

**Category: Collect** · Tags: casual, joy, collect

## At a glance

| Field | Value |
|-------|-------|
| **Title** | Collect Rattle Drop |
| **Common uses** | Collectible drops, item rattles, loot pickup |
| **Default frequency** | 900 Hz (FM carrier) |
| **Default duration** | 0.292 s |
| **Tier** | 3 — Textured & filtered |
| **Category** | Collect |
| **Tags** | casual, joy, collect |

## Sound design

### Overview

`collect-rattle-drop` provides rattle-drop collectible. It belongs to the casual recipe family (casual, joy, collect) and is designed to be short, characterful and easy to layer.

### Synthesis

It is built from an FM (fmPattern) voice, shaped by an amplitude envelope (attack 0.002s, decay 0.2s, sustain 0), which opens quickly and then settles. No additional processing is required, so it renders quickly and deterministically.

### Parameters

The declared parameters (`carrierFreq`, `modulatorFreq`, `modIndex`, `attack`, `decay`) expose the pitch contour endpoints and the envelope timing. Override a contour endpoint to change the direction or span of the sweep, or adjust the decay to make the event snappier or more resonant.

### Seed behaviour & musical intent

With a fixed seed (e.g. `--seed 42`) this recipe renders byte-identical audio on every platform and run. A lightweight, joyful game sound intended as a placeholder that a sound designer can immediately vary through the CLI.

## ToneForge CLI

<!-- CLI_BLOCK_START — regenerate with: tsx scripts/recipe-book/generate-cli-blocks.ts collect-rattle-drop -->
```bash
# Generate the recipe with a specific seed
toneforge generate --recipe collect-rattle-drop --seed 42 --output collect-rattle-drop.wav
```
```bash
# Show the recipe metadata
toneforge show --recipe collect-rattle-drop
```
```bash
# List all recipes, filtered by casual tag
toneforge list recipes --tags casual
```
```bash
# Generate with default seed
toneforge generate --recipe collect-rattle-drop --output collect-rattle-drop-default.wav
```
<!-- CLI_BLOCK_END -->

## Parameters

| Parameter | Type | Range | Default |
|-----------|------|-------|---------|
| `carrierFreq` | number | 450–1620 Hz | 900 Hz |
| `modulatorFreq` | number | 750–2700 Hz | 1500 Hz |
| `modIndex` | number | 1–12 ratio | 4 ratio |
| `attack` | number | 0.001–0.03 s | 0.002 s |
| `decay` | number | 0.06–0.26 s | 0.2 s |

## See also

- [Recipe Book Index](./index.md)
- [ToneGraph Schema](../../tonegraph.md)
