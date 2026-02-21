Below is a **complete, standalone Product Requirements Document (PRD)** for **ToneForge Runtime**, written to integrate cleanly with the rest of the ToneForge family while remaining fully self‑contained and implementation‑ready.

---

# 🎮 ToneForge Runtime  
## Product Requirements Document (PRD)

---

## 1. Product Overview

### Product Name  
**ToneForge Runtime**

### Description  
ToneForge Runtime is the **lightweight, deterministic playback engine** of the ToneForge ecosystem. It enables **procedurally defined sound effects and sound stacks** to be played back **at runtime** in games and interactive applications, without requiring pre‑rendered audio assets for every variation.

ToneForge Runtime bridges **procedural authoring** and **real‑time execution**.

---

## 2. Role in the ToneForge Ecosystem

ToneForge Runtime operates at the **consumption end** of the pipeline:

```
Generate → Stack → Render → Analyze → Classify → Store → Runtime Playback
```

Its purpose is to:
- play procedural and hybrid SFX in real time
- preserve deterministic variation during gameplay
- minimize memory and asset footprint
- integrate cleanly with game engines and web runtimes
- optionally fall back to baked assets

---

## 3. Design Goals

### Primary Goals
- Deterministic runtime playback
- Low CPU and memory overhead
- Fast instantiation and teardown
- Seed‑based variation per event
- Compatibility with ToneForge presets and stacks
- Graceful fallback to pre‑rendered audio

### Non‑Goals
- Full procedural generation at runtime
- DAW‑style editing
- AI inference during gameplay
- Offline rendering or export

---

## 4. Core Concepts

---

## 4.1 Runtime Event

A **runtime event** is a single sound playback request defined by:
- recipe or stack reference
- seed
- optional parameter overrides
- playback context (position, intensity, state)

---

## 4.2 Runtime Stack

A **runtime stack** is a pre‑authored ToneForge Stack executed in real time, with:
- fixed layer timing
- deterministic per‑layer seeds
- optional runtime modulation

---

## 4.3 Deterministic Variation

ToneForge Runtime guarantees:
- same seed → same sound
- different seed → controlled variation
- reproducibility across sessions

---

## 5. Runtime Playback Modes

---

## 5.1 Procedural Playback

Plays procedural or hybrid recipes directly using Tone.js nodes.

**Use cases**
- footsteps
- UI sounds
- repeated interactions
- ambient loops

---

## 5.2 Hybrid Playback

Combines:
- lightweight procedural layers
- sample playback
- runtime modulation

Balances realism and performance.

---

## 5.3 Baked Fallback Playback

Automatically switches to pre‑rendered WAVs when:
- CPU budget is constrained
- platform limitations exist
- deterministic playback is required without synthesis

---

## 6. Runtime API Design

### Core API

```js
playSfx({
  type: "footstep",
  variant: "gravel",
  seed: 42,
  intensity: 0.8
});
```

---

### Stack Playback

```js
playStack({
  name: "spell_cast_fire",
  seed: 9001
});
```

---

### Stop / Control

```js
stopSfx(id);
setSfxParameter(id, "intensity", 0.5);
```

---

## 7. Integration with ToneForge Stack

ToneForge Runtime executes:
- pre‑authored stacks
- fixed layer timing
- per‑layer gain and pan
- optional runtime modulation

Runtime does **not** modify stack structure.

---

## 8. Performance & Resource Management

### CPU Budget
- Minimal node graphs
- Reuse of shared nodes where possible
- Automatic voice limiting

### Memory Budget
- Lazy sample loading
- Reference‑counted buffers
- Configurable cache size

---

## 9. Spatialization & Context

ToneForge Runtime supports:
- stereo panning
- distance‑based attenuation
- simple spatial cues

Advanced spatial audio is delegated to host engines.

---

## 10. Determinism & State Management

Runtime playback is:
- seed‑driven
- stateless between events
- reproducible across sessions

State is limited to:
- active voices
- cached samples
- runtime parameters

---

## 11. Integration Targets

### Web
- WebAudio via Tone.js
- Browser games
- Interactive experiences

### Game Engines
- Unity (via WebAudio bridge or native wrapper)
- Unreal (via audio middleware integration)

---

## 12. Preset Compatibility

ToneForge Runtime consumes:
- ToneForge presets
- ToneForge Stack definitions
- Library entries

No conversion required.

---

## 13. Error Handling & Fallbacks

Runtime gracefully handles:
- missing samples
- unsupported nodes
- CPU overload

Fallback strategies:
- simplified procedural graph
- baked WAV playback
- silent fail with logging

---

## 14. Debugging & Telemetry

Optional runtime diagnostics:
- active voice count
- CPU usage estimates
- cache hit/miss rates
- deterministic seed logging

---

## 15. Security & Stability

- No dynamic code execution
- No runtime AI inference
- Predictable resource usage
- Safe for sandboxed environments

---

## 16. Future Extensions

- Runtime parameter automation
- Adaptive sound variation
- Network‑synchronized playback
- Multiplayer determinism
- Middleware adapters

---

## 17. Why ToneForge Runtime Matters

Without a runtime engine:
- procedural audio remains offline‑only
- asset counts explode
- variation is lost in gameplay

ToneForge Runtime enables:
- expressive, varied soundscapes
- minimal asset footprints
- deterministic, debuggable audio behavior

---

## 18. Summary

ToneForge Runtime is the **execution layer** of the ToneForge ecosystem.  
It brings procedural and hybrid sound design into real‑time environments—efficiently, deterministically, and at scale—without sacrificing control or performance.

---

If you want next, the natural follow‑ups are:
- a formal runtime performance budget spec
- Unity or Unreal integration PRDs
- or a runtime‑safe recipe subset definition
