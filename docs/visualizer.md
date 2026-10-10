# ToneForge Visualizer

ToneForge Visualizer generates **deterministic, audio-synchronised visual
effects** from the same sound data the rest of the pipeline already produces.
It has two jobs:

1. turn a recipe + seed into a sequence of procedural effect frames whose
   intensity follows the rendered audio's amplitude envelope; and
2. export those frames as game-ready sprite sheets (or individual PNGs) with
   grid metadata.

See [`docs/prd/VISUALIZE_PRD.md`](prd/VISUALIZE_PRD.md) and
[`docs/prd/PALLETE_PRD.md`](prd/PALLETE_PRD.md) for the product-level design.

## CLI

```
toneforge visualize export --recipe <name> --seed <n> --format <f> --output <dir>
```

| Option | Description |
|---|---|
| `--recipe <name>` | Registered recipe to visualise (required) |
| `--seed <number>` | Deterministic seed (required) |
| `--format <spritesheet\|frames>` | Export format; default `spritesheet` |
| `--output <dir>` | Output directory, created if missing (required) |
| `--palette <name>` | Aesthetic palette; default `calm_ui` |
| `--frames <n>` | Number of animation frames; default `8` |
| `--width <n>` / `--height <n>` | Frame size in pixels; default `64` |
| `--json` | Emit the structured export report on stdout |
| `--help`, `-h` | Show command help |

Example:

```
toneforge visualize export --recipe weapon-laser-zap --seed 42 \
  --format spritesheet --output ./vfx/
```

The command writes `<recipe>-seed-<n>-<palette>-spritesheet.png` and a
matching `*-spritesheet.json` describing the frame grid
(`frameWidth`, `frameHeight`, `frameCount`, `columns`, `rows`, and each
frame's `x`/`y` offset). With `--format frames` it instead writes one PNG per
frame plus a `*-frames.json` manifest.

## Palettes

A palette is a named set of visual style constraints: a colour range, a
motion intensity, and a particle density. Palettes are semantic and
inspectable; they never introduce hidden randomness.

| Palette | Feel |
|---|---|
| `calm_ui` | Soft blue-grey tones, restrained motion, sparse particles (default) |
| `high_energy_combat` | Hot red/amber tones, aggressive motion, dense particles |
| `mystical_magic` | Violet/cyan tones, sweeping motion |
| `industrial_mechanical` | Steel grey/amber tones, measured motion |
| `sci_fi_neon` | Blue/cyan neon, sharp motion, high contrast |
| `organic_forest` | Green/brown tones, soft motion, low contrast |

Changing the palette changes the generated pixels in a consistent way: colour
range drives the effect colours, motion intensity scales the effect geometry,
and particle density controls how many particles are emitted.

## Effect styles

The recipe's category and tags select an effect family:

| Style | Selected when | Example recipes |
|---|---|---|
| `directional_streak` | weapon / laser / projectile-like | `weapon-laser-zap` |
| `impact_burst` | impact / combat / explosion-like | `impact-crack`, `slam-transient` |
| `radial_pulse` | UI / notification-like, or fallback | `ui-scifi-confirm` |

## Determinism and audio synchronisation

Visual output is deterministic: the same recipe + seed + palette produces
byte-identical assets. Visual intensity for each frame is the root-mean-square
amplitude of the audio slice that maps to that frame, normalised so the
loudest frame is `1`, so a quiet tail fades out and a sharp transient spikes —
effects stay locked to the sound rather than to wall-clock time.

## Programmatic API

```ts
import { exportVisual, resolvePalette, generateEffectFrames } from "./src/visualizer/index.js";

const result = await exportVisual({
  recipe: "weapon-laser-zap",
  seed: 42,
  format: "spritesheet",
  outputDir: "./vfx",
  palette: "sci_fi_neon",
});
```

Lower-level building blocks are exported too: `buildAmplitudeEnvelope`,
`generateEffectFrames`/`styleForRecipe`, `composeSpriteSheet`,
`buildSpriteSheetMetadata`, and `encodePng` (a dependency-free PNG encoder
built on Node's `zlib`).
