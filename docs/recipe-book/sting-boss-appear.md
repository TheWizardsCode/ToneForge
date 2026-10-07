---
title: "Sting Boss Appear"
id: "sting-boss-appear"
order: 90
description: "Boss-appear dramatic sting"
---

# Sting Boss Appear

**Category: Sting** · Tags: casual, fun, sting

## Sound design

### Overview

A dramatic boss-appear sting — a low descending growl with a noise swell.

### Synthesis

A sawtooth lead falls 110→82 Hz over 700 ms while brown noise through a 600 Hz lowpass (Q 2) swells beneath it. The low register signals size and threat.

### Parameters

`leadStart`/`leadEnd` set the fall; `noiseLevel` the swell; `filterFreq` the darkness; `attack`/`decay` the shape.

### Seed behaviour & musical intent

With a fixed seed (e.g. `--seed 42`) this recipe renders byte-identical audio on every platform and run. An imposing entrance cue for bosses and major threats.

## ToneForge CLI

<!-- CLI_BLOCK_START — regenerate with: tsx scripts/recipe-book/generate-cli-blocks.ts sting-boss-appear -->
```bash
# Generate the recipe with a specific seed
toneforge generate --recipe sting-boss-appear --seed 42 --output sting-boss-appear.wav
```
```bash
# Show the recipe metadata
toneforge show --recipe sting-boss-appear
```
```bash
# List all recipes, filtered by casual tag
toneforge list recipes --tags casual
```
```bash
# Generate with default seed
toneforge generate --recipe sting-boss-appear --output sting-boss-appear-default.wav
```
<!-- CLI_BLOCK_END -->

## Parameters

| Parameter | Type | Range | Default |
|-----------|------|-------|---------|
| `leadStart` | number | 80–150 Hz | 110 Hz |
| `leadEnd` | number | 60–110 Hz | 82 Hz |
| `noiseLevel` | number | 0.15–0.7 amplitude | 0.4 amplitude |
| `filterFreq` | number | 350–1000 Hz | 600 Hz |
| `attack` | number | 0.005–0.03 s | 0.01 s |
| `decay` | number | 0.4–0.9 s | 0.7 s |

## See also

- [Recipe Book Index](./index.md)
- [ToneGraph Schema](../../tonegraph.md)
