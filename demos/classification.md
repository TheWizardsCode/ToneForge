---
title: "Classification: Semantic Labels for Sounds"
id: classification
order: 75
description: >
  Assign structured semantic labels to analyzed sounds -- category, intensity,
  texture, material, and tags -- using rule-based classification. Classify from
  analysis files, WAV files, or recipe+seed directly. Search across classified
  sounds by any dimension.
---

## Intro

You have generated sounds, exported WAV files, stacked layers, and analyzed
metrics. But numbers alone do not tell you *what a sound is*. Is it a weapon?
An impact? Is it soft or aggressive? Bright or dark?

ToneForge's `classify` command bridges the gap between numeric metrics and
human-meaningful labels. It assigns structured semantic labels to sounds
using deterministic, rule-based classification -- no machine learning, no
randomness, no subjectivity. The same input always produces the same labels.

In this walkthrough you will learn:

1. What each classification dimension means
2. How to classify a recipe+seed directly
3. How to classify an external WAV file end-to-end
4. How to batch-classify from analysis data
5. How to search classified sounds by category, intensity, or texture
6. How classification connects analysis metrics to semantic meaning

## Act 1 -- Classify a recipe directly

> You want to see what labels ToneForge assigns to a weapon sound without
> writing any files to disk.

```bash
toneforge classify --recipe weapon-laser-zap --seed 42
```

The output shows the classification result with all semantic dimensions:

```
Classification: weapon-laser-zap_seed-042
  Category:  weapon
  Intensity: hard
  Texture:   bright, sharp
  Material:  energy
  Tags:      sci-fi, ranged, laser, zap
  Ref:       (recipe: weapon-laser-zap, seed: 42)
```

> [!commentary]
> The classifier uses the recipe name and metadata as primary signals for
> category and tags. The recipe `weapon-laser-zap` is registered with
> category "Weapon" and tags ["laser", "zap", "sci-fi"]. Intensity and
> texture are derived from the analysis metrics -- RMS loudness, peak
> amplitude, spectral centroid, and attack time. Material is inferred from
> recipe tags ("energy" for laser/zap sounds). Add `--json` for structured
> JSON output suitable for piping to other tools.

## Act 2 -- What each dimension means

> You see labels but want to understand how each one is determined.

| Dimension | What it describes | How it is determined |
|-----------|-------------------|----------------------|
| **category** | Primary sound type (weapon, footstep, ui, ambient, impact, etc.) | Recipe metadata first, then recipe name parsing, then metric heuristics |
| **intensity** | Energy level (soft, medium, hard, aggressive, subtle) | RMS loudness and peak amplitude thresholds |
| **texture** | Timbral character (sharp, bright, warm, dark, smooth, etc.) | Spectral centroid and attack time thresholds |
| **material** | Physical material (metal, wood, stone, energy, organic, etc.) | Recipe tags/name first, then spectral heuristics. Null when undetermined |
| **tags** | Contextual use-case labels | Recipe tags with category-based defaults |

> [!commentary]
> Classification is hierarchical. Category is the most reliable dimension
> because it draws on recipe metadata. Intensity and texture rely on
> analysis metrics with calibrated thresholds. Material is best-effort --
> not every sound has a meaningful material, so the field can be null.
> Tags provide contextual labels that help with search but are not
> exclusive categories.

## Act 3 -- Classify an external WAV file

> You have picked up a sound effect from outside ToneForge -- an 8-bit
> coin-collect chime bundled in `assets/samples/`. Listen to it first,
> then classify it to see what the engine infers without recipe metadata.

Play the sound:

```bash
toneforge play assets/samples/coin-collect/token.wav
```

Classify it:

```bash
toneforge classify --input assets/samples/coin-collect/token.wav
```

```
Classification: token
  Category:  impact
  Intensity: aggressive
  Texture:   crunchy, sharp
  Material:  (none)
  Tags:      unclassified
  Ref:       assets/samples/coin-collect/token.wav
```

> [!commentary]
> Without recipe metadata the classifier relies entirely on analysis
> metrics. The short, loud, transient-heavy coin chime is classified as
> an `impact` with `aggressive` intensity -- reasonable for its signal
> profile, even though a human would call it a "UI pickup" sound. The
> material field is `(none)` because the metrics alone cannot determine
> a physical material. This shows why recipe context matters: when you
> classify via `--recipe`, category and tags come from the registry.
> With a bare WAV file, the engine does its best from the waveform alone.

## Act 4 -- Batch classify from analysis data

> You have already analyzed a directory of sounds and want to classify
> them all at once.

First, generate and analyze several sounds:

