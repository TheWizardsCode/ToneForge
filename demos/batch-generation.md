---
title: "Batch Generation: Mass-Producing Sound Variations"
id: batch-generation
order: 4
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
node dist/cli.js generate --recipe weapon-laser-zap --seed-range 1:5 --output ./output/lasers/
```

> [!commentary]
> Five files appear in `./output/lasers/`:
> `weapon-laser-zap-seed-1.wav` through `weapon-laser-zap-seed-5.wav`.
> Listen through them, pick your favorites to ship as fixed assets, and
> note the remaining seeds for procedural generation at runtime.
> The naming is deterministic: `<recipe>-seed-<n>.wav`.

## Act 2 — Build a footstep palette

> Your character walks on stone. You need enough variation that the
> footsteps don't sound like a loop, but you also want to pre-approve
> which variations make it into the build rather than leaving it
> entirely to chance at runtime.

Generate a set of footstep impacts to curate from:

```bash
node dist/cli.js generate --recipe footstep-stone --seed-range 10:20 --output ./output/footsteps/
```

> [!commentary]
> Eleven footstep variations (seeds 10 through 20, inclusive). Each one
> has slightly different filter brightness, resonance, and decay. Pick
> the seeds that sound right for your stone surface, ship those as WAV
> assets, and optionally let the engine procedurally fill in additional
> variation at runtime from other seeds.

## Act 3 — Curate a UI chime collection

> Your app needs several notification chimes. You want to pick the
> most pleasant ones from a set of candidates — some to ship as fixed
> assets, others to note as seeds for on-the-fly generation when the
> app wants subtle variety.

Generate a palette of chime variations to choose from:

```bash
node dist/cli.js generate --recipe ui-notification-chime --seed-range 1:10 --output ./output/chimes/
```

> [!commentary]
> Ten notification chimes to audition. Each seed shifts the harmonic
> content, fundamental pitch, and envelope shape. Keep the WAV files
> for your hero sounds; record the seed numbers of runners-up for
> procedural generation when you want variety without storing every file.

## Act 4 — Understanding the naming convention

> You have a directory full of generated files. How do you track which
> seeds produced which files — and which seeds to use for procedural
> generation at runtime?

The naming convention is `<recipe>-seed-<n>.wav`, making every file
traceable back to its recipe and seed:

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
> Ship the WAV. Want more variety? Feed the same seed range to the
> runtime engine, or explore new ranges without storing anything.

## Recap — What you just saw

1. `--seed-range 1:10` generates seeds 1 through 10 (inclusive) as WAV files
2. Batch export lets you audition and curate variations before shipping
3. Pin your favorites as WAV assets; keep other seeds for procedural runtime variety
4. Files are named `<recipe>-seed-<n>.wav` for easy identification and traceability
5. Output directories are created automatically
6. No audio plays during batch generation — pure file output
