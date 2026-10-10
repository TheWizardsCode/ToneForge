---
title: "Collect Gem Arc"
id: "collect-gem-arc"
order: 26
description: "Arcing gem pickup contour"
---

# Collect Gem Arc

**Category: Collect** · Tags: casual, joy, collect

## At a glance

| Field | Value |
|-------|-------|
| **Title** | Collect Gem Arc |
| **Common uses** | Gem pickups, collectible arcs, score rewards |
| **Default frequency** | 1200 Hz |
| **Default duration** | 0.25 s |
| **Tier** | 2 — Shaped events |
| **Category** | Collect |
| **Tags** | casual, joy, collect |

## Sound design

### Overview

`collect-gem-arc` provides arcing gem pickup contour. It belongs to the casual recipe family (casual, joy, collect) and is designed to be short, characterful and easy to layer.

### Synthesis

It is built from a single triangle tone, shaped by an amplitude envelope (attack 0.003s, decay 0.12s, sustain 0), which opens quickly and then settles. The pitch follows a linear rising contour (1200 Hz → 2000 Hz) scheduled on the frequency AudioParam, so the sound bends rather than holding a fixed pitch.

### Parameters

The declared parameters (`startFreq`, `endFreq`, `attack`, `decay`) expose the pitch contour endpoints and the envelope timing. Override a contour endpoint to change the direction or span of the sweep, or adjust the decay to make the event snappier or more resonant.

### Seed behaviour & musical intent

With a fixed seed (e.g. `--seed 42`) this recipe renders byte-identical audio on every platform and run. A lightweight, joyful game sound intended as a placeholder that a sound designer can immediately vary through the CLI.

## ToneForge CLI

<!-- CLI_BLOCK_START — regenerate with: tsx scripts/recipe-book/generate-cli-blocks.ts collect-gem-arc -->
```bash
# Generate the recipe with a specific seed
toneforge generate --recipe collect-gem-arc --seed 42 --output collect-gem-arc.wav
```
```bash
# Show the recipe metadata
toneforge show --recipe collect-gem-arc
```
```bash
# List all recipes, filtered by casual tag
toneforge list recipes --tags casual
```
```bash
# Generate with default seed
toneforge generate --recipe collect-gem-arc --output collect-gem-arc-default.wav
```
<!-- CLI_BLOCK_END -->

## Parameters

| Parameter | Type | Range | Default |
|-----------|------|-------|---------|
| `startFreq` | number | 720–1920 Hz | 1200 Hz |
| `endFreq` | number | 1200–3200 Hz | 2000 Hz |
| `attack` | number | 0.001–0.03 s | 0.003 s |
| `decay` | number | 0.03–0.4 s | 0.12 s |

## See also

- [Recipe Book Index](./index.md)
- [ToneGraph Schema](../../tonegraph.md)
