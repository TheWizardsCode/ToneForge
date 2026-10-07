# ToneForge Haptics

ToneForge Haptics is the **tactile output layer**: it converts a sound event's
behaviour and intensity into a deterministic, inspectable haptic pattern that
can be translated to controllers, phones, wearables, or other
feedback-capable hardware.

See [`docs/prd/HAPTICS_PRD.md`](prd/HAPTICS_PRD.md) and
[`docs/prd/PALLETE_PRD.md`](prd/PALLETE_PRD.md) for the product-level design.

## How it works

Haptics does not author wave forms. It derives a pattern from the audio:

1. Render the recipe's audio and sample its amplitude per frame
   (`buildAmplitudeEnvelope`).
2. Group contiguous frames above an amplitude threshold into **pulses**.
   A pulse's `atMs` is the run's start time and its `intensity` is the run's
   peak amplitude, so timing and intensity track the sound automatically.
3. Apply the palette's visual style:

   | Palette dimension | Haptic effect |
   |---|---|
   | `motionIntensity` | scales pulse intensity, sharpness and decay |
   | `particleDensity` | splits long runs into more sub-pulses (rhythm) |

This keeps haptics perceptually aligned with the Visualizer's effects (a
visual burst maps to a tactile thump; a sustained visual maps to a rumble) and
with the same palette that drives visuals.

## Pattern families

The recipe's category and tags select a family:

| Style | Selected when | Example recipes |
|---|---|---|
| `ui_tick` | UI / notification-like | `ui-scifi-confirm` |
| `footstep_pulse` | footstep / walk-like | `footstep-stone` |
| `impact_thump` | impact / combat-like | `impact-crack` |
| `sustained_rumble` | vehicle / creature / ambient-like | `vehicle-engine` |
| `pulse` | fallback | — |

## Determinism

The same recipe + seed + palette always produces the same pattern. There is no
hidden randomness: pulses are a pure function of the amplitude envelope, the
palette, and the seed. Pulse timing is read directly from the audio, so it does
not drift.

## Programmatic API

```ts
import { buildHapticPattern, generateHapticPattern } from "./src/haptics/index.js";

// Audio-backed: renders the recipe and derives pulses from the envelope.
const pattern = await buildHapticPattern({
  recipe: "weapon-laser-zap",
  seed: 42,
  palette: "high_energy_combat",
});
// → { command: "haptic pattern", style: "impact_thump", pulses: [...] }

// Pure: supply your own envelope when you already have one.
const custom = generateHapticPattern({
  envelope: [0, 0.4, 1, 0.3, 0],
  durationSeconds: 0.5,
  palette,
  seed: 42,
  style: "impact_thump",
});
```

Each pulse exposes `atMs`, `durationMs`, `intensity`, `sharpness` and `decay`
(`fast` / `medium` / `slow`), giving device integrations enough detail to map
the pattern to their capability class.
