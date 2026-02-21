Absolutely — **ToneForge State** is a *keystone module*. It’s the missing layer that turns ToneForge from a powerful procedural system into a **coherent behavioral engine**.

Below is a **complete, standalone PRD** for **ToneForge State**, written to integrate cleanly with Sequencer, Runtime, Intelligence, and Visualizer without overlapping responsibilities.

---

# 🔁 ToneForge State  
## Product Requirements Document (PRD)

---

## 1. Product Overview

### Product Name  
**ToneForge State**

### Description  
ToneForge State is the **formal state‑machine and behavioral context module** of the ToneForge ecosystem. It defines **discrete and continuous states** that drive how sound and visuals behave over time, enabling adaptive, reactive, and intentional audio‑visual systems.

ToneForge State does **not** generate sound or visuals.  
It defines **why behavior changes**.

---

## 2. Role in the ToneForge Ecosystem

ToneForge State sits **above Sequencer and Runtime**, influencing behavior without directly producing output:

```
Core → Stack → Sequencer → Runtime
                 ↑
               State
                 ↑
           Intelligence
                 ↓
            Visualizer
```

Its purpose is to:
- model behavioral transitions
- unify audio and visual responses
- provide a shared vocabulary for systems
- eliminate ad‑hoc conditional logic
- enable scalable adaptive behavior

---

## 3. Design Goals

### Primary Goals
- Explicit, inspectable state definitions
- Deterministic transitions
- Runtime‑safe evaluation
- Shared state across audio and visuals
- Human‑readable configuration
- Intelligence‑aware but not AI‑dependent

### Non‑Goals
- AI decision‑making
- Procedural generation
- Timeline sequencing
- Asset storage

---

## 4. Core Concepts

---

## 4.1 State

A **state** represents a meaningful behavioral mode.

Examples:
- idle
- walk
- run
- sprint
- alert
- combat
- cooldown
- disabled

States are **semantic**, not technical.

---

## 4.2 State Machine

A **state machine** defines:
- valid states
- allowed transitions
- transition conditions
- entry and exit hooks

```json
{
  "states": ["idle", "walk", "run"],
  "initial": "idle",
  "transitions": [
    { "from": "idle", "to": "walk", "condition": "speed > 0.1" },
    { "from": "walk", "to": "run", "condition": "speed > 0.6" }
  ]
}
```

---

## 4.3 State Parameters

States may expose **continuous parameters**:

- speed
- intensity
- tension
- fatigue
- alertness

These parameters influence Sequencer timing, Stack selection, and Visualizer output.

---

## 5. Integration with Other Modules

---

## 5.1 ToneForge Sequencer

State controls:
- which sequences are active
- tempo scaling
- probabilistic variation
- pattern switching

Example:
- walk → slower footstep sequence
- run → faster, heavier sequence

---

## 5.2 ToneForge Runtime

Runtime queries State to:
- select appropriate stacks
- adjust playback parameters
- ensure deterministic behavior

State evaluation is lightweight and frame‑safe.

---

## 5.3 ToneForge Visualizer

Visualizer uses State to:
- change motion profiles
- adjust color intensity
- scale visual energy
- synchronize visual transitions with sound

---

## 5.4 ToneForge Intelligence

Intelligence:
- observes state usage
- suggests state refinements
- detects over‑complexity
- recommends simplifications

State changes are **never automatic** without approval.

---

## 6. State Definition Schema

```json
{
  "name": "movement",
  "states": {
    "idle": {
      "sequencer": "footstep_idle",
      "visualStyle": "calm"
    },
    "walk": {
      "sequencer": "footstep_walk",
      "visualStyle": "neutral"
    },
    "run": {
      "sequencer": "footstep_run",
      "visualStyle": "energetic"
    }
  }
}
```

---

## 7. Transition Conditions

Transitions may depend on:
- numeric thresholds
- boolean flags
- external signals
- time spent in state

Conditions are **pure and deterministic**.

---

## 8. Runtime API

```js
stateMachine.set("movement", "walk");
stateMachine.update({ speed: 0.4 });
```

State changes propagate to:
- Sequencer
- Runtime
- Visualizer

---

## 9. Determinism & Safety

ToneForge State guarantees:
- no hidden transitions
- explicit conditions
- reproducible behavior
- no side effects

State machines are validated before runtime use.

---

## 10. Debugging & Visualization

Optional tooling includes:
- current state inspection
- transition logs
- state timelines
- conflict detection

This makes behavior **observable and debuggable**.

---

## 11. Performance Targets

- Constant‑time state evaluation
- Minimal memory footprint
- Safe for per‑frame updates
- Scales to dozens of concurrent state machines

---

## 12. Use Cases

- Footstep behavior
- Combat audio escalation
- UI interaction modes
- Environmental ambience shifts
- Creature behavior cycles
- Accessibility modes

---

## 13. Future Extensions

- Hierarchical states
- Parallel state machines
- State blending
- Network‑synchronized states
- Designer‑friendly visual editors

---

## 14. Why ToneForge State Matters

Without a formal state layer:
- behavior logic fragments
- audio and visuals drift apart
- systems become brittle

ToneForge State provides:
- clarity
- consistency
- scalability
- shared intent

It turns procedural systems into **coherent behaviors**.

---

## 15. Summary

ToneForge State is the **behavioral backbone** of the ToneForge ecosystem.  
It defines *why* sound and visuals change, enabling adaptive, expressive, and deterministic audio‑visual systems without complexity creep.

---

If you want next, the strongest follow‑ups are:
- a PRD for ToneForge Context
- a state + sequencer interaction spec
- or a comparison to Wwise/FMOD state systems
