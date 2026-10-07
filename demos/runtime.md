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
(surface: stone / gravel).

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
> (stone to gravel), while the **state** change swaps the sequence (slower,
> softer walking cadence to a faster, louder sprint). State and context are
> orthogonal inputs to the same runtime.

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
> That is the recipe resolver doing context-driven switching. From time 0 to
> 1.2s the surface is stone; at 1.4s the context changes to gravel and the
> remaining footsteps resolve to gravel; at 2.8s the state becomes sprint.

## Act 3 — Export for CI

> You want the demo to be verifiable in CI, where there is no audio output.

```bash
toneforge runtime demo --output ./runtime-demo/
```

This writes the mixed `runtime-demo.wav`, one WAV per resolved event (for
example `00-footstep-stone-seed42.wav` and `03-footstep-gravel-seed42.wav`),
and a `timeline.json` describing the run — all without touching an audio
device.

> [!commentary]
> Because rendering is deterministic, the exported WAVs are byte-identical for
> a given seed. That makes the runtime demo as reproducible as every other
> ToneForge surface: same seed, same scenario, same sound.

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
