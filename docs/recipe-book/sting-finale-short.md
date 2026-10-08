---
title: "Sting Finale Short"
id: "sting-finale-short"
order: 100
description: "Short finale sting"
---

# Sting Finale Short

**Category: Sting** · Tags: casual, fun, sting

## At a glance

| Field | Value |
|-------|-------|
| **Title** | Sting Finale Short |
| **Common uses** | Endings, finales, closing flourishes |
| **Default frequency** | 523 Hz |
| **Default duration** | 0.715 s |
| **Tier** | 7 — Multi-voice stings |
| **Category** | Sting |
| **Tags** | casual, fun, sting |

## Sound design

### Overview

A short finale sting — a fast rising lead with a bass anchor.

### Synthesis

A triangle lead climbs C5–G5–C6 in 200 ms while a sine bass holds C4. The compact, upward gesture closes a moment decisively.

### Parameters

`noteLow`/`noteHigh` set the run; `bassFreq` the anchor; `attack`/`decay` the shape.

### Seed behaviour & musical intent

With a fixed seed (e.g. `--seed 42`) this recipe renders byte-identical audio on every platform and run. A concise closing flourish for level ends and reveals.

## ToneForge CLI

<!-- CLI_BLOCK_START — regenerate with: tsx scripts/recipe-book/generate-cli-blocks.ts sting-finale-short -->
```bash
# Generate the recipe with a specific seed
toneforge generate --recipe sting-finale-short --seed 42 --output sting-finale-short.wav
```
```bash
# Show the recipe metadata
toneforge show --recipe sting-finale-short
```
```bash
# List all recipes, filtered by casual tag
toneforge list recipes --tags casual
```
```bash
# Generate with default seed
toneforge generate --recipe sting-finale-short --output sting-finale-short-default.wav
```
<!-- CLI_BLOCK_END -->

## Parameters

| Parameter | Type | Range | Default |
|-----------|------|-------|---------|
| `noteLow` | number | 420–640 Hz | 523 Hz |
| `noteHigh` | number | 880–1300 Hz | 1047 Hz |
| `bassFreq` | number | 200–340 Hz | 262 Hz |
| `attack` | number | 0.002–0.015 s | 0.004 s |
| `decay` | number | 0.2–0.5 s | 0.38 s |

## See also

- [Recipe Book Index](./index.md)
- [ToneGraph Schema](../../tonegraph.md)
