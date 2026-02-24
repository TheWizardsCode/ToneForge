---
title: "Exploration: Finding the Best Sounds"
id: exploration
order: 85
description: >
  Systematically discover optimal sounds across large seed spaces -- sweep
  thousands of seeds, rank by analysis metrics, cluster by similarity,
  mutate promising seeds, and promote top candidates to a curated library.
---

## Intro

You have generated sounds, analyzed their metrics, and classified them with
semantic labels. But you have been working one seed at a time. What if the
best creature vocal is seed 4821 out of 10,000? You would never find it by
hand.

ToneForge's `explore` command automates the search. It sweeps large seed
ranges, renders and analyzes every candidate, ranks them by the metrics you
care about, clusters similar results, and lets you promote the winners into
a curated library. Deterministic and reproducible -- the same sweep always
produces the same results.

In this walkthrough you will learn:

1. How to sweep a seed range and rank results by a metric
2. How to read the ranked results table and cluster summaries
3. How to use multiple ranking metrics for nuanced selection
4. How to mutate a promising seed to generate close variations
5. How to review past exploration runs
6. How to promote a top candidate to the library

## Act 1 -- Sweep a seed range

> You are building a creature system and need the loudest, most
> aggressive vocal sounds. Listening to hundreds of seeds manually is
> not feasible.

Sweep seeds 0 through 19 for the `creature-vocal` recipe, keeping the
top 5 ranked by RMS loudness:

```bash
toneforge explore sweep --recipe creature-vocal --seed-range 0:19 --keep-top 5 --rank-by rms --clusters 3
```

The output shows ranked results and cluster summaries:

```
Sweeping recipe 'creature-vocal' over 20 seeds (0:19)...
  Rank by: rms  |  Keep top: 5  |  Clusters: 3  |  Concurrency: 4
Sweep complete in 639ms -- 20 seeds, 5 kept
Run ID: run-mm0gej70-ffeecb65

| #   | Candidate                 | Score  | Cluster | Metrics   |
| --- | ------------------------- | ------ | ------- | --------- |
| 1   | creature-vocal_seed-00010 | 1.0000 | 0       | rms=1.000 |
| 2   | creature-vocal_seed-00012 | 0.8808 | 2       | rms=0.881 |
| 3   | creature-vocal_seed-00019 | 0.8792 | 2       | rms=0.879 |
| 4   | creature-vocal_seed-00007 | 0.7251 | 1       | rms=0.725 |
| 5   | creature-vocal_seed-00002 | 0.6492 | 1       | rms=0.649 |

Cluster summaries:
  Cluster 0: 1 members, centroid: rms=1.000
  Cluster 1: 2 members, centroid: rms=0.687
  Cluster 2: 2 members, centroid: rms=0.880
```

Now listen to the top result -- seed 10 scored highest:

```bash
toneforge generate --recipe creature-vocal --seed 10
```

> [!commentary]
> The sweep rendered all 20 seeds, analyzed each one, ranked them by
> normalized RMS, and kept the top 5. Seed 10 scored 1.0 -- the loudest
> in the range. Clustering grouped the results into three tiers: the
> single loudest seed in cluster 0, two moderately loud seeds in cluster
> 2, and two quieter seeds in cluster 1. The run is automatically saved
> with its run ID so you can revisit it later. Concurrency defaults to
> half your logical CPU cores.

## Act 2 -- Understanding scores and clusters

> You see scores from 0 to 1 and cluster numbers, but want to understand
> what they mean.

**Scores** are normalized within each run. The candidate with the highest
raw metric value gets a score of 1.0, and the lowest gets 0.0. When
multiple metrics are used, scores are averaged across all selected metrics.
This makes scores comparable within a run but not between runs.

**Clusters** use k-means to group candidates by their metric vectors.
Candidates in the same cluster have similar metric profiles. This helps
you spot patterns: are all the top results similar, or do they fall into
distinct groups with different characteristics?

The cluster summaries show the centroid (average metric values) and
exemplar candidates for each group.

> [!commentary]
> Clustering is most useful with multiple metrics. With a single metric
> like RMS, clusters simply reflect loudness tiers. With two or more
> metrics, clusters reveal genuinely different sound characters -- for
> example, one cluster might be loud and bright while another is loud
> and dark. The number of clusters is configurable with `--clusters`
> (1 to 8, default 3).

