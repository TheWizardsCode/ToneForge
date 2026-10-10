---
title: "Critter Squeak Toy"
id: "critter-squeak-toy"
order: 69
description: "Toy critter squeak"
---

# Critter Squeak Toy

**Category: Critter** · Tags: casual, joy, critter

## At a glance

| Field | Value |
|-------|-------|
| **Title** | Critter Squeak Toy |
| **Common uses** | Toy critters, pet creatures, playful squeaks |
| **Default frequency** | 1200 Hz (FM carrier) |
| **Default duration** | 0.315 s |
| **Tier** | 5 — Character & critter voices |
| **Category** | Critter |
| **Tags** | casual, joy, critter |

## Sound design

### Overview

A bright, toy-like squeak for a cute critter — the sound of a rubber toy being squeezed.

### Synthesis

An `fmPattern` voice at a high 1200 Hz carrier with a 1900 Hz modulator at index 7 gives the squeak its plasticky, hollow character. A 4 ms attack and a 200 ms decay keep it toylike.

### Parameters

`carrierFreq`/`modulatorFreq` set the pitch and hollow tone; `modIndex` controls the squeakiness; `attack`/`decay` trim the squeeze.

### Seed behaviour & musical intent

With a fixed seed (e.g. `--seed 42`) this recipe renders byte-identical audio on every platform and run. A cheerful, compact squeak for mascots, pets and toy creatures.

## ToneForge CLI

<!-- CLI_BLOCK_START — regenerate with: tsx scripts/recipe-book/generate-cli-blocks.ts critter-squeak-toy -->
```bash
# Generate the recipe with a specific seed
toneforge generate --recipe critter-squeak-toy --seed 42 --output critter-squeak-toy.wav
```
```bash
# Show the recipe metadata
toneforge show --recipe critter-squeak-toy
```
```bash
# List all recipes, filtered by casual tag
toneforge list recipes --tags casual
```
```bash
# Generate with default seed
toneforge generate --recipe critter-squeak-toy --output critter-squeak-toy-default.wav
```
<!-- CLI_BLOCK_END -->

## Parameters

| Parameter | Type | Range | Default |
|-----------|------|-------|---------|
| `carrierFreq` | number | 800–1600 Hz | 1200 Hz |
| `modulatorFreq` | number | 1200–2600 Hz | 1900 Hz |
| `modIndex` | number | 3–14 ratio | 7 ratio |
| `attack` | number | 0.002–0.015 s | 0.004 s |
| `decay` | number | 0.1–0.3 s | 0.2 s |

## See also

- [Recipe Book Index](./index.md)
- [ToneGraph Schema](../../tonegraph.md)
