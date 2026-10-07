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
- Offline rendering or export *as a user-facing feature* (the runtime uses offline rendering internally to produce buffers; see §19)

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

Plays procedural or hybrid recipes directly through the ToneForge offline renderer (see §19). The renderer is the single source of audio truth; the runtime does not embed a second synthesis engine.

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

`setSfxParameter(id, name, value)` updates a parameter of a sound that is
already playing, in real time. The initial supported scope is
**continuous/looping sounds** (for example an engine loop whose pitch tracks
RPM); general real-time parameter automation for arbitrary one-shot sounds
remains a Future Extension (§16). Supported parameters are `intensity`,
`gain`, `pitch`, and `filter`, each validated against a documented range
before any state is mutated. See §19.9 for the implementation reference.

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

## 19. Runtime ↔ Render/Playback Pipeline (2026‑10 Revisit)

This section records the outcome of the runtime PRD revisit
(TF‑0MM4M1NXU0WHH6AJ) and supersedes earlier wording that implied a
Tone.js‑only, offline‑only runtime.

### 19.1 The gap

The runtime in `src/runtime/` orchestrates State, Context, and Sequencer and
logs deterministic events, but it never produces audio. The former Demo 9 was
removed because it emitted only simulated transitions as JSONL. This section
defines how the runtime, when asked to play, wires into the existing renderer
and audio player.

### 19.2 Decision: a render‑backed runtime

Runtime playback is **render‑backed**. An event resolves to a concrete recipe
(or sequence/stack); the existing offline renderer produces a deterministic
sample buffer; the runtime schedules that buffer through the host playback
layer. The runtime does not grow a second synthesis engine, and the renderer
remains the single source of audio truth.

Pipeline:

```
Context / State
      ↓
Runtime event  →  recipe resolver  →  render layer
                                       (renderRecipe / renderSequence / renderStack)
      ↓                                        ↓
  event log  ←─────────────────  AudioBuffer cache  →  playback
                                                        (Node WAV player /
                                                         browser AudioContext)
```

### 19.3 Render layer

- `renderRecipe(recipe, seed)`, `renderSequence(...)`, and `renderStack(...)`
  produce Float32 samples at 44.1 kHz mono (the current convention).
- The renderer is pure and deterministic; runtime playback never mutates it.
- Rendering is asynchronous so sample‑backed recipes work unchanged.

### 19.4 Playback layer

- **Node:** encode the rendered buffer with `encodeWav` and hand the file to
  `playAudio` — the same path used by `toneforge play`.
- **Browser:** wrap the buffer in an `AudioBuffer` and schedule an
  `AudioBufferSourceNode` on the shared `AudioContext`.
- Playback is non‑blocking and does not change the runtime event log.

### 19.5 Buffer cache

- Buffers are cached by `(recipe, seed, overrides hash)`.
- The cache is bounded by a configurable limit and evicts deterministically
  (LRU), so repeated events reuse work without unbounded memory growth.

### 19.6 Playback modes (revised)

The three modes in §5 map onto one buffer interface:

| Mode | Implementation |
|---|---|
| Procedural | Render the recipe/sequence now and play the buffer |
| Hybrid | Render procedural layers now, mix with pre‑baked sample layers |
| Baked fallback | Look up a pre‑baked WAV instead of rendering |

### 19.7 Determinism

Same seed + recipe → identical samples → identical playback. Rendering is
independent of runtime state; runtime state remains active voices, the buffer
cache, and runtime parameters.

### 19.8 Audible demo user story

**As a game developer**, I want a scripted runtime demo that plays audible
sound whose recipe changes as state and context change — footsteps changing
from stone to gravel, and from walking to sprinting — so that I can *hear* the
runtime responding to behaviour instead of reading its event log.

The demo is tracked as **TF‑0MUXW66870013DOL** ("Runtime Audio Demo: audible
state‑ and context‑driven playback"), which carries the updated, verifiable
acceptance criteria. This revisit item is complete once this PRD and that work
item's acceptance criteria exist; building the demo is owned by
TF‑0MUXW66870013DOL.

### 19.9 Parameter adjustment

Focused real-time parameter modulation of continuous/looping sounds is
implemented by `runtime.setSfxParameter(id, name, value)` (work item
TF‑0MLYX9DP51U7AQDK). It supports `intensity`, `gain`, `pitch`, and `filter`,
validates names and ranges before mutating state, logs a deterministic
`parameter_change` event, and stores per-sound values keyed by sound id.

General real‑time parameter automation for arbitrary sounds remains a Future
Extension (see §16).

---

If you want next, the natural follow‑ups are:
- the audible runtime demo (TF‑0MUXW66870013DOL)
- a formal runtime performance budget spec
- Unity or Unreal integration PRDs
- or a runtime‑safe recipe subset definition