## Act 3 -- Multi-metric ranking

> You want weapon sounds that are loud, bright, and have a fast attack --
> not just the loudest, but the best overall across multiple dimensions.

Sweep with three ranking metrics:

```bash
toneforge explore sweep --recipe weapon-laser-zap --seed-range 0:29 --keep-top 5 --rank-by rms,spectral-centroid,attack-time --clusters 3
```

```
| #   | Candidate                    | Score  | Cluster | Metrics                          |
| --- | ---------------------------- | ------ | ------- | -------------------------------- |
| 1   | weapon-laser-zap_seed-00000  | 0.8152 | 0       | rms=0.972, spectral-centroid=    |
|     |                              |        |         | 1.000, attack-time=0.473         |
| 2   | weapon-laser-zap_seed-00019  | 0.5430 | 1       | rms=0.329, spectral-centroid=    |
|     |                              |        |         | 0.300, attack-time=1.000         |
| 3   | weapon-laser-zap_seed-00024  | 0.5409 | 1       | rms=0.423, spectral-centroid=    |
|     |                              |        |         | 0.344, attack-time=0.856         |

Cluster summaries:
  Cluster 0: 1 members — rms=0.972, spectral-centroid=1.000, attack-time=0.473
  Cluster 1: 2 members — rms=0.376, spectral-centroid=0.322, attack-time=0.928
  Cluster 2: 2 members — rms=0.973, spectral-centroid=0.037, attack-time=0.514
```

> [!commentary]
> With three metrics, the ranking reveals trade-offs. Seed 0 has the
> highest overall score (0.815) because it is loud (rms=0.972), the
> brightest (spectral-centroid=1.000), though its attack is moderate
> (0.473). Seeds 19 and 24 score lower overall but have the fastest
> attacks (1.000 and 0.856). Cluster 2 contains the loudest but darkest
> seeds -- high RMS but very low spectral centroid. Multi-metric ranking
> surfaces these trade-offs that single-metric ranking would miss.

## Act 4 -- Mutate a promising seed

> Seed 10 was the loudest creature vocal. You want to explore the
> neighbourhood around it -- subtle variations that stay close to the
> original character.

```bash
toneforge explore mutate --recipe creature-vocal --seed 10 --jitter 0.1 --count 10 --rank-by rms
```

```
Mutating recipe 'creature-vocal' from seed 10 (jitter: 0.1, count: 10)...
Mutate complete in 344ms -- 10 variations

| #   | Candidate                 | Score  | Metrics   |
| --- | ------------------------- | ------ | --------- |
| 1   | creature-vocal_seed-00024 | 1.0000 | rms=1.000 |
| 2   | creature-vocal_seed-00989 | 0.9629 | rms=0.963 |
| 3   | creature-vocal_seed-00853 | 0.9558 | rms=0.956 |
| 4   | creature-vocal_seed-00150 | 0.9122 | rms=0.912 |
| 5   | creature-vocal_seed-00868 | 0.7817 | rms=0.782 |
```

> [!commentary]
> Mutation generates deterministic seed variations by hashing the base
> seed with sequential nonces, then applying jitter to the RNG state.
> A jitter of 0.1 keeps variations close to the original; higher values
> (up to 1.0) produce more divergent results. The mutated seeds (24,
> 989, 853, etc.) are not sequential neighbours of seed 10 -- they are
> deterministic projections into the seed space that produce perceptually
> related but distinct sounds. Several of these mutations scored higher
> than the original range, discovering loud vocalisations that a
> sequential sweep might have missed.

## Act 5 -- Review past runs

> You ran several explorations over the past hour and want to see what
> you have done.

List all completed runs:

```bash
toneforge explore runs
```

```
| Run ID                    | Type   | Recipe         | Total | Kept | Duration |
| ------------------------- | ------ | -------------- | ----- | ---- | -------- |
| run-mm0gej70-ffeecb65     | sweep  | creature-vocal | 20    | 5    | 639ms    |
| run-mm0get4p-436abfdc     | mutate | creature-vocal | 10    | 10   | 344ms    |
| run-mm0gf3o9-8226ff52     | sweep  | weapon-laser-  | 30    | 5    | 411ms    |
```

