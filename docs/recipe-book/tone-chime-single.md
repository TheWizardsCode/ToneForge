---
title: "Tone Chime Single"
id: "tone-chime-single"
order: 5
description: "Single-note chime for notifications"
---

# Tone Chime Single

**Category: UI** · Tags: casual, joy, ui

## At a glance

| Field | Value |
|-------|-------|
| **Title** | Tone Chime Single |
| **Common uses** | Notifications, rewards, achievement chimes |
| **Default frequency** | 1320 Hz |
| **Default duration** | 0.274 s |
| **Tier** | 1 — Pure tones & blips |
| **Category** | UI |
| **Tags** | casual, joy, ui |

## Sound design

### Overview

A single-note chime for notifications, rewards and pleasant state changes. It is the first Tier 1 sound with a noticeably longer tail.

### Synthesis

A sine oscillator at 1320 Hz with a 4 ms attack and a 250 ms decay. The pure waveform and long decay give the note a bell-like ring without the complexity of a true bell.

### Parameters

`frequency` moves the chime from a warm 880 Hz to a sparkling 1760 Hz. `decay` (0.15–0.4 s) sets the ring length — shorter for frequent notifications, longer for rare rewards.

### Seed behaviour & musical intent

With a fixed seed (e.g. `--seed 42`) this recipe renders byte-identical audio on every platform and run. A bright, friendly chime that signals something good has happened.

## ToneForge CLI

<!-- CLI_BLOCK_START — regenerate with: tsx scripts/recipe-book/generate-cli-blocks.ts tone-chime-single -->
```bash
# Generate the recipe with a specific seed
toneforge generate --recipe tone-chime-single --seed 42 --output tone-chime-single.wav
```
```bash
# Show the recipe metadata
toneforge show --recipe tone-chime-single
```
```bash
# List all recipes, filtered by casual tag
toneforge list recipes --tags casual
```
```bash
# Generate with default seed
toneforge generate --recipe tone-chime-single --output tone-chime-single-default.wav
```
<!-- CLI_BLOCK_END -->

## Parameters

| Parameter | Type | Range | Default |
|-----------|------|-------|---------|
| `frequency` | number | 880–1760 Hz | 1320 Hz |
| `attack` | number | 0.001–0.02 s | 0.004 s |
| `decay` | number | 0.15–0.4 s | 0.25 s |

## See also

- [Recipe Book Index](./index.md)
- [ToneGraph Schema](../../tonegraph.md)
