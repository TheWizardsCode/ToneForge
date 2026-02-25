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

In this walkthrough you will build a laser-sound palette from a single
sweep, promoting three complementary candidates into the Library. Then
you will learn to:

1. List and browse Library entries
2. Search by attributes (intensity, texture, tags)
3. Discover similar sounds
4. Export WAV files organized by category
5. Regenerate a sound from its stored preset

## Act 1 -- Build a laser palette

> You are designing weapon audio for a sci-fi shooter. You need a group
> of laser sounds that share a common character but vary enough to avoid
> repetition when the player fires rapidly. Your goal: sweep a wide seed
> range, audition candidates from adjacent clusters, and promote three
> complementary picks into the Library.

Sweep 50 seeds of the `weapon-laser-zap` recipe, keep the top 10
candidates, and cluster them into 4 groups so you can spot natural
groupings:

```bash
toneforge explore sweep --recipe weapon-laser-zap --seed-range 0:49 --keep-top 10 --rank-by rms,spectral-centroid --clusters 4
```

```
| #  | Candidate                          | Score  | Cluster | Metrics                             |
| -- | ---------------------------------- | ------ | ------- | ----------------------------------- |
| 1  | weapon-laser-zap_seed-00042        | 0.8731 | 0       | rms=0.912, spectral-centroid=0.834  |
| 2  | weapon-laser-zap_seed-00017        | 0.8544 | 0       | rms=0.889, spectral-centroid=0.820  |
| 3  | weapon-laser-zap_seed-00031        | 0.8210 | 1       | rms=0.845, spectral-centroid=0.797  |
| 4  | weapon-laser-zap_seed-00009        | 0.7998 | 1       | rms=0.831, spectral-centroid=0.769  |
| 5  | weapon-laser-zap_seed-00025        | 0.7812 | 1       | rms=0.802, spectral-centroid=0.760  |
| 6  | weapon-laser-zap_seed-00003        | 0.7650 | 2       | rms=0.778, spectral-centroid=0.752  |
| 7  | weapon-laser-zap_seed-00038        | 0.7401 | 2       | rms=0.756, spectral-centroid=0.724  |
| 8  | weapon-laser-zap_seed-00046        | 0.7189 | 3       | rms=0.734, spectral-centroid=0.704  |
| 9  | weapon-laser-zap_seed-00011        | 0.6950 | 3       | rms=0.710, spectral-centroid=0.680  |
| 10 | weapon-laser-zap_seed-00029        | 0.6723 | 3       | rms=0.688, spectral-centroid=0.657  |

Cluster summaries:
  Cluster 0: 2 members, centroid: rms=0.901, spectral-centroid=0.827
  Cluster 1: 3 members, centroid: rms=0.826, spectral-centroid=0.775
  Cluster 2: 2 members, centroid: rms=0.767, spectral-centroid=0.738
  Cluster 3: 3 members, centroid: rms=0.711, spectral-centroid=0.680
```

Clusters 0 and 1 sit close together -- bright, punchy lasers with high
spectral centroid. Audition five candidates drawn from those two
clusters to compare them by ear. The `generate` command renders a seed
and plays it back immediately when `--output` is omitted:

```bash
toneforge generate --recipe weapon-laser-zap --seed 42
toneforge generate --recipe weapon-laser-zap --seed 17
toneforge generate --recipe weapon-laser-zap --seed 31
toneforge generate --recipe weapon-laser-zap --seed 9
toneforge generate --recipe weapon-laser-zap --seed 25
```

Seeds 42 and 17 (cluster 0) are the sharpest and loudest. Seeds 31, 9,
and 25 (cluster 1) are slightly softer with a rounder attack -- good
variety within the same family. Pick one from cluster 0 and two from
cluster 1 to build a three-sound palette with shared character but
enough variation to avoid monotony.

Use `--category` on promote to organize entries from the start.
Seed 42 is the lead shot -- file it under `weapon`. Seeds 31 and 9 are
softer alternatives -- file them under `weapon-alt`:

```bash
toneforge explore promote --latest --id weapon-laser-zap_seed-00042 --category weapon
```

```
Promoted 'weapon-laser-zap_seed-00042' to library as 'lib-weapon-laser-zap_seed-00042'
  WAV: weapon/lib-weapon-laser-zap_seed-00042.wav
  Metadata: weapon/lib-weapon-laser-zap_seed-00042.json
```

```bash
toneforge explore promote --latest --id weapon-laser-zap_seed-00031 --category weapon-alt
```

```
Promoted 'weapon-laser-zap_seed-00031' to library as 'lib-weapon-laser-zap_seed-00031'
  WAV: weapon-alt/lib-weapon-laser-zap_seed-00031.wav
  Metadata: weapon-alt/lib-weapon-laser-zap_seed-00031.json
```

