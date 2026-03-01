---
title: "Card Game Sounds: Find, Preview, and Select"
id: card-game-sounds
order: 97
description: >
  Discover ToneForge's 34 card game sound recipes, preview them by ear,
  classify and search by attributes, explore seed variations to find the
  best candidates, and promote a curated palette into the Library.
---

## Intro

You are building a card game -- collectible, poker, solitaire, deck-builder,
or memory/matching. The game needs sound for every interaction: flipping cards,
dealing hands, collecting coins, winning rounds, breaking combos. Final audio
is months away, but you need placeholder sounds now so the prototype feels
alive.

ToneForge ships 34 procedural card game recipes covering seven categories of
interaction:

| Category | Recipes | Examples |
|---|---|---|
| Card manipulation | 6 | flip, slide, place, draw, shuffle, fan |
| Game outcomes | 5 | success, failure, victory-fanfare, defeat-sting, round-complete |
| Collection & economy | 6 | coin-collect, coin-spend, chip-stack, token-earn, treasure-reveal |
| Discard & removal | 3 | discard, burn, return-to-deck |
| Card state & effects | 6 | power-up, power-down, lock, unlock, glow, transform |
| Combo & chain | 4 | combo-hit, combo-break, multiplier-up, match |
| Ambient & contextual | 4 | table-ambience, deck-presence, timer-tick, timer-warning |

Every recipe is deterministic: same seed = same sound, byte for byte. In this
walkthrough you will learn to find card game sounds, preview them, search by
attributes, explore seed variations, and build a curated palette for your game.

## Act 1 -- See what is available

> You just installed ToneForge and want to know what card game sounds exist.

List all registered recipes, then filter to card game sounds:

```bash
toneforge list recipes
```

The full list includes every recipe in ToneForge. Filter to just the card
game sounds:

```bash
toneforge list recipes | grep card
```

```
card-burn
card-chip-stack
card-coin-collect
card-coin-collect-hybrid
card-coin-spend
card-combo-break
card-combo-hit
card-deck-presence
card-defeat-sting
card-discard
card-draw
card-failure
card-fan
card-flip
card-glow
card-lock
card-match
card-multiplier-up
card-place
card-power-down
card-power-up
card-return-to-deck
card-round-complete
card-shuffle
card-slide
card-success
card-table-ambience
card-timer-tick
card-timer-warning
card-token-earn
card-transform
card-treasure-reveal
card-unlock
card-victory-fanfare
```

34 recipes. All prefixed with `card-` so they are easy to find.

> [!commentary]
> Every card game recipe follows the `card-<action>` naming convention.
> The naming is designed to be scannable -- you can see at a glance what
> each sound does. The `list recipes` command queries the in-memory
> recipe registry, so it is instant regardless of how many recipes are
> registered.

## Act 2 -- Preview sounds by ear

> You see 34 recipe names but names do not tell you what they sound like.
> You need to hear them.

Preview any recipe by running `generate` without `--output`. ToneForge
renders the sound and plays it through your speakers immediately:

```bash
toneforge generate --recipe card-flip --seed 42
```

Try a few more to hear the range of card interactions:

```bash
toneforge generate --recipe card-shuffle --seed 42
```

```bash
toneforge generate --recipe card-coin-collect --seed 42
```

```bash
toneforge generate --recipe card-victory-fanfare --seed 42
```

```bash
toneforge generate --recipe card-combo-hit --seed 42
```

> [!commentary]
> Each recipe produces a stylized, arcade-aesthetic sound -- bright,
> exaggerated, and immediately recognizable. The card-flip is a quick
> transient burst. The shuffle is a granular flutter of overlapping
> clicks. The coin-collect is a bright ascending chime. The
> victory-fanfare is a multi-note celebratory arpeggio. The combo-hit
> is a sharp positive transient. All from code -- no sample files
> needed (except the optional hybrid coin-collect variant). Omitting
> `--output` plays the sound directly; add `--output <file.wav>` to
> save it to disk instead.

## Act 3 -- Vary the seed, vary the sound

> You like the card-flip sound but need five distinct flip variations for
> different card rarities in your collectible card game. Each should feel
> like a flip, but subtly different.

Change the seed to produce variations of the same recipe:

```bash
toneforge generate --recipe card-flip --seed 1
```

```bash
toneforge generate --recipe card-flip --seed 2
```

