# ToneForge

A procedural audio platform that generates placeholder sound effects instantly, so development never stalls waiting for final audio assets.

ToneForge lets developers generate placeholder sounds from recipes and seeds during prototyping — exploring variations in seconds, sharing reproducible results via seed numbers, and building with real audio feedback from day one. When the sound designer delivers final assets, swap them in. Every output is deterministic: same seed + same recipe = same result, across machines and runs.

## What It Does

- **Generate** -- Procedural and sample-hybrid sound synthesis via the Web Audio API (browser-native, with optional offline rendering in Node.js)
- **Compose** -- Layer multiple sounds into stacks with per-layer gain, pan, and sample-accurate timing
- **Sequence** -- Schedule sounds into temporal patterns with state-driven transitions and probabilistic variation
- **Analyze** -- Extract audio features (envelope, spectral, loudness, transient) in batch
- **Classify** -- Semantic labeling via rule-based and AI model inference, with human correction
- **Explore** -- Sweep parameter spaces, discover outliers, rank and cluster variants
- **Store** -- Structured library with metadata indexing, similarity search, and deterministic regeneration
- **Deploy** -- Real-time playback engine with seed-based variation and baked fallback, targeting browser and Node.js

## What It Is Not

ToneForge is not a DAW, a music sequencer, a black-box AI audio generator, or a replacement for sound designers. It generates placeholder and prototype audio so teams can develop with sound from the start. Final assets come from your sound designer — ToneForge makes sure you're never blocked waiting for them.

## Status

MVP complete. The `generate` command renders and plays a procedural sci-fi UI confirm sound with seed-based variation and verified byte-level determinism.

## Getting Started

```bash
git clone <repo-url> && cd ToneForge
npm install
```

On local development machines, `npm install` runs a safe postinstall step that attempts `npm link`, making two CLI commands available on your PATH:

- **`tf`** -- short alias (recommended for daily use)
- **`toneforge`** -- full name (used in demos and documentation)

Both commands are identical -- they run `bin/dev-cli.js`, which loads `src/cli.yargs.ts` (and the current CLI pipeline) directly via tsx. No build step is needed, and source changes are reflected immediately.

The command migration matrix and cutover gates are tracked in `docs/cli-cutover-checklist.md`.

### Quick start

```bash
tf generate --recipe ui-scifi-confirm --seed 42
```

### Run the interactive demo

```bash
npm run demo
```

