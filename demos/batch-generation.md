---
title: "Batch Generation: Mass-Producing Sound Variations"
id: batch-generation
description: >
  A walkthrough demonstrating ToneForge's batch generation feature, showing
  how to use --seed-range to generate multiple sound variations in one
  command for auditioning and asset pipelines.
---

## Intro

One sound is useful. Ten variations are powerful. A hundred are a library.

ToneForge's `--seed-range` flag generates multiple WAV files in a single
command — one per seed in an inclusive range. Pick a recipe, pick a range,
and get a directory of variations to audition, compare, and ship.

## Act 1 — Generate a batch of laser sounds

> Your game has a laser weapon. One sound feels repetitive — you want
> 5 variations to rotate through during gameplay.

The `--seed-range` flag generates one WAV file per seed:

```bash
node dist/cli.js generate --recipe weapon-laser-zap --seed-range 1:5 --output ./output/lasers/
```

> [!commentary]
> Five files appear in `./output/lasers/`:
> `weapon-laser-zap-seed-1.wav` through `weapon-laser-zap-seed-5.wav`.
> Each one is a distinct laser sound, all from the same recipe family.
> The naming is deterministic: `<recipe>-seed-<n>.wav`.

## Act 2 — Audition footstep variations

> Your character walks on stone. You need enough variation so the
> footsteps don't sound like a loop.

Generate a set of footstep impacts to rotate through:

```bash
node dist/cli.js generate --recipe footstep-stone --seed-range 10:20 --output ./output/footsteps/
```

> [!commentary]
> Eleven footstep variations (seeds 10 through 20, inclusive). Each one
> has slightly different filter brightness, resonance, and decay —
> enough variety to avoid the robotic repetition of a single sample.

## Act 3 — UI chime palette

> Your app needs several notification chimes. You want to pick the
> most pleasant one from a set of options.

Generate a palette of chime variations:

```bash
node dist/cli.js generate --recipe ui-notification-chime --seed-range 1:10 --output ./output/chimes/
```

> [!commentary]
> Ten notification chimes to audition. Each seed shifts the harmonic
> content, fundamental pitch, and envelope shape. Listen through them
> all and keep the seed number of your favorite.

## Act 4 — Understanding the naming convention

> You have a directory full of generated files. How do you know which
> seed produced which file?

The naming convention is `<recipe>-seed-<n>.wav`:

```bash
node dist/cli.js generate --recipe ambient-wind-gust --seed-range 100:102 --output ./output/wind/
```

> [!commentary]
> The directory contains:
> - `ambient-wind-gust-seed-100.wav`
> - `ambient-wind-gust-seed-101.wav`
> - `ambient-wind-gust-seed-102.wav`
>
> The seed number is right in the filename. Found a sound you like?
> Note the seed and regenerate it anytime with the same recipe and seed.

## Recap — What you just saw

1. `--seed-range 1:10` generates seeds 1 through 10 (inclusive)
2. Each seed produces a unique variation of the same recipe
3. Files are named `<recipe>-seed-<n>.wav` for easy identification
4. Output directories are created automatically
5. No audio plays during batch generation — pure file output
6. Combine with any recipe for instant sound palettes
