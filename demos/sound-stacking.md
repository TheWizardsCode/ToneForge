---
title: "Sound Stacking: Layered Events"
id: sound-stacking
order: 60
description: >
  Compose complex sound events from multiple layered recipes
  with independent timing and gain controls.
---

## Intro

Real-world sounds are rarely one thing. An explosion is a sharp crack,
a low rumble, and scattered debris — happening at slightly different
times, at different volumes. A door slam is a transient impact followed
by woody resonance and a rattling settle.

ToneForge's **sound stacking** lets you compose these complex events
from simple, reusable recipe layers. Each layer references a recipe,
specifies a timing offset and gain, and renders independently with its
own deterministic seed. The results are mixed into a single mono WAV.

Two stack presets ship with ToneForge:

1. **explosion_heavy** — impact crack + rumble body + debris tail
2. **door_slam** — slam transient + resonance body + rattle decay

Let's build some layered sounds.

## Act 1 — Hear the ingredients

> Before stacking, listen to the individual layer recipes on their own.
> These are the building blocks that will be combined into complex events.

The explosion preset uses three recipes. Here's each one solo:

Each recipe is designed to fill a specific frequency range and time window in the final explosion. The impact-crack handles high frequencies and the initial transient. The rumble-body fills the low end with sustained weight. The debris-tail adds mid-to-high frequency scatter that trails off last. Listen to each one individually before hearing them combined.

```bash
toneforge generate --recipe impact-crack --seed 42
```

```bash
toneforge generate --recipe rumble-body --seed 42
```

```bash
toneforge generate --recipe debris-tail --seed 42
```

> [!commentary]
> Each recipe has a distinct role: the impact-crack is a sharp transient,
> rumble-body provides low-frequency weight, and debris-tail adds scattered
> crackle. Individually they're simple building blocks. The magic happens
> when we layer them with precise timing and gain.

## Act 2 — Inspect a preset

> You want to understand what's inside a preset before rendering it.

The `stack inspect` command shows you the layer structure without
rendering any audio:

The output lists each layer's recipe name, its timing offset (when it starts relative to time zero), and its gain level (volume scaling from 0.0 to 1.0). This lets you understand the arrangement before committing to a render — useful for debugging timing or gain issues.

```bash
toneforge stack inspect --preset presets/explosion_heavy.json
```

> [!commentary]
> You can see the three layers, their timing offsets in milliseconds,
> and their gain levels. The impact crack starts at 0ms with full
> gain. The rumble body follows 5ms later at lower gain. The debris
> tail enters 50ms in, quietest of all. This layered timing creates
> the illusion of a single complex event from three simple recipes.

## Act 3 — Render and hear the explosion

> You're building a game with destructible environments. You need an
> explosion sound that's rich and layered — not a single flat noise burst.

Render the explosion preset and hear it immediately:

The renderer processes each layer independently using a deterministic seed derived from the global seed (seed+0 for layer 1, seed+1 for layer 2, seed+2 for layer 3). The resulting audio buffers are mixed with sample-accurate timing offsets and gain scaling, then clamped to the [-1, 1] range to prevent digital clipping.

```bash
toneforge stack render --preset presets/explosion_heavy.json --seed 42
```

> [!commentary]
> Three recipes rendered independently, each with a deterministic seed
> derived from the global seed (seed+0, seed+1, seed+2). The results
> were mixed with sample-accurate timing offsets and gain scaling, then
> clamped to [-1, 1]. One command, three layers of depth. Compare what
> you just heard to the individual ingredients from Act 1 — the layered
> version is far richer.

## Act 4 — Seed variation

> You want several explosion variants so they don't all sound identical
> when multiple barrels explode simultaneously.

Different seeds produce different variations of the same layered event:

```bash
toneforge stack render --preset presets/explosion_heavy.json --seed 100
```

```bash
toneforge stack render --preset presets/explosion_heavy.json --seed 256
```

> [!commentary]
> Same preset, same layer structure, same timing — but each seed
> shifts the synthesis parameters within every layer recipe. The crack
> is sharper or duller, the rumble deeper or brighter, the debris more
> or less scattered. The event's character changes while its structure
> stays consistent. Same seed always produces the same bytes.

You can also save a favourite variation to a file:

```bash
toneforge stack render --preset presets/explosion_heavy.json --seed 100 --output ./output/explosion_v2.wav
```

## Act 5 — The door slam preset

> Your horror game needs door slams — a sharp impact followed by
> resonance and a subtle rattle as the frame settles.

Inspect the door slam preset, then render and hear it:

The door slam uses a different set of layer recipes tuned for an interior impact event. The slam transient provides the sharp initial contact. The resonance body simulates the wood vibrating after impact. The rattle decay adds the settling detail — the latch and frame vibrating as the energy dissipates. Timing offsets are tighter than the explosion because a door slam is a more compact event.

```bash
toneforge stack inspect --preset presets/door_slam.json
```

```bash
toneforge stack render --preset presets/door_slam.json --seed 42
```

```bash
toneforge stack render --preset presets/door_slam.json --seed 99
```

> [!commentary]
> Three layers again, but tuned for a completely different sound event.
> The slam transient is the sharp initial impact. The resonance body
> provides woody sustain. The rattle decay adds the settling detail
> that makes it feel like a real physical object. Timing offsets are
> tighter here — the slam is near-instantaneous, with resonance and
> rattle following within tens of milliseconds.

## Act 6 — Ad-hoc stacking with --layer

> You want to prototype a new layered sound without creating a preset
> file — just combine existing recipes directly on the command line.

The `--layer` flag lets you specify recipes with inline timing and gain:

Each `--layer` flag defines one layer using the `recipe=name,offset=time,gain=value` syntax. Offsets accept `ms` and `s` suffixes (bare numbers default to seconds). This is useful for quick experiments — test different recipe combinations and timing without creating a preset file first.

```bash
toneforge stack render --layer "recipe=impact-crack,offset=0ms,gain=0.9" --layer "recipe=debris-tail,offset=30ms,gain=0.6" --seed 42
```

> [!commentary]
> No preset file needed. Each `--layer` flag defines one layer using
> the `recipe=name,offset=time,gain=value` syntax. Offsets accept
> `ms` and `s` suffixes (bare numbers default to seconds). This is
> useful for quick experiments before committing to a preset. Once you
> find a combination you like, save it as a JSON preset for repeatable
> renders.

## Recap — What you just saw

1. Individual layer recipes can be previewed solo before stacking
2. `stack inspect` previews the layer structure without rendering
3. `stack render` produces a single mixed mono output from all layers
4. Omit `--output` to hear the result immediately; add it to save a file
5. Deterministic seeds derive unique per-layer seeds automatically
6. Different seeds vary the synthesis while preserving layer structure
7. Inline `--layer` syntax enables ad-hoc stacking from the CLI
8. Six purpose-built recipes across two preset categories (explosion, door slam)
9. Output is clamped to [-1, 1] — no clipping, no normalization artifacts

Simple recipes as ingredients. Timing and gain as the arrangement.
That's sound stacking.
