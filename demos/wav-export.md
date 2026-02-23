---
title: "WAV Export: Saving Sounds to Disk"
id: wav-export
description: >
  A walkthrough demonstrating ToneForge's WAV export feature, showing how
  to save generated sounds to disk using the --output flag for use in
  DAWs, game engines, and build pipelines.
---

## Intro

ToneForge generates procedural sounds on the fly. But listening is only
half the story. To use these sounds in a game engine, a DAW, or a CI
pipeline, you need files on disk.

The `--output` flag turns ToneForge from a listen-only tool into a
production asset generator. One flag, one WAV file, no audio playback.

## Act 1 — Export a single sound

> You've found a UI confirmation tone you like with seed 42. Now you
> need the actual WAV file to drop into your project.

The `--output` flag writes the rendered audio to a file instead of
playing it through speakers:

```bash
node dist/cli.js generate --recipe ui-scifi-confirm --seed 42 --output ./output/confirm.wav
```

> [!commentary]
> One line of output: `Wrote ./output/confirm.wav`. No audio played.
> The file is a standard 44.1 kHz, 16-bit PCM mono WAV that opens in
> any audio editor or game engine.

## Act 2 — Write-only mode

> You're running ToneForge in a CI pipeline or headless server. You
> need to export audio without any playback at all.

When `--output` is specified, ToneForge skips the audio player entirely.
No speaker detection, no playback dependencies, no sound:

```bash
node dist/cli.js generate --recipe weapon-laser-zap --seed 1337 --output ./output/laser.wav
```

> [!commentary]
> Write-only mode means ToneForge works in headless environments —
> Docker containers, CI runners, SSH sessions — anywhere you can run
> Node.js but don't have audio hardware.

## Act 3 — Different recipes, same workflow

> Your project needs sounds from multiple categories. The export
> workflow should be the same for every recipe.

Every recipe supports `--output` identically:

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
> Three recipes, three WAV files. The `--output` flag works with any
> registered recipe — no special configuration needed. Parent directories
> are created automatically if they don't exist.

## Act 4 — Deterministic output

> You need to regenerate the exact same sound later — maybe in a
> different environment or after a code change. Can you trust the output?

The same recipe and seed always produce a byte-identical WAV file:

```bash
node dist/cli.js generate --recipe ui-scifi-confirm --seed 42 --output ./output/confirm-again.wav
```

> [!commentary]
> Compare `confirm.wav` and `confirm-again.wav` — they are byte-for-byte
> identical. This determinism guarantee means you can version-control
> seeds instead of audio files, and regenerate assets at any time.

## Recap — What you just saw

1. The `--output` flag saves generated audio as a WAV file
2. Write-only mode skips playback — perfect for CI and headless environments
3. Every recipe supports export with the same workflow
4. Parent directories are created automatically
5. Same seed always produces the same file — deterministic and reproducible
