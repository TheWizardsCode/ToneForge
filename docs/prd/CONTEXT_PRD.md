ToneForge Context is a *quietly powerful* module — it doesn’t make sound, visuals, or decisions, but it **grounds every other system in reality**. Below is a **complete, standalone PRD** that positions ToneForge Context as the environmental and situational truth layer of the platform.

---

# 🌍 ToneForge Context  
## Product Requirements Document (PRD)

---

## 1. Product Overview

### Product Name  
**ToneForge Context**

### Description  
ToneForge Context is the **environmental and situational context resolver** for the ToneForge ecosystem. It provides a **unified, deterministic snapshot of the world state** that informs how sound and visuals should behave at any given moment.

ToneForge Context does **not** generate sound, visuals, or behavior.  
It answers the question: **“What is happening around us right now?”**

---

## 2. Role in the ToneForge Ecosystem

ToneForge Context sits **alongside State**, feeding real‑world signals into behavioral systems:

```
Context → State → Sequencer → Runtime
     ↓        ↓
  Analyze   Visualizer
     ↓
 Intelligence
```

Its purpose is to:
- centralize environmental inputs
- eliminate scattered conditionals
- ensure consistent behavior across systems
- provide a shared situational vocabulary
- enable scalable adaptive audio‑visual behavior

---

## 3. Design Goals

### Primary Goals
- Explicit, inspectable context definitions
- Deterministic resolution
- Runtime‑safe evaluation
- Shared access across modules
- Low overhead and high clarity

### Non‑Goals
- Decision‑making
- State transitions
- Procedural generation
- AI inference

---

## 4. Core Concepts

---

## 4.1 Context Snapshot

A **context snapshot** is a structured, read‑only representation of the current environment.

Examples:
- surface type
- location category
- weather
- time of day
- player status
- interaction mode

```json
{
  "surface": "gravel",
  "environment": "outdoor",
  "weather": "rain",
  "timeOfDay": "night",
  "playerState": "moving"
}
```

---

## 4.2 Context Dimensions

Context is composed of **orthogonal dimensions**, not a single state.

Common dimensions include:
- Physical (surface, material)
- Spatial (indoor/outdoor, proximity)
- Temporal (time of day, duration)
- Situational (combat, UI, exploration)
- Systemic (performance mode, accessibility)

Each dimension is optional and extensible.

---

## 4.3 Context Resolution

Context values may come from:
- engine signals
- gameplay systems
- UI layers
- platform constraints
- user preferences

Resolution is **deterministic and explicit**.

---

## 5. Integration with Other Modules

---

## 5.1 ToneForge State

Context **informs** state transitions but does not trigger them directly.

Example:
- Context: `surface = metal`
- State: `movement = walk`
- Result: metal footstep behavior

---

## 5.2 ToneForge Sequencer

Sequencer uses Context to:
- select appropriate patterns
- adjust tempo or density
- enable or disable events

Example:
- rain → more frequent ambient drips
- indoor → reduced echo patterns

---

## 5.3 ToneForge Runtime

Runtime queries Context to:
- select stacks
- apply parameter overrides
- ensure platform‑safe behavior

Context evaluation is lightweight and frame‑safe.

---

## 5.4 ToneForge Visualizer

Visualizer uses Context to:
- adjust color palettes
- scale motion intensity
- alter spatial distribution
- maintain visual coherence

---

## 5.5 ToneForge Intelligence

Intelligence observes Context to:
- detect mismatches (e.g., loud visuals in calm contexts)
- suggest refinements
- guide exploration and optimization

Context is **observed**, never mutated, by Intelligence.

---

## 6. Context Definition Schema

```json
{
  "dimensions": {
    "surface": ["wood", "metal", "gravel"],
    "environment": ["indoor", "outdoor"],
    "weather": ["clear", "rain", "snow"]
  }
}
```

---

## 7. Runtime API

```js
context.set({
  surface: "gravel",
  weather: "rain"
});

const currentContext = context.get();
```

Context updates propagate to:
- State
- Sequencer
- Runtime
- Visualizer

---

## 8. Determinism & Safety

ToneForge Context guarantees:
- no hidden defaults
- explicit values
- predictable resolution
- no side effects

Context changes are logged and inspectable.

---

## 9. Debugging & Tooling

Optional tooling includes:
- live context inspection
- change history
- conflict detection
- visualization overlays

This makes environmental influence **transparent**.

---

## 10. Performance Targets

- Constant‑time access
- Minimal memory footprint
- Safe for per‑frame reads
- Scales to many concurrent contexts

---

## 11. Use Cases

- Footstep material selection
- Ambient sound variation
- UI feedback modes
- Accessibility adjustments
- Performance‑aware behavior
- Visual style adaptation

---

## 12. Future Extensions

- Hierarchical contexts
- Context blending
- Network‑synchronized context
- Context presets
- Designer‑friendly editors

---

## 13. Why ToneForge Context Matters

Without a formal context layer:
- logic fragments across systems
- behavior becomes inconsistent
- scalability suffers

ToneForge Context provides:
- clarity
- consistency
- composability
- shared understanding

It ensures that **sound and visuals respond to the world, not guess at it**.

---

## 14. Summary

ToneForge Context is the **situational truth layer** of the ToneForge ecosystem.  
It captures *what is happening around the system* so that State, Sequencer, Runtime, Visualizer, and Intelligence can behave coherently, deterministically, and at scale.

---

If you want next, the strongest follow‑ups are:
- a Context + State interaction spec
- a Context schema for a specific genre (game/UI/XR)
- or a comparison to traditional “switch/RTPC” systems
