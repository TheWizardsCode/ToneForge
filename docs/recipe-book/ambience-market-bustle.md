---
title: "Ambience Market Bustle"
id: "ambience-market-bustle"
order: 83
description: "Market bustle ambience"
---

# Ambience Market Bustle

**Category: Ambience** · Tags: casual, fun, ambience

## At a glance

| Field | Value |
|-------|-------|
| **Title** | Ambience Market Bustle |
| **Common uses** | Towns, markets, busy public spaces |
| **Default frequency** | 300 Hz |
| **Default duration** | 1.6 s |
| **Tier** | 6 — Ambience & loops |
| **Category** | Ambience |
| **Tags** | casual, fun, ambience |

## Sound design

### Overview

A busy market — a chattering mid-band bed with a tonal undercurrent.

### Synthesis

Pink noise through a bandpass at 1000 Hz (Q 1) modulated by a 2 Hz LFO (±300 Hz) suggests indistinct voices, while a 300 Hz sine adds body beneath them.

### Parameters

`chatterRate`/`chatterDepth` set the crowd movement; `filterFreq` the voices' band; `noiseLevel` the crowd level; `attack`/`release` the fade.

### Seed behaviour & musical intent

With a fixed seed (e.g. `--seed 42`) this recipe renders byte-identical audio on every platform and run. A lively, populated town loop.

## ToneForge CLI

<!-- CLI_BLOCK_START — regenerate with: tsx scripts/recipe-book/generate-cli-blocks.ts ambience-market-bustle -->
```bash
# Generate the recipe with a specific seed
toneforge generate --recipe ambience-market-bustle --seed 42 --output ambience-market-bustle.wav
```
```bash
# Show the recipe metadata
toneforge show --recipe ambience-market-bustle
```
```bash
# List all recipes, filtered by casual tag
toneforge list recipes --tags casual
```
```bash
# Generate with default seed
toneforge generate --recipe ambience-market-bustle --output ambience-market-bustle-default.wav
```
<!-- CLI_BLOCK_END -->

## Parameters

| Parameter | Type | Range | Default |
|-----------|------|-------|---------|
| `chatterRate` | number | 0.8–5 Hz | 2 Hz |
| `chatterDepth` | number | 150–600 Hz | 300 Hz |
| `filterFreq` | number | 550–1600 Hz | 1000 Hz |
| `noiseLevel` | number | 0.3–0.8 amplitude | 0.5 amplitude |
| `attack` | number | 0.1–0.4 s | 0.25 s |
| `release` | number | 0.2–0.6 s | 0.5 s |

## See also

- [Recipe Book Index](./index.md)
- [ToneGraph Schema](../../tonegraph.md)
