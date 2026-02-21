Below is a **complete, standalone Product Requirements Document (PRD)** for **ToneForge Explore**, written to integrate cleanly with the ToneForge ecosystem while remaining fully self‑contained and implementation‑ready.

---

# 🧪 ToneForge Explore  
## Product Requirements Document (PRD)

---

## 1. Product Overview

### Product Name  
**ToneForge Explore**

### Description  
ToneForge Explore is the **procedural sound discovery and exploration module** within the ToneForge ecosystem. It enables users to **systematically explore large procedural parameter spaces**, discover interesting or extreme sound variants, cluster results, and curate high‑value sound effects for reuse.

ToneForge Explore does not generate sound primitives directly. It **orchestrates controlled exploration** of existing recipes, stacks, and presets.

---

## 2. Role in the ToneForge Ecosystem

ToneForge Explore operates across generation, analysis, and classification:

```
Generate → Stack → Render → Analyze → Classify → Explore → Store → Reuse
```

Its purpose is to:
- discover novel or high‑quality sounds
- explore parameter and seed spaces efficiently
- surface interesting outliers
- cluster and rank generated sounds
- reduce manual trial‑and‑error sound design

---

## 3. Design Goals

### Primary Goals
- Efficient exploration of large parameter spaces
- Deterministic, reproducible discovery
- Integration with analysis and classification data
- Scalable to thousands of generated sounds
- Human‑guided and automated exploration modes

### Non‑Goals
- Manual sound editing
- Real‑time performance synthesis
- AI‑driven sound generation (uses existing recipes)

---

## 4. Core Concepts

---

## 4.1 Exploration Space

An **exploration space** defines the range of parameters to explore:
- seed ranges
- recipe variants
- layer configurations
- sample toggles
- parameter bounds

```json
{
  "recipe": "creature",
  "seedRange": [0, 10000],
  "parameters": {
    "intensity": [0.2, 1.0],
    "brightness": [0.1, 0.9]
  }
}
```

---

## 4.2 Exploration Run

An **exploration run** is a batch process that:
1. Generates candidate sounds
2. Analyzes them
3. Classifies them
4. Scores and ranks results

---

## 4.3 Scoring & Ranking

Each sound is scored using:
- analysis metrics
- classification confidence
- user‑defined criteria

Example criteria:
- “most aggressive”
- “short and punchy”
- “high transient density”
- “low spectral centroid”

---

## 5. Exploration Modes

---

## 5.1 Seed Sweep

Systematically iterates through seed ranges.

```js
exploreSeeds({
  recipe: "footstep",
  seedRange: [0, 5000],
  keepTop: 100
});
```

---

## 5.2 Parameter Sweep

Explores combinations of parameter values.

```js
exploreParameters({
  recipe: "spell",
  parameters: {
    intensity: [0.3, 0.6, 0.9],
    decay: [0.2, 0.5, 1.0]
  }
});
```

---

## 5.3 Mutation & Variation

Generates variations around a known good sound.

```js
mutatePreset(preset, {
  seedJitter: 50,
  parameterVariance: 0.1
});
```

---

## 5.4 Outlier Discovery

Finds sounds that deviate strongly from the norm.

Uses:
- clustering
- distance metrics
- embedding variance

---

## 6. Integration with Analysis & Classification

ToneForge Explore relies heavily on:
- **ToneForge Analyze** for numeric metrics
- **ToneForge Classify** for semantic labels and embeddings

This enables:
- clustering by similarity
- filtering by category or texture
- ranking by intensity or clarity

---

## 7. Exploration Output

Each exploration run produces:
- ranked sound candidates
- analysis summaries
- classification metadata
- provenance data

```json
{
  "id": "creature_8421",
  "score": 0.91,
  "analysis": {...},
  "classification": {...},
  "preset": "creature_8421.json"
}
```

---

## 8. Curation Workflow

Users can:
- audition results
- flag favorites
- discard low‑quality sounds
- promote selected sounds to the library

```js
promoteToLibrary(candidateId);
```

---

## 9. API Design

### Core API

```js
explore(config)
```

### Example

```js
const results = explore({
  recipe: "impact",
  seedRange: [0, 2000],
  criteria: "highest transient density",
  keepTop: 50
});
```

---

## 10. UI Experience

### Exploration Dashboard
- Recipe selector
- Seed and parameter controls
- Exploration mode selector
- Progress visualization
- Result ranking list

### Result Viewer
- Waveform preview
- Analysis metrics
- Classification tags
- Similarity neighbors
- Promote / discard actions

---

## 11. Performance Targets

- Efficient batch generation
- Parallelizable exploration runs
- Scales to tens of thousands of candidates
- Incremental result streaming

---

## 12. Determinism & Reproducibility

ToneForge Explore guarantees:
- deterministic generation per seed
- reproducible exploration runs
- stored exploration configurations
- auditable discovery paths

---

## 13. Storage & Provenance

Exploration results store:
- exploration configuration
- scoring criteria
- analysis and classification versions
- timestamps

This ensures:
- traceability
- repeatability
- collaborative review

---

## 14. Future Extensions

- Active learning loops
- User‑guided scoring models
- Cross‑project exploration reuse
- Visual clustering maps
- Automated “best of” library generation

---

## 15. Why ToneForge Explore Matters

Procedural systems can generate infinite sounds—but **infinite choice is unusable**.

ToneForge Explore:
- narrows the search space
- surfaces high‑value sounds
- enables creative discovery
- replaces manual trial‑and‑error

It turns procedural generation into **intentional exploration**.

---

## 16. Summary

ToneForge Explore is the **discovery engine** of the ToneForge ecosystem.  
It enables systematic, scalable, and reproducible exploration of procedural sound spaces—bridging raw generation and curated reuse.

---

If you want next, the natural follow‑ups are:
- a PRD for ToneForge Runtime
- a CLI‑driven exploration workflow
- or a visualization‑focused exploration UI
