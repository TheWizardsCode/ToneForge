---
title: "Creature Frog Croak"
id: "creature-frog-croak"
order: 66
description: "Frog croak"
---

# Creature Frog Croak

**Category: Creature** · Tags: casual, fun, creature

## At a glance

| Field | Value |
|-------|-------|
| **Title** | Creature Frog Croak |
| **Common uses** | Frog enemies, swamp critters, pond creatures |
| **Default frequency** | 140 Hz (FM carrier) |
| **Default duration** | 0.43 s |
| **Tier** | 5 — Character & critter voices |
| **Category** | Creature |
| **Tags** | casual, fun, creature |

## Sound design

### Overview

A low, rattly frog croak with a distinctly non-musical timbre.

### Synthesis

An `fmPattern` voice with a low 140 Hz carrier and an 85 Hz modulator at index 14 produces a dense, inharmonic rattle — the classic croak. A short 10 ms attack and a 300 ms decay give it the throaty push.

### Parameters

`carrierFreq`/`modulatorFreq` set the pitch and rattle; `modIndex` controls the rasp; `attack`/`decay` tune the push and release.

### Seed behaviour & musical intent

With a fixed seed (e.g. `--seed 42`) this recipe renders byte-identical audio on every platform and run. A characterful low croak for amphibian creatures and swamp ambience.

## ToneForge CLI

<!-- CLI_BLOCK_START — regenerate with: tsx scripts/recipe-book/generate-cli-blocks.ts creature-frog-croak -->
```bash
# Generate the recipe with a specific seed
toneforge generate --recipe creature-frog-croak --seed 42 --output creature-frog-croak.wav
```
```bash
# Show the recipe metadata
toneforge show --recipe creature-frog-croak
```
```bash
# List all recipes, filtered by casual tag
toneforge list recipes --tags casual
```
```bash
# Generate with default seed
toneforge generate --recipe creature-frog-croak --output creature-frog-croak-default.wav
```
<!-- CLI_BLOCK_END -->

## Parameters

| Parameter | Type | Range | Default |
|-----------|------|-------|---------|
| `carrierFreq` | number | 90–200 Hz | 140 Hz |
| `modulatorFreq` | number | 55–130 Hz | 85 Hz |
| `modIndex` | number | 6–24 ratio | 14 ratio |
| `attack` | number | 0.004–0.03 s | 0.01 s |
| `decay` | number | 0.16–0.4 s | 0.3 s |

## See also

- [Recipe Book Index](./index.md)
- [ToneGraph Schema](../../tonegraph.md)
