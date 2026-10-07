---
title: "Sting Defeat Soft"
id: "sting-defeat-soft"
order: 88
description: "Soft multi-voice defeat sting"
---

# Sting Defeat Soft

**Category: Sting** · Tags: casual, fun, sting

## Sound design

### Overview

A soft, two-voice defeat sting — a descending sigh over a low pedal.

### Synthesis

A sine lead glides A4→F4 over 500 ms while a sine bass holds F3. The minor fall and slow 20 ms attack keep the sting resigned rather than harsh.

### Parameters

`leadStart`/`leadEnd` set the fall; `bassFreq` sets the pedal; `attack`/`decay` shape the fade.

### Seed behaviour & musical intent

With a fixed seed (e.g. `--seed 42`) this recipe renders byte-identical audio on every platform and run. A gentle losing cue that closes a round without punishing the player.

## ToneForge CLI

<!-- CLI_BLOCK_START — regenerate with: tsx scripts/recipe-book/generate-cli-blocks.ts sting-defeat-soft -->
```bash
# Generate the recipe with a specific seed
toneforge generate --recipe sting-defeat-soft --seed 42 --output sting-defeat-soft.wav
```
```bash
# Show the recipe metadata
toneforge show --recipe sting-defeat-soft
```
```bash
# List all recipes, filtered by casual tag
toneforge list recipes --tags casual
```
```bash
# Generate with default seed
toneforge generate --recipe sting-defeat-soft --output sting-defeat-soft-default.wav
```
<!-- CLI_BLOCK_END -->

## Parameters

| Parameter | Type | Range | Default |
|-----------|------|-------|---------|
| `leadStart` | number | 360–520 Hz | 440 Hz |
| `leadEnd` | number | 280–400 Hz | 349 Hz |
| `bassFreq` | number | 130–220 Hz | 175 Hz |
| `attack` | number | 0.01–0.04 s | 0.02 s |
| `decay` | number | 0.3–0.7 s | 0.55 s |

## See also

- [Recipe Book Index](./index.md)
- [ToneGraph Schema](../../tonegraph.md)
