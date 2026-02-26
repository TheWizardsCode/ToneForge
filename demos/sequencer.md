---
title: "Sequencer: Temporal Behavior Patterns"
id: sequencer
order: 95
description: >
  Schedule recipe triggers over time to create weapon bursts, melodies,
  rhythmic stings, and ambient loops from versioned JSON presets.
---

## Intro

Games and apps need sounds that unfold over time. A weapon fires three
rapid shots. A game-over melody plays four descending notes. A dramatic
sting repeats a rhythmic pattern of impacts and rattles.

ToneForge's **sequencer** lets you describe these temporal patterns as
JSON presets. Each preset lists timed events that reference existing
recipes. The sequencer simulates the timeline deterministically, then
renders each event and mixes the results into a single audio buffer.

Three example presets ship with ToneForge:

1. **weapon_burst** -- three-round laser burst with descending gain
2. **gameover_melody** -- four-note descending melody using UI chimes
3. **rhythmic_sting** -- repeating impact pattern with probability filtering

Let's explore each one.

## Act 1 -- Inspect a sequence preset

> You want to understand what's inside a sequence preset before
> rendering it. The `sequence inspect` command shows the preset
> structure and validates it without producing audio.

Start with the weapon burst:

```bash
toneforge sequence inspect --preset presets/sequences/weapon_burst.json
```

> [!commentary]
> The output shows each event's timing, recipe name, seed offset, and
> gain. The weapon burst fires three `weapon-laser-zap` events at 0ms,
> 120ms, and 240ms, with gain decreasing from 1.0 to 0.85. This creates
> a natural burst effect where each successive shot is slightly quieter.

## Act 2 -- Simulate the timeline

> Before rendering audio, you can simulate the timeline to see exactly
> when each event will fire and what seed each will use. This is useful
> for debugging timing and probability filtering.

```bash
toneforge sequence simulate --preset presets/sequences/weapon_burst.json --seed 42
```

Simulation shows the expanded timeline with absolute timestamps,
sample offsets, and per-event seeds. The seed for each event is
computed as `baseSeed + seedOffset`, so with seed 42, the three shots
use seeds 42, 43, and 44.

> [!commentary]
> The simulate command is your debugging tool. It shows the exact sample
> offset where each event fires, which matters when you need frame-accurate
> timing. At 44.1 kHz, 120ms translates to sample 5292 -- you can verify
> this in the output.

## Act 3 -- Render the weapon burst

> You're building a sci-fi shooter and need a three-round burst that
> sounds consistent every time your player pulls the trigger.

```bash
toneforge sequence generate --preset presets/sequences/weapon_burst.json --seed 42
```

The sequencer renders each event using its recipe and event seed, then
mixes them at the correct sample offsets into a single mono buffer.
Without `--output`, it plays immediately through your speakers.

To save to a file instead:

```bash
toneforge sequence generate --preset presets/sequences/weapon_burst.json --seed 42 --output burst.wav
```

> [!commentary]
> Each shot in the burst is a distinct `weapon-laser-zap` render with
> its own seed, so they sound similar but not identical. The descending
> gain sells the illusion of a mechanical burst. Run the same command
> again with the same seed and you get byte-identical output.

## Act 4 -- A melody with duration control

> Your game needs a short jingle for the game-over screen. You want a
> descending series of chimes followed by a confirmation tone.

```bash
toneforge sequence inspect --preset presets/sequences/gameover_melody.json
```

```bash
toneforge sequence generate --preset presets/sequences/gameover_melody.json --seed 42
```

The melody preset uses the `duration` field on each event to control
how long each note rings. The three chimes each last 0.4 seconds, and
the final `ui-scifi-confirm` rings for 0.6 seconds.

> [!commentary]
> Duration control keeps notes from bleeding into each other. Without
> it, each recipe would render its full natural length. The `tempo`
> field in the preset is metadata for documentation and tooling -- the
> actual timing comes from the `time` values on each event.

## Act 5 -- Repeating patterns with probability

> You need a dramatic sting that loops a rhythmic pattern. Some hits
> should be slightly unpredictable to avoid mechanical repetition.

```bash
toneforge sequence inspect --preset presets/sequences/rhythmic_sting.json
```

```bash
toneforge sequence simulate --preset presets/sequences/rhythmic_sting.json --seed 42
```

The rhythmic sting uses `repeat` to play the pattern three times total
(the base pattern plus 2 repetitions at 1-second intervals). Two of
the four events have `probability` values less than 1.0 -- the
`resonance-body` at 0.8 and `rattle-decay` at 0.7. The deterministic
RNG decides which events pass the probability filter, so the same seed
always produces the same pattern of hits and drops.

```bash
toneforge sequence generate --preset presets/sequences/rhythmic_sting.json --seed 42
```

> [!commentary]
> Probability filtering adds controlled variation without randomness.
> Seed 42 might drop one rattle-decay in the second repetition, creating
> a gap that makes the pattern feel more organic. Change the seed and
> different events get filtered. But the same seed always produces the
> exact same pattern -- determinism is preserved.

## Act 6 -- JSON output for tooling

> You're building a visualization tool and need machine-readable
> simulation data.

```bash
toneforge sequence simulate --preset presets/sequences/weapon_burst.json --seed 42 --json
```

```bash
toneforge sequence inspect --preset presets/sequences/gameover_melody.json --json
```

The `--json` flag outputs structured data to stdout, suitable for
piping to other tools or scripts.

> [!commentary]
> All three sequence subcommands support `--json`. The simulate output
> includes every timeline event with its sample offset, seed, and gain.
> The inspect output shows the preset structure and validation status.
> This makes ToneForge's sequencer scriptable and integrable into
> asset pipelines.

## Act 7 -- Verify determinism

> You need to prove that your game's audio is reproducible across builds.

Run the same generate command twice and compare the output files:

```bash
toneforge sequence generate --preset presets/sequences/weapon_burst.json --seed 42 --output burst_a.wav
toneforge sequence generate --preset presets/sequences/weapon_burst.json --seed 42 --output burst_b.wav
```

The two files will be byte-identical. This is guaranteed by the
deterministic RNG seeding: each event gets seed `baseSeed + seedOffset`,
and the same seed always drives the same recipe parameters through the
same synthesis pipeline.

> [!commentary]
> Deterministic audio is critical for testing, caching, and
> reproducibility. If a QA tester reports a sound bug, you can reproduce
> it exactly with the same preset and seed. If you're caching generated
> audio in a build pipeline, identical seeds produce cache hits. The
> golden fixture test harness in the codebase verifies 10-run
> byte-identical output for every shipped preset.
