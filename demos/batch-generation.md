---
title: "Batch Generation: Mass-Producing Sound Variations"
id: batch-generation
order: 40
description: >
  A walkthrough demonstrating ToneForge's batch generation feature, showing
  how to use --seed-range to pre-render a curated palette of sound
  variations to disk while keeping the flexibility to procedurally vary
  other sounds at runtime.
---

## Intro

Procedural generation gives you infinite variety. But sometimes you want
to audition that variety, pick favorites, and lock them down — while
still letting other sounds vary freely at runtime.

ToneForge's `--seed-range` flag bridges both worlds: generate a batch of
WAV files in a single command, audition them, keep the ones you like as
pinned assets, and leave the rest of your sound palette procedural.
Pick a recipe, pick a range, and build a curated library without giving
up runtime variety.

## Act 1 — Audition laser variations

> Your game has a laser weapon. One fixed sound feels repetitive, but
> pure procedural generation means you can't preview what players will
> hear. You want to audition a handful of variations, pick the best
> ones to ship as WAV assets, and let the engine procedurally vary
> the rest during gameplay.

The `--seed-range` flag generates one WAV file per seed — a set of
candidates to listen through:

```bash
toneforge generate --recipe weapon-laser-zap --seed-range 1:5 --output ./output/lasers/
```

> [!commentary]
> Five files appear in `./output/lasers/`:
> `weapon-laser-zap-seed-1.wav` through `weapon-laser-zap-seed-5.wav`.
> The naming is deterministic: `<recipe>-seed-<n>.wav`.

## Act 2 — Listen to the laser candidates

> You've generated five laser variations. Now play them back-to-back
> so you can hear the differences and pick favorites.

Audition each file with `toneforge play`:

```bash
toneforge play ./output/lasers/weapon-laser-zap-seed-1.wav
```

```bash
toneforge play ./output/lasers/weapon-laser-zap-seed-2.wav
```

```bash
toneforge play ./output/lasers/weapon-laser-zap-seed-3.wav
```

```bash
toneforge play ./output/lasers/weapon-laser-zap-seed-4.wav
```

```bash
toneforge play ./output/lasers/weapon-laser-zap-seed-5.wav
```

> [!commentary]
> Each seed produces a distinct laser character — some snappy, some
> drawn-out, some bright, some hollow. Pick the seeds you like, ship
> those WAV files, and note the rest for procedural generation at runtime.

## Act 3 — Build a footstep palette

> Your character walks on stone. You need enough variation that the
> footsteps don't sound like a loop, but you also want to pre-approve
> which variations make it into the build rather than leaving it
> entirely to chance at runtime.

Generate a set of footstep impacts to curate from:

```bash
toneforge generate --recipe footstep-stone --seed-range 10:20 --output ./output/footsteps/
```

> [!commentary]
> Eleven footstep variations (seeds 10 through 20, inclusive). Each one
> has slightly different filter brightness, resonance, and decay.

## Act 4 — Listen to the footstep candidates

> Eleven footstep files are sitting in `./output/footsteps/`. Play
> through them to find the set that feels right for your stone surface.

Audition each footstep variation:

```bash
toneforge play ./output/footsteps/footstep-stone-seed-10.wav
```

```bash
toneforge play ./output/footsteps/footstep-stone-seed-11.wav
```

```bash
toneforge play ./output/footsteps/footstep-stone-seed-12.wav
```

```bash
toneforge play ./output/footsteps/footstep-stone-seed-13.wav
```

```bash
toneforge play ./output/footsteps/footstep-stone-seed-14.wav
```

```bash
toneforge play ./output/footsteps/footstep-stone-seed-15.wav
```

```bash
toneforge play ./output/footsteps/footstep-stone-seed-16.wav
```

```bash
toneforge play ./output/footsteps/footstep-stone-seed-17.wav
```

```bash
toneforge play ./output/footsteps/footstep-stone-seed-18.wav
```

```bash
toneforge play ./output/footsteps/footstep-stone-seed-19.wav
```

```bash
toneforge play ./output/footsteps/footstep-stone-seed-20.wav
```

> [!commentary]
> Pick the seeds that sound right for your stone surface, ship those as WAV
> assets, and optionally let the engine procedurally fill in additional
> variation at runtime from other seeds.

## Act 5 — Curate a UI chime collection

> Your app needs several notification chimes. You want to pick the
> most pleasant ones from a set of candidates — some to ship as fixed
> assets, others to note as seeds for on-the-fly generation when the
> app wants subtle variety.

Generate a palette of chime variations to choose from:

```bash
toneforge generate --recipe ui-notification-chime --seed-range 1:10 --output ./output/chimes/
```

> [!commentary]
> Ten notification chimes generated. Each seed shifts the harmonic
> content, fundamental pitch, and envelope shape.

## Act 6 — Listen to the chime candidates

> Ten chime files are ready in `./output/chimes/`. Play through
> them to find your hero sounds and runners-up.

Audition each chime variation:

```bash
toneforge play ./output/chimes/ui-notification-chime-seed-1.wav
```

```bash
toneforge play ./output/chimes/ui-notification-chime-seed-2.wav
```

```bash
toneforge play ./output/chimes/ui-notification-chime-seed-3.wav
```

```bash
toneforge play ./output/chimes/ui-notification-chime-seed-4.wav
```

```bash
toneforge play ./output/chimes/ui-notification-chime-seed-5.wav
```

```bash
toneforge play ./output/chimes/ui-notification-chime-seed-6.wav
```

```bash
toneforge play ./output/chimes/ui-notification-chime-seed-7.wav
```

```bash
toneforge play ./output/chimes/ui-notification-chime-seed-8.wav
```

```bash
toneforge play ./output/chimes/ui-notification-chime-seed-9.wav
```

```bash
toneforge play ./output/chimes/ui-notification-chime-seed-10.wav
```

> [!commentary]
> Keep the WAV files for your hero sounds; record the seed numbers of
> runners-up for procedural generation when you want variety without
> storing every file.

## Act 7 — Understanding the naming convention

> You have a directory full of generated files. How do you track which
> seeds produced which files — and which seeds to use for procedural
> generation at runtime?

The naming convention is `<recipe>-seed-<n>.wav`, making every file
traceable back to its recipe and seed:

```bash
toneforge generate --recipe ambient-wind-gust --seed-range 100:102 --output ./output/wind/
```

> [!commentary]
> The directory contains:
> - `ambient-wind-gust-seed-100.wav`
> - `ambient-wind-gust-seed-101.wav`
> - `ambient-wind-gust-seed-102.wav`

## Act 8 — Listen to the wind gusts

> Three wind gust files in `./output/wind/`. A quick listen confirms
> the naming convention maps cleanly to what you hear.

Play through the wind variations:

```bash
toneforge play ./output/wind/ambient-wind-gust-seed-100.wav
```

```bash
toneforge play ./output/wind/ambient-wind-gust-seed-101.wav
```

```bash
toneforge play ./output/wind/ambient-wind-gust-seed-102.wav
```

> [!commentary]
> The seed number is right in the filename. Found a sound you like?
> Ship the WAV. Want more variety? Feed the same seed range to the
> runtime engine, or explore new ranges without storing anything.

## Recap — What you just saw

1. `--seed-range 1:10` generates seeds 1 through 10 (inclusive) as WAV files
2. Batch export lets you audition and curate variations before shipping
3. `toneforge play` lets you listen to each candidate back-to-back
4. Pin your favorites as WAV assets; keep other seeds for procedural runtime variety
5. Files are named `<recipe>-seed-<n>.wav` for easy identification and traceability
6. Output directories are created automatically
