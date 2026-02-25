---
title: "Library: Structured Asset Storage"
id: library
order: 90
description: >
  Promote explored sounds into a persistent, indexed Library. Browse
  entries by category, search by attributes, discover similar sounds,
  export WAV files by category, and regenerate from stored presets --
  deterministic and reproducible.
---

## Intro

You have explored seed spaces, ranked candidates by metrics, and promoted
the best sounds. But promoted candidates were written to a flat staging
directory -- no indexing, no search, no management. What happens when you
have fifty promoted sounds and need to find the loud, sharp weapon effects?

ToneForge's Library module replaces the staging area with structured,
queryable storage. When you promote a candidate, it is written directly
into the Library with its analysis, classification, and preset data. You
can then list, search, find similar sounds, export WAV files by category,
and regenerate any entry from its stored preset -- deterministically and
reproducibly.

In this walkthrough you will learn:

1. How promotion writes directly to the Library
2. How to list and browse Library entries
3. How to search by attributes (intensity, texture, tags)
4. How to discover similar sounds
5. How to export WAV files organized by category
6. How to regenerate a sound from its stored preset

## Act 1 -- Promote candidates to the Library

> You swept creature vocals and weapon sounds in the exploration
> walkthrough. Now you want to save the best ones permanently.

First, sweep creature vocals and promote the top candidate:

```bash
toneforge explore sweep --recipe creature-vocal --seed-range 0:19 --keep-top 5 --rank-by rms --clusters 3
```

Promote the top-scoring candidate using `--latest`:

```bash
toneforge explore promote --latest --id creature-vocal_seed-00010
```

```
Promoted 'creature-vocal_seed-00010' to library as 'lib-creature-vocal_seed-00010'
  Library ID: lib-creature-vocal_seed-00010
  Category: uncategorized
```

Now sweep weapon laser zaps and promote a candidate:

```bash
toneforge explore sweep --recipe weapon-laser-zap --seed-range 0:29 --keep-top 5 --rank-by rms,spectral-centroid --clusters 3
```

```bash
toneforge explore promote --latest --id weapon-laser-zap_seed-00000
```

```
Promoted 'weapon-laser-zap_seed-00000' to library as 'lib-weapon-laser-zap_seed-00000'
  Library ID: lib-weapon-laser-zap_seed-00000
  Category: uncategorized
```

Promote a second creature vocal for variety:

```bash
toneforge explore sweep --recipe creature-vocal --seed-range 0:19 --keep-top 5 --rank-by rms --clusters 3
```

```bash
toneforge explore promote --latest --id creature-vocal_seed-00012
```

> [!commentary]
> Each promoted candidate is written directly into the Library at
> `.toneforge-library/`. The Library stores the WAV audio, a metadata
> JSON file, and updates a central index. The entry ID follows the
> format `lib-<candidateId>`. When classification data is available
> on the candidate (from a prior `toneforge classify` step), the
> category is derived automatically. Without classification, entries
> default to `uncategorized`. You can override the category with
> `--category` on the promote command. Promotion is idempotent:
> promoting the same candidate twice returns the existing entry
> without creating a duplicate.

## Act 2 -- List Library entries

> You have promoted several sounds. How do you see what is in the Library?

List all Library entries:

```bash
toneforge library list
```

```
| ID                                 | Recipe           | Category      | Duration | Tags |
| ---------------------------------- | ---------------- | ------------- | -------- | ---- |
| lib-creature-vocal_seed-00010      | creature-vocal   | uncategorized | 0.26s    | —    |
| lib-creature-vocal_seed-00012      | creature-vocal   | uncategorized | 0.26s    | —    |
| lib-weapon-laser-zap_seed-00000    | weapon-laser-zap | uncategorized | 0.22s    | —    |

3 entries listed
```

Filter by category:

```bash
toneforge library list --category uncategorized
```

