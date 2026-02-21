Below is a **revised, system‑level PRD** that replaces the earlier “How It Fits Together” document. This version **explicitly integrates ToneForge Sequencer and ToneForge Intelligence as first‑class architectural layers**, clarifies responsibility boundaries, and tightens the conceptual model so the platform reads as a **coherent sound‑behavior system**, not just a toolchain.

---

# 🧩 ToneForge Platform Architecture  
## System‑Level Product Requirements Document (PRD)

---

## 1. Product Overview

### Product Name  
**ToneForge Platform**

### Description  
ToneForge is a **procedural audio production and execution platform** that treats sound as **deterministic, inspectable, and reusable behavior**, not static assets.

It enables teams to:
- generate sound events procedurally
- compose them into layered structures
- sequence them into time‑based behaviors
- analyze and classify results
- explore large sound spaces
- store and reuse curated outputs
- deploy sounds at runtime or as baked assets
- reason about sound libraries at scale

ToneForge is best understood as a **sound‑event compiler and behavior engine**.

---

## 2. Core Philosophy

### Sound as Behavior
ToneForge models sound across **three axes**:

- **What** a sound is → *Generation & Stack*
- **When** it happens → *Sequencer*
- **Why / how it evolves** → *Intelligence*

This separation allows expressive sound systems without DAW‑style complexity.

---

## 3. High‑Level System Flow

ToneForge is **not a linear pipeline**, but a layered system with feedback loops:

```
Recipes & Samples
        ↓
     Core
        ↓
     Stack
        ↓
   Sequencer
        ↓
     Runtime
        ↓
   (Playback)

        ↓
     Analyze
        ↓
    Classify
        ↓
     Explore
        ↓
     Library
        ↓
   Intelligence
        ↺
```

Each layer can operate independently, but gains power when composed.

---

## 4. Architectural Layers

---

## 4.1 ToneForge Core — Sound Generation

**Responsibility:**  
Define *what a sound is*.

**Handles**
- Procedural synthesis
- Sample‑hybrid recipes
- Seeded determinism
- Offline rendering

**Outputs**
- Audio buffers
- Recipe presets

Core never schedules time or behavior.

---

## 4.2 ToneForge Stack — Event Composition

**Responsibility:**  
Define *how multiple sounds combine into one event*.

**Handles**
- Layering
- Precise offsets
- Gain / pan
- Deterministic orchestration

**Outputs**
- Single sound events
- Stack presets

Stack is **vertical** (layers), not temporal behavior.

---

## 4.3 ToneForge Sequencer — Temporal Behavior

**Responsibility:**  
Define *when sound events occur over time*.

**Handles**
- Event scheduling
- Repetition patterns
- Probabilistic variation
- State‑driven transitions
- Tempo‑aware timing

**Does NOT**
- Generate sound
- Mix layers
- Analyze audio

Sequencer turns **events into behaviors**.

---

## 4.4 ToneForge Runtime — Execution Layer

**Responsibility:**  
Play sound behaviors in real time.

**Handles**
- Procedural playback
- Stack execution
- Sequencer timing
- Seed‑based variation
- Baked fallback

Runtime is **performance‑constrained and deterministic**.

---

## 4.5 ToneForge Analyze — Measurement Layer

**Responsibility:**  
Convert audio into structured numeric data.

**Handles**
- Envelope metrics
- Spectral features
- Loudness
- Transient detection
- Quality flags

Analyze never interprets meaning.

---

## 4.6 ToneForge Classify — Semantic Layer

**Responsibility:**  
Assign meaning to sound.

**Handles**
- Categories
- Materials
- Intensity
- Texture tags
- Similarity embeddings

Classification is **explainable and overrideable**.

---

## 4.7 ToneForge Explore — Discovery Layer

**Responsibility:**  
Navigate large procedural spaces.

**Handles**
- Seed sweeps
- Parameter exploration
- Ranking and clustering
- Outlier discovery

Explore reduces infinite possibility into curated choice.

---

## 4.8 ToneForge Library — System of Record

**Responsibility:**  
Persist sound knowledge.

**Handles**
- Asset storage
- Metadata indexing
- Search & similarity
- Deterministic regeneration
- Versioning

Library is **authoritative and immutable by default**.

---

## 4.9 ToneForge Intelligence — Reasoning Layer

**Responsibility:**  
Reason about sound systems and assist decisions.

**Handles**
- Intent interpretation
- Recommendation generation
- Library optimization
- Exploration guidance
- Sequencer pattern suggestions

**Key Rule:**  
Intelligence **never mutates assets automatically**.  
All actions are suggested, explainable, and human‑approved.

---

## 4.10 ToneForge Integrations & CLI — Delivery Layer

**Responsibility:**  
Connect ToneForge to production reality.

**Handles**
- Automation
- CI/CD
- Engine adapters
- Asset compilation
- Batch workflows

CLI is the **primary orchestration surface**.

---

## 5. Determinism & Provenance

Every sound or behavior carries:

- recipe name
- seed(s)
- stack definition
- sequence definition
- sample references
- analysis metrics
- classification metadata
- version hashes

This guarantees:
- reproducibility
- auditability
- long‑term reuse

---

## 6. Typical System‑Level Workflows

---

### 6.1 Behavioral Runtime Workflow

1. Author recipes
2. Compose stacks
3. Define sequences
4. Deploy via Runtime
5. Use seeds for variation
6. Fall back to baked assets if needed

---

### 6.2 Asset Factory Workflow

1. Generate thousands of events
2. Analyze and classify
3. Explore and curate
4. Store in Library
5. Compile for shipping

---

### 6.3 Intelligence‑Assisted Workflow

1. Explore sound space
2. Intelligence surfaces insights
3. User approves recommendations
4. Library evolves intentionally
5. Sequencer patterns improve over time

---

## 7. What ToneForge Is (and Is Not)

### ToneForge Is
- A sound‑event compiler
- A behavior engine
- A procedural audio platform
- A production‑scale system

### ToneForge Is Not
- A DAW
- A music sequencer
- A black‑box AI generator
- A runtime audio engine replacement

---

## 8. Why This Architecture Works

- **Clear responsibility boundaries**
- **Composable layers**
- **Deterministic behavior**
- **Human‑centered intelligence**
- **Scales from prototype to production**

ToneForge treats audio the way modern systems treat code:
> generated, versioned, analyzed, reasoned about, and reused.

---

## 9. Summary

ToneForge is a **modular, deterministic sound‑behavior platform**.

- Core defines sound
- Stack defines events
- Sequencer defines behavior
- Runtime executes
- Analyze measures
- Classify interprets
- Explore discovers
- Library preserves
- Intelligence guides
- CLI ships

Together, these form a **coherent, future‑proof audio system** that replaces manual asset pipelines with intentional, scalable sound design.

---

If you want next, the strongest follow‑ups are:
- a dependency graph showing module coupling
- a minimal “ToneForge MVP” cut
- or a comparison against Wwise/FMOD at the architectural level
