---
title: "Sting Level Complete"
id: "sting-level-complete"
order: 89
description: "Level-complete sting"
---

# Sting Level Complete

**Category: Sting** · Tags: casual, joy, sting

## At a glance

| Field | Value |
|-------|-------|
| **Title** | Sting Level Complete |
| **Common uses** | Level completion, stage clear, progression |
| **Default frequency** | 523 Hz |
| **Default duration** | 0.82 s |
| **Tier** | 7 — Multi-voice stings |
| **Category** | Sting |
| **Tags** | casual, joy, sting |

## Sound design

### Overview

A level-complete sting built from a bright FM lead and a triangle harmony.

### Synthesis

An `fmPattern` voice (carrier 660 Hz, modulator 990 Hz, index 4) gives a bell-like lead, while a triangle at 523 Hz holds a consonant harmony beneath it.

### Parameters

`carrierFreq`/`modulatorFreq`/`modIndex` shape the lead timbre; `harmonyFreq` sets the chord; `attack`/`decay` trim the sting.

### Seed behaviour & musical intent

With a fixed seed (e.g. `--seed 42`) this recipe renders byte-identical audio on every platform and run. A satisfying completion cue for levels and chapters.

## ToneForge CLI

<!-- CLI_BLOCK_START — regenerate with: tsx scripts/recipe-book/generate-cli-blocks.ts sting-level-complete -->
```bash
# Generate the recipe with a specific seed
toneforge generate --recipe sting-level-complete --seed 42 --output sting-level-complete.wav
```
```bash
# Show the recipe metadata
toneforge show --recipe sting-level-complete
```
```bash
# List all recipes, filtered by casual tag
toneforge list recipes --tags casual
```
```bash
# Generate with default seed
toneforge generate --recipe sting-level-complete --output sting-level-complete-default.wav
```
<!-- CLI_BLOCK_END -->

## Parameters

| Parameter | Type | Range | Default |
|-----------|------|-------|---------|
| `carrierFreq` | number | 500–850 Hz | 660 Hz |
| `modulatorFreq` | number | 800–1300 Hz | 990 Hz |
| `modIndex` | number | 2–9 ratio | 4 ratio |
| `harmonyFreq` | number | 420–640 Hz | 523 Hz |
| `attack` | number | 0.003–0.02 s | 0.006 s |
| `decay` | number | 0.2–0.6 s | 0.45 s |

## See also

- [Recipe Book Index](./index.md)
- [ToneGraph Schema](../../tonegraph.md)
