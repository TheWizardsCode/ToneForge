---
title: "Sting Puzzle Solved"
id: "sting-puzzle-solved"
order: 91
description: "Puzzle-solved sting"
---

# Sting Puzzle Solved

**Category: Sting** · Tags: casual, joy, sting

## Sound design

### Overview

A puzzle-solved sting — a rising chime with a consonant harmony.

### Synthesis

A sine lead rises 880→1175 Hz over 180 ms while a triangle holds 659 Hz. The fast rise and short decay read as a clean, clever "aha".

### Parameters

`leadStart`/`leadEnd` set the rise; `harmonyFreq` the chord; `attack`/`decay` the length.

### Seed behaviour & musical intent

With a fixed seed (e.g. `--seed 42`) this recipe renders byte-identical audio on every platform and run. A crisp reward for solving a puzzle or unlocking a mechanism.

## ToneForge CLI

<!-- CLI_BLOCK_START — regenerate with: tsx scripts/recipe-book/generate-cli-blocks.ts sting-puzzle-solved -->
```bash
# Generate the recipe with a specific seed
toneforge generate --recipe sting-puzzle-solved --seed 42 --output sting-puzzle-solved.wav
```
```bash
# Show the recipe metadata
toneforge show --recipe sting-puzzle-solved
```
```bash
# List all recipes, filtered by casual tag
toneforge list recipes --tags casual
```
```bash
# Generate with default seed
toneforge generate --recipe sting-puzzle-solved --output sting-puzzle-solved-default.wav
```
<!-- CLI_BLOCK_END -->

## Parameters

| Parameter | Type | Range | Default |
|-----------|------|-------|---------|
| `leadStart` | number | 700–1000 Hz | 880 Hz |
| `leadEnd` | number | 1000–1400 Hz | 1175 Hz |
| `harmonyFreq` | number | 520–800 Hz | 659 Hz |
| `attack` | number | 0.003–0.02 s | 0.005 s |
| `decay` | number | 0.2–0.55 s | 0.4 s |

## See also

- [Recipe Book Index](./index.md)
- [ToneGraph Schema](../../tonegraph.md)
