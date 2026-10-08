---
title: "Sting Treasure Found"
id: "sting-treasure-found"
order: 93
description: "Treasure-found sting"
---

# Sting Treasure Found

**Category: Sting** · Tags: casual, joy, sting

## At a glance

| Field | Value |
|-------|-------|
| **Title** | Sting Treasure Found |
| **Common uses** | Treasure discovery, secret reveals, loot |
| **Default frequency** | 262 Hz |
| **Default duration** | 0.87 s |
| **Tier** | 7 — Multi-voice stings |
| **Category** | Sting |
| **Tags** | casual, joy, sting |

## Sound design

### Overview

A treasure-found sting — a shimmering FM lead, a bass anchor and a sparkle of noise.

### Synthesis

An `fmPattern` voice (carrier 1200 Hz, modulator 1800 Hz, index 3) supplies the shimmer, a triangle holds 262 Hz and a light white-noise layer adds sparkle. All three are summed before one envelope.

### Parameters

`carrierFreq`/`modulatorFreq`/`modIndex` shape the shimmer; `bassFreq` the anchor; `noiseLevel` the sparkle; `attack`/`decay` the shape.

### Seed behaviour & musical intent

With a fixed seed (e.g. `--seed 42`) this recipe renders byte-identical audio on every platform and run. A rewarding discovery sting for loot, chests and secrets.

## ToneForge CLI

<!-- CLI_BLOCK_START — regenerate with: tsx scripts/recipe-book/generate-cli-blocks.ts sting-treasure-found -->
```bash
# Generate the recipe with a specific seed
toneforge generate --recipe sting-treasure-found --seed 42 --output sting-treasure-found.wav
```
```bash
# Show the recipe metadata
toneforge show --recipe sting-treasure-found
```
```bash
# List all recipes, filtered by casual tag
toneforge list recipes --tags casual
```
```bash
# Generate with default seed
toneforge generate --recipe sting-treasure-found --output sting-treasure-found-default.wav
```
<!-- CLI_BLOCK_END -->

## Parameters

| Parameter | Type | Range | Default |
|-----------|------|-------|---------|
| `carrierFreq` | number | 900–1500 Hz | 1200 Hz |
| `modulatorFreq` | number | 1400–2200 Hz | 1800 Hz |
| `modIndex` | number | 2–8 ratio | 3 ratio |
| `bassFreq` | number | 200–340 Hz | 262 Hz |
| `noiseLevel` | number | 0.05–0.3 amplitude | 0.15 amplitude |
| `attack` | number | 0.003–0.02 s | 0.006 s |
| `decay` | number | 0.25–0.65 s | 0.5 s |

## See also

- [Recipe Book Index](./index.md)
- [ToneGraph Schema](../../tonegraph.md)
