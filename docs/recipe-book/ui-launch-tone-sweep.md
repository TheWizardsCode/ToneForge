---
title: "Ui Launch Tone Sweep"
id: "ui-launch-tone-sweep"
order: 28
description: "Launch tone with an upward sweep"
---

# Ui Launch Tone Sweep

**Category: UI** · Tags: casual, joy, ui

## At a glance

| Field | Value |
|-------|-------|
| **Title** | Ui Launch Tone Sweep |
| **Common uses** | Game launch, level start, activation cues |
| **Default frequency** | 200 Hz |
| **Default duration** | 0.7 s |
| **Tier** | 2 — Shaped events |
| **Category** | UI |
| **Tags** | casual, joy, ui |

## Sound design

### Overview

`ui-launch-tone-sweep` provides launch tone with an upward sweep. It belongs to the casual recipe family (casual, joy, ui) and is designed to be short, characterful and easy to layer.

### Synthesis

It is built from a single sine tone, shaped by an amplitude envelope (attack 0.01s, decay 0.35s, sustain 0), which opens quickly and then settles. The pitch follows a linear rising contour (200 Hz → 1000 Hz) scheduled on the frequency AudioParam, so the sound bends rather than holding a fixed pitch.

### Parameters

The declared parameters (`startFreq`, `endFreq`, `attack`, `decay`) expose the pitch contour endpoints and the envelope timing. Override a contour endpoint to change the direction or span of the sweep, or adjust the decay to make the event snappier or more resonant.

### Seed behaviour & musical intent

With a fixed seed (e.g. `--seed 42`) this recipe renders byte-identical audio on every platform and run. A lightweight, joyful game sound intended as a placeholder that a sound designer can immediately vary through the CLI.

## ToneForge CLI

<!-- CLI_BLOCK_START — regenerate with: tsx scripts/recipe-book/generate-cli-blocks.ts ui-launch-tone-sweep -->
```bash
# Generate the recipe with a specific seed
toneforge generate --recipe ui-launch-tone-sweep --seed 42 --output ui-launch-tone-sweep.wav
```
```bash
# Show the recipe metadata
toneforge show --recipe ui-launch-tone-sweep
```
```bash
# List all recipes, filtered by casual tag
toneforge list recipes --tags casual
```
```bash
# Generate with default seed
toneforge generate --recipe ui-launch-tone-sweep --output ui-launch-tone-sweep-default.wav
```
<!-- CLI_BLOCK_END -->

## Parameters

| Parameter | Type | Range | Default |
|-----------|------|-------|---------|
| `startFreq` | number | 120–320 Hz | 200 Hz |
| `endFreq` | number | 600–1600 Hz | 1000 Hz |
| `attack` | number | 0.001–0.03 s | 0.01 s |
| `decay` | number | 0.03–0.4 s | 0.35 s |

## See also

- [Recipe Book Index](./index.md)
- [ToneGraph Schema](../../tonegraph.md)