```bash
toneforge generate --recipe card-flip --seed 3
```

```bash
toneforge generate --recipe card-flip --seed 4
```

```bash
toneforge generate --recipe card-flip --seed 5
```

> [!commentary]
> Each seed derives a different set of synthesis parameters from the
> recipe's parameter ranges -- filter frequency, envelope attack time,
> noise burst duration, pitch offset. The result is a family of sounds
> that share the flip character but differ in detail. Seeds 1 through 5
> give you five quick candidates. Pick the ones you like and note their
> seed numbers -- those seeds are your sound brief.

## Act 4 -- Inspect a recipe's details

> You want to understand what a recipe does before using it. What
> parameters does it expose? What tags does it carry?

Use the `show` command to inspect a recipe:

```bash
toneforge show card-flip --seed 42
```

Try it on a longer recipe:

```bash
toneforge show card-victory-fanfare --seed 42
```

> [!commentary]
> The `show` command displays a recipe's metadata (name, category, tags,
> duration) and the concrete parameter values derived for the given seed.
> This tells you what the synthesis engine will do: the oscillator
> frequencies, filter cutoffs, envelope shapes, and timing values. When
> you find a seed you like, `show` documents exactly why it sounds the
> way it does. Every parameter is deterministic -- the same seed always
> produces the same values.

## Act 5 -- Classify a sound

> You want to know how ToneForge's classifier describes a card sound --
> what category, intensity, and texture does it assign?

Classify a recipe directly:

```bash
toneforge classify --recipe card-flip --seed 42
```

```
Classification: card-flip_seed-042
  Category:  card-game
  Intensity: medium
  Texture:   sharp
  Material:  (none)
  Tags:      card, flip, card-game, manipulation, arcade
  Ref:       (recipe: card-flip, seed: 42)
```

Compare a few different card sounds to see how classification varies:

```bash
toneforge classify --recipe card-victory-fanfare --seed 42
```

```bash
toneforge classify --recipe card-table-ambience --seed 42
```

```bash
toneforge classify --recipe card-burn --seed 42
```

> [!commentary]
> All card game recipes classify under the `card-game` category -- this
> is determined by the `card` prefix in the recipe name, mapped
> automatically by the classifier. Intensity and texture vary by recipe
> and seed: a flip is medium/sharp, a fanfare might be hard/bright, an
> ambience is soft/warm. Tags come from the recipe's metadata: `card`,
> `flip`, `card-game`, `manipulation`, `arcade`. Classification gives
> you structured, searchable labels for every sound.

## Act 6 -- Search for sounds by attributes

> You are looking for all the positive, rewarding card sounds -- the ones
> that should play when a player does something right.

First, generate, analyze, and classify a batch of card sounds:

```bash
toneforge generate --recipe card-success --seed 1 --output ./output/card-success_seed-001.wav
toneforge generate --recipe card-failure --seed 1 --output ./output/card-failure_seed-001.wav
toneforge generate --recipe card-coin-collect --seed 1 --output ./output/card-coin-collect_seed-001.wav
toneforge generate --recipe card-combo-hit --seed 1 --output ./output/card-combo-hit_seed-001.wav
toneforge generate --recipe card-power-up --seed 1 --output ./output/card-power-up_seed-001.wav
toneforge generate --recipe card-defeat-sting --seed 1 --output ./output/card-defeat-sting_seed-001.wav
toneforge classify --input ./output/ --output ./classification/
```

Search for positive-feedback sounds by tag:

```bash
toneforge classify search --category card-game --dir ./classification/
```

> [!commentary]
> The `classify search` command scans classification JSON files in the
> specified directory and filters by the attributes you specify. All
> card game sounds share the `card-game` category, but you can narrow
> further by intensity or texture. Filters combine with AND logic: add
> `--intensity hard` to find only the loud, punchy positive sounds. The
> search operates on saved classification files, so you classify once
> and search many times.

## Act 7 -- Explore the seed space systematically

> Trying seeds one at a time is slow. You want to sweep a range of seeds
> for card-flip and find the best candidates by metrics -- not by
> listening to all of them.

Sweep 50 seeds, keep the top 5, ranked by spectral centroid (brightness)
and RMS (loudness):

```bash
toneforge explore sweep --recipe card-flip --seed-range 0:49 --keep-top 5 --rank-by rms,spectral-centroid --clusters 3
```

