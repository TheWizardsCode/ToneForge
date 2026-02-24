---
title: "Classification: Semantic Labels for Sounds"
id: classification
order: 70
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
3. How to classify a WAV file end-to-end
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
> recipe tags ("energy" for laser/zap sounds).

For structured output, add `--json`:

```bash
toneforge classify --recipe weapon-laser-zap --seed 42 --json
```

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

## Act 3 -- Classify a WAV file end-to-end

> You have a WAV file on disk and want to classify it without running
> analysis separately.

Generate a WAV file:

```bash
toneforge generate --recipe footstep-stone --seed 7 --output ./output/footstep-stone_seed-007.wav
```

Classify it directly:

```bash
toneforge classify --input ./output/footstep-stone_seed-007.wav
```

```
Classification: footstep-stone_seed-007
  Category:  footstep
  Intensity: medium
  Texture:   sharp
  Material:  stone
  Tags:      movement, environment, stone, footstep
  Ref:       ./output/footstep-stone_seed-007.wav
```

> [!commentary]
> The `--input` path handles the full pipeline internally: decode WAV,
> analyze metrics, then classify. When the filename matches a known recipe
> name pattern (e.g. `footstep-stone_seed-007`), the classifier extracts
> recipe metadata for more accurate classification. For WAV files with
> unrecognized names, classification falls back to metric-only heuristics.

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
> `--output`, results are displayed but not saved.

For JSON output of the entire batch:

```bash
toneforge classify --analysis ./analysis/ --json
```

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
toneforge classify search --category weapon --intensity hard --texture sharp --dir ./classification/ --json
```

> [!commentary]
> Search scans classification JSON files in the specified directory
> (defaulting to `./classification/`). Filters are AND-combined: a sound
> must match all specified filters. Texture matching checks if the
> specified texture appears anywhere in the texture array, so `--texture
> sharp` matches `["sharp", "bright"]`. For structured results, add
> `--json`. For human-readable output, the default table format shows a
> scannable summary.

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
> accuracy. The `--format table` flag shows the summary table; `--json`
> gives structured output.

## Act 7 -- Comparing classification across recipes

> You want to see how different recipes classify to understand the range
> of labels the system produces.

```bash
toneforge classify --recipe ambient-wind-gust --seed 42 --json
toneforge classify --recipe impact-crack --seed 42 --json
toneforge classify --recipe ui-scifi-confirm --seed 42 --json
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
2. **WAV classification** -- `--input <file.wav>` decodes, analyzes, and classifies end-to-end
3. **Batch from analysis** -- `--analysis <dir>` classifies pre-analyzed data without re-decoding
4. **Batch from WAV** -- `--input <dir>` processes an entire directory of WAV files
5. **Search** -- `classify search --category/--intensity/--texture` finds sounds by semantic attributes
6. **Five dimensions** -- category, intensity, texture, material (best-effort), and tags
7. **Determinism** -- same input, same labels, every time, on any machine
8. **Recipe metadata** -- known recipes get more accurate classification than unknown WAV files
9. **Output options** -- `--json` for structured data, `--format table` for human scanning, `--output <dir>` for file persistence

Classification turns numeric analysis into human-meaningful labels. You can
now search, filter, and organize sounds by what they *sound like* rather
than how they were generated -- the foundation for exploration, library
management, and automated content organization.
