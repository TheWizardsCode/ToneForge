# ToneForge

A procedural audio production platform that treats sound as deterministic, inspectable, and reusable behavior rather than static assets.

ToneForge lets you define sound effects as code -- generated from recipes and seeds, composed into layered stacks, sequenced into time-based behaviors, and analyzed or classified at scale. Every output is reproducible: same seed + same recipe = same result.

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

ToneForge is not a DAW, a music sequencer, a black-box AI audio generator, or a replacement for runtime audio engines like FMOD or Wwise. It produces the sound assets and behaviors those tools consume.

## Status

This project is in the architecture and design phase. No source code has been written yet. The `docs/prd/` directory contains detailed product requirements documents for each module.

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
