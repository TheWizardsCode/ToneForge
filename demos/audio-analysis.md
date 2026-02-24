---
title: "Audio Analysis: Measuring What You Made"
id: audio-analysis
order: 50
description: >
  Analyze generated sounds to extract structured metrics -- duration, peak,
  RMS, crest factor, attack time, spectral centroid -- and detect quality
  issues like clipping and silence. Single file, recipe+seed, and batch modes.
---

## Intro

You have generated sounds, exported WAV files, and stacked layers. But how
do you know what you actually made? Is it too loud? Too quiet? Does it
clip? How bright is it compared to another sound?

ToneForge's `analyze` command answers these questions with structured,
deterministic metrics. Every analysis produces the same output for the
same input -- on any machine, every time. No listening required.

In this walkthrough you will learn:

1. What each analysis metric means in plain language
2. How to analyze a single WAV file and read the JSON output
3. How to analyze a recipe+seed directly without writing to disk
4. How to batch-analyze a directory and scan a summary table
5. How to interpret quality flags (clipping and silence)
6. How to compare sounds by their numeric fingerprints

## Act 1 -- Analyze a single WAV file

> You exported a laser zap sound earlier and want to know its objective
> characteristics -- how loud, how long, how bright.

First, generate a WAV file to analyze:

```bash
toneforge generate --recipe weapon-laser-zap --seed 42 --output ./output/weapon-laser-zap_seed-042.wav
```

Now analyze it:

```bash
toneforge analyze --input ./output/weapon-laser-zap_seed-042.wav --json
```

The output is structured JSON with every metric the engine extracts:

```json
{
  "command": "analyze",
  "file": "./output/weapon-laser-zap_seed-042.wav",
  "analysisVersion": "1.0",
  "sampleRate": 44100,
  "sampleCount": 4778,
  "metrics": {
    "time": {
      "duration": 0.108345,
      "peak": 1,
      "rms": 0.376683,
      "crestFactor": 2.654752
    },
    "quality": {
      "clipping": true,
      "silence": false
    },
    "envelope": {
      "attackTime": 0.005147
    },
    "spectral": {
      "spectralCentroid": 954.96819
    }
  }
}
```

> [!commentary]
> Every metric is categorized: `time` for basic measurements, `quality`
> for automated flags, `envelope` for transient shape, and `spectral`
> for frequency content. The `analysisVersion` field ("1.0") allows
> future schema changes without breaking existing consumers. Notice
> that `clipping` is `true` -- the peak hit 1.0, which means the
> signal reached the maximum representable value in 16-bit PCM.

## Act 2 -- What each metric means

> You see numbers but want to understand what they tell you about the
> sound.

Here is what each metric measures, in plain language:

- **duration** (seconds) -- How long the sound is. This laser zap is
  0.108 seconds -- about 108 milliseconds, a short burst.

- **peak** (0.0 to 1.0+) -- The highest absolute sample value. A peak
  of 1.0 means the signal reached the maximum before clipping. Values
  above 1.0 indicate the signal exceeded the clipping threshold during
  rendering (before WAV encoding clamped it).

- **rms** (root mean square) -- A measure of average loudness. Higher
  RMS means the sound is consistently louder. This zap's RMS of 0.377
  means it is fairly loud for its short duration.

- **crestFactor** (peak / RMS) -- The ratio of peak to average loudness.
  A low crest factor (near 1.0) means the sound is very compressed --
  consistently loud. A high crest factor means it has sharp transients
  with quieter passages. This zap at 2.65 has moderate dynamics.

- **attackTime** (seconds) -- How quickly the sound reaches 90% of its
  peak amplitude, measured from the first sample above the noise floor.
  This zap's attack of 0.005 seconds (5 ms) means it starts almost
  instantly -- a sharp transient.

- **spectralCentroid** (Hz) -- The "center of mass" of the frequency
  spectrum. A low centroid (under 500 Hz) means the sound is bassy.
  A high centroid (above 3000 Hz) means it is bright and tinny. This
  zap at 955 Hz sits in the midrange.

- **clipping** (true/false) -- Raised when peak >= 1.0. The signal hit
  or exceeded the maximum, which can cause audible distortion.

- **silence** (true/false) -- Raised when RMS is below 0.001. The sound
  is effectively inaudible.

## Act 3 -- Recipe+seed analysis (no disk write)

> You want to quickly check the characteristics of a recipe at a
> specific seed without generating a WAV file first.

The `--recipe` and `--seed` flags render internally and analyze the
result in memory:

```bash
toneforge analyze --recipe weapon-laser-zap --seed 42 --json
```

```bash
toneforge analyze --recipe footstep-stone --seed 42 --json
```

```bash
toneforge analyze --recipe ambient-wind-gust --seed 42 --json
```

> [!commentary]
> Three very different sounds, three very different fingerprints. The
> weapon-laser-zap is short (0.11s), loud (RMS 0.38), with a fast attack
> (5 ms) and a midrange centroid (955 Hz). The footstep-stone is also
> short (0.13s) but much quieter (peak 0.34, RMS 0.09) with a higher
> centroid (1048 Hz) -- the bandpass-filtered noise sounds brighter. The
> ambient-wind-gust is long (1.64s), very quiet (peak 0.18, RMS 0.02),
> with a slow attack (453 ms) and high crest factor (7.7) -- it fades in
> gradually with lots of dynamic range. These numbers capture what your
> ears already know: zaps are loud and sharp, footsteps are moderate
> impacts, wind is quiet and gradual.

## Act 4 -- Comparing sound families

> You want to see how the explosion stacking recipes differ from each
> other numerically -- the sharp crack versus the deep rumble.