Listen to the top candidate:

```bash
toneforge generate --recipe card-flip --seed 0
```

Listen to one from each cluster to hear the variety:

```bash
toneforge generate --recipe card-flip --seed 10
```

```bash
toneforge generate --recipe card-flip --seed 25
```

> [!commentary]
> The sweep rendered all 50 seeds, analyzed each one, and ranked them by
> a composite score of RMS loudness and spectral centroid (brightness).
> Clustering groups the results by metric similarity -- some flips are
> bright and snappy, others are darker and softer. Instead of listening
> to 50 sounds, you listen to 3-5 top-ranked representatives. The sweep
> is deterministic: the same seed range and metrics always produce the
> same ranking. Run IDs are saved automatically for later recall with
> `explore runs` and `explore show`.

## Act 8 -- Mutate a promising seed

> You found a card-shuffle sound you like at seed 12, but you want to
> hear close variations -- sounds that are similar but not identical.

```bash
toneforge explore mutate --recipe card-shuffle --seed 12 --jitter 0.15 --count 8 --rank-by rms
```

Listen to the top mutation:

```bash
toneforge generate --recipe card-shuffle --seed 12
```

Compare with a mutation candidate from the results:

```bash
toneforge generate --recipe card-shuffle --seed 150
```

> [!commentary]
> Mutation generates deterministic variations around a base seed. A
> jitter of 0.15 keeps mutations close to the original character. The
> mutated seeds are not sequential neighbours of seed 12 -- they are
> deterministic projections into the seed space that produce perceptually
> related but distinct sounds. This is how you refine a sound: find a
> good starting point, then mutate to discover the best version nearby.

## Act 9 -- Build a curated palette

> You are ready to lock in your card game sound palette. You need a flip,
> a draw, a success chime, a coin collect, and a victory fanfare --
> promoted into the Library for permanent storage and easy export.

Run sweeps for each sound you need:

```bash
toneforge explore sweep --recipe card-flip --seed-range 0:49 --keep-top 3 --rank-by rms,spectral-centroid --clusters 2
```

Promote the top flip candidate:

```bash
toneforge explore promote --latest --id card-flip_seed-00000 --category card-game
```

```
Promoted 'card-flip_seed-00000' to library as 'lib-card-flip_seed-00000'
  WAV: card-game/lib-card-flip_seed-00000.wav
  Metadata: card-game/lib-card-flip_seed-00000.json
```

Repeat for each sound in your palette. Sweep, audition, promote:

```bash
toneforge explore sweep --recipe card-draw --seed-range 0:49 --keep-top 3 --rank-by rms,spectral-centroid --clusters 2
toneforge explore promote --latest --id card-draw_seed-00000 --category card-game
```

```bash
toneforge explore sweep --recipe card-success --seed-range 0:49 --keep-top 3 --rank-by rms,spectral-centroid --clusters 2
toneforge explore promote --latest --id card-success_seed-00000 --category card-game
```

```bash
toneforge explore sweep --recipe card-coin-collect --seed-range 0:49 --keep-top 3 --rank-by rms,spectral-centroid --clusters 2
toneforge explore promote --latest --id card-coin-collect_seed-00000 --category card-game
```

```bash
toneforge explore sweep --recipe card-victory-fanfare --seed-range 0:49 --keep-top 3 --rank-by rms,spectral-centroid --clusters 2
toneforge explore promote --latest --id card-victory-fanfare_seed-00000 --category card-game
```

> [!commentary]
> Each sweep finds the best candidates for a given recipe. Promoting
> with `--category card-game` organizes all your card sounds under a
> single Library category for easy browsing and export. The Library
> stores the WAV audio, metadata JSON, analysis metrics, and
> classification labels -- everything you need to manage your sound
> palette. Promotion is idempotent: promoting the same candidate twice
> is a no-op.

## Act 10 -- Browse and search your palette

> You have promoted five sounds into the Library. Now you want to browse
> them and verify the palette.

List all card game entries:

```bash
toneforge library list --category card-game
```

Search for specific attributes within your palette:

```bash
toneforge library search --category card-game --tags arcade
```

Find sounds similar to your promoted flip:

```bash
toneforge library similar --id lib-card-flip_seed-00000 --limit 3
```

