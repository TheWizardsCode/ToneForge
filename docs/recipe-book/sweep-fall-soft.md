---
title: "Sweep Fall Soft"
id: "sweep-fall-soft"
order: 18
description: "Soft falling pitch sweep for wind-downs"
---

# Sweep Fall Soft

**Category: UI** · Tags: casual, joy, sweep

## At a glance

| Field | Value |
|-------|-------|
| **Title** | Sweep Fall Soft |
| **Common uses** | Wind-downs, losing a life, closing menus |
| **Default frequency** | 900 Hz |
| **Default duration** | 0.6 s |
| **Tier** | 2 — Shaped events |
| **Category** | UI |
| **Tags** | casual, joy, sweep |

## Sound design

### Overview

`sweep-fall-soft` provides soft falling pitch sweep for wind-downs. It belongs to the casual recipe family (casual, joy, sweep) and is designed to be short, characterful and easy to layer.

### Synthesis

It is built from a single sine tone, shaped by an amplitude envelope (attack 0.01s, decay 0.3s, sustain 0), which opens quickly and then settles. The pitch follows a linear falling contour (900 Hz → 300 Hz) scheduled on the frequency AudioParam, so the sound bends rather than holding a fixed pitch.

### Parameters

The declared parameters (`startFreq`, `endFreq`, `attack`, `decay`) expose the pitch contour endpoints and the envelope timing. Override a contour endpoint to change the direction or span of the sweep, or adjust the decay to make the event snappier or more resonant.

### Seed behaviour & musical intent

With a fixed seed (e.g. `--seed 42`) this recipe renders byte-identical audio on every platform and run. A lightweight, joyful game sound intended as a placeholder that a sound designer can immediately vary through the CLI.

## ToneForge CLI

<!-- CLI_BLOCK_START — regenerate with: tsx scripts/recipe-book/generate-cli-blocks.ts sweep-fall-soft -->
```bash
# Generate the recipe with a specific seed
toneforge generate --recipe sweep-fall-soft --seed 42 --output sweep-fall-soft.wav
```
```bash
# Show the recipe metadata
toneforge show --recipe sweep-fall-soft
```
```bash
# List all recipes, filtered by casual tag
toneforge list recipes --tags casual
```
```bash
# Generate with default seed
toneforge generate --recipe sweep-fall-soft --output sweep-fall-soft-default.wav
```
<!-- CLI_BLOCK_END -->

## Parameters

| Parameter | Type | Range | Default |
|-----------|------|-------|---------|
| `startFreq` | number | 540–1440 Hz | 900 Hz |
| `endFreq` | number | 180–480 Hz | 300 Hz |
| `attack` | number | 0.001–0.03 s | 0.01 s |
| `decay` | number | 0.03–0.4 s | 0.3 s |

## See also

- [Recipe Book Index](./index.md)
- [ToneGraph Schema](../../tonegraph.md)
