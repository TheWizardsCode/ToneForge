---
title: "Sting Adventure Call"
id: "sting-adventure-call"
order: 99
description: "Adventure-call sting"
---

# Sting Adventure Call

**Category: Sting** · Tags: casual, joy, sting

## Sound design

### Overview

An adventure-call sting — a bright major triad fanfare.

### Synthesis

Three triangles at G4, C5 and E5 sound together as a major triad under a shared envelope, giving a bold, open call to action.

### Parameters

`voice1`/`voice2`/`voice3` set the triad; `attack`/`decay` shape the fanfare.

### Seed behaviour & musical intent

With a fixed seed (e.g. `--seed 42`) this recipe renders byte-identical audio on every platform and run. A rousing cue for quest starts and new areas.

## ToneForge CLI

<!-- CLI_BLOCK_START — regenerate with: tsx scripts/recipe-book/generate-cli-blocks.ts sting-adventure-call -->
```bash
# Generate the recipe with a specific seed
toneforge generate --recipe sting-adventure-call --seed 42 --output sting-adventure-call.wav
```
```bash
# Show the recipe metadata
toneforge show --recipe sting-adventure-call
```
```bash
# List all recipes, filtered by casual tag
toneforge list recipes --tags casual
```
```bash
# Generate with default seed
toneforge generate --recipe sting-adventure-call --output sting-adventure-call-default.wav
```
<!-- CLI_BLOCK_END -->

## Parameters

| Parameter | Type | Range | Default |
|-----------|------|-------|---------|
| `voice1` | number | 300–520 Hz | 392 Hz |
| `voice2` | number | 420–640 Hz | 523 Hz |
| `voice3` | number | 540–800 Hz | 659 Hz |
| `attack` | number | 0.005–0.03 s | 0.01 s |
| `decay` | number | 0.3–0.7 s | 0.55 s |

## See also

- [Recipe Book Index](./index.md)
- [ToneGraph Schema](../../tonegraph.md)
