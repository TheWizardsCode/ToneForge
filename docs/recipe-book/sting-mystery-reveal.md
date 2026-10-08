---
title: "Sting Mystery Reveal"
id: "sting-mystery-reveal"
order: 96
description: "Mystery-reveal sting"
---

# Sting Mystery Reveal

**Category: Sting** · Tags: casual, joy, sting

## At a glance

| Field | Value |
|-------|-------|
| **Title** | Sting Mystery Reveal |
| **Common uses** | Mystery reveals, plot twists, discoveries |
| **Default frequency** | 440 Hz |
| **Default duration** | 1.18 s |
| **Tier** | 7 — Multi-voice stings |
| **Category** | Sting |
| **Tags** | casual, joy, sting |

## Sound design

### Overview

A mystery-reveal sting — a suspended two-note chord.

### Synthesis

Two sines at A4 and C5 form a suspended interval that never quite resolves, with a slow 40 ms attack and long decay that feel curious rather than final.

### Parameters

`voice1`/`voice2` set the suspended interval; `attack`/`decay` the slow swell.

### Seed behaviour & musical intent

With a fixed seed (e.g. `--seed 42`) this recipe renders byte-identical audio on every platform and run. A curious, unresolved cue for discoveries and secrets.

## ToneForge CLI

<!-- CLI_BLOCK_START — regenerate with: tsx scripts/recipe-book/generate-cli-blocks.ts sting-mystery-reveal -->
```bash
# Generate the recipe with a specific seed
toneforge generate --recipe sting-mystery-reveal --seed 42 --output sting-mystery-reveal.wav
```
```bash
# Show the recipe metadata
toneforge show --recipe sting-mystery-reveal
```
```bash
# List all recipes, filtered by casual tag
toneforge list recipes --tags casual
```
```bash
# Generate with default seed
toneforge generate --recipe sting-mystery-reveal --output sting-mystery-reveal-default.wav
```
<!-- CLI_BLOCK_END -->

## Parameters

| Parameter | Type | Range | Default |
|-----------|------|-------|---------|
| `voice1` | number | 340–540 Hz | 440 Hz |
| `voice2` | number | 420–640 Hz | 523 Hz |
| `attack` | number | 0.02–0.08 s | 0.04 s |
| `decay` | number | 0.4–0.9 s | 0.7 s |

## See also

- [Recipe Book Index](./index.md)
- [ToneGraph Schema](../../tonegraph.md)