```
| ID                                 | Recipe           | Category      | Duration | Tags |
| ---------------------------------- | ---------------- | ------------- | -------- | ---- |
| lib-creature-vocal_seed-00010      | creature-vocal   | uncategorized | 0.26s    | —    |
| lib-creature-vocal_seed-00012      | creature-vocal   | uncategorized | 0.26s    | —    |

2 entries listed
```

For machine-readable output, add `--json`:

```bash
toneforge library list --json
```

> [!commentary]
> The Library index is a single JSON file at `.toneforge-library/index.json`
> loaded into memory. Listing is instant even with hundreds of entries.
> Each entry shows its ID, recipe, category, duration, and tags.
> The `--category` flag filters to a single category. All Library
> commands support `--json` for scripting and CI integration --
> consistent with every other ToneForge command.

## Act 3 -- Search by attributes

> You need to find sounds by specific attributes. Search works on
> classification data stored in Library entries.

When candidates have classification data (from running `toneforge classify`
before promotion), you can search by intensity, texture, tags, or category.

Search by category (always available since every entry has a category):

```bash
toneforge library search --category uncategorized
```

Search by intensity (requires classification data on entries):

```bash
toneforge library search --intensity high
```

Search by tags:

```bash
toneforge library search --tags organic
```

Combine multiple filters (AND logic):

```bash
toneforge library search --intensity high --tags organic --json
```

> [!commentary]
> Search supports four attribute filters: `--category`, `--intensity`,
> `--texture`, and `--tags`. When multiple filters are provided, they
> combine with AND logic -- a sound must match all specified criteria.
> At least one filter is required. The `--category` filter always works
> since every entry has a category. The `--intensity`, `--texture`, and
> `--tags` filters require that candidates had classification data when
> promoted. To get richer search results, run `toneforge classify` on
> your candidates before promoting them. Search operates on the
> in-memory index, so results are immediate.

## Act 4 -- Discover similar sounds

> You like `lib-creature-vocal_seed-00010` and want to find other entries
> with a similar character.

```bash
toneforge library similar --id lib-creature-vocal_seed-00010 --limit 3
```

The output shows other entries ranked by distance (lower = more similar):

```
| ID                                 | Recipe           | Category      | Distance | Tag Sim |
| ---------------------------------- | ---------------- | ------------- | -------- | ------- |
| lib-creature-vocal_seed-00012      | creature-vocal   | uncategorized | 0.1234   | 0.00    |
| lib-weapon-laser-zap_seed-00000    | weapon-laser-zap | uncategorized | 1.7321   | 0.00    |

2 similar entries found
```

For JSON output with full distance breakdowns:

```bash
toneforge library similar --id lib-creature-vocal_seed-00010 --json
```

> [!commentary]
> Similarity uses a hybrid approach. The primary signal is the distance
> between analysis metrics -- normalized RMS, spectral centroid, and
> duration. Tag overlap (Jaccard similarity) acts as a tiebreaker.
> Lower distance means more similar. The creature vocal entries are
> close neighbours because they share the same recipe and similar metric
> profiles. The weapon sound is distant with a very different spectral
> profile. Tag similarity shows 0.00 here because the candidates were
> promoted without classification data (no tags). With classified
> entries, tag similarity provides additional ranking signal. The
> `--limit` flag controls how many results to return (default 10). This
> hybrid approach works well for moderate-sized libraries; a future
> enhancement will add embedding-based similarity for richer perceptual
> matching.

## Act 5 -- Export WAV files

> You are ready to deliver weapon sounds to your game engine. You need
> them as WAV files organized by category.

```bash
toneforge library export --output ./export --category uncategorized --format wav
```

```
Exported 3 WAV files to ./export
```

Check the output directory:

```bash
ls ./export/
```

Export all categories at once (same result when all entries share a category):

```bash
toneforge library export --output ./export-all --format wav
```

```
Exported 3 WAV files to ./export-all
```

