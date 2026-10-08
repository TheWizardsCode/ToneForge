---
title: "Character Happy Voice"
id: "character-happy-voice"
order: 61
description: "Character happy voice"
---

# Character Happy Voice

**Category: Character** · Tags: casual, joy, character

## At a glance

| Field | Value |
|-------|-------|
| **Title** | Character Happy Voice |
| **Common uses** | Celebrations, cheerful reactions, positive events |
| **Default frequency** | 520 Hz (FM carrier) |
| **Default duration** | 0.36 s |
| **Tier** | 5 — Character & critter voices |
| **Category** | Character |
| **Tags** | casual, joy, character |

## Sound design

### Overview

A bright, approving character chirp for a happy reaction — a short, bell-like FM "yay".

### Synthesis

An `fmPattern` voice (carrier 520 Hz, modulator 780 Hz, index 4) produces a bell-like but still vocal tone; a quick 6 ms attack and a 240 ms decay give it a bouncy, cheerful shape.

### Parameters

`carrierFreq`/`modulatorFreq` set the register and harmonic ratio; `modIndex` controls brightness and roughness; `attack`/`decay` tune the bounce.

### Seed behaviour & musical intent

With a fixed seed (e.g. `--seed 42`) this recipe renders byte-identical audio on every platform and run. A perky positive cue for rewards, greetings and friendly moments.

## ToneForge CLI

<!-- CLI_BLOCK_START — regenerate with: tsx scripts/recipe-book/generate-cli-blocks.ts character-happy-voice -->
```bash
# Generate the recipe with a specific seed
toneforge generate --recipe character-happy-voice --seed 42 --output character-happy-voice.wav
```
```bash
# Show the recipe metadata
toneforge show --recipe character-happy-voice
```
```bash
# List all recipes, filtered by casual tag
toneforge list recipes --tags casual
```
```bash
# Generate with default seed
toneforge generate --recipe character-happy-voice --output character-happy-voice-default.wav
```
<!-- CLI_BLOCK_END -->

## Parameters

| Parameter | Type | Range | Default |
|-----------|------|-------|---------|
| `carrierFreq` | number | 360–720 Hz | 520 Hz |
| `modulatorFreq` | number | 540–1080 Hz | 780 Hz |
| `modIndex` | number | 2–9 ratio | 4 ratio |
| `attack` | number | 0.003–0.02 s | 0.006 s |
| `decay` | number | 0.14–0.34 s | 0.24 s |

## See also

- [Recipe Book Index](./index.md)
- [ToneGraph Schema](../../tonegraph.md)
