---
title: "Building a Sound: From Sine Wave to Recipe"
id: sound-creation
order: 60
description: >
  A step-by-step tutorial that builds a character-jump sound effect from
  scratch, explaining oscillators, envelopes, filters, noise, and seeded
  variation along the way. No prior audio knowledge required.
---

## Intro

Every sound you hear in a game -- a jump, a laser, a footstep -- is
built from simple building blocks: oscillators that produce tones,
envelopes that shape volume over time, filters that remove frequencies,
and noise that adds texture.

In this walkthrough we will build a "character jump" sound from
scratch, starting with a single raw tone and iteratively adding layers
until we have a complete, registered ToneForge recipe. By the end you
will understand:

1. What an oscillator is and how it produces sound
2. How envelopes shape a sound's volume over time
3. How pitch sweeps create a sense of motion
4. How noise adds physical texture to synthetic sounds
5. How filters sculpt timbre by removing frequencies
6. How ToneForge's seed system creates infinite variations
7. How to register and test a recipe in the codebase

Let's start with the simplest possible sound.

## Act 1 -- The raw oscillator

> You want to understand what an oscillator is -- the most fundamental
> building block of synthesized sound.

An oscillator produces a repeating waveform. The simplest is a sine
wave: a smooth, pure tone with no harmonics. Its frequency (measured
in Hz) determines the pitch -- 440 Hz is the "A above middle C" that
orchestras tune to. Lower Hz values sound deeper; higher values sound
brighter.

Our first recipe -- `character-jump-step1` -- is the absolute
minimum: a sine oscillator at a seed-derived frequency, playing for a
fixed 0.2 seconds at constant volume. Let's look at the parameters:

```bash
cat src/recipes/character-jump-step1-params.ts
```

The base frequency varies between 300 and 600 Hz depending on the
seed. Let's hear what a raw oscillator sounds like:

```bash
toneforge generate --recipe character-jump-step1 --seed 42
```

```bash
toneforge generate --recipe character-jump-step1 --seed 99
```

> [!commentary]
> That flat, constant tone is a raw oscillator -- no shaping at all.
> It starts abruptly, plays at full volume, and stops abruptly. It
> sounds nothing like a jump yet, but it is the foundation everything
> else builds on. Notice how seed 42 and seed 99 have different
> pitches -- the RNG is already at work, varying the base frequency.

## Act 2 -- Shaping volume with an amplitude envelope

> A raw oscillator plays at constant volume and starts/stops abruptly.
> You need a way to make the sound start quickly and fade out
> naturally -- like a real physical event.

An amplitude envelope controls how loud a sound is over time. The two
most important parameters are:

- **Attack**: how quickly the sound reaches full volume (shorter =
  snappier)
- **Decay**: how quickly the sound fades to silence after the peak

For a jump sound, we want a very fast attack (the moment of launch is
instantaneous) and a short decay (the sound fades as the character
rises). Our second recipe -- `character-jump-step2` -- adds exactly
this: attack/decay envelope shaping on the same sine oscillator.

```bash
grep -E "attack|decay" src/recipes/character-jump-step2-params.ts
```

The attack ranges from 2 to 10 milliseconds -- barely perceptible.
The decay ranges from 50 to 200 milliseconds -- just long enough to
feel like motion. Together, attack + decay define the total duration
of the sound.

Let's hear the difference the envelope makes:

```bash
toneforge generate --recipe character-jump-step2 --seed 42
```

```bash
toneforge generate --recipe character-jump-step2 --seed 1
```

> [!commentary]
> Compare that to Act 1's raw oscillator. Instead of an abrupt start
> and stop, the sound now fades in and out smoothly. The envelope is
> what transforms a continuous oscillator tone into a discrete event
> -- a "blip" instead of a hum. Each seed produces different attack
> and decay times, making some sounds snappier and others more drawn
> out.

## Act 3 -- Adding motion with a pitch sweep

> A constant-pitch tone sounds static. A jump should feel like upward
> motion -- something rising through the air.

A pitch sweep changes the oscillator's frequency over time. For a jump
sound, we sweep upward: the frequency starts at `baseFreq` and rises
to `baseFreq + sweepRange` over `sweepDuration` seconds. This creates
the classic rising "boing" that tells the player their character is
moving upward.

Our third recipe -- `character-jump-step3` -- adds the sweep to the
enveloped oscillator. Let's see the new parameters:

```bash
grep -E "sweepRange|sweepDuration" src/recipes/character-jump-step3-params.ts
```

The sweep range varies from 200 to 800 Hz -- determining how dramatic
the pitch rise is. The sweep duration (50-150ms) controls how fast the
frequency climbs. A wider range with a shorter duration produces a more
exaggerated cartoon-style jump.

