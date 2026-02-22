---
title: ToneForge MVP Demo
id: mvp-1
description: >
  An interactive walkthrough that demonstrates how ToneForge accelerates
  development by generating placeholder audio instantly — so teams can
  build and test with sound from day one, without waiting for final assets.
---

## Intro

Every game, app, and interactive experience needs sound effects.
But final audio assets are one of the last things delivered.

During development, teams either:

1. Build features in silence and bolt sounds on later
2. Scrub through generic libraries for 'close enough' temps
3. Wait for the sound designer before they can test anything

The result: integration surprises, wasted iteration cycles,
and features that were never tested with audio feedback.

What if you could generate placeholder sounds from code?
Instantly. Varied. Reproducible. Right from day one.

That is ToneForge — placeholder audio at the speed of development.
Build and test with sound now. Drop in final assets when they're ready.

## Act 1 — Unblock your build on day one

> You're building a sci-fi game UI. You need a confirmation sound to test
> your button flow, but final audio assets are weeks away. Development
> stalls — or proceeds in silence.

ToneForge generates placeholder sounds from recipes in milliseconds.
No assets needed. One command, one sound.

```bash
node dist/cli.js generate --recipe ui-scifi-confirm --seed 42
```

> [!commentary]
> That placeholder was synthesized entirely from code. A sine oscillator
> shaped by a seed-derived envelope. No files to find, no licenses to
> check, no designer to wait for.

## Act 2 — Explore the design space before your sound designer does

> Your prototype has five different confirm actions and each needs to feel
> distinct. Searching asset libraries for five 'close enough' temps is
> slow and none of them quite fit.

Change the seed, change the sound. Same recipe, different number, instant
variation. Try three candidates in seconds:

```bash
node dist/cli.js generate --recipe ui-scifi-confirm --seed 100
```

```bash
node dist/cli.js generate --recipe ui-scifi-confirm --seed 9999
```

```bash
node dist/cli.js generate --recipe ui-scifi-confirm --seed 7
```

> [!commentary]
> Three distinct placeholders. Same recipe. Three different integers.
> Pick your favourites and hand the seeds to your sound designer as a
> brief: 'this is the feel we prototyped with.'

## Act 3 — Reproducible placeholders across your team

> A colleague asks 'what was that sound you used in the prototype?' You
> need to reproduce it exactly — not hunt through a downloads folder or
> re-scrub an asset library.

ToneForge is deterministic. Same recipe + same seed = identical audio,
byte for byte. Share a seed, share a sound:

```bash
node dist/cli.js generate --recipe ui-scifi-confirm --seed 42
```

> [!commentary]
> That is the exact same sound you heard in Act 1. Not similar. Identical.
> Any team member with the seed gets the same placeholder — no file
> sharing needed.

## Act 4 — Determinism you can verify in CI

> Placeholder or not, if your integration tests depend on audio output,
> you need a guarantee that the output never drifts between runs.
> 'Probably the same' is not enough.

ToneForge's test suite renders the same seed 10 times and compares every
sample byte-for-byte. Let's run it:

```bash
npx vitest run src/core/renderer.test.ts
```

> [!commentary]
> 11 tests pass, including the 10-render determinism check. Every one of
> those renders produced the exact same buffer.

## Recap — What you just saw

1. Placeholder audio generated instantly — no waiting for assets
2. Rapid variation — explore the design space with seed changes
3. Reproducible across your team — share a seed, share a sound
4. CI-verifiable determinism — proven by automated tests

This is one recipe. One sound type. The beginning.

Generate placeholders now. Prototype with real audio feedback.
Hand your favourite seeds to the sound designer as a brief.
Drop in final assets when they're ready.
