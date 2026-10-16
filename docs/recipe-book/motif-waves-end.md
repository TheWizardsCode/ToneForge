---
title: "Motif Waves End"
id: "motif-waves-end"
order: 59
description: "Wave-complete leitmotif (relief then worry)"
---

# Motif Waves End

**Category: UI** · Tags: casual, joy, fun, leitmotif, wave-complete, level-complete

## At a glance

| Field | Value |
|-------|-------|
| **Title** | Motif Waves End |
| **Common uses** | Wave completion, level completion, stage cleared |
| **Default frequency** | 392 Hz |
| **Default duration** | 1.4 s |
| **Tier** | 4 — Melodic motifs |
| **Category** | UI |
| **Tags** | casual, joy, fun, leitmotif, wave-complete, level-complete |

## Sound design

### Overview

A leitmotif for wave completion that tells a two-part story in under 1.5 seconds: **relief** at clearing the stage, then a subtle **worry** about what comes next. The same theme is reused by the `sequence-wave-end` (compact) and `sequence-level-end` (layered) sequences, so the whole book has one recognisable wave-end identity instead of a pure celebration fanfare.

### Synthesis

A single triangle oscillator steps through a four-note C-major contour while a gain gate articulates each note. The relief phrase rises G4 (392 Hz) → C5 (523 Hz) → E5 (659 Hz), outlining the tonic and its major third — a bright, settled cadence. After a short gap the motif lands on F♯5 (740 Hz), the raised 4th — a tritone above the C-major root — and holds it past the point of resolution, so the tail never quite settles. That one unresolved interval is what carries the worry.

### Parameters

`note1`/`note2`/`note3` shape the relief phrase (raise `note3` to brighten the resolution); `note4` is the worry tail — tune it to another dissonance (e.g. a b2nd) for a harsher or softer “what’s next” feel.

### Seed behaviour & musical intent

With a fixed seed (e.g. `--seed 42`) this recipe renders byte-identical audio on every platform and run. A deterministic relief-then-worry leitmotif that keeps the player satisfied a wave is over while hinting the fight continues.

## ToneForge CLI

<!-- CLI_BLOCK_START — regenerate with: tsx scripts/recipe-book/generate-cli-blocks.ts motif-waves-end -->
```bash
# Generate the recipe with a specific seed
toneforge generate --recipe motif-waves-end --seed 42 --output motif-waves-end.wav
```
```bash
# Show the recipe metadata
toneforge show motif-waves-end
```
```bash
# List all recipes, filtered by casual tag
toneforge list recipes --tags casual
```
```bash
# Generate with default seed
toneforge generate --recipe motif-waves-end --output motif-waves-end-default.wav
```
<!-- CLI_BLOCK_END -->

## Parameters

| Parameter | Type | Range | Default |
|-----------|------|-------|---------|
| `note1` | number | 274–548 Hz | 392 Hz |
| `note2` | number | 366–732 Hz | 523 Hz |
| `note3` | number | 461–922 Hz | 659 Hz |
| `note4` | number | 518–1036 Hz | 740 Hz |

## See also

- [Recipe Book Index](./index.md)
- [ToneGraph Schema](../tonegraph.md)
