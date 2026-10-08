---
title: "Character Hurt Voice"
id: "character-hurt-voice"
order: 60
description: "Character hurt voice"
---

# Character Hurt Voice

**Category: Character** · Tags: casual, fun, character

## At a glance

| Field | Value |
|-------|-------|
| **Title** | Character Hurt Voice |
| **Common uses** | Taking damage, pain reactions, combat feedback |
| **Default frequency** | 300 Hz (FM carrier) |
| **Default duration** | 0.43 s |
| **Tier** | 5 — Character & critter voices |
| **Category** | Character |
| **Tags** | casual, fun, character |

## Sound design

### Overview

A pained character exclamation — an FM yelp that falls away as the character recoils, the descending brightness suggesting a flinch.

### Synthesis

An `fmPattern` voice (carrier 300 Hz, modulator 450 Hz, index 9) carries a buzzy, vocal timbre while a lowpass filter sweeps from 1200 Hz down to 350 Hz, darkening the tone as it fades over 280 ms.

### Parameters

`carrierFreq`/`modulatorFreq`/`modIndex` set the voice's timbre; `filterStart`/`filterEnd` set how quickly it darkens; `attack`/`decay` control the wince.

### Seed behaviour & musical intent

With a fixed seed (e.g. `--seed 42`) this recipe renders byte-identical audio on every platform and run. A readable hurt reaction that is expressive but never harsh on repeated playback.

## ToneForge CLI

<!-- CLI_BLOCK_START — regenerate with: tsx scripts/recipe-book/generate-cli-blocks.ts character-hurt-voice -->
```bash
# Generate the recipe with a specific seed
toneforge generate --recipe character-hurt-voice --seed 42 --output character-hurt-voice.wav
```
```bash
# Show the recipe metadata
toneforge show --recipe character-hurt-voice
```
```bash
# List all recipes, filtered by casual tag
toneforge list recipes --tags casual
```
```bash
# Generate with default seed
toneforge generate --recipe character-hurt-voice --output character-hurt-voice-default.wav
```
<!-- CLI_BLOCK_END -->

## Parameters

| Parameter | Type | Range | Default |
|-----------|------|-------|---------|
| `carrierFreq` | number | 200–420 Hz | 300 Hz |
| `modulatorFreq` | number | 300–640 Hz | 450 Hz |
| `modIndex` | number | 3–16 ratio | 9 ratio |
| `filterStart` | number | 700–1800 Hz | 1200 Hz |
| `filterEnd` | number | 180–600 Hz | 350 Hz |
| `attack` | number | 0.003–0.03 s | 0.008 s |
| `decay` | number | 0.16–0.4 s | 0.28 s |

## See also

- [Recipe Book Index](./index.md)
- [ToneGraph Schema](../../tonegraph.md)
