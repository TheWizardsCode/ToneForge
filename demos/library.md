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
| #   | Candidate                           | Score    | Cluster | Metrics                                  |
| --- | ----------------------------------- | -------- | ------- | ---------------------------------------- |
| 1   | weapon-laser-zap_seed-00000         | 0.9767   | 0       | rms=0.975, spectral-centroid=0.978       |
| 2   | weapon-laser-zap_seed-00049         | 0.5636   | 2       | rms=0.127, spectral-centroid=1.000       |
| 3   | weapon-laser-zap_seed-00004         | 0.5101   | 1       | rms=0.951, spectral-centroid=0.069       |
| 4   | weapon-laser-zap_seed-00040         | 0.5034   | 3       | rms=0.727, spectral-centroid=0.280       |
| 5   | weapon-laser-zap_seed-00002         | 0.5014   | 1       | rms=1.000, spectral-centroid=0.003       |
| 6   | weapon-laser-zap_seed-00030         | 0.5001   | 1       | rms=0.943, spectral-centroid=0.057       |
| 7   | weapon-laser-zap_seed-00042         | 0.4941   | 3       | rms=0.795, spectral-centroid=0.193       |
| 8   | weapon-laser-zap_seed-00045         | 0.4931   | 2       | rms=0.017, spectral-centroid=0.969       |
| 9   | weapon-laser-zap_seed-00009         | 0.4924   | 1       | rms=0.927, spectral-centroid=0.058       |
| 10  | weapon-laser-zap_seed-00033         | 0.4835   | 1       | rms=0.930, spectral-centroid=0.036       |

Cluster summaries:
  Cluster 0: 1 members, centroid: rms=0.975, spectral-centroid=0.978
    Exemplars: weapon-laser-zap_seed-00000
  Cluster 1: 5 members, centroid: rms=0.950, spectral-centroid=0.045
    Exemplars: weapon-laser-zap_seed-00004, weapon-laser-zap_seed-00002, weapon-laser-zap_seed-00030
  Cluster 2: 2 members, centroid: rms=0.072, spectral-centroid=0.985
    Exemplars: weapon-laser-zap_seed-00049, weapon-laser-zap_seed-00045
  Cluster 3: 2 members, centroid: rms=0.761, spectral-centroid=0.236
    Exemplars: weapon-laser-zap_seed-00040, weapon-laser-zap_seed-00042
```

Seed 0 (cluster 0) is the clear leader -- both loud and bright. Cluster 1
groups five punchy lasers with high rms but low spectral centroid -- heavy
and direct. Audition candidates from clusters 0 and 1 to compare them by
ear. The `generate` command renders a seed and plays it back immediately
when `--output` is omitted:

```bash
toneforge generate --recipe weapon-laser-zap --seed 0
toneforge generate --recipe weapon-laser-zap --seed 4
toneforge generate --recipe weapon-laser-zap --seed 30
toneforge generate --recipe weapon-laser-zap --seed 2
```

Seed 0 (cluster 0) is the sharpest and brightest. Seeds 4 and 30
(cluster 1) are heavy and direct -- high energy with a dark timbre, and
nearly identical metrics. Seed 2 (also cluster 1) pushes harder but is
shorter. Pick seed 0 as the lead and two cluster-1 neighbours to build
a palette where the alternatives are close enough to swap freely.

Use `--category` on promote to organize entries from the start.
Seed 0 is the lead shot -- file it under `weapon`. Seeds 4 and 30 are
complementary alternatives -- file them under `weapon-alt`:

```bash
toneforge explore promote --latest --id weapon-laser-zap_seed-00000 --category weapon
```

```
Promoted 'weapon-laser-zap_seed-00000' to library as 'lib-weapon-laser-zap_seed-00000'
  WAV: weapon/lib-weapon-laser-zap_seed-00000.wav
  Metadata: weapon/lib-weapon-laser-zap_seed-00000.json
```

```bash
toneforge explore promote --latest --id weapon-laser-zap_seed-00004 --category weapon-alt
```

```
Promoted 'weapon-laser-zap_seed-00004' to library as 'lib-weapon-laser-zap_seed-00004'
  WAV: weapon-alt/lib-weapon-laser-zap_seed-00004.wav
  Metadata: weapon-alt/lib-weapon-laser-zap_seed-00004.json
```

```bash
toneforge explore promote --latest --id weapon-laser-zap_seed-00030 --category weapon-alt
```

```
Promoted 'weapon-laser-zap_seed-00030' to library as 'lib-weapon-laser-zap_seed-00030'
  WAV: weapon-alt/lib-weapon-laser-zap_seed-00030.wav
  Metadata: weapon-alt/lib-weapon-laser-zap_seed-00030.json
