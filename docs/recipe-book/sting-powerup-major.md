---
title: "Sting Powerup Major"
id: "sting-powerup-major"
order: 94
description: "Major power-up sting"
---

# Sting Powerup Major

**Category: Sting** · Tags: casual, joy, sting

## At a glance

| Field | Value |
|-------|-------|
| **Title** | Sting Powerup Major |
| **Common uses** | Major power-ups, transformations, upgrades |
| **Default frequency** | 392 Hz |
| **Default duration** | 0.87 s |
| **Tier** | 7 — Multi-voice stings |
| **Category** | Sting |
| **Tags** | casual, joy, sting |

## Sound design

### Overview

A major power-up sting — a four-note rising figure over a bass pedal.

### Synthesis

A triangle lead steps G4–C5–E5–G5 via scheduled set events while a sine bass holds G3. The fast, upward line signals growing strength.

### Parameters

`noteLow`/`noteHigh` set the figure endpoints; `bassFreq` the pedal; `attack`/`decay` the shape.

### Seed behaviour & musical intent

With a fixed seed (e.g. `--seed 42`) this recipe renders byte-identical audio on every platform and run. An energising reward for power-ups and upgrades.

## ToneForge CLI

<!-- CLI_BLOCK_START — regenerate with: tsx scripts/recipe-book/generate-cli-blocks.ts sting-powerup-major -->
```bash
# Generate the recipe with a specific seed
toneforge generate --recipe sting-powerup-major --seed 42 --output sting-powerup-major.wav
```
```bash
# Show the recipe metadata
toneforge show --recipe sting-powerup-major
```
```bash
# List all recipes, filtered by casual tag
toneforge list recipes --tags casual
```
```bash
# Generate with default seed
toneforge generate --recipe sting-powerup-major --output sting-powerup-major-default.wav
```
<!-- CLI_BLOCK_END -->

## Parameters

| Parameter | Type | Range | Default |
|-----------|------|-------|---------|
| `noteLow` | number | 320–480 Hz | 392 Hz |
| `noteHigh` | number | 660–950 Hz | 784 Hz |
| `bassFreq` | number | 150–260 Hz | 196 Hz |
| `attack` | number | 0.003–0.02 s | 0.005 s |
| `decay` | number | 0.25–0.65 s | 0.5 s |

## See also

- [Recipe Book Index](./index.md)
- [ToneGraph Schema](../../tonegraph.md)