> [!commentary]
> The Library is a structured, queryable index. List shows all entries
> at a glance. Search narrows by attributes -- category, intensity,
> texture, or tags. Similar finds entries with the closest metric
> embeddings, useful for discovering alternatives or verifying that your
> palette has enough variety. All Library commands support `--json` for
> scripting and CI integration.

## Act 11 -- Export WAV files for your game engine

> Your palette is ready. Time to export WAV files to your game project's
> asset directory.

Export all card game sounds to a directory:

```bash
toneforge library export --output ./game-assets/audio/card-sfx --format wav --category card-game
```

```
Exported 5 WAV files to ./game-assets/audio/card-sfx
```

> [!commentary]
> Export copies WAV files from the Library to an output directory,
> organized and ready for your game engine. The `--category` flag
> exports only the card game sounds. Without it, every Library entry
> would be exported. The exported files are the same byte-identical
> WAV files stored in the Library -- no re-rendering needed. When you
> update ToneForge or change a recipe, use `library regenerate` to
> re-render from stored presets, then export again.

## Act 12 -- Quick-export without the Library

> You do not need a curated palette yet. You just want WAV files for
> a handful of core card game sounds with a single seed to get started
> fast.

Export the six core card manipulation sounds directly to disk:

```bash
toneforge generate --recipe card-flip --seed 42 --output ./card-sfx/card-flip.wav
toneforge generate --recipe card-slide --seed 42 --output ./card-sfx/card-slide.wav
toneforge generate --recipe card-place --seed 42 --output ./card-sfx/card-place.wav
toneforge generate --recipe card-draw --seed 42 --output ./card-sfx/card-draw.wav
toneforge generate --recipe card-shuffle --seed 42 --output ./card-sfx/card-shuffle.wav
toneforge generate --recipe card-fan --seed 42 --output ./card-sfx/card-fan.wav
```

Add outcome and economy sounds:

```bash
toneforge generate --recipe card-success --seed 42 --output ./card-sfx/card-success.wav
toneforge generate --recipe card-failure --seed 42 --output ./card-sfx/card-failure.wav
toneforge generate --recipe card-victory-fanfare --seed 42 --output ./card-sfx/card-victory-fanfare.wav
toneforge generate --recipe card-coin-collect --seed 42 --output ./card-sfx/card-coin-collect.wav
toneforge generate --recipe card-combo-hit --seed 42 --output ./card-sfx/card-combo-hit.wav
toneforge generate --recipe card-match --seed 42 --output ./card-sfx/card-match.wav
```

> [!commentary]
> Each command renders one recipe at seed 42 and writes a WAV file.
> Every file is deterministic -- run it again and you get byte-identical
> output. This is the fastest path from zero to a working card game
> sound palette: twelve commands, twelve files, a few seconds. Add more
> recipes as your prototype grows, or switch to the sweep-and-promote
> workflow from Act 9 when you want to curate the best seed for each
> sound. The full list of 34 card recipes is always available via
> `toneforge list recipes | grep card`.

## Recap -- What you just learned

1. **Discovery** -- `list recipes | grep card` finds all 34 card game recipes instantly
2. **Preview** -- `generate --recipe <name> --seed <n>` plays a sound immediately; omit `--output` for instant playback
3. **Seed variation** -- change the seed to produce distinct variations of the same recipe
4. **Inspection** -- `show <recipe> --seed <n>` displays metadata and concrete parameter values
5. **Classification** -- `classify --recipe <name> --seed <n>` assigns category, intensity, texture, material, and tags
6. **Search** -- `classify search --category card-game` finds sounds by semantic attributes
7. **Exploration** -- `explore sweep` ranks candidates by metrics across a seed range; `explore mutate` generates close variations
8. **Promotion** -- `explore promote` saves the best candidates to the Library with full metadata
9. **Library browsing** -- `library list`, `library search`, and `library similar` manage your curated palette
10. **Export** -- `library export --category card-game` delivers WAV files to your game engine
11. **Quick export** -- a shell loop with `generate --output` exports all 34 sounds in seconds
12. **Determinism** -- same recipe + same seed = identical audio, every time, on any machine

ToneForge's card game library covers the full sound design surface for card
games -- from the snap of a flip to the fanfare of a victory. Generate
placeholders now. Prototype with real audio feedback. Hand your favourite
seeds to the sound designer as a brief. Drop in final assets when they are
ready.
