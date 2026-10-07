---
title: "Casual Ui Confirm Stack"
id: "casual_ui_confirm_stack"
order: 101
description: "Casual UI confirm stack: a crisp selection pop, a rising confirmation tone and a magic shimmer layered into one satisfying interface acknowledgement."
---

# Casual Ui Confirm Stack

**Capstone Stack** · presets/stacks

## Sound design

### Overview

A stacked interface confirmation that layers a crisp selection pop, a rising confirmation tone and a magic shimmer into one satisfying acknowledgement.

### Layered structure

Three file-backed recipes play within 80 ms of each other: `ui-select-pop` at full gain anchors the attack, `ui-confirm-rise` at 0.8 adds the rising gesture, and `sparkle-magic-shimmer` at 0.5 sends a bright tail upward. Mixing short, harmonically distinct recipes is what gives the stack its richness without inventing a new recipe.

### Voices

| Recipe | Start | Gain |
|--------|-------|------|
| `ui-select-pop` | 0.00 s | 1.00 |
| `ui-confirm-rise` | 0.02 s | 0.80 |
| `sparkle-magic-shimmer` | 0.08 s | 0.50 |

### Seed behaviour & musical intent

With a fixed seed the whole arrangement renders byte-identical audio on every platform and run; changing the seed varies the texture while preserving the structure. A polished, joyful confirmation for menus and dialogue choices.

## ToneForge CLI

```bash
# Inspect the layered structure
toneforge stack inspect --preset presets/stacks/casual_ui_confirm_stack.json
```
```bash
# Render the stack at a fixed seed
toneforge stack render --preset presets/stacks/casual_ui_confirm_stack.json --seed 42 --output casual_ui_confirm_stack.wav
```
```bash
# List every stack preset
toneforge list stacks
```

## See also

- [Recipe Book Index](./index.md)
- [Stack PRD](../../prd/STACK_PRD.md)
- [Sequencer PRD](../../prd/SEQUENCER_PRD.md)
