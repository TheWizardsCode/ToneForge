---
title: "Sting Sad Trombone Soft"
id: "sting-sad-trombone-soft"
order: 98
description: "Soft sad-trombone sting"
---

# Sting Sad Trombone Soft

**Category: Sting** · Tags: casual, fun, sting

## Sound design

### Overview

A soft sad-trombone sting — a descending saw lead over a low pedal.

### Synthesis

A sawtooth lead falls C4→G3 over 550 ms through an 800 Hz lowpass (Q 1.5) for a brassy, muted wail, with a sine bass holding G3 beneath it.

### Parameters

`leadStart`/`leadEnd` set the fall; `filterFreq` the brass tone; `bassFreq` the pedal; `attack`/`decay` the fade.

### Seed behaviour & musical intent

With a fixed seed (e.g. `--seed 42`) this recipe renders byte-identical audio on every platform and run. A comic-but-kind "wah wah" failure cue.

## ToneForge CLI

<!-- CLI_BLOCK_START — regenerate with: tsx scripts/recipe-book/generate-cli-blocks.ts sting-sad-trombone-soft -->
```bash
# Generate the recipe with a specific seed
toneforge generate --recipe sting-sad-trombone-soft --seed 42 --output sting-sad-trombone-soft.wav
```
```bash
# Show the recipe metadata
toneforge show --recipe sting-sad-trombone-soft
```
```bash
# List all recipes, filtered by casual tag
toneforge list recipes --tags casual
```
```bash
# Generate with default seed
toneforge generate --recipe sting-sad-trombone-soft --output sting-sad-trombone-soft-default.wav
```
<!-- CLI_BLOCK_END -->

## Parameters

| Parameter | Type | Range | Default |
|-----------|------|-------|---------|
| `leadStart` | number | 200–340 Hz | 262 Hz |
| `leadEnd` | number | 140–240 Hz | 196 Hz |
| `bassFreq` | number | 110–220 Hz | 196 Hz |
| `filterFreq` | number | 500–1300 Hz | 800 Hz |
| `attack` | number | 0.01–0.04 s | 0.02 s |
| `decay` | number | 0.35–0.8 s | 0.6 s |

## See also

- [Recipe Book Index](./index.md)
- [ToneGraph Schema](../../tonegraph.md)
