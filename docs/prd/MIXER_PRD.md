ToneForge Mixer is the **last missing real‑time control layer** that turns ToneForge from a behavior engine into a **fully coherent audio‑visual system under load**. It is *not* a traditional mixer — it is a **behavior‑aware, intent‑driven mixing system**.

Below is a **complete, standalone PRD** for **ToneForge Mixer**, written to integrate cleanly with State, Context, Sequencer, Runtime, Visualizer, and Intelligence.

---

# 🎚️ ToneForge Mixer  
## Product Requirements Document (PRD)

---

## 1. Product Overview

### Product Name  
**ToneForge Mixer**

### Description  
ToneForge Mixer is the **behavior‑aware mixing and routing layer** of the ToneForge ecosystem. It dynamically balances, routes, attenuates, and prioritizes sound and visual outputs based on **state, context, intent, and system constraints**.

ToneForge Mixer does **not** generate sound or visuals.  
It controls **how multiple behaviors coexist**.

---

## 2. Role in the ToneForge Ecosystem

ToneForge Mixer operates **at runtime**, downstream of behavior definition and upstream of final output:

```
State / Context
      ↓
   Sequencer
      ↓
   Runtime
      ↓
    Mixer
      ↓
 Audio Output / Visual Output
```

Its purpose is to:
- prevent audio chaos under load
- enforce behavioral priorities
- adapt mixing dynamically
- maintain clarity and intent
- unify audio and visual intensity control

---

## 3. Design Goals

### Primary Goals
- Behavior‑aware mixing decisions
- Deterministic runtime behavior
- Low‑latency, low‑overhead execution
- Unified audio + visual intensity control
- Explicit, inspectable rules

### Non‑Goals
- DAW‑style mixing
- Manual automation curves
- Offline rendering
- Creative sound design

---

## 4. Core Concepts

---

## 4.1 Mix Group

A **mix group** represents a semantic category, not a channel strip.

Examples:
- footsteps
- UI
- combat
- ambience
- dialogue
- alerts

Mix groups are defined by **intent**, not signal type.

---

## 4.2 Priority

Each mix group has a **priority level** that determines dominance under contention.

Example:
- dialogue > UI > combat > ambience

Priority is dynamic and context‑aware.

---

## 4.3 Mix Rules

Mixing behavior is defined declaratively:

```json
{
  "when": { "state": "combat" },
  "then": {
    "duck": ["ambience"],
    "boost": ["combat"],
    "limit": ["ui"]
  }
}
```

Rules are deterministic and overrideable.

---

## 5. Integration with Other Modules

---

### 5.1 ToneForge State

State influences:
- mix priorities
- ducking behavior
- intensity scaling

Example:
- entering combat raises combat priority automatically

---

### 5.2 ToneForge Context

Context influences:
- spatial balance
- environmental attenuation
- accessibility adjustments

Example:
- indoor context reduces reverb and ambience width

---

### 5.3 ToneForge Sequencer

Sequencer informs:
- upcoming event density
- rhythmic emphasis
- pre‑emptive ducking

Mixer can prepare for bursts before they occur.

---

### 5.4 ToneForge Runtime

Runtime executes Mixer decisions in real time:
- gain changes
- routing
- voice limiting

Mixer never blocks Runtime execution.

---

### 5.5 ToneForge Visualizer

Mixer controls **visual intensity** alongside audio:

- particle density
- motion amplitude
- brightness scaling

This keeps sound and visuals perceptually aligned.

---

### 5.6 ToneForge Intelligence

Intelligence may:
- suggest mix rule refinements
- detect masking or fatigue
- recommend priority adjustments

Mixer never auto‑applies suggestions without approval.

---

## 6. Mixing Capabilities

ToneForge Mixer supports:

- Dynamic ducking
- Priority‑based attenuation
- Voice limiting
- Contextual gain scaling
- Cross‑modal intensity alignment
- Accessibility‑aware adjustments

All operations are **lightweight and deterministic**.

---

## 7. Runtime API

```js
mixer.setContext(context);
mixer.updateState(state);
mixer.applyRules();
```

Mixer updates are:
- incremental
- non‑blocking
- frame‑safe

---

## 8. Determinism & Safety

ToneForge Mixer guarantees:
- no hidden automation
- explicit rule evaluation
- reproducible behavior
- bounded gain changes

All mix decisions are inspectable.

---

## 9. Debugging & Tooling

Optional tooling includes:
- live mix visualization
- priority graphs
- ducking timelines
- conflict detection

This makes runtime behavior **observable and debuggable**.

---

## 10. Performance Targets

- Constant‑time rule evaluation
- Minimal CPU overhead
- Scales to dozens of concurrent mix groups
- Safe for low‑power platforms

---

## 11. Use Cases

- Combat vs ambience balancing
- UI clarity under load
- Dialogue intelligibility
- Accessibility mixing modes
- Visual overload prevention

---

## 12. Future Extensions

- Per‑listener mixing
- Network‑synchronized mixing
- Adaptive loudness targets
- Player‑customizable mix profiles
- Cross‑project mix templates

---

## 13. Why ToneForge Mixer Matters

Without a behavior‑aware mixer:
- procedural systems overwhelm players
- clarity degrades under load
- sound and visuals drift apart

ToneForge Mixer ensures:
- intent is preserved
- systems remain readable
- experiences stay comfortable

---

## 14. Summary

ToneForge Mixer is the **real‑time arbitration layer** of the ToneForge ecosystem.  
It ensures that sound and visuals coexist coherently under dynamic conditions, preserving clarity, intent, and comfort without manual intervention.

It is the difference between **many systems playing at once** and **one system speaking clearly**.

---

If you want next, the strongest follow‑ups are:
- a Mixer + Accessibility spec
- example mix rulesets for different genres
- or a comparison to traditional middleware mixing models