```bash
toneforge explore promote --latest --id weapon-laser-zap_seed-00009 --category weapon-alt
```

```
Promoted 'weapon-laser-zap_seed-00009' to library as 'lib-weapon-laser-zap_seed-00009'
  WAV: weapon-alt/lib-weapon-laser-zap_seed-00009.wav
  Metadata: weapon-alt/lib-weapon-laser-zap_seed-00009.json
```

> [!commentary]
> One sweep, four clusters, five auditions, three promotions. The sound
> designer chose candidates from two adjacent clusters -- close enough
> to share a bright, punchy character, different enough to avoid
> sounding identical when played in quick succession. Each promoted
> candidate is written directly into the Library at `.toneforge-library/`.
> The Library stores the WAV audio, a metadata JSON file, and updates a
> central index. The entry ID follows the format `lib-<candidateId>`.
> The `--category` flag assigns a category at promote time. Without it,
> entries default to `uncategorized`. When classification data is
> available on the candidate (from a prior `toneforge classify` step),
> the category can also be derived automatically. Here the designer
> chose explicit categories: `weapon` for the lead shot and `weapon-alt`
> for the softer alternatives. This separation pays off immediately
> when listing and searching the Library. Promotion is idempotent:
> promoting the same candidate twice returns the existing entry without
> creating a duplicate.

## Act 2 -- List Library entries

> You promoted three laser sounds into two categories. What does the
> Library look like now?

List all Library entries:

```bash
toneforge library list
```

```
| ID                                 | Recipe           | Category   | Duration | Tags |
| ---------------------------------- | ---------------- | ---------- | -------- | ---- |
| lib-weapon-laser-zap_seed-00009    | weapon-laser-zap | weapon-alt | 0.22s    | —    |
| lib-weapon-laser-zap_seed-00031    | weapon-laser-zap | weapon-alt | 0.22s    | —    |
| lib-weapon-laser-zap_seed-00042    | weapon-laser-zap | weapon     | 0.22s    | —    |

3 entries listed
```

Filter by category to see only the lead shot:

```bash
toneforge library list --category weapon
```

```
| ID                                 | Recipe           | Category   | Duration | Tags |
| ---------------------------------- | ---------------- | ---------- | -------- | ---- |
| lib-weapon-laser-zap_seed-00042    | weapon-laser-zap | weapon     | 0.22s    | —    |

1 entry listed
```

> [!commentary]
> The Library index is a single JSON file at `.toneforge-library/index.json`
> loaded into memory. Listing is instant even with hundreds of entries.
> Each entry shows its ID, recipe, category, duration, and tags.
> The `--category` flag filters to a single category -- here it narrows
> three entries down to the one filed under `weapon`. All Library
> commands support `--json` for scripting and CI integration --
> consistent with every other ToneForge command.

## Act 3 -- Search by attributes

> You need to find the softer alternative shots quickly. Search narrows
> entries by category, intensity, texture, or tags.

Search by category to find just the alternative shots:

```bash
toneforge library search --category weapon-alt
```

```
| ID                                 | Recipe           | Category   | Intensity | Tags |
| ---------------------------------- | ---------------- | ---------- | --------- | ---- |
| lib-weapon-laser-zap_seed-00009    | weapon-laser-zap | weapon-alt | —         | —    |
| lib-weapon-laser-zap_seed-00031    | weapon-laser-zap | weapon-alt | —         | —    |

Found 2 matches
```

Search the lead category:

```bash
toneforge library search --category weapon
```

```
| ID                                 | Recipe           | Category   | Intensity | Tags |
| ---------------------------------- | ---------------- | ---------- | --------- | ---- |
| lib-weapon-laser-zap_seed-00042    | weapon-laser-zap | weapon     | —         | —    |

Found 1 match
```

> [!commentary]
> Search supports four attribute filters: `--category`, `--intensity`,
> `--texture`, and `--tags`. When multiple filters are provided, they
> combine with AND logic -- a sound must match all specified criteria.
> At least one filter is required.
>
> The Intensity and Tags columns show `—` because these entries were
> promoted without classification data. The `explore sweep` command
> does not classify candidates automatically. To populate intensity,
> texture, and tags on Library entries, run `toneforge classify` on
> candidates before promoting them -- or integrate classification into
> your pipeline. The `--category` filter always works because every
> entry receives a category at promote time (either via `--category` or
> derived from classification data, defaulting to `uncategorized`).
> Search operates on the in-memory index, so results are immediate.

## Act 4 -- Discover similar sounds

> You like `lib-weapon-laser-zap_seed-00042` -- the sharpest of the
> three -- and want to see which other entries are closest to it.

```bash
toneforge library similar --id lib-weapon-laser-zap_seed-00042 --limit 3
```

The output shows other entries ranked by distance (lower = more similar):

