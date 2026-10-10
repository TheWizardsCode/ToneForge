---
title: "Tone Bell Tap"
id: "tone-bell-tap"
order: 6
description: "Bell-like tapped tone for rewards"
---

# Tone Bell Tap

**Category: Collect** · Tags: casual, joy, collect

## At a glance

| Field | Value |
|-------|-------|
| **Title** | Tone Bell Tap |
| **Common uses** | Reward collection, treasure pickup, bell cues |
| **Default frequency** | 990 Hz |
| **Default duration** | 0.323 s |
| **Tier** | 1 — Pure tones & blips |
| **Category** | Collect |
| **Tags** | casual, joy, collect |

## Sound design

### Overview

A bell-like tapped tone for rewards, combining a pure sine with a long, ringing decay to suggest a struck metal bell.

### Synthesis

A sine oscillator at 990 Hz with a 3 ms attack and a 300 ms decay. The instantaneous attack mimics the strike of a mallet, and the long decay produces the ringing tail.

### Parameters

`frequency` (660–1480 Hz) sets the bell size. `decay` (0.18–0.45 s) is the ring time; longer decays suit rarer, more valuable rewards.

### Seed behaviour & musical intent

With a fixed seed (e.g. `--seed 42`) this recipe renders byte-identical audio on every platform and run. A satisfying reward tone that makes collecting feel precious.

## ToneForge CLI

<!-- CLI_BLOCK_START — regenerate with: tsx scripts/recipe-book/generate-cli-blocks.ts tone-bell-tap -->
```bash
# Generate the recipe with a specific seed
toneforge generate --recipe tone-bell-tap --seed 42 --output tone-bell-tap.wav
```
```bash
# Show the recipe metadata
toneforge show --recipe tone-bell-tap
```
```bash
# List all recipes, filtered by casual tag
toneforge list recipes --tags casual
```
```bash
# Generate with default seed
toneforge generate --recipe tone-bell-tap --output tone-bell-tap-default.wav
```
<!-- CLI_BLOCK_END -->

## Parameters

| Parameter | Type | Range | Default |
|-----------|------|-------|---------|
| `frequency` | number | 660–1480 Hz | 990 Hz |
| `attack` | number | 0.001–0.02 s | 0.003 s |
| `decay` | number | 0.18–0.45 s | 0.3 s |

## See also

- [Recipe Book Index](./index.md)
- [ToneGraph Schema](../../tonegraph.md)