For JSON output with file listings:

```bash
toneforge library export --output ./export --format wav --json
```

> [!commentary]
> Export copies WAV files from the Library to an output directory.
> The `--category` flag filters to a single category; omitting it
> exports everything. Only WAV format is supported in this scope.
> Entries whose WAV files are missing (e.g. after a manual deletion)
> are skipped with a warning rather than causing a failure. This
> makes the Library a reliable bridge from exploration to production
> pipeline -- promote the winners, export what you need, deliver.

## Act 6 -- Regenerate from a stored preset

> You updated ToneForge with improved creature vocal synthesis. You want
> to re-render your Library entries with the new code to hear the
> difference.

```bash
toneforge library regenerate --id lib-creature-vocal_seed-00010
```

```
Regenerated 'lib-creature-vocal_seed-00010' successfully
  WAV: .toneforge-library/uncategorized/lib-creature-vocal_seed-00010.wav
  Regenerated at: 2026-02-24T12:34:56.789Z
```

Play the regenerated sound to compare with the original:

```bash
toneforge generate --recipe creature-vocal --seed 10
```

For JSON output:

```bash
toneforge library regenerate --id lib-creature-vocal_seed-00010 --json
```

> [!commentary]
> Every Library entry stores a preset: the recipe name, seed, and
> parameter overrides used to generate it. Regeneration re-renders
> the sound from this preset and replaces the stored WAV file. If
> ToneForge code has not changed, the output is byte-identical --
> proving determinism. If you have updated a recipe's synthesis
> engine, regeneration produces the new version while preserving all
> metadata. This means you never lose your curation work -- presets
> are the source of truth, not the stored audio files.

## Act 7 -- The complete workflow

> You want to see the full flow from exploration to production delivery
> in one sequence.

```bash
# 1. Explore: sweep a seed range
toneforge explore sweep --recipe impact-crack --seed-range 0:49 --keep-top 10 --rank-by rms,spectral-centroid --clusters 4

# 2. Promote: save the best to the Library
toneforge explore promote --latest --id impact-crack_seed-00023

# 3. Browse: list what is in the Library
toneforge library list

# 4. Search: find entries by category
toneforge library search --category uncategorized

# 5. Discover: find similar sounds
toneforge library similar --id lib-impact-crack_seed-00023

# 6. Export: deliver to production
toneforge library export --output ./delivery --format wav

# 7. Verify: regenerate to confirm determinism
toneforge library regenerate --id lib-impact-crack_seed-00023
```

> [!commentary]
> Seven steps from raw seed space to production-ready assets. Explore
> finds the best candidates across thousands of seeds. Promote saves
> the winners with full metadata. The Library makes them searchable
> and discoverable. Export delivers WAV files to your pipeline.
> Regeneration proves that presets are sufficient to reproduce any
> sound. The entire chain is deterministic, reproducible, and
> automatable via `--json` output on every command.

## Recap -- What you just learned

1. **Promotion** -- `explore promote` writes directly to the Library with full metadata
2. **Listing** -- `library list [--category <c>]` browses entries with optional filtering
3. **Search** -- `library search --intensity/--texture/--tags/--category` finds entries by attributes (AND logic)
4. **Similarity** -- `library similar --id <id>` discovers perceptually related entries using hybrid metric+tag distance
5. **Export** -- `library export --output <dir> --format wav` delivers WAV files organized by category
6. **Regeneration** -- `library regenerate --id <id>` re-renders from stored presets, proving determinism
7. **JSON output** -- `--json` on all Library commands for scripting and CI integration
8. **Idempotent promotion** -- promoting the same candidate twice is a no-op
9. **Automatic categorization** -- categories derived from classification data

The Library bridges exploration and production. Promoted sounds become
persistent, searchable assets with deterministic regeneration -- every
sound is reproducible from its stored preset, and every Library operation
is automatable for CI and build pipelines.
