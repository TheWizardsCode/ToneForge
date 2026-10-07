---
title: "Blip Sine Ping"
id: "blip-sine-ping"
order: 1
description: "Short, bright sine blip for UI confirmations"
---

# Blip Sine Ping

**Category: UI** · Tags: casual, fun, ui

## Sound design

### Overview

The simplest possible ToneForge recipe: a single sine oscillator gated by a fast ADSR envelope, routed directly to the output. It produces a short, bright tone ideal for casual UI confirmations — the sound a coin makes when collected, or a button click in a lighthearted interface.

### Synthesis

The sine waveform produces a pure, pleasant tone with no harsh harmonics. At 880 Hz it sits comfortably in the upper-mid range: bright enough to cut through other game audio without becoming piercing. The 5 ms attack gives an instant onset and the 40 ms decay creates a snappy ping that feels responsive.

### Parameters

Lower `frequency` values (around 600 Hz) give a softer, more muted blip for less important confirmations; higher values (up to 1200 Hz) are brighter and more attention-grabbing. `decay` controls perceived length — shorter feels punchier, longer feels more melodic.

### Seed behaviour & musical intent

With a fixed seed (e.g. `--seed 42`) this recipe renders byte-identical audio on every platform and run. A cheerful, unambiguous confirmation that a tap or press was registered, with no sustain to mask the next sound.

## ToneForge CLI

<!-- CLI_BLOCK_START — regenerate with: tsx scripts/recipe-book/generate-cli-blocks.ts blip-sine-ping -->
```bash
# Generate the recipe with a specific seed
toneforge generate --recipe blip-sine-ping --seed 42 --output blip-sine-ping.wav
```
```bash
# Show the recipe metadata
toneforge show --recipe blip-sine-ping
```
```bash
# List all recipes, filtered by casual tag
toneforge list recipes --tags casual
```
```bash
# Generate with default seed
toneforge generate --recipe blip-sine-ping --output blip-sine-ping-default.wav
```
<!-- CLI_BLOCK_END -->

## Parameters

| Parameter | Type | Range | Default |
|-----------|------|-------|---------|
| `frequency` | number | 600–1200 Hz | 880 Hz |
| `attack` | number | 0.001–0.01 s | 0.005 s |
| `decay` | number | 0.02–0.1 s | 0.04 s |

## See also

- [Recipe Book Index](./index.md)
- [ToneGraph Schema](../../tonegraph.md)
