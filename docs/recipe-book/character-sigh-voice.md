---
title: "Character Sigh Voice"
id: "character-sigh-voice"
order: 63
description: "Character sigh"
---

# Character Sigh Voice

**Category: Character** · Tags: casual, fun, character

## Sound design

### Overview

A soft, deflating sigh — the sound of relief or resignation, with a falling pitch and a long breath tail.

### Synthesis

A 320 Hz sine glides down to 180 Hz over 400 ms while pink noise at 0.35 passes through a 700 Hz bandpass and mixes with the tone. The slow 30 ms attack and 400 ms decay let the breath out gradually.

### Parameters

`startFreq`/`endFreq` set the fall; `filterFreq` places the breath; `noiseLevel` balances air against voice; `attack`/`decay` control the length of the exhalation.

### Seed behaviour & musical intent

With a fixed seed (e.g. `--seed 42`) this recipe renders byte-identical audio on every platform and run. A gentle downward cue for letting go, disappointment or calm after action.

## ToneForge CLI

<!-- CLI_BLOCK_START — regenerate with: tsx scripts/recipe-book/generate-cli-blocks.ts character-sigh-voice -->
```bash
# Generate the recipe with a specific seed
toneforge generate --recipe character-sigh-voice --seed 42 --output character-sigh-voice.wav
```
```bash
# Show the recipe metadata
toneforge show --recipe character-sigh-voice
```
```bash
# List all recipes, filtered by casual tag
toneforge list recipes --tags casual
```
```bash
# Generate with default seed
toneforge generate --recipe character-sigh-voice --output character-sigh-voice-default.wav
```
<!-- CLI_BLOCK_END -->

## Parameters

| Parameter | Type | Range | Default |
|-----------|------|-------|---------|
| `startFreq` | number | 220–420 Hz | 320 Hz |
| `endFreq` | number | 120–240 Hz | 180 Hz |
| `filterFreq` | number | 450–1100 Hz | 700 Hz |
| `noiseLevel` | number | 0.15–0.7 amplitude | 0.35 amplitude |
| `attack` | number | 0.01–0.06 s | 0.03 s |
| `decay` | number | 0.26–0.56 s | 0.4 s |

## See also

- [Recipe Book Index](./index.md)
- [ToneGraph Schema](../../tonegraph.md)
