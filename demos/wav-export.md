---
title: "WAV Export: Saving Sounds to Disk"
id: wav-export
description: >
  A walkthrough demonstrating ToneForge's WAV export feature, showing how
  to selectively save generated sounds to disk using the --output flag
  while keeping the option to procedurally vary other sounds at runtime.
---

## Intro

ToneForge generates procedural sounds on the fly — every seed yields a
unique variation, and no two runs need to sound the same. But real-world
projects rarely live at one extreme. Sometimes you need the option to
store some files on disk while procedurally varying other sounds at
runtime: a pinned UI confirmation tone shipped as a WAV asset alongside
footsteps that are generated fresh each session.

The `--output` flag gives you that choice. When you find a sound worth
keeping, freeze it to a WAV file. When you want variety, keep generating
procedurally. One tool, both workflows.

## Act 1 — Pin a sound you like

> You've been auditioning UI confirmation tones and seed 42 is the one.
> You want to pin that exact sound as a WAV asset in your project while
> other UI sounds keep varying procedurally.

The `--output` flag renders the audio to a file instead of playing it
through speakers — freezing that seed into a reusable asset:

```bash
node dist/cli.js generate --recipe ui-scifi-confirm --seed 42 --output ./output/confirm.wav
```

> [!commentary]
> One line of output: `Wrote ./output/confirm.wav`. No audio played.
> The file is a standard 44.1 kHz, 16-bit PCM mono WAV that opens in
> any audio editor or game engine. Meanwhile, your other UI sounds can
> still be generated procedurally at runtime with different seeds.

## Act 2 — Write-only mode for build pipelines

> Your build pipeline pre-renders key sounds to WAV during CI while the
> game engine generates ambient variations procedurally at runtime. You
> need the export step to run headlessly — no speakers, no audio hardware.

When `--output` is specified, ToneForge skips the audio player entirely.
No speaker detection, no playback dependencies, no sound:

```bash
node dist/cli.js generate --recipe weapon-laser-zap --seed 1337 --output ./output/laser.wav
```

> [!commentary]
> Write-only mode means ToneForge works in headless environments —
> Docker containers, CI runners, SSH sessions. Pre-render your hero
> sounds during build, and let the runtime procedurally generate
> the rest on demand.

## Act 3 — Selective export across recipes

> Your project uses five recipes. Some sounds are signature assets you
> want locked down as WAV files; others stay procedural for variety.
> The export workflow should be the same for every recipe you choose
> to freeze.

Every recipe supports `--output` identically — export only the sounds
you want to pin:

```bash
node dist/cli.js generate --recipe footstep-stone --seed 10 --output ./output/footstep.wav
```

```bash
node dist/cli.js generate --recipe ui-notification-chime --seed 88 --output ./output/chime.wav
```

```bash
node dist/cli.js generate --recipe ambient-wind-gust --seed 500 --output ./output/wind.wav
```

> [!commentary]
> Three recipes, three pinned WAV files. The rest of your sound palette
> can still be generated procedurally at runtime with varying seeds.
> Parent directories are created automatically if they don't exist.

## Act 4 — Deterministic re-export

> You exported a confirmation tone last month. Now you need to
> regenerate the exact same file in a different environment. Can you
> trust the output to match?

The same recipe and seed always produce a byte-identical WAV file:

```bash
node dist/cli.js generate --recipe ui-scifi-confirm --seed 42 --output ./output/confirm-again.wav
```

> [!commentary]
> Compare `confirm.wav` and `confirm-again.wav` — they are byte-for-byte
> identical. This determinism guarantee is what makes the hybrid workflow
> practical: version-control seeds instead of audio files, and re-export
> pinned assets at any time while procedurally varying everything else.

## Recap — What you just saw

1. The `--output` flag freezes a procedurally generated sound into a WAV file
2. Export the sounds you want to pin; keep the rest procedural for variety
3. Write-only mode skips playback — perfect for CI and build pipelines
4. Every recipe supports export with the same workflow
5. Parent directories are created automatically
6. Same seed always produces the same file — re-export anywhere, anytime
