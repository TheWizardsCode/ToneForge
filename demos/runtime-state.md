---
title: "Runtime & State: Real-Time Behavioral Sound"
id: runtime-state
order: 100
description: >
  Drive movement state transitions and environmental context changes in
  real time, showing how the runtime orchestrates state machines,
  context-driven recipe switching, and deterministic event logging.
---

## Intro

Games don't play isolated sounds. A character walks, then runs, then
sprints -- and the footstep sounds change to match. The surface changes
from stone to gravel -- and the recipe switches instantly.

ToneForge's **runtime** ties together three new modules:

1. **State** -- a state machine that tracks discrete states (idle, walk,
   run, sprint) with explicit transitions and inspection
2. **Context** -- environmental dimensions (surface, weather) that drive
   recipe selection
3. **Runtime** -- the orchestrator that reacts to state and context
   changes, fires sequence events, and logs everything deterministically

This demo runs a scripted session showing all three working together.

## Act 1 -- Run the built-in demo

> You want to see state-driven sound behavior in action without writing
> any code. The `runtime` command runs a built-in scripted demo.

```bash
toneforge runtime --seed 42
```

The demo walks through a complete session: start the runtime, set the
surface to stone, transition through walk, run, and sprint states,
switch the surface to gravel mid-session, inspect the full state, view
the event log, and stop.

> [!commentary]
> Each state transition triggers a different footstep sequence. Walking
> uses a relaxed 0.6s cadence, running tightens to 0.35s, and sprinting
> pushes to 0.25s. When context changes from stone to gravel, the recipe
> resolver swaps `footstep-stone` to `footstep-gravel` in real time --
> you can see this in the event log where `originalRecipe` and
> `resolvedRecipe` differ.

## Act 2 -- Verify determinism

> You need to prove that identical seeds produce identical event logs.
> This is critical for QA reproducibility and cache-safe asset pipelines.

Run the demo twice with JSON output and compare:

```bash
toneforge runtime --seed 42 --json > /tmp/run_a.jsonl
```

```bash
toneforge runtime --seed 42 --json > /tmp/run_b.jsonl
```

The two JSONL files are byte-identical. Every event ID, timestamp, seed,
and state transition matches exactly.

> [!commentary]
> Determinism is enforced at every layer: the state machine uses a
> deterministic clock, context changes are logged with monotonic
> sequence numbers, and the runtime generates session IDs and event IDs
> from the seed. Change the seed and you get different session IDs and
> event seeds, but repeat the same seed and everything reproduces.

## Act 3 -- Inspect state and transitions

> You're debugging a footstep bug and need to see the full state
> machine history, active sequences, and context snapshot.

The built-in demo includes an `inspect` command. To see just the
inspection output in machine-readable form:

```bash
toneforge runtime --seed 42 --json
```

Look for the line with `"cmd":"inspect"` in the JSONL output. It
contains the full runtime inspection:

- `state.machineName` -- the state machine name ("movement")
- `state.currentState` -- the active state at inspection time
- `state.transitions` -- array of all transitions with timestamps
- `context` -- current environment dimensions
- `eventCount` -- total events fired in this session
- `activeSequences` -- which sequence presets are currently active

> [!commentary]
> The inspect API is designed for tooling integration. Game engines can
> poll `inspect()` to display real-time state overlays. QA scripts can
> assert on transition counts and timing. The `transitions` array acts
> as a flight recorder showing exactly what happened and when.

## Act 4 -- Custom scripts

> You need to test a specific sequence of state changes that matches
> your game's actual state flow.

Create a JSON script file:

```bash
toneforge runtime --script my-test-script.json --seed 100
```

The script format is a JSON array of command objects:

```json
[
  { "cmd": "start" },
  { "cmd": "context.set", "args": { "surface": "stone" } },
  { "cmd": "state.set", "args": { "state": "walk" } },
  { "cmd": "state.set", "args": { "state": "sprint" } },
  { "cmd": "inspect" },
  { "cmd": "stop" }
]
```

Available commands: `start`, `stop`, `context.set`, `state.set`,
`inspect`, `log`.

> [!commentary]
> Custom scripts let you reproduce specific scenarios. If QA reports
> "footsteps glitch when jumping from walk to sprint on gravel," you
> write a script that does exactly that, run it with `--json`, and
> inspect the event log. Same seed, same script, same output -- every
> time.

## Act 5 -- JSON event log for pipeline integration

> You're building an asset pipeline that needs to verify runtime
> behavior programmatically.

```bash
toneforge runtime --seed 42 --json
```

Every line of JSONL output is a structured event. Command results
include `cmd`, `from`/`to` for transitions, and `changes` for context
updates. Log entries include `sessionId`, `event.id`, `event.type`,
`event.timestamp`, `event.seed`, and `event.detail` with the full
context snapshot at the time of each event.

> [!commentary]
> The JSONL format is designed for `jq`, test assertions, and log
> aggregation. Each event carries enough context to reconstruct the
> full session state at any point. The `event.detail` object includes
> both the original recipe name and the resolved name after context
> substitution, so you can trace exactly how context affected each
> sound event.

## PRD Mapping

This demo validates requirements from three PRDs:

| PRD | Key Requirements Demonstrated |
|-----|-------------------------------|
| `RUNTIME_PRD.md` | `start()`/`stop()`, seed-driven determinism, event logging, voice scheduling |
| `STATE_PRD.md` | `set("movement", "walk")`, transition validation, `inspect()` with history, sequencer mapping |
| `CONTEXT_PRD.md` | `set({ surface: "gravel" })`, dimension validation, change logging, recipe resolution |

### Movement State Machine

| State | Sequence Preset | Cadence | Intensity |
|-------|----------------|---------|-----------|
| idle | (none) | -- | -- |
| walk | `footsteps_walk` | 0.60s | 0.70 |
| run | `footsteps_run` | 0.35s | 0.85 |
| sprint | `footsteps_sprint` | 0.25s | 1.00 |

### Context Dimensions

| Dimension | Valid Values | Effect |
|-----------|-------------|--------|
| surface | stone, gravel | Recipe resolver: `footstep-stone` or `footstep-gravel` |

### Recipe Resolution

The runtime's recipe resolver intercepts each event name before
rendering. When the event starts with `footstep-`, the suffix is
replaced with the current `surface` context value. This allows the
same sequence preset to produce different sounds based on environment.
