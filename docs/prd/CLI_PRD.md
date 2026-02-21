Below is a **complete, standalone Product Requirements Document (PRD)** for **ToneForge CLI**, written to integrate cleanly with the ToneForge ecosystem and support automation, CI/CD, and large‑scale procedural audio workflows.

---

# 🖥️ ToneForge CLI  
## Product Requirements Document (PRD)

---

## 1. Product Overview

### Product Name  
**ToneForge CLI**

### Description  
ToneForge CLI is the **command‑line interface** for the ToneForge ecosystem. It provides a **scriptable, automatable, and deterministic** way to generate, analyze, classify, explore, stack, export, and manage procedural sound effects at scale.

ToneForge CLI is designed for:
- build pipelines
- CI/CD systems
- batch asset generation
- headless environments
- power users and technical sound designers

It is the **primary automation surface** for ToneForge.

---

## 2. Role in the ToneForge Ecosystem

ToneForge CLI spans the entire lifecycle:

```
Author → Generate → Stack → Analyze → Classify → Explore → Store → Integrate → Ship
```

Its purpose is to:
- expose all ToneForge capabilities non‑interactively
- enable reproducible builds
- support large‑scale sound generation
- integrate with existing toolchains
- eliminate manual asset handling

---

## 3. Design Goals

### Primary Goals
- Deterministic, repeatable execution
- Script‑friendly interface
- Clear, composable commands
- JSON‑based configuration
- CI‑safe operation
- Cross‑platform support

### Non‑Goals
- Interactive sound editing
- GUI replacement
- Real‑time audio playback
- AI model training

---

## 4. Core Concepts

---

## 4.1 Command Model

ToneForge CLI uses a **verb‑first command structure**:

```
toneforge <command> [options]
```

Commands are:
- composable
- idempotent where possible
- explicit in side effects

---

## 4.2 Configuration

All commands support:
- inline flags
- JSON config files
- environment variables

Configuration precedence:
1. CLI flags  
2. Config file  
3. Environment variables  
4. Defaults  

---

## 5. Core Commands

---

## 5.1 `generate`

Generates procedural or hybrid sound effects.

```bash
toneforge generate \
  --recipe footstep \
  --variant gravel \
  --count 1000 \
  --seed-range 1000:2000
```

### Options
- `--recipe`
- `--variant`
- `--count`
- `--seed`
- `--seed-range`
- `--duration`
- `--samples`

---

## 5.2 `stack`

Renders layered sound events using ToneForge Stack.

```bash
toneforge stack \
  --preset explosion_heavy.json \
  --export wav
```

---

## 5.3 `analyze`

Runs ToneForge Analyze on audio assets.

```bash
toneforge analyze \
  --input ./renders \
  --output ./analysis
```

---

## 5.4 `classify`

Runs ToneForge Classify on analyzed sounds.

```bash
toneforge classify \
  --analysis ./analysis \
  --output ./classification
```

---

## 5.5 `explore`

Performs procedural sound exploration.

```bash
toneforge explore \
  --recipe creature \
  --seed-range 0:10000 \
  --keep-top 200
```

---

## 5.6 `library`

Manages ToneForge Library assets.

```bash
toneforge library list --category ui
toneforge library export --format wav
```

---

## 5.7 `compile`

Compiles a curated library into production assets.

```bash
toneforge compile \
  --category footsteps \
  --format wav \
  --validate
```

---

## 6. Batch & Pipeline Support

ToneForge CLI is designed for **large‑scale batch execution**.

### Features
- parallel processing
- resumable jobs
- progress reporting
- partial failure recovery

---

## 7. Determinism & Reproducibility

ToneForge CLI guarantees:
- same inputs → same outputs
- explicit version locking
- deterministic seed handling
- reproducible builds across machines

Each run records:
- ToneForge version
- command invocation
- configuration hash
- timestamps

---

## 8. Output Artifacts

Depending on command, outputs may include:
- WAV files
- JSON presets
- analysis metadata
- classification metadata
- logs and reports

All outputs are:
- structured
- machine‑readable
- versioned

---

## 9. Error Handling & Logging

### Error Handling
- clear exit codes
- descriptive error messages
- non‑fatal warnings where possible

### Logging
- human‑readable console output
- optional JSON logs for CI
- verbosity levels

---

## 10. CI/CD Integration

ToneForge CLI is safe for:
- headless execution
- sandboxed environments
- automated builds

Supports:
- fail‑fast validation
- artifact caching
- incremental builds

---

## 11. Security & Stability

- No dynamic code execution
- Explicit file access
- Predictable resource usage
- Safe for shared build agents

---

## 12. Performance Targets

- Fast startup time
- Efficient batch processing
- Scales to tens of thousands of sounds
- Minimal memory overhead

---

## 13. Extensibility

ToneForge CLI supports:
- plugin commands
- custom recipes
- external integrations
- future module expansion

---

## 14. Documentation & Help

Built‑in help system:

```bash
toneforge help
toneforge generate --help
```

Includes:
- command descriptions
- option explanations
- usage examples

---

## 15. Why ToneForge CLI Matters

Without a CLI:
- procedural audio cannot scale
- automation breaks down
- reproducibility is fragile

ToneForge CLI turns ToneForge into a **production‑grade audio pipeline**, enabling:
- massive asset generation
- deterministic builds
- seamless integration into modern workflows

---

## 16. Summary

ToneForge CLI is the **automation backbone** of the ToneForge ecosystem.  
It exposes every major capability through a clean, scriptable interface—making procedural audio generation reliable, scalable, and production‑ready.

---

If you want next, the natural follow‑ups are:
- a CLI command reference spec
- CI pipeline examples
- or a plugin architecture design