```bash
toneforge generate --recipe character-jump-step3 --seed 42
```

```bash
toneforge generate --recipe character-jump-step3 --seed 7
```

> [!commentary]
> Now it sounds like a jump. The pitch sweep is what makes this
> recognizable as upward motion rather than just a beep. Our ears
> associate rising pitch with upward movement -- the same
> psychoacoustic trick used in classic platformer games. Compare
> seeds 42 and 7 to hear how sweep range and duration create
> different characters: some jumps are subtle rises, others are
> dramatic swoops.

## Act 4 -- Noise for physical texture

> The tonal sweep sounds clean but artificial. Real physical actions --
> a shoe leaving the ground, air rushing past -- produce broad-spectrum
> noise, not pure tones.

A noise generator produces random audio samples with energy spread
across all frequencies. White noise contains equal energy at every
frequency -- it sounds like static or rushing air. By mixing a short
burst of white noise with our tonal sweep, we add the physical
"texture" that makes the jump sound grounded in reality.

Our fourth recipe -- `character-jump-step4` -- adds an unfiltered
noise burst. Let's see the noise parameters:

```bash
grep -E "noiseLevel|noiseDecay" src/recipes/character-jump-step4-params.ts
```

The noise level (0.1-0.4) controls the mix between the tonal and noise
components. The noise decay (20-80ms) is shorter than the main decay,
so the noise acts as an initial "pop" of impact that fades quickly
while the tonal sweep continues.

```bash
toneforge generate --recipe character-jump-step4 --seed 42
```

```bash
toneforge generate --recipe character-jump-step4 --seed 500
```

> [!commentary]
> The noise burst adds that crucial sense of physicality. Without it,
> the sound is just a pitch sweep -- a synthesizer effect. With it,
> there is an initial burst of energy (the moment of contact with the
> ground) followed by the tonal rise (the trajectory through the air).
> But notice the noise sounds a bit harsh and hissy -- that raw white
> noise contains all frequencies equally, including piercing highs.
> We will fix that in the next step with a filter.

## Act 5 -- Filtering the noise

> Raw white noise contains all frequencies equally, which can sound
> harsh. A filter removes unwanted frequencies to shape the noise's
> character.

A lowpass filter allows frequencies below its cutoff point to pass
through while attenuating (reducing) frequencies above it. By
applying a lowpass filter to our noise burst, we control whether the
impact sounds bright and crispy (high cutoff) or dull and thuddy
(low cutoff).

The final `character-jump` recipe adds this filter -- the only
difference from step 4. Let's see the filter parameter:

```bash
grep "filterCutoff" src/recipes/character-jump-params.ts
```

The cutoff varies from 1500 to 5000 Hz. At 1500 Hz, the noise sounds
muffled -- like a heavy landing. At 5000 Hz, it sounds bright and
airy -- like a quick hop.

Compare the unfiltered step 4 with the filtered final recipe:

```bash
toneforge generate --recipe character-jump-step4 --seed 42
```

```bash
toneforge generate --recipe character-jump --seed 42
```

```bash
toneforge generate --recipe character-jump --seed 300
```

> [!commentary]
> Listen to the difference between step 4 (unfiltered) and the final
> recipe (filtered) at seed 42. The filter tames the harshness of the
> raw noise, making the impact sound more natural. Filters are one of
> the most powerful tools in sound design -- by changing just the
> cutoff frequency, you can make the same noise burst feel like a
> heavy boot landing or a nimble fairy hop.

## Act 6 -- Seed variation: Infinite jumps from one recipe

> You have built all the components of a jump sound. But a game needs
> dozens of variations so jumps do not sound repetitive.

ToneForge's seeded random number generator (RNG) is a function that
produces a deterministic sequence of numbers from a starting "seed"
value. Same seed, same sequence, same sound -- every time, on any
machine. Different seed, different sequence, different sound.

The `character-jump` recipe derives all 8 parameters from the seed:

```bash
cat src/recipes/character-jump-params.ts
```

Let's generate a batch to hear the variety:

```bash
toneforge generate --recipe character-jump --seed-range 1:5 --output ./output/jump-batch/
```

```bash
for f in ./output/jump-batch/*.wav; do toneforge play "$f"; sleep 0.3; done
```

> [!commentary]
> Five distinct jumps, all from the same recipe. The seed controls
> every parameter simultaneously -- pitch, sweep range, noise level,
> filter cutoff, timing -- so each variation is internally consistent.
> Seed 1 might produce a quick, bright hop while seed 5 produces a
> slower, deeper leap. And because the RNG is deterministic, seed 1
> will always produce that exact same quick, bright hop. This is the
> foundation of ToneForge's design: infinite variation with perfect
> reproducibility.

