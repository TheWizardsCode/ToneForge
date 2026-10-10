---
title: "Runtime: Audible State- and Context-Driven Playback"
id: runtime
order: 96
description: >
  Run a scripted runtime scenario that resolves state and context changes to
  recipes, renders them with the offline renderer, and plays them — so you
  hear the runtime respond to behaviour instead of reading an event log.
---

## Intro

A game character walks across stone, the ground turns to gravel, and then
they break into a sprint. Each footstep is a different sound, chosen by the
**runtime** from the current state (walk / sprint) and environment context
(surface: stone / gravel). Each state sequence is a single footstep; the loop
cadence is declared per sequence as `loopInterval`.

The runtime is **render-backed**: it resolves every event to a concrete
recipe, the existing offline renderer mixes the result, and the host playback
layer plays it. There is no second synthesis engine — the same recipes and
renderer power offline generation and real-time playback.

The scripted scenario lives in
[`presets/runtime/footsteps.json`](../presets/runtime/footsteps.json):
a state machine, a context dimension, per-state sequences, a recipe resolver
(`footstep` + `surface` → `footstep-{surface}`), and a list of timed steps.

## Act 1 — Hear the runtime respond

> You want to hear the runtime change the sound as behaviour and environment
> change, not read a JSON event log.

```bash
toneforge runtime demo
```

The demo steps the runtime through three phases — **walk on stone**, **walk
on gravel**, **sprint on gravel** — and plays the mixed audio. Even though the
sequences reference a single generic `footstep` event, the recipe resolver
turns each into `footstep-stone` or `footstep-gravel` based on the current
context.

> [!commentary]
> Listen for two independent changes. The **surface** change swaps the recipe
> (stone to gravel), while the **state** change swaps the (single-footstep)
> sequence — its gain and character. In the live transport (Act 4) the state
> also swaps the cadence, because each sequence declares its own
> `loopInterval` (walk 0.6s, run 0.35s, sprint 0.25s).

## Act 2 — Inspect the resolved timeline

> You want to verify exactly which recipe each event resolved to, and when it
> fires — without audio hardware.

```bash
toneforge runtime demo --json
```

The `--json` output is deterministic: the same seed always produces the same
event log. Each event carries its absolute time, sample offset, state,
sequence, the original event name, and the **resolved** recipe name.

> [!commentary]
> Notice `originalRecipe: "footstep"` alongside `recipe: "footstep-gravel"`.
> That is the recipe resolver doing context-driven switching: a walk footstep
> at 0s resolves to `footstep-stone`; at 1.4s the surface changes to gravel so
> the next footstep resolves to `footstep-gravel`; at 2.8s the state becomes
> sprint (still gravel). One footstep per phase.

## Act 3 — Export for CI

> You want the demo to be verifiable in CI, where there is no audio output.

```bash
toneforge runtime demo --output ./runtime-demo/
```

This writes the mixed `runtime-demo.wav`, one WAV per resolved event (for
example `00-footstep-stone-seed42.wav` and `01-footstep-gravel-seed42.wav`),
and a `timeline.json` describing the run — all without touching an audio
device.

> [!commentary]
> Because rendering is deterministic, the exported WAVs are byte-identical for
> a given seed. That makes the runtime demo as reproducible as every other
> ToneForge surface: same seed, same scenario, same sound.

## Act 4 — Drive it live

> The scripted demo is deterministic, but the runtime is meant to be embedded.
> In a live session the runtime runs against a real clock, so commands take
> effect as they arrive — and `start` keeps the footsteps going instead of
> firing a single burst.

Interactively, `start` begins a **continuous transport** and `stop` halts it:

```
runtime> start walk
runtime> context surface=gravel
runtime> state sprint
runtime> stop
runtime> quit
```

For a deterministic, CI-friendly version, run a command script with a loop
bound:

```bash
toneforge runtime start --script demos/fixtures/runtime-session.txt --iterations 3
```

Where `demos/fixtures/runtime-session.txt` is one command per line:

```
start walk
context surface=gravel
state sprint
quit
```

Each iteration plays one footstep, resolving the recipe from the current
surface, and waits the sequence's `loopInterval` before the next — so the
state determines the cadence and each iteration uses a distinct deterministic
seed, evolving rather than repeating identically. `--iterations <n>` bounds the
run; without it an interactive transport loops until `stop`/`quit`.
`--no-seed-variation` makes every iteration identical, and `--json` streams
the loop as a headless event log.

> [!commentary]
> `start`/`stop` turn the runtime from a burst player into a sustained
> behavioural engine: the footsteps keep playing while you retune state and
> environment. `runtime demo` remains the fixed-script listening example; see
> `docs/prd/RUNTIME_PRD.md` §19.10.

## Recap

- The runtime orchestrates **State**, **Context**, and the **Sequencer**.
- A **recipe resolver** maps events plus context to concrete recipes
  (`footstep` + `gravel` → `footstep-gravel`).
- The existing **offline renderer** mixes the resolved events — no second
  synthesis engine.
- **Node** plays via `playAudio`; the **browser** schedules an
  `AudioBufferSourceNode` on the shared `AudioContext`.
- `--output` / `--json` make the demo verifiable in CI without audio hardware.

See [`docs/prd/RUNTIME_PRD.md`](../docs/prd/RUNTIME_PRD.md) §19 for the
render/playback pipeline design.
