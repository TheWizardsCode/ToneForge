---
title: "Jingle Coin Chain"
id: "jingle-coin-chain"
order: 51
description: "Coin-chain jingle"
---

# Jingle Coin Chain

**Category: Collect** · Tags: casual, joy, jingle

## Sound design

### Overview

`jingle-coin-chain` provides coin-chain jingle. It belongs to the casual recipe family (casual, joy, jingle) and is designed to be short, characterful and easy to layer.

### Synthesis

It is built from a single square tone, shaped by a compact amplitude envelope. The pitch steps through a 3-note figure (659 Hz → 784 Hz → 880 Hz) via scheduled set events on the frequency AudioParam, while a gain gate shapes each note into a short articulated motif.

### Parameters

The declared parameters (`note1`, `note2`, `note3`) expose the pitch contour endpoints and the envelope timing. Override a contour endpoint to change the direction or span of the sweep, or adjust the decay to make the event snappier or more resonant.

### Seed behaviour & musical intent

With a fixed seed (e.g. `--seed 42`) this recipe renders byte-identical audio on every platform and run. A lightweight, joyful game sound intended as a placeholder that a sound designer can immediately vary through the CLI.

## ToneForge CLI

<!-- CLI_BLOCK_START — regenerate with: tsx scripts/recipe-book/generate-cli-blocks.ts jingle-coin-chain -->
```bash
# Generate the recipe with a specific seed
toneforge generate --recipe jingle-coin-chain --seed 42 --output jingle-coin-chain.wav
```
```bash
# Show the recipe metadata
toneforge show --recipe jingle-coin-chain
```
```bash
# List all recipes, filtered by casual tag
toneforge list recipes --tags casual
```
```bash
# Generate with default seed
toneforge generate --recipe jingle-coin-chain --output jingle-coin-chain-default.wav
```
<!-- CLI_BLOCK_END -->

## Parameters

| Parameter | Type | Range | Default |
|-----------|------|-------|---------|
| `note1` | number | 461–922 Hz | 659 Hz |
| `note2` | number | 548–1097 Hz | 784 Hz |
| `note3` | number | 616–1232 Hz | 880 Hz |

## See also

- [Recipe Book Index](./index.md)
- [ToneGraph Schema](../../tonegraph.md)
