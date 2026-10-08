---
title: "Character Effort Grunt"
id: "character-effort-grunt"
order: 62
description: "Character effort grunt"
---

# Character Effort Grunt

**Category: Character** · Tags: casual, fun, character

## At a glance

| Field | Value |
|-------|-------|
| **Title** | Character Effort Grunt |
| **Common uses** | Physical effort, attacks, pushing and lifting |
| **Default frequency** | 120 Hz |
| **Default duration** | 0.35 s |
| **Tier** | 5 — Character & critter voices |
| **Category** | Character |
| **Tags** | casual, fun, character |

## Sound design

### Overview

A low, breathy grunt for physical effort — a short burst of voice plus breath that reads as exertion.

### Synthesis

A 120 Hz sine carries the pitched part of the grunt while white noise through a 600 Hz lowpass supplies the breath; the two are summed before a 200 ms envelope. This noise-plus-tonal blend is one of the tier's defining techniques.

### Parameters

`toneFreq` sets the pitch of the voice; `noiseLevel` balances breath against tone; `filterFreq` darkens the noise; `attack`/`decay` shape the effort.

### Seed behaviour & musical intent

With a fixed seed (e.g. `--seed 42`) this recipe renders byte-identical audio on every platform and run. A grounded, physical effort cue for pushes, lifts, hits and landings.

## ToneForge CLI

<!-- CLI_BLOCK_START — regenerate with: tsx scripts/recipe-book/generate-cli-blocks.ts character-effort-grunt -->
```bash
# Generate the recipe with a specific seed
toneforge generate --recipe character-effort-grunt --seed 42 --output character-effort-grunt.wav
```
```bash
# Show the recipe metadata
toneforge show --recipe character-effort-grunt
```
```bash
# List all recipes, filtered by casual tag
toneforge list recipes --tags casual
```
```bash
# Generate with default seed
toneforge generate --recipe character-effort-grunt --output character-effort-grunt-default.wav
```
<!-- CLI_BLOCK_END -->

## Parameters

| Parameter | Type | Range | Default |
|-----------|------|-------|---------|
| `toneFreq` | number | 80–180 Hz | 120 Hz |
| `noiseLevel` | number | 0.2–0.9 amplitude | 0.5 amplitude |
| `filterFreq` | number | 350–950 Hz | 600 Hz |
| `attack` | number | 0.004–0.03 s | 0.01 s |
| `decay` | number | 0.12–0.32 s | 0.2 s |

## See also

- [Recipe Book Index](./index.md)
- [ToneGraph Schema](../../tonegraph.md)
