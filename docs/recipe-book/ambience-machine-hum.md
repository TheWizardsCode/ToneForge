---
title: "Ambience Machine Hum"
id: "ambience-machine-hum"
order: 83
description: "Machine hum ambience"
---

# Ambience Machine Hum

**Category: Ambience** · Tags: casual, fun, ambience

## At a glance

| Field | Value |
|-------|-------|
| **Title** | Ambience Machine Hum |
| **Common uses** | Machine rooms, factories, industrial areas |
| **Default frequency** | 55 Hz |
| **Default duration** | 1.7 s |
| **Tier** | 6 — Ambience & loops |
| **Category** | Ambience |
| **Tags** | casual, fun, ambience |

## Sound design

### Overview

A machine-room hum — a low sawtooth drone softened by a lowpass.

### Synthesis

A 55 Hz sawtooth through a 400 Hz lowpass (Q 2) yields a rich but muffled industrial hum; the lowpass removes the harsh upper harmonics that would otherwise fatigue.

### Parameters

`humFreq` sets the motor pitch; `filterFreq` the muffling; `attack`/`release` the fade.

### Seed behaviour & musical intent

With a fixed seed (e.g. `--seed 42`) this recipe renders byte-identical audio on every platform and run. A steady engine-room or factory loop.

## ToneForge CLI

<!-- CLI_BLOCK_START — regenerate with: tsx scripts/recipe-book/generate-cli-blocks.ts ambience-machine-hum -->
```bash
# Inspect a representative ambience sequence
toneforge sequence inspect --preset presets/sequences/footsteps_run.json
```
```bash
# Sweep seeds and rank the best variants
toneforge explore sweep --recipe ambience-machine-hum --seed-range 1:50 --keep-top 5
```
<!-- CLI_BLOCK_END -->

## Parameters

| Parameter | Type | Range | Default |
|-----------|------|-------|---------|
| `humFreq` | number | 35–90 Hz | 55 Hz |
| `filterFreq` | number | 200–700 Hz | 400 Hz |
| `attack` | number | 0.15–0.5 s | 0.3 s |
| `release` | number | 0.2–0.6 s | 0.5 s |

## See also

- [Recipe Book Index](./index.md)
- [ToneGraph Schema](../tonegraph.md)
