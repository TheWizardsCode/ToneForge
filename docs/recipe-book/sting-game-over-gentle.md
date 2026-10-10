---
title: "Sting Game Over Gentle"
id: "sting-game-over-gentle"
order: 92
description: "Gentle game-over sting"
---

# Sting Game Over Gentle

**Category: Sting** · Tags: casual, fun, sting

## At a glance

| Field | Value |
|-------|-------|
| **Title** | Sting Game Over Gentle |
| **Common uses** | Game over, run ends, soft conclusions |
| **Default frequency** | 392 Hz |
| **Default duration** | 1.04 s |
| **Tier** | 7 — Multi-voice stings |
| **Category** | Sting |
| **Tags** | casual, fun, sting |

## Sound design

### Overview

A gentle game-over sting — a descending three-note chord.

### Synthesis

Three sines at G4, E4 and C4 sound together under a shared slow envelope, giving a soft major-to-melancholy resolution rather than a jarring end.

### Parameters

`voice1`/`voice2`/`voice3` set the three chord tones; `attack`/`decay` shape the fade.

### Seed behaviour & musical intent

With a fixed seed (e.g. `--seed 42`) this recipe renders byte-identical audio on every platform and run. A kind, unhurried end-of-run cue.

## ToneForge CLI

<!-- CLI_BLOCK_START — regenerate with: tsx scripts/recipe-book/generate-cli-blocks.ts sting-game-over-gentle -->
```bash
# Generate the recipe with a specific seed
toneforge generate --recipe sting-game-over-gentle --seed 42 --output sting-game-over-gentle.wav
```
```bash
# Show the recipe metadata
toneforge show --recipe sting-game-over-gentle
```
```bash
# List all recipes, filtered by casual tag
toneforge list recipes --tags casual
```
```bash
# Generate with default seed
toneforge generate --recipe sting-game-over-gentle --output sting-game-over-gentle-default.wav
```
<!-- CLI_BLOCK_END -->

## Parameters

| Parameter | Type | Range | Default |
|-----------|------|-------|---------|
| `voice1` | number | 320–470 Hz | 392 Hz |
| `voice2` | number | 260–400 Hz | 330 Hz |
| `voice3` | number | 200–320 Hz | 262 Hz |
| `attack` | number | 0.01–0.04 s | 0.02 s |
| `decay` | number | 0.35–0.8 s | 0.6 s |

## See also

- [Recipe Book Index](./index.md)
- [ToneGraph Schema](../../tonegraph.md)
