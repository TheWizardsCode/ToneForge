---
title: "Casual Menu Flow Sequence"
id: "casual_menu_flow_sequence"
order: 106
description: "Casual menu flow: a click, a selection pop, a rising confirm and a dialog-open motif tracing a happy interface journey."
---

# Casual Menu Flow Sequence

**Capstone Sequence** · presets/sequences

## At a glance

| Field | Value |
|-------|-------|
| **Title** | Casual Menu Flow Sequence |
| **Common uses** | Menu navigation, tutorials, interface demos |
| **Default frequency** | 262–700 Hz |
| **Default duration** | 1.11 s |
| **Type** | Sequence (4 events) |
| **Recipes** | `ui-click-crisp`, `ui-select-pop`, `ui-confirm-rise`, `ui-dialog-open-motif` |

## Sound design

### Overview

A short interface journey: a click, a selection pop, a rising confirm and a dialog-open motif over 700 ms.

### Layered structure

Each event triggers one file-backed UI recipe at a fixed time and seed offset; `ui-click-crisp` opens navigation, `ui-select-pop` commits the choice, `ui-confirm-rise` acknowledges it and `ui-dialog-open-motif` reveals the next screen. Distinct seed offsets keep repeated events subtly varied but deterministic.

### Voices

| Recipe | Time | Seed offset | Gain |
|--------|------|-------------|------|
| `ui-click-crisp` | 0.00 s | 0 | 1.00 |
| `ui-select-pop` | 0.18 s | 1 | 0.95 |
| `ui-confirm-rise` | 0.42 s | 2 | 1.00 |
| `ui-dialog-open-motif` | 0.70 s | 3 | 0.85 |

### Seed behaviour & musical intent

With a fixed seed the whole arrangement renders byte-identical audio on every platform and run; changing the seed varies the texture while preserving the structure. A guided, joyful menu interaction for demos and tutorials.

## ToneForge CLI

```bash
# Simulate the event schedule
toneforge sequence simulate --preset presets/sequences/casual_menu_flow_sequence.json --seed 42
```
```bash
# Render the sequence at a fixed seed
toneforge sequence generate --preset presets/sequences/casual_menu_flow_sequence.json --seed 42 --output casual_menu_flow_sequence.wav
```
```bash
# List every sequence preset
toneforge list sequences
```

## See also

- [Recipe Book Index](./index.md)
- [Stack PRD](../../prd/STACK_PRD.md)
- [Sequencer PRD](../../prd/SEQUENCER_PRD.md)