```

> [!commentary]
> One sweep, four clusters, five auditions, three promotions. The sound
> designer chose candidates from two adjacent clusters -- close enough
> to share a laser character, different enough to avoid sounding
> identical when played in quick succession. The sweep command renders,
> analyzes, and classifies each candidate automatically -- intensity,
> texture, and tags are assigned during the sweep, not as a separate
> step. Each promoted candidate is written directly into the Library at
> `.toneforge-library/` with its classification data intact. The Library
> stores the WAV audio, a metadata JSON file, and updates a central
> index. The entry ID follows the format `lib-<candidateId>`. The
> `--category` flag assigns a category at promote time. Without it,
> entries default to `uncategorized`. Here the designer chose explicit
> categories: `weapon` for the lead shot and `weapon-alt` for the
> complementary alternatives. This separation pays off immediately when
> listing and searching the Library. Promotion is idempotent: promoting
> the same candidate twice returns the existing entry without creating
> a duplicate.

## Act 2 -- List Library entries

> You promoted three laser sounds into two categories. What does the
> Library look like now?

List all Library entries:

```bash
toneforge library list
```

```
| ID                                       | Recipe               | Category         | Duration   | Tags                           |
| ---------------------------------------- | -------------------- | ---------------- | ---------- | ------------------------------ |
| lib-weapon-laser-zap_seed-00000          | weapon-laser-zap     | weapon           | 0.22s      | laser, sci-fi, zap, crunchy,   |
|                                          |                      |                  |            | harsh, sharp                   |
| ---------------------------------------- | -------------------- | ---------------- | ---------- | ------------------------------ |
| lib-weapon-laser-zap_seed-00004          | weapon-laser-zap     | weapon-alt       | 0.12s      | laser, sci-fi, zap, sharp,     |
|                                          |                      |                  |            | warm                           |
| ---------------------------------------- | -------------------- | ---------------- | ---------- | ------------------------------ |
| lib-weapon-laser-zap_seed-00030          | weapon-laser-zap     | weapon-alt       | 0.12s      | laser, sci-fi, zap, sharp,     |
|                                          |                      |                  |            | warm                           |
3 entries listed
```

Filter by category to see only the lead shot:

```bash
toneforge library list --category weapon
```

```
| ID                                       | Recipe               | Category         | Duration   | Tags                           |
| ---------------------------------------- | -------------------- | ---------------- | ---------- | ------------------------------ |
| lib-weapon-laser-zap_seed-00000          | weapon-laser-zap     | weapon           | 0.22s      | laser, sci-fi, zap, crunchy,   |
|                                          |                      |                  |            | harsh, sharp                   |
1 entry listed
```

> [!commentary]
> The Library index is a single JSON file at `.toneforge-library/index.json`
> loaded into memory. Listing is instant even with hundreds of entries.
> Each entry shows its ID, recipe, category, duration, and tags. The
> Tags column shows classification data assigned during the sweep --
> recipe-level tags like `laser`, `sci-fi`, `zap` plus texture
> descriptors like `crunchy`, `harsh`, `sharp`, and `warm` derived
> from the analysis metrics. The `--category` flag filters to a single
> category -- here it narrows three entries down to the one filed under
> `weapon`. All Library commands support `--json` for scripting and CI
> integration -- consistent with every other ToneForge command.

## Act 3 -- Search by attributes

> You need to find the softer alternative shots quickly. Search narrows
> entries by category, intensity, texture, or tags.

Search by category to find just the alternative shots:

```bash
toneforge library search --category weapon-alt
```

```
| ID                                       | Recipe               | Category         | Intensity    | Tags                           |
| ---------------------------------------- | -------------------- | ---------------- | ------------ | ------------------------------ |
| lib-weapon-laser-zap_seed-00004          | weapon-laser-zap     | weapon-alt       | aggressive   | laser, sci-fi, zap, sharp,     |
|                                          |                      |                  |              | warm                           |
| ---------------------------------------- | -------------------- | ---------------- | ------------ | ------------------------------ |
| lib-weapon-laser-zap_seed-00030          | weapon-laser-zap     | weapon-alt       | aggressive   | laser, sci-fi, zap, sharp,     |
|                                          |                      |                  |              | warm                           |
Found 2 matches
```

Search by texture to find the warm-sounding entries:

```bash
toneforge library search --texture warm
```

```
| ID                                       | Recipe               | Category         | Intensity    | Tags                           |
| ---------------------------------------- | -------------------- | ---------------- | ------------ | ------------------------------ |
| lib-weapon-laser-zap_seed-00004          | weapon-laser-zap     | weapon-alt       | aggressive   | laser, sci-fi, zap, sharp,     |
|                                          |                      |                  |              | warm                           |
| ---------------------------------------- | -------------------- | ---------------- | ------------ | ------------------------------ |
| lib-weapon-laser-zap_seed-00030          | weapon-laser-zap     | weapon-alt       | aggressive   | laser, sci-fi, zap, sharp,     |
|                                          |                      |                  |              | warm                           |
Found 2 matches
```

Combine filters with AND logic -- find sharp sounds in the lead category:

```bash
toneforge library search --tags sharp --category weapon
```

```
| ID                                       | Recipe               | Category         | Intensity    | Tags                           |
| ---------------------------------------- | -------------------- | ---------------- | ------------ | ------------------------------ |
| lib-weapon-laser-zap_seed-00000          | weapon-laser-zap     | weapon           | aggressive   | laser, sci-fi, zap, crunchy,   |
|                                          |                      |                  |              | harsh, sharp                   |
Found 1 match
```

> [!commentary]
> Search supports four attribute filters: `--category`, `--intensity`,
> `--texture`, and `--tags`. When multiple filters are provided, they
> combine with AND logic -- a sound must match all specified criteria.
> At least one filter is required.
>
> Classification data (intensity, texture, tags) is assigned
> automatically during the sweep. The `explore sweep` command renders,
> analyzes, and classifies each candidate, so promoted entries arrive
> in the Library with full classification metadata. Category is set
> explicitly via `--category` at promote time. Search operates on the
> in-memory index, so results are immediate.

## Act 4 -- Discover similar sounds

> You like `lib-weapon-laser-zap_seed-00004` -- one of the heavy,
> direct cluster-1 lasers -- and want to see which other entries sound
> closest to it.

```bash
toneforge library similar --id lib-weapon-laser-zap_seed-00004 --limit 3
```

The output shows other entries ranked by distance (lower = more similar):

```
| ID                                       | Recipe               | Category         | Distance     | Tag Sim    |
| ---------------------------------------- | -------------------- | ---------------- | ------------ | ---------- |
| lib-weapon-laser-zap_seed-00030          | weapon-laser-zap     | weapon-alt       | 0.2229       | 1.00       |
| ---------------------------------------- | -------------------- | ---------------- | ------------ | ---------- |
| lib-weapon-laser-zap_seed-00000          | weapon-laser-zap     | weapon           | 1.5950       | 0.57       |
2 similar entries found
```

Now play the similar sounds to compare them by ear with the original:

```bash
toneforge generate --recipe weapon-laser-zap --seed 30
toneforge generate --recipe weapon-laser-zap --seed 0
```

> [!commentary]
> Similarity uses a hybrid approach. The primary signal is the Euclidean
> distance between normalized analysis metrics -- RMS, spectral centroid,
> duration, and zero-crossing rate. Tag overlap (Jaccard similarity) acts
> as a tiebreaker: a higher tag similarity slightly reduces the combined
> distance. Lower distance means more similar.
>
> The contrast here is dramatic. Seeds 4 and 30 are both from cluster 1 --
> they share nearly identical metrics (rms ~0.40, spectral centroid ~600,
> duration ~0.12s) and identical classification tags. The result: distance
> 0.2229 with a perfect tag similarity of 1.00. Seed 0 (cluster 0) is the
> outlier -- bright where the cluster-1 sounds are dark, with different
> texture descriptors -- so it lands at distance 1.5950 with tag similarity
> 0.57. This seven-fold distance gap (0.22 vs 1.60) shows that the
> similarity engine reliably surfaces same-cluster sounds as nearest
> neighbours. The `--limit` flag controls how many results to return
> (default 10). Playing the similar sounds with `generate --recipe --seed`
> lets you compare by ear -- the same workflow used in Act 1 for
> auditioning candidates.

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
toneforge library regenerate --id lib-weapon-laser-zap_seed-00000
```

