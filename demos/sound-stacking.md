---
title: "Sound Stacking: Layered Events"
id: sound-stacking
order: 40
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

## Act 1 — Inspect a preset

> You've heard about presets but want to understand what's inside one
> before rendering anything.

The `stack inspect` command shows you the layer structure of a preset
without rendering any audio:

```bash
toneforge stack inspect --preset presets/explosion_heavy.json
```

> [!commentary]
> You can see the three layers, their timing offsets in milliseconds,
> and their gain levels. The impact crack starts at 0ms with full
> gain. The rumble body follows 5ms later at lower gain. The debris
> tail enters 50ms in, quietest of all. This layered timing creates
> the illusion of a single complex event from three simple recipes.

## Act 2 — Render the explosion

> You're building a game with destructible environments. You need an
> explosion sound that's rich and layered — not a single flat noise burst.

Render the explosion preset with a seed:

```bash
toneforge stack render --preset presets/explosion_heavy.json --seed 42 --output ./output/explosion.wav
```

> [!commentary]
> Three recipes rendered independently, each with a deterministic seed
> derived from the global seed (seed+0, seed+1, seed+2). The results
> were mixed with sample-accurate timing offsets and gain scaling, then
> clamped to [-1, 1]. One command, one WAV, three layers of depth.

## Act 3 — Seed variation

> You want several explosion variants so they don't all sound identical
> when multiple barrels explode simultaneously.

Different seeds produce different variations of the same layered event:

```bash
toneforge stack render --preset presets/explosion_heavy.json --seed 100 --output ./output/explosion_v2.wav
```

```bash
toneforge stack render --preset presets/explosion_heavy.json --seed 256 --output ./output/explosion_v3.wav
```

> [!commentary]
> Same preset, same layer structure, same timing — but each seed
> shifts the synthesis parameters within every layer recipe. The crack
> is sharper or duller, the rumble deeper or brighter, the debris more
> or less scattered. The event's character changes while its structure
> stays consistent. Same seed always produces the same bytes.

## Act 4 — The door slam preset

> Your horror game needs door slams — a sharp impact followed by
> resonance and a subtle rattle as the frame settles.

Inspect the door slam preset, then render it:

```bash
toneforge stack inspect --preset presets/door_slam.json
```

```bash
toneforge stack render --preset presets/door_slam.json --seed 42 --output ./output/door_slam.wav
```

```bash
toneforge stack render --preset presets/door_slam.json --seed 99 --output ./output/door_slam_v2.wav
```

> [!commentary]
> Three layers again, but tuned for a completely different sound event.
> The slam transient is the sharp initial impact. The resonance body
> provides woody sustain. The rattle decay adds the settling detail
> that makes it feel like a real physical object. Timing offsets are
> tighter here — the slam is near-instantaneous, with resonance and
> rattle following within tens of milliseconds.

## Act 5 — Ad-hoc stacking with --layer

> You want to prototype a new layered sound without creating a preset
> file — just combine existing recipes directly on the command line.

The `--layer` flag lets you specify recipes with inline timing and gain:

```bash
toneforge stack render --layer "recipe=impact-crack,offset=0ms,gain=0.9" --layer "recipe=debris-tail,offset=30ms,gain=0.6" --seed 42 --output ./output/custom_stack.wav
```

> [!commentary]
> No preset file needed. Each `--layer` flag defines one layer using
> the `recipe=name,offset=time,gain=value` syntax. Offsets accept
> `ms` and `s` suffixes (bare numbers default to seconds). This is
> useful for quick experiments before committing to a preset. Once you
> find a combination you like, save it as a JSON preset for repeatable
> renders.

## Recap — What you just saw

1. Stack presets define layers with recipe names, timing offsets, and gain
2. `stack inspect` previews the layer structure without rendering
3. `stack render` produces a single mixed mono WAV from all layers
4. Deterministic seeds derive unique per-layer seeds automatically
5. Different seeds vary the synthesis while preserving layer structure
6. Inline `--layer` syntax enables ad-hoc stacking from the CLI
7. Six purpose-built recipes across two preset categories (explosion, door slam)
8. Output is clamped to [-1, 1] — no clipping, no normalization artifacts

Simple recipes as ingredients. Timing and gain as the arrangement.
That's sound stacking.