Show details for a specific run:

```bash
toneforge explore show --run run-mm0gej70-ffeecb65
```

```
Run: run-mm0gej70-ffeecb65
  Type: sweep
  Recipe: creature-vocal
  Total candidates: 20
  Kept: 5

| #   | Candidate                 | Score  | Cluster | Promoted |
| --- | ------------------------- | ------ | ------- | -------- |
| 1   | creature-vocal_seed-00010 | 1.0000 | 0       | no       |
| 2   | creature-vocal_seed-00012 | 0.8808 | 2       | no       |
| 3   | creature-vocal_seed-00019 | 0.8792 | 2       | no       |
| 4   | creature-vocal_seed-00007 | 0.7251 | 1       | no       |
| 5   | creature-vocal_seed-00002 | 0.6492 | 1       | no       |
```

> [!commentary]
> Every exploration run is automatically persisted as a JSON index in
> `.exploration/runs/`. The `runs` command lists all completed runs with
> summary statistics. The `show` command displays the full ranked results
> for any run, including which candidates have been promoted. All run
> data is deterministic -- re-running the same sweep with the same
> parameters produces the same run ID and results.

## Act 6 -- Promote a candidate to the library

> You have found the best creature vocal (seed 10) and want to save it
> permanently with its analysis metadata for future use.

```bash
toneforge explore promote --run run-mm0gej70-ffeecb65 --id creature-vocal_seed-00010
```

```
Promoted 'creature-vocal_seed-00010' to library as 'lib-creature-vocal-10'
  WAV: .exploration/promoted/creature-vocal_seed-00010.wav
  Metadata: .exploration/promoted/creature-vocal_seed-00010.json
```

> [!commentary]
> Promotion renders the candidate to a WAV file and writes a metadata
> JSON alongside it containing the recipe name, seed, full analysis
> metrics, and ranking information. The promoted files are stored in
> `.exploration/promoted/` as a staging area. Promotion is idempotent --
> promoting the same candidate twice is a no-op. The `show` command will
> now display "yes" in the Promoted column for this candidate. When the
> persistent Library module is available, promote will write directly
> into the library instead of the staging directory.

## Act 7 -- Scaling up

> You are ready to sweep a larger range for production use.

For larger sweeps, increase the seed range and adjust concurrency:

```bash
toneforge explore sweep --recipe footstep-gravel --seed-range 0:999 --keep-top 20 --rank-by rms,spectral-centroid --clusters 5
```

For JSON output suitable for scripts and CI pipelines:

```bash
toneforge explore sweep --recipe ui-scifi-confirm --seed-range 0:499 --keep-top 10 --rank-by attack-time --json
```

> [!commentary]
> The explore pipeline is designed for single-machine execution with
> bounded concurrency (default: half your logical CPU cores). A 1,000-seed
> sweep typically completes in seconds; 10,000 seeds in under two minutes
> depending on recipe complexity. The `--json` flag on all subcommands
> produces structured output for automation -- pipe it to `jq`, feed it
> to a CI step, or consume it from a build script. All results are
> deterministic and reproducible across machines.

## Recap -- What you just learned

1. **Sweep** -- `explore sweep --recipe <name> --seed-range <start>:<end>` renders, analyzes, and ranks across a seed range
2. **Ranking** -- `--rank-by <metric,...>` selects 1-4 metrics: rms, spectral-centroid, attack-time, transient-density
3. **Clustering** -- `--clusters <N>` groups results by metric similarity (k-means, 1-8 clusters)
4. **Filtering** -- `--keep-top <N>` retains only the highest-scoring candidates
5. **Mutation** -- `explore mutate --seed <N> --jitter <0-1>` generates variations around a promising seed
6. **Persistence** -- every run is saved automatically; `explore runs` and `explore show` recall past results
7. **Promotion** -- `explore promote --run <id> --id <candidate>` saves a WAV + metadata to the staging library
8. **JSON output** -- `--json` on all subcommands for scripting and CI integration
9. **Determinism** -- same parameters, same results, every time, on any machine

Exploration turns the vast procedural seed space from a haystack into a
curated shortlist. Instead of listening to thousands of sounds, you let
metrics do the filtering and focus your ears on the candidates that
matter -- the foundation for building a curated sound library at scale.