The guided walkthroughs live in [`demos/`](demos/) -- see the
[Demo Index](demos/README.md#demo-index) for the full list. For a
machine-consumption example, [`demos/machine-use.md`](demos/machine-use.md)
walks through [`scripts/report-available-sounds.sh`](scripts/report-available-sounds.sh),
a reusable batch script that consumes `toneforge list recipes --json`,
filters out already-used sounds, and reports the remaining candidates as
text or JSON -- useful when automating asset discovery in a build or CI
pipeline.

### Run the web demo

Starts the backend server and Vite dev server:

```bash
npm run dev:web
```

### Run the runtime audio demo

The runtime is **render-backed**: a scripted session drives State and Context
changes, each runtime event resolves to a recipe through a recipe resolver,
and the existing offline renderer mixes the result — no second synthesis
engine. Playing it lets you *hear* behaviour change (a footstep moving from
stone to gravel, then walking to sprinting) instead of reading an event log:

```bash
toneforge runtime demo
```

The demo is deterministic (a fixed seed reproduces the same event log and the
same rendered samples) and can be verified in CI without audio hardware:

```bash
toneforge runtime demo --json                 # print the resolved event timeline
toneforge runtime demo --output ./runtime-demo/  # export WAVs + timeline.json
toneforge runtime demo --seed 7 --json          # seed override
```

The scenario lives in [`presets/runtime/footsteps.json`](presets/runtime/footsteps.json).
See [RUNTIME_PRD.md §19](docs/prd/RUNTIME_PRD.md) for the render/playback
pipeline design.

### Drive the runtime live

`runtime start` opens a **live session** — the runtime embeds in a host and
reacts to commands as they arrive, rendering each event through a bounded LRU
buffer cache and scheduling it for playback at its sequence-relative time:

```bash
toneforge runtime start
# runtime> start walk          # begin continuous footsteps
# runtime> context surface=gravel
# runtime> param footstep-gravel pitch 1.5   # audible on the next loop pass
# runtime> state sprint
# runtime> stop
# runtime> quit
```

`start` runs a **continuous transport** that keeps the active sequence looping;
`state`/`context` changes reconfigure it live and `stop` halts it. Each
iteration uses a distinct deterministic seed, so the loop evolves rather than
repeating identically. `param <id> <name> <value>` adjusts a continuous sound's
`intensity`, `gain`, `pitch` or `filter`; because a whole WAV is rendered per
event, the change is audible on the **next loop pass** (iteration-granular).

For deterministic, non-interactive replay (and CI), use a command script —
`--json` streams one JSON object per runtime event and performs no playback,
and `--iterations` bounds the loop so it terminates:

```bash
toneforge runtime start --script ./session.txt
toneforge runtime start --script ./session.txt --iterations 4
toneforge runtime start --script ./session.txt --json --iterations 4
toneforge runtime start --cache-size 128 --no-seed-variation
```

For a **long-running service**, `--serve` keeps the runtime alive and
processing commands over time: it does not require a TTY, does not exit when
stdin closes, and shuts down cleanly on `SIGINT`/`SIGTERM` or a `quit` command:

```bash
toneforge runtime start --serve
```

See [RUNTIME_PRD.md §19](docs/prd/RUNTIME_PRD.md) and
[Browser Runtime Usage](docs/browser-usage.md).

### Browser support

ToneForge is Runtime-aware: the Runtime, renderer, and recipe registry run in
the browser using the native Web Audio API. `node-web-audio-api` is an optional
dependency used only for offline rendering in Node.js and is never bundled into
browser builds. See [Using ToneForge in the Browser](docs/browser-usage.md) for
installation, the Runtime API, and recipe-rendering examples.

### Web demo — CI-safe CLI in the PTY

The web demo spawns a terminal PTY for the frontend to execute CLI commands.
To make `toneforge` and `tf` resolvable inside that PTY without a global
`npm link`, the server prepends a shim directory (`bin/tf-shim/`) to the
PTY `PATH` at startup. The shim scripts delegate to `bin/dev-cli.js`, so the
commands work in CI and on any machine.

### Troubleshooting

In CI, the postinstall step skips linking automatically. If linking is unavailable locally (permissions/restricted environments), you'll see a non-failing message and can use the loader script directly:

```bash
./bin/dev-cli.js generate --recipe ui-scifi-confirm --seed 42
```

The `docs/prd/` directory contains detailed product requirements documents for planned modules beyond the MVP.

## Planned Tech Stack

- JavaScript / TypeScript
- Native [Web Audio API](https://developer.mozilla.org/docs/Web/API/Web_Audio_API) in the browser
- Offline rendering via `OfflineAudioContext` (browser-native, or `node-web-audio-api` in Node.js)
- WAV export
- JSON configuration for presets, stacks, sequences, and library entries
- npm distribution

## Architecture

ToneForge is organized as a pipeline of modular layers:

| Layer | Modules |
|---|---|
| Sound creation | Core, Stack, Sequencer |
| Playback | Runtime, Mixer |
| Analysis | Analyze, Classify, Explore |
| Storage | Library |
| Intelligence | Intelligence, Intent, Memory |
| Behavior | State, Context |
| Output | Visualizer, Haptics, Palette |
| Production | CLI, Compiler, Validator, Integrations, Network, Marketplace |

Each module has a dedicated PRD in `docs/prd/`.

## Planned CLI

Commands beyond the MVP (not yet implemented):

```
toneforge generate --recipe laser --seed 42 --output laser.wav
toneforge stack --config stack.json --output combo.wav
toneforge analyze --input sound.wav --features envelope,spectral
toneforge explore --recipe laser --sweep gain:0.1-1.0 --count 100
toneforge library add --input sound.wav --tags "weapon,laser"
```

## Documentation

- [System Architecture PRD](docs/prd/PRD.md)
- [Core Module PRD](docs/prd/CORE_PRD.md)
- [ToneGraph v0.1 Specification](docs/tonegraph.md)
- [Casual Game Recipe Book](docs/recipe-book/index.md) — a guided tour of 100 procedural recipes, from single-oscillator blips to layered stings.
- [Browser Runtime Usage](docs/browser-usage.md)
- [Mixer Rules](docs/mixer-rules.md)
- [Visualizer](docs/visualizer.md)
- [Haptics](docs/haptics.md)
- [All Module PRDs](docs/prd/)
- [Research Questions](docs/prd/BRAINSTORM_QUESTIONS.md)

## License

ToneForge is released under the [MIT License](LICENSE).
