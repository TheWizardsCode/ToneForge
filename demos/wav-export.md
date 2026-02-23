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

## Act 2 — Listen to what you just exported

> You've saved the file, but you want to hear it before dropping it
> into your project. Play the exported WAV back through your system
> audio player.

Use your platform's audio player to listen to the exported file:

```bash
aplay ./output/confirm.wav
```

> [!commentary]
> `aplay` is the standard ALSA player on Linux. On macOS use `afplay`,
> on Windows use `powershell -c "(New-Object Media.SoundPlayer
> './output/confirm.wav').PlaySync()"`. The exported WAV is a standard
> 44.1 kHz 16-bit PCM file — any audio player or editor can open it.

## Act 3 — Write-only mode for build pipelines

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

## Act 4 — Selective export across recipes

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

## Act 5 — From procedural to pre-rendered

> You've been generating the UI confirmation sound procedurally in your
> game — calling ToneForge at runtime with seed 42 every time the player
> hits "confirm." It sounds great, but it's the same sound every time.
> For a consistent effect like that, it's better to save CPU and play
> back from a pre-rendered file. The question is: will the file sound
> exactly the same as what the engine has been generating on the fly?

First, listen to the procedurally generated sound — the same one your
game has been producing at runtime:

```bash
node dist/cli.js generate --recipe ui-scifi-confirm --seed 42
```

Now save that exact sound to disk with the same recipe and seed:

```bash
node dist/cli.js generate --recipe ui-scifi-confirm --seed 42 --output ./output/confirm-prerendered.wav
```

Play back the saved file and compare:

```bash
aplay ./output/confirm-prerendered.wav
```

> [!commentary]
> Identical. The file saved to disk is byte-for-byte the same audio
> that ToneForge generates procedurally at runtime. You can swap from
> runtime generation to file playback without any audible difference —
> just less CPU overhead. Version-control the seed, pre-render during
> your build, and ship the WAV as a static asset.

## Recap — What you just saw

1. The `--output` flag freezes a procedurally generated sound into a WAV file
2. Exported WAV files play back in any system audio player (`aplay`, `afplay`, etc.)
3. Export the sounds you want to pin; keep the rest procedural for variety
4. Write-only mode skips playback — perfect for CI and build pipelines
5. Every recipe supports export with the same workflow
6. Parent directories are created automatically
7. Pre-rendered files are byte-identical to procedural output — swap runtime generation for file playback with zero audible difference