```bash
toneforge analyze --recipe impact-crack --seed 42 --json
```

```bash
toneforge analyze --recipe rumble-body --seed 42 --json
```

> [!commentary]
> The impact-crack has a spectral centroid of 11,344 Hz -- extremely
> bright, all high-frequency energy. Its attack time is 1.6 ms -- nearly
> instantaneous. The rumble-body has a centroid of just 42 Hz -- deep
> sub-bass. Its attack time is 67 ms -- a slower onset that builds weight.
> These are the same two recipes used in the explosion_heavy stack preset.
> Analysis reveals exactly why they complement each other: one provides
> the sharp transient attack, the other provides the low-frequency body.
> Neither would sound like an explosion alone; together they cover the
> full frequency range.

## Act 5 -- Batch analysis with table output

> You generated a batch of character-jump variations and want to scan
> them quickly for outliers without reading individual JSON files.

Generate a batch, then analyze the entire directory with table output:

```bash
toneforge generate --recipe character-jump --seed-range 1:5 --output ./output/jump-batch/
```

```bash
toneforge analyze --input ./output/jump-batch/ --format table
```

The table shows key metrics for each file at a glance:

```
| File                      | Dur(s)  | Peak    | RMS     | Crest   | Centroid  | Flags      |
| ------------------------- | ------- | ------- | ------- | ------- | --------- | ---------- |
| character-jump-seed-1.wav | 0.075   | 1.0000  | 0.4077  | 2.45    | 700       | !clip      |
| character-jump-seed-2.wav | 0.190   | 1.0000  | 0.4089  | 2.45    | 790       | !clip      |
| character-jump-seed-3.wav | 0.173   | 1.0000  | 0.4086  | 2.45    | 727       | !clip      |
| character-jump-seed-4.wav | 0.169   | 1.0000  | 0.4100  | 2.44    | 1199      | !clip      |
| character-jump-seed-5.wav | 0.190   | 1.0000  | 0.4088  | 2.45    | 596       | !clip      |
```

> [!commentary]
> Five files, one table. You can immediately spot patterns: all five
> seeds clip (peak 1.0, every row shows `!clip`), RMS is consistent
> around 0.41, and durations range from 75 to 190 ms. But look at the
> centroid column -- seed 4 stands out at 1199 Hz compared to the others
> clustering around 600-790 Hz. That seed produced a noticeably brighter
> jump sound. If you were selecting sounds for a game, this table lets
> you identify the outlier instantly without listening to all five.

## Act 6 -- Batch output to files

> You want to save analysis results alongside your WAV files for later
> processing or integration with other tools.

```bash
toneforge analyze --input ./output/jump-batch/ --output ./output/jump-analysis/
```

This writes one JSON file per WAV:

```bash
ls ./output/jump-analysis/
```

Each JSON file contains the full analysis for the corresponding WAV:

```
character-jump-seed-1.json
character-jump-seed-2.json
character-jump-seed-3.json
character-jump-seed-4.json
character-jump-seed-5.json
```

> [!commentary]
> One JSON per WAV, named to match. These files can be consumed by
> scripts, CI pipelines, or downstream ToneForge features like
> classification. The output directory is created automatically if it
> does not exist.

## Act 7 -- Quality flags: Clipping and silence

> You want to understand when quality flags fire and what they mean
> for your sounds.

**Clipping** is flagged when peak >= 1.0. This means the audio signal
reached or exceeded the maximum representable amplitude. In 16-bit PCM
(the format ToneForge exports), values above 1.0 are clamped during
encoding -- information is lost, and the result can sound distorted.

All the character-jump seeds clip because the recipe's synthesis pushes
the signal to full scale. For short game SFX this is often acceptable --
clipping adds a bit of aggressive character. For ambient sounds or
music, it would be a problem.

**Silence** is flagged when RMS < 0.001. This catches sounds that are
effectively inaudible -- a recipe that produced near-zero output due to
a parameter edge case, or an empty render. In practice, silence flags
most often appear in edge case testing rather than normal recipe usage.

Compare the wind gust (no clipping, no silence) to the laser zap
(clipping, no silence):

```bash
toneforge analyze --recipe ambient-wind-gust --seed 42 --json
```

```bash
toneforge analyze --recipe weapon-laser-zap --seed 42 --json
```

> [!commentary]
> The wind gust has a peak of 0.18 -- well below the clipping threshold.
> Its dynamics (crest factor 7.7) mean the loudest moments are far above
> the average, but even the peaks have headroom. The laser zap hits 1.0
> exactly, triggering the clipping flag. Quality flags are binary
> indicators, not judgments -- clipping in a laser zap may be intentional,
> while clipping in an ambient pad would be a bug. The flags tell you
> what happened; you decide what it means.

## Recap -- What you just learned

1. **Single file analysis** -- `--input <file.wav>` decodes and analyzes any WAV
2. **Recipe+seed analysis** -- `--recipe <name> --seed <n>` renders in memory, no disk write
3. **Batch analysis** -- `--input <directory>` processes all WAV files at once
4. **Table output** -- `--format table` shows a scannable summary for quick outlier detection
5. **File output** -- `--output <dir>` writes one JSON per WAV for downstream consumption
6. **Quality flags** -- `clipping` and `silence` provide automated quality gates
7. **Determinism** -- same input, same metrics, every time, on any machine
8. **Metric categories** -- time-domain (duration, peak, RMS, crest factor), envelope (attack time), spectral (centroid), and quality (clipping, silence)

Every sound has a numeric fingerprint. Analysis turns subjective
listening into objective measurement -- the foundation for classification,
exploration, and automated quality control.
