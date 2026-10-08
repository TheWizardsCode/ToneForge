---
title: "Casual Coin Reward Stack"
id: "casual_coin_reward_stack"
order: 102
description: "Casual coin reward stack: a bright pickup tick, an arcing coin contour and a coin-chain jingle that together celebrate a reward."
---

# Casual Coin Reward Stack

**Capstone Stack** · presets/stacks

## At a glance

| Field | Value |
|-------|-------|
| **Title** | Casual Coin Reward Stack |
| **Common uses** | Coin rewards, loot pickups, collection celebrations |
| **Default frequency** | 659–1560 Hz |
| **Default duration** | 0.77 s |
| **Type** | Stack (3 voices) |
| **Recipes** | `collect-pickup-coin`, `collect-coin-arc`, `jingle-coin-chain` |

## Sound design

### Overview

A coin reward stack combining a bright pickup tick, an arcing coin contour and a coin-chain jingle.

### Layered structure

`collect-pickup-coin` fires first for the instant reward, `collect-coin-arc` follows 60 ms later to arc upward, and `jingle-coin-chain` at 180 ms extends the celebration into a short melodic flourish. Each layer is a separate recipe, so the arrangement stays a pure composition over the delivered palette.

### Voices

| Recipe | Start | Gain |
|--------|-------|------|
| `collect-pickup-coin` | 0.00 s | 0.90 |
| `collect-coin-arc` | 0.06 s | 0.80 |
| `jingle-coin-chain` | 0.18 s | 0.70 |

### Seed behaviour & musical intent

With a fixed seed the whole arrangement renders byte-identical audio on every platform and run; changing the seed varies the texture while preserving the structure. A celebratory reward for coins, loot and collectibles.

## ToneForge CLI

```bash
# Inspect the layered structure
toneforge stack inspect --preset presets/stacks/casual_coin_reward_stack.json
```
```bash
# Render the stack at a fixed seed
toneforge stack render --preset presets/stacks/casual_coin_reward_stack.json --seed 42 --output casual_coin_reward_stack.wav
```
```bash
# List every stack preset
toneforge list stacks
```

## See also

- [Recipe Book Index](./index.md)
- [Stack PRD](../../prd/STACK_PRD.md)
- [Sequencer PRD](../../prd/SEQUENCER_PRD.md)
