---
title: "Weapon Zap Electric"
id: "weapon-zap-electric"
order: 41
description: "Electric weapon zap"
---

# Weapon Zap Electric

**Category: Weapon** · Tags: casual, fun, weapon

## At a glance

| Field | Value |
|-------|-------|
| **Title** | Weapon Zap Electric |
| **Common uses** | Electric weapons, zaps, energy attacks |
| **Default frequency** | 1200 Hz (FM carrier) |
| **Default duration** | 0.226 s |
| **Tier** | 3 — Textured & filtered |
| **Category** | Weapon |
| **Tags** | casual, fun, weapon |

## Sound design

### Overview

`weapon-zap-electric` provides electric weapon zap. It belongs to the casual recipe family (casual, fun, weapon) and is designed to be short, characterful and easy to layer.

### Synthesis

It is built from an FM (fmPattern) voice, shaped by an amplitude envelope (attack 0.001s, decay 0.15s, sustain 0), which opens quickly and then settles. No additional processing is required, so it renders quickly and deterministically.

### Parameters

The declared parameters (`carrierFreq`, `modulatorFreq`, `modIndex`, `attack`, `decay`) expose the pitch contour endpoints and the envelope timing. Override a contour endpoint to change the direction or span of the sweep, or adjust the decay to make the event snappier or more resonant.

### Seed behaviour & musical intent

With a fixed seed (e.g. `--seed 42`) this recipe renders byte-identical audio on every platform and run. A lightweight, joyful game sound intended as a placeholder that a sound designer can immediately vary through the CLI.

## ToneForge CLI

<!-- CLI_BLOCK_START — regenerate with: tsx scripts/recipe-book/generate-cli-blocks.ts weapon-zap-electric -->
```bash
# Generate the recipe with a specific seed
toneforge generate --recipe weapon-zap-electric --seed 42 --output weapon-zap-electric.wav
```
```bash
# Show the recipe metadata
toneforge show --recipe weapon-zap-electric
```
```bash
# List all recipes, filtered by casual tag
toneforge list recipes --tags casual
```
```bash
# Generate with default seed
toneforge generate --recipe weapon-zap-electric --output weapon-zap-electric-default.wav
```
<!-- CLI_BLOCK_END -->

## Parameters

| Parameter | Type | Range | Default |
|-----------|------|-------|---------|
| `carrierFreq` | number | 600–2160 Hz | 1200 Hz |
| `modulatorFreq` | number | 150–540 Hz | 300 Hz |
| `modIndex` | number | 1–12 ratio | 8 ratio |
| `attack` | number | 0.001–0.03 s | 0.001 s |
| `decay` | number | 0.045–0.195 s | 0.15 s |

## See also

- [Recipe Book Index](./index.md)
- [ToneGraph Schema](../../tonegraph.md)
