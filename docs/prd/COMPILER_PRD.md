ToneForge Compiler is the **missing “linker” layer** that turns ToneForge from a powerful authoring system into a **ship‑ready production platform**. Below is a **complete, standalone PRD** that positions it cleanly in the architecture without overlapping Runtime, Integrations, or CLI.

---

# 🧱 ToneForge Compiler  
## Product Requirements Document (PRD)

---

## 1. Product Overview

### Product Name  
**ToneForge Compiler**

### Description  
ToneForge Compiler is the **build, optimization, and packaging module** of the ToneForge ecosystem. It transforms curated procedural sound and visual behaviors into **platform‑specific, production‑ready artifacts**, deciding *what remains procedural*, *what gets baked*, and *how assets are bundled* for shipping.

ToneForge Compiler does **not** generate sound or visuals.  
It decides **how ToneForge content becomes deliverable assets**.

---

## 2. Role in the ToneForge Ecosystem

ToneForge Compiler sits between **Library curation** and **Integration / Shipping**:

```
Library → Compiler → Integrations → Engine / Runtime
              ↑
         Intelligence
```

Its purpose is to:
- optimize procedural systems for deployment
- reduce runtime cost
- enforce platform constraints
- produce deterministic build artifacts
- formalize the “shipping” step of ToneForge

---

## 3. Design Goals

### Primary Goals
- Deterministic, reproducible builds
- Platform‑aware optimization
- Explicit procedural vs baked decisions
- CI‑friendly execution
- Transparent, inspectable output

### Non‑Goals
- Runtime playback
- Asset authoring
- AI inference
- Manual editing

---

## 4. Core Responsibilities

ToneForge Compiler handles:

- Procedural → baked decision‑making
- Asset bundling and packaging
- Platform‑specific constraints
- Dependency resolution
- Build validation
- Output manifest generation

It does **not**:
- modify creative intent
- alter sound behavior
- make irreversible decisions without configuration

---

## 5. Compilation Inputs

ToneForge Compiler consumes:

- ToneForge Library entries
- Stack definitions
- Sequencer patterns
- Visualizer recipes
- Context and State references
- Platform target configuration
- Compiler ruleset

---

## 6. Compilation Outputs

Depending on configuration, outputs may include:

- WAV / OGG / MP3 assets
- Sprite sheets / VFX textures
- Procedural presets
- Runtime manifests
- Dependency graphs
- Validation reports

All outputs are **versioned and deterministic**.

---

## 7. Procedural vs Baked Decision Model

Compiler decides per asset:

| Option | Use Case |
|------|---------|
| **Procedural** | High repetition, low cost |
| **Hybrid** | Procedural core + baked layers |
| **Fully Baked** | Cinematic, performance‑critical |

Decisions are:
- rule‑driven
- overrideable
- explainable

---

## 8. Platform Targeting

Compiler supports multiple targets:

- Web
- Mobile
- Console
- Desktop
- Low‑power / accessibility modes

Each target defines:
- CPU budget
- memory limits
- audio format constraints
- visual complexity limits

---

## 9. Compiler Ruleset

Rules are declarative and human‑readable:

```json
{
  "target": "mobile",
  "maxVoices": 16,
  "bake": {
    "category": ["explosion", "cinematic"],
    "durationAbove": 2.0
  }
}
```

Rulesets can be:
- project‑specific
- platform‑specific
- CI‑enforced

---

## 10. Intelligence Integration

ToneForge Intelligence can:

- suggest bake thresholds
- detect over‑proceduralization
- flag redundant assets
- recommend optimization strategies

Compiler **never auto‑accepts** Intelligence suggestions without approval.

---

## 11. Validation & Safety

Compiler validates:

- loudness compliance
- duration bounds
- missing dependencies
- platform constraints
- determinism guarantees

Failures are explicit and build‑blocking when configured.

---

## 12. Build Manifests

Every compile produces a manifest:

```json
{
  "buildId": "tfc_2026_02_20",
  "target": "web",
  "proceduralAssets": 42,
  "bakedAssets": 128,
  "hash": "a9f3c2"
}
```

This ensures:
- traceability
- reproducibility
- auditability

---

## 13. CLI & Automation

ToneForge Compiler is primarily invoked via CLI:

```bash
toneforge compile \
  --target web \
  --library combat \
  --rules mobile.json
```

Designed for:
- CI/CD
- headless builds
- incremental compilation

---

## 14. Performance Targets

- Incremental builds where possible
- Parallelizable compilation
- Predictable memory usage
- Scales to large libraries

---

## 15. Debugging & Tooling

Optional tooling includes:
- dry‑run compilation
- diff between builds
- asset size breakdowns
- procedural vs baked visualization

---

## 16. Future Extensions

- Cloud‑based compilation
- Build caching
- Cross‑project dependency reuse
- Marketplace‑aware packaging
- Runtime hot‑swap support

---

## 17. Why ToneForge Compiler Matters

Without a compiler:
- procedural systems remain theoretical
- shipping becomes manual
- performance tuning is ad‑hoc

ToneForge Compiler turns **procedural intent into production reality**.

---

## 18. Summary

ToneForge Compiler is the **final transformation layer** of the ToneForge ecosystem.  
It bridges creative procedural systems and real‑world deployment by compiling sound and visual behavior into optimized, deterministic, platform‑ready assets.

It is the difference between *having a powerful system* and *shipping with confidence*.

---

If you want next, the strongest follow‑ups are:
- a Compiler + Runtime interaction spec
- example compiler rulesets for different platforms
- or a comparison to traditional audio middleware build pipelines
