---
title: "Sample-Hybrid Recipes: Real Audio Meets Procedural Synthesis"
id: sample-hybrid
order: 50
description: >
  A walkthrough demonstrating ToneForge's sample-hybrid recipes, which layer
  CC0 audio samples with procedurally varied synthesis to produce sounds that
  are both authentic and infinitely variable.
---

## Intro

Pure procedural synthesis gives you infinite variation, but some sounds
need the texture of real audio to feel convincing. Footsteps on gravel,
creature growls, engine rumbles — these benefit from the character that
only a real recording can provide.

ToneForge's sample-hybrid recipes solve this by layering a fixed CC0
audio sample with seed-controlled procedural synthesis. The sample
plays identically every render, providing authentic texture. The
procedural layer — filters, oscillators, envelopes — varies with each
seed, ensuring no two outputs sound the same.

Three hybrid recipes ship with ToneForge:

1. **Footstep-Gravel** — impact transient + filtered noise
2. **Creature-Vocal** — growl sample + FM synthesis
3. **Vehicle-Engine** — looping engine sample + sawtooth oscillator

Let's hear them.

## Act 1 — Footstep-Gravel: Authentic crunch

> Your character walks on a gravel path. You need footstep impacts
> that sound real — not just filtered noise — but each step should
> be slightly different so they don't feel repetitive.

First, listen to the raw CC0 impact transient on its own — this is
the sample ingredient before any synthesis is layered on:

```bash
toneforge play assets/samples/footstep-gravel/impact.wav
```

Now hear what the `footstep-gravel` recipe does with it — the same
transient layered with procedurally varied noise tails:

```bash
toneforge generate --recipe footstep-gravel --seed 42
```

```bash
toneforge generate --recipe footstep-gravel --seed 100
```

```bash
toneforge generate --recipe footstep-gravel --seed 256
```

> [!commentary]
> The impact transient you heard first is the same real audio sample
> in every generated output — that's what gives it texture. But the
> filter frequency, decay times, and noise mix shift with each seed,
> so every footstep has unique character. Compare these to the purely
> procedural `footstep-stone` recipe to hear the difference a real
> sample makes.

## Act 2 — Creature-Vocal: Organic monsters

> Your game has creatures that need to growl, snarl, and roar. You
> want something organic — not a synthesizer beep — but you need
> dozens of variants for different creature types.

First, the raw CC0 growl sample — this is the organic texture that
anchors every creature variant:

```bash
toneforge play assets/samples/creature-vocal/growl.wav
```

Now hear the `creature-vocal` recipe layer it with FM synthesis and
formant-style bandpass filtering:

```bash
toneforge generate --recipe creature-vocal --seed 42
```

```bash
toneforge generate --recipe creature-vocal --seed 200
```

```bash
toneforge generate --recipe creature-vocal --seed 777
```

> [!commentary]
> The growl you heard first is the same in every output. FM synthesis
> adds harmonic richness that varies with carrier frequency and
> modulation index. The bandpass filter shapes formant-like resonances.
> Each seed produces a creature that sounds related but distinct — a
> whole bestiary from one sample and one recipe.

## Act 3 — Vehicle-Engine: Mechanical rumble

> Your racing game needs engine sounds for different vehicles. You
> want that unmistakable mechanical texture of a real engine, but
> each car should sound different.

First, the raw CC0 engine loop — the mechanical foundation that
every engine variant builds on:

```bash
toneforge play assets/samples/vehicle-engine/loop.wav
```

Now hear the `vehicle-engine` recipe layer it with a sawtooth
oscillator and LFO-modulated lowpass filter:

```bash
toneforge generate --recipe vehicle-engine --seed 42
```

```bash
toneforge generate --recipe vehicle-engine --seed 500
```

```bash
toneforge generate --recipe vehicle-engine --seed 1000
```

> [!commentary]
> The engine loop you heard first is the same in every output,
> providing mechanical texture. The sawtooth oscillator reinforces
> the fundamental at different frequencies per seed. The LFO
> modulates the lowpass filter cutoff, creating RPM-like tonal
> fluctuations. Different seeds produce different engine characters —
> from deep rumble to higher-pitched whine.

## Act 4 — Batch export: Build a sample library

> You want to pre-render a palette of hybrid sounds to disk so your
> sound designer can audition and curate them.

Hybrid recipes work with `--output` and `--seed-range` just like
procedural recipes:

```bash
toneforge generate --recipe footstep-gravel --seed-range 1 5 --output ./gravel-steps/
```

```bash
toneforge generate --recipe creature-vocal --seed-range 1 3 --output ./creatures/
```

> [!commentary]
> Five gravel footsteps and three creature variants, all deterministic
> WAV files. The sound designer can pick favorites by seed number,
> and those exact sounds can be reproduced anywhere — same seed,
> same bytes, every time.

## Act 5 — How it works

> You want to understand what makes hybrid recipes different from
> purely procedural ones, without reading source code.

The `list recipes` command shows all registered recipes including hybrids:

```bash
toneforge list recipes
```

> [!commentary]
> Eight recipes now — five procedural, three hybrid. They all follow
> the same architecture: a params module for seed-derived values and
> a synthesis factory for audio construction. The only difference is
> that hybrid recipes load a sample file during graph construction.
> Same CLI. Same API. Same determinism guarantees.

## Recap — What you just saw

1. Three sample-hybrid recipes across three game audio categories
2. Real CC0 audio samples providing authentic texture
3. Procedural synthesis varying with each seed for infinite variation
4. The sample is fixed; only synthesis parameters change — guaranteeing determinism
5. Full compatibility with batch export (`--output`, `--seed-range`)
6. Same two-file recipe architecture as purely procedural recipes
7. Total sample budget: 73 KB for all three recipes combined

Samples as ingredients, synthesis as the recipe. That's the hybrid approach.
