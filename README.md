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
- [Browser Runtime Usage](docs/browser-usage.md)
- [Mixer Rules](docs/mixer-rules.md)
- [Visualizer](docs/visualizer.md)
- [Haptics](docs/haptics.md)
- [All Module PRDs](docs/prd/)
- [Research Questions](docs/prd/BRAINSTORM_QUESTIONS.md)

## License

ToneForge is released under the [MIT License](LICENSE).
