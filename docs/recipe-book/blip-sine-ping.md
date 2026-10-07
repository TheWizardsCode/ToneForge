---
title: "Blip Sine Ping"
id: "blip-sine-ping"
order: 2
description: "Short, bright sine blip for UI confirmations"
---

# Blip Sine Ping

**Tier 1** · UI · Tags: casual, fun, ui

## Sound design

The `blip-sine-ping` is the simplest possible ToneForge recipe: a single sine oscillator
gated by a fast ADSR envelope, routed directly to the output. It produces a short,
bright tone ideal for casual game UI confirmations — think the sound a coin makes
when collected in a mobile puzzle game, or a button click in a lighthearted interface.

The sine waveform was chosen because it produces a pure, pleasant tone with no harsh
harmonics. At 880 Hz (the default frequency), it sits comfortably in the upper-mid
range — bright enough to cut through other game audio, but not so high that it becomes
piercing. The 5 ms attack gives an instant onset, and the 40 ms decay creates a
snappy "ping" that feels responsive without dragging.

The key parameter to experiment with is `frequency`. Lower values (around 600 Hz)
produce a softer, more muted blip suitable for less important confirmations. Higher
values (up to 1200 Hz) create a brighter, more attention-grabbing tone for critical
feedback. The `decay` parameter controls the perceived length — shorter decays feel
punchier, longer decays feel more melodic.

## ToneForge CLI

<!-- CLI_BLOCK_START — regenerate with: tsx scripts/recipe-book/generate-cli-blocks.ts blip-sine-ping -->
```bash
# Generate the recipe with a specific seed
toneforge generate --recipe blip-sine-ping --seed 42 --output blip-sine-ping.wav

# Show the recipe metadata
toneforge show --recipe blip-sine-ping

# List all recipes, filtered by casual tag
toneforge list recipes --tags casual

# Generate with default seed
toneforge generate --recipe blip-sine-ping --output blip-sine-ping-default.wav
```
<!-- CLI_BLOCK_END -->

## Parameters

| Parameter | Type | Range | Default | Description |
|-----------|------|-------|---------|-------------|
| `frequency` | number | 600–1200 Hz | 880 Hz | The pitch of the sine oscillator |
| `attack` | number | 1–10 ms | 5 ms | Time for the sound to reach full volume |
| `decay` | number | 20–100 ms | 40 ms | Time for the sound to fade after the attack phase |

## Seed behaviour

With a fixed seed (e.g. `--seed 42`), the recipe produces byte-identical output
across all platforms and runs. This determinism is guaranteed by ToneForge's
deterministic RNG and offline rendering pipeline.

## See also

- [Recipe Book Index](./index.md)
- [ToneGraph Schema](../../tonegraph.md)
