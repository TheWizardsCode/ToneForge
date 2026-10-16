---
title: "Ambience Space Hum"
id: "ambience-space-hum"
order: 82
description: "Space hum ambience"
---

# Ambience Space Hum

**Category: Ambience** · Tags: casual, fun, ambience

## At a glance

| Field | Value |
|-------|-------|
| **Title** | Ambience Space Hum |
| **Common uses** | Space stations, sci-fi scenes, cosmic settings |
| **Default frequency** | 60 Hz |
| **Default duration** | 2.1 s |
| **Tier** | 6 — Ambience & loops |
| **Category** | Ambience |
| **Tags** | casual, fun, ambience |

## Sound design

### Overview

A deep space hum — two almost-identical low drones that beat slowly.

### Synthesis

60 Hz and 61 Hz sines are summed; their 1 Hz difference creates a slow, unsettling beat. A long attack and release keep the drone sustained and seamless.

### Parameters

`humFreq` and `beatFreq` set the two drone pitches (their difference is the beat); `attack`/`release` shape the fade.

### Seed behaviour & musical intent

With a fixed seed (e.g. `--seed 42`) this recipe renders byte-identical audio on every platform and run. An eerie, weightless sci-fi loop.

## ToneForge CLI

<!-- CLI_BLOCK_START — regenerate with: tsx scripts/recipe-book/generate-cli-blocks.ts ambience-space-hum -->
```bash
# Inspect a representative ambience sequence
toneforge sequence inspect --preset presets/sequences/footsteps_run.json
```
```bash
# Sweep seeds and rank the best variants
toneforge explore sweep --recipe ambience-space-hum --seed-range 1:50 --keep-top 5
```
<!-- CLI_BLOCK_END -->

## Parameters

| Parameter | Type | Range | Default |
|-----------|------|-------|---------|
| `humFreq` | number | 40–90 Hz | 60 Hz |
| `beatFreq` | number | 41–96 Hz | 61 Hz |
| `attack` | number | 0.2–0.7 s | 0.45 s |
| `release` | number | 0.3–0.8 s | 0.6 s |

## See also

- [Recipe Book Index](./index.md)
- [ToneGraph Schema](../tonegraph.md)