```
| ID                                 | Recipe           | Category   | Distance | Tag Sim |
| ---------------------------------- | ---------------- | ---------- | -------- | ------- |
| lib-weapon-laser-zap_seed-00031    | weapon-laser-zap | weapon-alt | 0.0823   | 0.00    |
| lib-weapon-laser-zap_seed-00009    | weapon-laser-zap | weapon-alt | 0.1456   | 0.00    |

2 similar entries found
```

For JSON output with full distance breakdowns:

```bash
toneforge library similar --id lib-weapon-laser-zap_seed-00042 --json
```

> [!commentary]
> Similarity uses a hybrid approach. The primary signal is the distance
> between analysis metrics -- normalized RMS, spectral centroid, and
> duration. Tag overlap (Jaccard similarity) acts as a tiebreaker.
> Lower distance means more similar. All three entries are close
> neighbours because they share the same recipe and were deliberately
> chosen from adjacent clusters. Seed 31 (cluster 1) is closer to
> seed 42 (cluster 0) than seed 9 is, reflecting the metric gradient
> visible in the sweep table. Tag similarity shows 0.00 here because
> the candidates were promoted without classification data (no tags).
> With classified entries, tag similarity provides additional ranking
> signal. The `--limit` flag controls how many results to return
> (default 10). This hybrid approach works well for moderate-sized
> libraries; a future enhancement will add embedding-based similarity
> for richer perceptual matching.

## Act 5 -- Export WAV files

> Your laser palette is ready. Time to deliver WAV files to the game
> engine's asset directory.

Export everything:

```bash
toneforge library export --output ./export --format wav
```

```
Exported 3 WAV files to ./export
```

Export only the lead shots:

```bash
toneforge library export --output ./export-weapon --format wav --category weapon
```

```
Exported 1 WAV file to ./export-weapon
```

Check the output directory:

```bash
ls ./export/
```

> [!commentary]
> Export copies WAV files from the Library to an output directory.
> The `--category` flag filters to a single category; omitting it
> exports everything. With two categories in the Library, the first
> command exports all three entries while the second exports only the
> one filed under `weapon`. Only WAV format is supported in this scope.
> Entries whose WAV files are missing (e.g. after a manual deletion)
> are skipped with a warning rather than causing a failure. This
> makes the Library a reliable bridge from exploration to production
> pipeline -- promote the winners, export what you need, deliver.

## Act 6 -- Regenerate from a stored preset

> You updated ToneForge with improved laser synthesis. You want to
> re-render a Library entry with the new code to hear the difference.

```bash
toneforge library regenerate --id lib-weapon-laser-zap_seed-00042
```

```
Regenerated 'lib-weapon-laser-zap_seed-00042' successfully
  WAV: .toneforge-library/weapon/lib-weapon-laser-zap_seed-00042.wav
  Regenerated at: 2026-02-24T12:34:56.789Z
```

Play the regenerated sound to compare with the original:

```bash
toneforge generate --recipe weapon-laser-zap --seed 42
```

For JSON output:

```bash
toneforge library regenerate --id lib-weapon-laser-zap_seed-00042 --json
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
> in one sequence -- this time with impact cracks.

```bash
# 1. Explore: sweep a seed range
toneforge explore sweep --recipe impact-crack --seed-range 0:49 --keep-top 10 --rank-by rms,spectral-centroid --clusters 4

# 2. Promote: save the best to the Library with a category
toneforge explore promote --latest --id impact-crack_seed-00023 --category impact

# 3. Browse: list what is in the Library
toneforge library list

# 4. Search: find entries by category
toneforge library search --category impact

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

1. **Sweep and audition** -- one sweep produces clustered candidates; `generate --recipe --seed` renders and plays a seed for auditioning
2. **Selective promotion** -- pick complementary candidates across clusters to build a varied but cohesive palette; `--category` organizes entries from the start
3. **Listing** -- `library list [--category <c>]` browses entries with optional category filtering
4. **Search** -- `library search --category` finds entries by category; `--intensity`, `--texture`, and `--tags` require classification data on entries
5. **Similarity** -- `library similar --id <id>` discovers perceptually related entries using hybrid metric+tag distance
6. **Export** -- `library export --output <dir> --format wav [--category <c>]` delivers WAV files, optionally filtered by category
7. **Regeneration** -- `library regenerate --id <id>` re-renders from stored presets, proving determinism
8. **JSON output** -- `--json` on all Library commands for scripting and CI integration
9. **Idempotent promotion** -- promoting the same candidate twice is a no-op
10. **Categorization** -- categories set via `--category` at promote time, or derived from classification data, defaulting to `uncategorized`

The Library bridges exploration and production. Promoted sounds become
persistent, searchable assets with deterministic regeneration -- every
sound is reproducible from its stored preset, and every Library operation
is automatable for CI and build pipelines.
