---
title: "Sting Danger Warning"
id: "sting-danger-warning"
order: 96
description: "Danger-warning sting"
---

# Sting Danger Warning

**Category: Sting** · Tags: casual, fun, sting

## At a glance

| Field | Value |
|-------|-------|
| **Title** | Sting Danger Warning |
| **Common uses** | Danger alerts, warnings, low health |
| **Default frequency** | 220 Hz |
| **Default duration** | 0.775 s |
| **Tier** | 7 — Multi-voice stings |
| **Category** | Sting |
| **Tags** | casual, fun, sting |

## Sound design

### Overview

A danger-warning sting — two detuned saws and a noise haze.

### Synthesis

Two sawtooths at 220 Hz and 233 Hz beat against each other for an uneasy roughness, lowpassed at 900 Hz (Q 2) with a white-noise layer adding urgency.

### Parameters

`voice1`/`voice2` set the detuned pair; `filterFreq` the bite; `noiseLevel` the haze; `attack`/`decay` the shape.

### Seed behaviour & musical intent

With a fixed seed (e.g. `--seed 42`) this recipe renders byte-identical audio on every platform and run. An alarming cue for hazards, timers and low health.

## ToneForge CLI

<!-- CLI_BLOCK_START — regenerate with: tsx scripts/recipe-book/generate-cli-blocks.ts sting-danger-warning -->
```bash
# Inspect a representative multi-voice stack
toneforge stack inspect --preset presets/stacks/casual_victory_stack.json
```
```bash
# Export deterministic visual frames
toneforge visualize export --recipe sting-danger-warning --seed 42 --format frames
```
<!-- CLI_BLOCK_END -->

## Parameters

| Parameter | Type | Range | Default |
|-----------|------|-------|---------|
| `voice1` | number | 160–300 Hz | 220 Hz |
| `voice2` | number | 170–320 Hz | 233 Hz |
| `filterFreq` | number | 500–1400 Hz | 900 Hz |
| `noiseLevel` | number | 0.05–0.35 amplitude | 0.2 amplitude |
| `attack` | number | 0.004–0.025 s | 0.008 s |
| `decay` | number | 0.2–0.55 s | 0.4 s |

## See also

- [Recipe Book Index](./index.md)
- [ToneGraph Schema](../tonegraph.md)
