# ToneForge

A procedural audio platform that generates placeholder sound effects instantly, so development never stalls waiting for final audio assets.

ToneForge lets developers generate placeholder sounds from recipes and seeds during prototyping — exploring variations in seconds, sharing reproducible results via seed numbers, and building with real audio feedback from day one. When the sound designer delivers final assets, swap them in. Every output is deterministic: same seed + same recipe = same result, across machines and runs.

## What It Does

- **Generate** -- Procedural and sample-hybrid sound synthesis via Tone.js
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

MVP complete. The `generate` command renders and plays a procedural sci-fi UI confirm sound with seed-based variation and verified byte-level determinism. Run the interactive demo:

```
npm run demo
```

Or generate a sound directly:

```
npx tsx src/cli.ts generate --recipe ui-scifi-confirm --seed 42
```

The `docs/prd/` directory contains detailed product requirements documents for planned modules beyond the MVP.

## Planned Tech Stack

- JavaScript / TypeScript
- [Tone.js](https://tonejs.github.io/) (Web Audio API)
- Offline rendering via `Tone.Offline`
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

```
toneforge generate --preset laser --seed 42 --output laser.wav
toneforge stack --config stack.json --output combo.wav
toneforge analyze --input sound.wav --features envelope,spectral
toneforge explore --preset laser --sweep gain:0.1-1.0 --count 100
toneforge library add --input sound.wav --tags "weapon,laser"
```

## Documentation

- [System Architecture PRD](docs/prd/PRD.md)
- [Core Module PRD](docs/prd/CORE_PRD.md)
- [All Module PRDs](docs/prd/)
- [Research Questions](docs/prd/BRAINSTORM_QUESTIONS.md)

## License

TBD
