---
title: "Recipe Variety: Multiple Sound Types"
id: recipe-variety
order: 20
description: >
  A walkthrough showcasing ToneForge's recipe variety across four game audio
  categories — weapons, footsteps, UI, and ambient — demonstrating that
  the procedural recipe pattern scales beyond a single sound type.
---

## Intro

In the MVP demo you saw one recipe: a sci-fi UI confirm tone.
One recipe proves the concept. Five recipes prove the architecture.

This ToneForge demo ships with recipes across four distinct game audio categories:

1. **UI** — interface confirmations and notification chimes
2. **Weapon** — punchy laser/blaster effects
3. **Footstep** — percussive surface impacts
4. **Ambient** — environmental wind gusts

Every recipe follows the same pattern: pick a recipe, pick a seed,
get deterministic procedural audio. Let's hear them all.

## Act 1 — Discover what's available

> You've installed ToneForge and want to know what sound types you can
> generate. Digging through source code to find recipe names is not
> a great developer experience.

The `list recipes` command shows every registered recipe:

The output includes the recipe name, a short description, and its audio category. This is the discovery interface — you never need to browse source files to find what recipes are available.

```bash
toneforge list recipes
```

> [!commentary]
> Five recipes, listed in registration order. As new recipes are added
> they appear here automatically — no CLI changes required.

## Act 2 — Weapon: Laser Zap

> Your game prototype needs a laser blaster effect. You need something
> short and punchy to wire up to the fire button.

The `weapon-laser-zap` recipe uses FM synthesis and a noise burst
to create sci-fi blaster sounds:

FM synthesis works by using one oscillator (the modulator) to rapidly vary the frequency of another (the carrier). This creates complex, harmonically rich timbres from just two sine waves. The noise burst adds percussive attack. Each seed shifts the carrier frequency, modulation depth, and noise character.

```bash
toneforge generate --recipe weapon-laser-zap --seed 42
```

```bash
toneforge generate --recipe weapon-laser-zap --seed 1337
```

```bash
toneforge generate --recipe weapon-laser-zap --seed 256
```

> [!commentary]
> Three different blaster sounds. The seed changes the carrier pitch,
> modulation depth, and noise burst character — each one feels distinct
> but clearly belongs to the same weapon category.

## Act 3 — Footstep: Stone Surface

> Your character walks on stone corridors. You need quick percussive
> impact sounds that vary with each step so they don't feel robotic.

The `footstep-stone` recipe uses filtered noise with transient shaping
to simulate hard surface impacts:

Unlike tonal recipes that use oscillators, footsteps are built from noise — random audio samples filtered through a bandpass to simulate surface material. The transient shaper creates a sharp initial impact followed by a rapid decay. Each seed varies the filter frequency, resonance, and decay time.

```bash
toneforge generate --recipe footstep-stone --seed 10
```

```bash
toneforge generate --recipe footstep-stone --seed 20
```

```bash
toneforge generate --recipe footstep-stone --seed 30
```

> [!commentary]
> Each seed produces a slightly different impact — varying filter
> brightness, resonance, and decay. Wire them to alternating steps
> and the footfalls sound natural, not looped.

## Act 4 — UI: Notification Chime

> Your app needs a pleasant notification tone — something musical
> and gentle, not a harsh beep.

The `ui-notification-chime` recipe builds a harmonic series with a
gentle envelope:

A harmonic series stacks sine waves at integer multiples of a fundamental frequency — the same physics that make bells and chimes ring musically. The seed controls the fundamental pitch, how many harmonics are included, and the envelope shape. Lower harmonic counts sound pure; higher counts sound richer and more bell-like.

```bash
toneforge generate --recipe ui-notification-chime --seed 42
```

```bash
toneforge generate --recipe ui-notification-chime --seed 88
```

> [!commentary]
> The harmonic count, fundamental pitch, and envelope shape all vary
> with the seed. Find a chime you like and keep its seed as your
> placeholder until final assets arrive.

## Act 5 — Ambient: Wind Gust

> Your outdoor level needs environmental atmosphere. You want wind
> that swells and fades naturally, not a static loop.

The `ambient-wind-gust` recipe uses filtered noise with LFO-modulated
cutoff for organic wind movement:

An LFO (low-frequency oscillator) slowly modulates the filter cutoff over time, creating the characteristic "breathing" quality of wind — swelling and receding naturally. The seed controls the LFO rate, filter bandwidth, and overall duration. Slower LFO rates produce gentle breezes; faster rates produce gusty, turbulent wind.

```bash
toneforge generate --recipe ambient-wind-gust --seed 42
```

```bash
toneforge generate --recipe ambient-wind-gust --seed 500
```

> [!commentary]
> Each wind gust has a different character — filter width, swell speed,
> and LFO rate all shift with the seed. Layer several seeds together
> for a richer ambient soundscape.

## Act 6 — Same architecture, every category

> You want proof that this is not five separate systems bolted together.
> One architecture. One pattern. Any recipe.

The original UI confirm tone still works exactly the same way:

All five recipes share the same two-file architecture: a params module that derives synthesis values from a seed using pure math (no audio dependencies), and a factory module that builds the audio graph. Adding a new recipe means creating these two files and registering the recipe — no changes to the renderer, CLI, or any existing code.

```bash
toneforge generate --recipe ui-scifi-confirm --seed 42
```

> [!commentary]
> All five recipes follow the same two-file pattern: a params module
> with zero audio dependencies and a synthesis factory. Adding a new
> recipe never touches the renderer or CLI — just register and go.

## Recap — What you just saw

1. Five recipes across four game audio categories
2. The `list recipes` command for discovery without reading source code
3. Seed-based variation within every category
4. One consistent architecture — recipes are plug-and-play
5. Deterministic output — same seed always produces the same sound

One recipe was a proof of concept. Five recipes prove the pattern scales.
Next up: WAV export and sample-hybrid recipes.