```bash
toneforge generate --recipe weapon-laser-zap --seed 1 --output ./output/weapon-laser-zap_seed-001.wav
toneforge generate --recipe ui-scifi-confirm --seed 1 --output ./output/ui-scifi-confirm_seed-001.wav
toneforge generate --recipe footstep-stone --seed 1 --output ./output/footstep-stone_seed-001.wav
toneforge analyze --input ./output/ --output ./analysis/
```

Now classify from the analysis directory:

```bash
toneforge classify --analysis ./analysis/ --output ./classification/
```

```
Source                         | Category   | Intensity  | Texture             | Material   | Tags
footstep-stone_seed-001        | footstep   | medium     | sharp               | stone      | movement, environment, stone...
ui-scifi-confirm_seed-001      | ui         | soft       | bright, smooth      | synthetic  | interface, notification, chi...
weapon-laser-zap_seed-001      | weapon     | hard       | bright, sharp       | energy     | sci-fi, ranged, laser, zap

Classified 3 files
```

> [!commentary]
> The `--analysis` flag reads pre-computed analysis JSON files, skipping
> the decode and analyze steps. This is faster when you have already run
> `toneforge analyze` and want to iterate on classification rules or
> search across results. The `--output` flag writes one classification
> JSON file per input, mirroring the analysis batch workflow. Without
> `--output`, results are displayed but not saved. Use `--json` for
> structured output of the entire batch.

## Act 5 -- Search classified sounds

> You have a directory of classified sounds and want to find all weapons,
> or all aggressive sounds, or all sounds with a sharp texture.

Search by category:

```bash
toneforge classify search --category weapon --dir ./classification/
```

```
Source                         | Category   | Intensity  | Texture             | Material   | Tags
weapon-laser-zap_seed-001      | weapon     | hard       | bright, sharp       | energy     | sci-fi, ranged, laser, zap

Found 1 match
```

Search by intensity:

```bash
toneforge classify search --intensity soft --dir ./classification/
```

Combine filters for precise results:

```bash
toneforge classify search --category weapon --intensity hard --texture sharp --dir ./classification/
```

> [!commentary]
> Search scans classification JSON files in the specified directory
> (defaulting to `./classification/`). Filters are AND-combined: a sound
> must match all specified filters. Texture matching checks if the
> specified texture appears anywhere in the texture array, so `--texture
> sharp` matches `["sharp", "bright"]`. Add `--json` for structured
> results or use the default table format for scannable summaries.

## Act 6 -- Classify WAV files in batch

> You have a directory of WAV files and want to classify them all without
> running analysis separately.

```bash
toneforge classify --input ./output/ --output ./classification/ --format table
```

> [!commentary]
> This is the all-in-one path: decode WAV, analyze, and classify in a
> single command. Each WAV file is processed independently. When the
> filename matches a known recipe, recipe metadata enhances classification
> accuracy. Use `--format table` for the summary table or `--json` for
> structured output.

## Act 7 -- Comparing classification across recipes

> You want to see how different recipes classify to understand the range
> of labels the system produces.

```bash
toneforge classify --recipe ambient-wind-gust --seed 42
toneforge classify --recipe impact-crack --seed 42
toneforge classify --recipe ui-scifi-confirm --seed 42
```

> [!commentary]
> Each recipe type produces distinct classification signatures. Ambient
> sounds tend toward soft intensity with smooth or warm textures. Impact
> sounds are hard or aggressive with sharp textures. UI sounds are soft
> or medium with bright textures. These patterns emerge from the
> combination of recipe metadata and analysis metrics -- the classifier
> does not have hard-coded rules per recipe, but the thresholds are
> calibrated to produce sensible labels across the full recipe range.

## Recap -- What you just learned

1. **Recipe classification** -- `--recipe <name> --seed <n>` renders, analyzes, and classifies in one step
2. **External WAV classification** -- `--input <file.wav>` decodes, analyzes, and classifies any WAV file end-to-end
3. **Batch from analysis** -- `--analysis <dir>` classifies pre-analyzed data without re-decoding
4. **Batch from WAV** -- `--input <dir>` processes an entire directory of WAV files
5. **Search** -- `classify search --category/--intensity/--texture` finds sounds by semantic attributes
6. **Five dimensions** -- category, intensity, texture, material (best-effort), and tags
7. **Determinism** -- same input, same labels, every time, on any machine
8. **Recipe context matters** -- known recipes get more accurate classification than unknown WAV files
9. **Output options** -- `--json` for structured data, `--format table` for human scanning, `--output <dir>` for file persistence

Classification turns numeric analysis into human-meaningful labels. You can
now search, filter, and organize sounds by what they *sound like* rather
than how they were generated -- the foundation for exploration, library
management, and automated content organization.