## Act 7 -- Branching exploration: Comparing design choices

> Before committing to a final recipe design, a sound designer
> explores alternatives. What if the filter were a bandpass instead
> of a lowpass? What if the noise were louder?

ToneForge's recipe architecture makes this kind of exploration easy --
each parameter is independently tunable. Let's compare the same seed
with different recipes to hear how design choices affect the result.

First, our character-jump with its rising pitch sweep and noise burst:

```bash
toneforge generate --recipe character-jump --seed 42
```

Now compare it with the `ui-scifi-confirm` recipe -- a simpler design
with just a sine oscillator and lowpass filter, no noise, no sweep:

```bash
toneforge generate --recipe ui-scifi-confirm --seed 42
```

And the `weapon-laser-zap` -- FM synthesis with a noise burst, similar
building blocks but very different parameters:

```bash
toneforge generate --recipe weapon-laser-zap --seed 42
```

> [!commentary]
> All three recipes use the same fundamental building blocks --
> oscillators, envelopes, filters, noise -- but combine them
> differently. The character-jump uses a rising pitch sweep; the
> ui-scifi-confirm uses a static frequency; the weapon-laser-zap uses
> FM synthesis where one oscillator modulates another's frequency.
> Sound design is about choosing which building blocks to combine and
> how to parameterize them. The recipe architecture makes each choice
> explicit and reproducible.

## Act 8 -- The recipe files: Anatomy of a ToneForge recipe

> You want to see how the character-jump recipe is organized in the
> codebase, so you can follow the same pattern for your own recipes.

Every ToneForge recipe follows a three-file pattern. First, the
parameters file -- pure math, no audio dependencies:

```bash
cat src/recipes/character-jump-params.ts
```

Next, the Tone.js factory that builds the audio graph for browser
playback:

```bash
cat src/recipes/character-jump.ts
```

Finally, the recipe metadata registered in the central index, which
includes the offline rendering graph (Web Audio API, no Tone.js
dependency) used by the CLI:

```bash
grep -A5 "character-jump" src/recipes/index.ts | head -20
```

Let's use the `tf show` command to inspect the registered metadata:

```bash
toneforge show character-jump
```

> [!commentary]
> The three-file pattern separates concerns cleanly: parameters are
> pure functions (testable, no dependencies), the Tone.js factory is
> for browser use, and the offline graph builder is for CLI rendering.
> The metadata -- description, category, tags, signal chain, parameter
> descriptors -- makes every recipe self-documenting. When you run
> `tf show`, you see exactly what the recipe does without reading
> source code.

## Act 9 -- Testing: Proving determinism and correctness

> A sound effect recipe must be deterministic -- the same seed must
> produce the same audio bytes every time. How do you verify that?

ToneForge provides a shared test helper called `describeRecipe()` that
runs a standard battery of tests on any recipe. Let's look at the
character-jump test file:

```bash
cat src/recipes/character-jump.test.ts
```

That single `describeRecipe()` call runs 15 automated tests:

1. **Parameter variation** -- 5 seeds produce at least 3 varying params
2. **Determinism** -- same seed produces identical params
3. **Range bounds** -- 50 seeds all within declared min/max
4. **Registry integration** -- recipe is registered with offline support
5. **Renderer determinism** -- seed 42 rendered 10 times, byte-identical
6. **Seed variation** -- seeds 1 and 2 produce different audio
7. **Non-silence** -- rendered audio contains non-zero samples

Let's run them:

```bash
npx vitest run src/recipes/character-jump.test.ts
```

> [!commentary]
> All 15 tests pass. The most important is renderer determinism: the
> same seed rendered ten times produces byte-identical output. This is
> what makes ToneForge sounds reproducible across machines and over
> time. If you change the recipe's parameter derivation order or audio
> graph structure, the determinism test will catch it immediately. This
> is why every recipe follows the same RNG consumption pattern -- one
> call to `getParams()` at the start, consuming RNG values in a fixed
> order.

## Recap -- What you just built

1. **Oscillator** -- a sine wave producing a pure tone at a seed-derived frequency
2. **Amplitude envelope** -- attack and decay shaping the tone into a short event
3. **Pitch sweep** -- rising frequency creating a sense of upward motion
4. **Noise burst** -- white noise adding physical impact texture
5. **Lowpass filter** -- shaping the noise from bright to muffled
6. **Seed variation** -- 8 parameters derived from a single seed for infinite reproducible variation
7. **Three-file pattern** -- params, factory, and tests following the codebase convention
8. **Determinism testing** -- 15 automated tests proving byte-identical reproduction

From a single sine wave to a registered, tested recipe in 8 steps.
Every ToneForge recipe is built from these same primitives -- the only
difference is which building blocks you choose and how you wire them
together.
