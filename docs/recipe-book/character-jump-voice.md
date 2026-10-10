---
title: "Character Jump Voice"
id: "character-jump-voice"
order: 59
description: "Character jump voice"
---

# Character Jump Voice

**Category: Character** · Tags: casual, fun, character

## At a glance

| Field | Value |
|-------|-------|
| **Title** | Character Jump Voice |
| **Common uses** | Character jumps, vocal effort, movement grunts |
| **Default frequency** | 180 Hz |
| **Default duration** | 0.34 s |
| **Tier** | 5 — Character & critter voices |
| **Category** | Character |
| **Tags** | casual, fun, character |

## Sound design

### Overview

A short, upward character utterance for a jump — a cheerful "hup!" that reads as effort leaving the ground. A sawtooth voice bent upward through a bandpass gives it a vowel-like, cartoonish lift.

### Synthesis

A sawtooth oscillator rises exponentially from 180 Hz to 520 Hz while a bandpass filter at 900 Hz (Q 4) emphasises a single formant region, so the sweep reads as a spoken vowel rather than a plain glide. A fast 5 ms attack and a 220 ms decay keep the hop snappy.

### Parameters

`startFreq`/`endFreq` set the register and span of the lift; `filterFreq` moves the formant that shapes the vowel; `attack`/`decay` tune the punch and length.

### Seed behaviour & musical intent

With a fixed seed (e.g. `--seed 42`) this recipe renders byte-identical audio on every platform and run. A joyful acknowledgement of a jump input that stays short enough to fire on every hop.

## ToneForge CLI

<!-- CLI_BLOCK_START — regenerate with: tsx scripts/recipe-book/generate-cli-blocks.ts character-jump-voice -->
```bash
# Generate the recipe with a specific seed
toneforge generate --recipe character-jump-voice --seed 42 --output character-jump-voice.wav
```
```bash
# Show the recipe metadata
toneforge show --recipe character-jump-voice
```
```bash
# List all recipes, filtered by casual tag
toneforge list recipes --tags casual
```
```bash
# Generate with default seed
toneforge generate --recipe character-jump-voice --output character-jump-voice-default.wav
```
<!-- CLI_BLOCK_END -->

## Parameters

| Parameter | Type | Range | Default |
|-----------|------|-------|---------|
| `startFreq` | number | 120–260 Hz | 180 Hz |
| `endFreq` | number | 360–780 Hz | 520 Hz |
| `filterFreq` | number | 600–1400 Hz | 900 Hz |
| `attack` | number | 0.002–0.02 s | 0.005 s |
| `decay` | number | 0.12–0.32 s | 0.22 s |

## See also

- [Recipe Book Index](./index.md)
- [ToneGraph Schema](../../tonegraph.md)