```
Regenerated 'lib-weapon-laser-zap_seed-00000' successfully
  WAV: .toneforge-library/weapon/lib-weapon-laser-zap_seed-00000.wav
  Regenerated at: 2026-02-24T12:34:56.789Z
```

Play the regenerated sound to compare with the original:

```bash
toneforge generate --recipe weapon-laser-zap --seed 0
```

For JSON output:

```bash
toneforge library regenerate --id lib-weapon-laser-zap_seed-00000 --json
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

## Recap -- What you just learned

1. **Sweep and audition** -- one sweep renders, analyzes, and classifies candidates; `generate --recipe --seed` plays a seed for auditioning
2. **Selective promotion** -- pick complementary candidates across clusters to build a varied but cohesive palette; `--category` organizes entries from the start
3. **Listing** -- `library list [--category <c>]` browses entries with optional category filtering
4. **Search** -- `library search` finds entries by `--category`, `--intensity`, `--texture`, and `--tags`; multiple filters combine with AND logic
5. **Similarity** -- `library similar --id <id>` discovers perceptually related entries using hybrid metric distance + tag overlap; `generate --recipe --seed` plays the results for comparison
6. **Export** -- `library export --output <dir> --format wav [--category <c>]` delivers WAV files, optionally filtered by category
7. **Regeneration** -- `library regenerate --id <id>` re-renders from stored presets, proving determinism
8. **JSON output** -- `--json` on all Library commands for scripting and CI integration
9. **Idempotent promotion** -- promoting the same candidate twice is a no-op
10. **Categorization** -- categories set via `--category` at promote time, or derived from classification data, defaulting to `uncategorized`

The Library bridges exploration and production. Promoted sounds become
persistent, searchable assets with deterministic regeneration -- every
sound is reproducible from its stored preset, and every Library operation
is automatable for CI and build pipelines.
