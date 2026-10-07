---
title: "Sting Victory Bright"
id: "sting-victory-bright"
order: 87
description: "Bright multi-voice victory sting"
---

# Sting Victory Bright

**Category: Sting** · Tags: casual, joy, sting

## Sound design

### Overview

A self-contained, triumphant victory sting — a rising major arpeggio over a held harmony and bass. Nothing else is needed to make it sound complete.

### Synthesis

Three voices are summed: a triangle lead steps C5–E5–G5 via scheduled set events, a triangle harmony holds G4 and a triangle bass holds C4. The shared envelope gives a quick 6 ms attack and a 450 ms decay.

### Parameters

`leadLow`/`leadHigh` set the arpeggio endpoints; `harmonyFreq` and `bassFreq` place the chord; `attack`/`decay` shape the sting.

### Seed behaviour & musical intent

With a fixed seed (e.g. `--seed 42`) this recipe renders byte-identical audio on every platform and run. A bright, celebratory reward sting for wins and achievements.

## ToneForge CLI

<!-- CLI_BLOCK_START — regenerate with: tsx scripts/recipe-book/generate-cli-blocks.ts sting-victory-bright -->
```bash
# Generate the recipe with a specific seed
toneforge generate --recipe sting-victory-bright --seed 42 --output sting-victory-bright.wav
```
```bash
# Show the recipe metadata
toneforge show --recipe sting-victory-bright
```
```bash
# List all recipes, filtered by casual tag
toneforge list recipes --tags casual
```
```bash
# Generate with default seed
toneforge generate --recipe sting-victory-bright --output sting-victory-bright-default.wav
```
<!-- CLI_BLOCK_END -->

## Parameters

| Parameter | Type | Range | Default |
|-----------|------|-------|---------|
| `leadLow` | number | 420–620 Hz | 523 Hz |
| `leadHigh` | number | 660–900 Hz | 784 Hz |
| `harmonyFreq` | number | 320–470 Hz | 392 Hz |
| `bassFreq` | number | 200–320 Hz | 262 Hz |
| `attack` | number | 0.003–0.02 s | 0.006 s |
| `decay` | number | 0.2–0.6 s | 0.45 s |

## See also

- [Recipe Book Index](./index.md)
- [ToneGraph Schema](../../tonegraph.md)
