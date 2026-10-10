---
title: "Creature Ghost Whisper"
id: "creature-ghost-whisper"
order: 71
description: "Ghost whisper"
---

# Creature Ghost Whisper

**Category: Creature** · Tags: casual, fun, creature

## At a glance

| Field | Value |
|-------|-------|
| **Title** | Creature Ghost Whisper |
| **Common uses** | Ghost enemies, haunted areas, spectral presences |
| **Default frequency** | 600 Hz |
| **Default duration** | 0.8 s |
| **Tier** | 5 — Character & critter voices |
| **Category** | Creature |
| **Tags** | casual, fun, creature |

## Sound design

### Overview

A breathy ghostly whisper, airy and unsettling but gentle rather than scary.

### Synthesis

White noise through a bandpass that rises from 800 Hz to 2000 Hz supplies the breath, while a 600 Hz sine slides to 500 Hz underneath. The 60 ms attack and 500 ms decay let it emerge and fade like a whisper.

### Parameters

`toneFreq` sets the underlying tone; `noiseLevel` balances air; `filterStart`/`filterEnd` set the breath sweep; `attack`/`decay` shape the fade.

### Seed behaviour & musical intent

With a fixed seed (e.g. `--seed 42`) this recipe renders byte-identical audio on every platform and run. A spooky-but-playful supernatural cue for ghosts and haunted spaces.

## ToneForge CLI

<!-- CLI_BLOCK_START — regenerate with: tsx scripts/recipe-book/generate-cli-blocks.ts creature-ghost-whisper -->
```bash
# Generate the recipe with a specific seed
toneforge generate --recipe creature-ghost-whisper --seed 42 --output creature-ghost-whisper.wav
```
```bash
# Show the recipe metadata
toneforge show --recipe creature-ghost-whisper
```
```bash
# List all recipes, filtered by casual tag
toneforge list recipes --tags casual
```
```bash
# Generate with default seed
toneforge generate --recipe creature-ghost-whisper --output creature-ghost-whisper-default.wav
```
<!-- CLI_BLOCK_END -->

## Parameters

| Parameter | Type | Range | Default |
|-----------|------|-------|---------|
| `toneFreq` | number | 380–760 Hz | 600 Hz |
| `noiseLevel` | number | 0.2–0.8 amplitude | 0.5 amplitude |
| `filterStart` | number | 500–1200 Hz | 800 Hz |
| `filterEnd` | number | 1400–2800 Hz | 2000 Hz |
| `attack` | number | 0.02–0.1 s | 0.06 s |
| `decay` | number | 0.36–0.7 s | 0.5 s |

## See also

- [Recipe Book Index](./index.md)
- [ToneGraph Schema](../../tonegraph.md)
