Below is a **complete, standalone Product Requirements Document (PRD)** for **ToneForge Classify**, written to integrate cleanly with the ToneForge ecosystem while remaining fully self‑contained and implementation‑ready.

---

# 🧠 ToneForge Classify  
## Product Requirements Document (PRD)

---

## 1. Product Overview

### Product Name  
**ToneForge Classify**

### Description  
ToneForge Classify is an **AI‑assisted semantic classification module** within the ToneForge ecosystem. It assigns **meaningful labels, tags, and similarity embeddings** to rendered sound effects using a combination of **audio analysis data**, **model inference**, and **rule‑based logic**.

ToneForge Classify does **not** generate sound. It interprets sound.

---

## 2. Role in the ToneForge Ecosystem

ToneForge Classify operates after audio analysis and before library storage:

```
Generate → Stack → Render → Analyze → Classify → Store → Reuse
```

Its purpose is to:
- convert numeric audio features into semantic meaning
- automate sound organization at scale
- enable search, filtering, and similarity discovery
- reduce manual tagging and curation effort
- preserve human‑correctable provenance

---

## 3. Design Goals

### Primary Goals
- Accurate semantic labeling
- Scalable batch classification
- Deterministic, repeatable outputs
- Human‑in‑the‑loop correction
- Model‑agnostic architecture
- JSON‑serializable results

### Non‑Goals
- Creative sound design decisions
- Real‑time inference during gameplay
- Black‑box classification without provenance

---

## 4. Inputs & Outputs

### Inputs
- Rendered audio buffer or WAV
- Analysis data from ToneForge Analyze
- Optional recipe metadata
- Optional classification configuration

### Outputs
- Semantic labels
- Descriptive tags
- Confidence scores
- Similarity embeddings
- Classification provenance

---

## 5. Classification Dimensions

ToneForge Classify assigns labels across multiple orthogonal dimensions.

---

## 5.1 Primary Category

High‑level sound type:

- Footstep
- Impact
- Explosion
- Spell
- UI
- Creature
- Vehicle
- Ambience
- Weapon
- Environmental

```json
{
  "category": "footstep",
  "confidence": 0.94
}
```

---

## 5.2 Material & Source

Inferred physical or conceptual source:

- Metal
- Wood
- Stone
- Organic
- Synthetic
- Magical
- Mechanical

```json
{
  "material": "gravel"
}
```

---

## 5.3 Intensity & Energy

Derived from loudness, transients, and envelope shape:

- Soft
- Medium
- Hard
- Aggressive
- Subtle

---

## 5.4 Texture & Timbre

Descriptive tags:

- Crunchy
- Smooth
- Noisy
- Tonal
- Harsh
- Warm
- Bright
- Dark

---

## 5.5 Use‑Case Tags

Contextual usage hints:

- UI interaction
- Player movement
- Combat
- Environmental loop
- Feedback
- Warning
- Decoration

---

## 6. Classification Output Schema

```json
{
  "category": "footstep",
  "material": "gravel",
  "intensity": "medium",
  "texture": ["crunchy", "dry"],
  "useCases": ["movement", "environment"],
  "confidence": 0.92,
  "embeddingId": "vec_8f23a"
}
```

---

## 7. Classification Pipeline

### 7.1 Feature Ingestion
- Receives structured metrics from ToneForge Analyze
- Optionally augments with recipe metadata

---

### 7.2 Rule‑Based Pre‑Classification
Fast heuristics:
- duration thresholds
- transient density
- spectral balance

Used to:
- constrain model search space
- enforce consistency
- catch obvious cases

---

### 7.3 Model Inference
- Audio embedding model
- Multimodal classifier (audio + metadata)
- Optional fine‑tuned domain models

Model selection is configurable and replaceable.

---

### 7.4 Post‑Processing
- Confidence normalization
- Tag pruning
- Conflict resolution
- Provenance attachment

---

## 8. Similarity Embeddings

Each sound is embedded into a vector space for:

- similarity search
- clustering
- deduplication
- discovery

```json
{
  "embedding": [0.012, -0.44, 0.91, ...]
}
```

Embeddings are stored separately from labels.

---

## 9. Human‑in‑the‑Loop Workflow

ToneForge Classify supports **manual review and correction**.

### Capabilities
- Override category or tags
- Adjust confidence
- Add custom labels
- Feed corrections back into training data

Corrections are tracked and versioned.

---

## 10. Batch Classification

Designed for large‑scale operation.

```js
classifyBatch(buffers, analysisData)
```

Supports:
- thousands of sounds per run
- progress reporting
- partial failure recovery
- resumable jobs

---

## 11. Integration with ToneForge Library

Classification results are stored alongside:
- WAV files
- presets
- analysis data
- layer stacks

This enables:
- structured browsing
- tag‑based filtering
- similarity search
- regeneration workflows

---

## 12. Determinism & Provenance

Each classification stores:
- model version
- rule set version
- analysis version
- timestamp
- confidence scores

This ensures:
- auditability
- reproducibility
- long‑term consistency

---

## 13. API Design

### Core API

```js
classify(buffer, analysisData, options)
```

### Example

```js
const classification = classify(audioBuffer, analysis);
```

---

## 14. Performance Targets

- <20 ms per sound (Node.js)
- <40 ms per sound (browser)
- Linear scaling with batch size
- Memory‑safe for large libraries

---

## 15. Configuration Options

```json
{
  "model": "default-audio-v1",
  "confidenceThreshold": 0.7,
  "enableRules": true,
  "generateEmbeddings": true
}
```

---

## 16. Future Extensions

- Active learning loops
- Cross‑project classification reuse
- Domain‑specific classifiers
- Emotional tone inference
- Language‑based sound queries

---

## 17. Why ToneForge Classify Matters

Without classification:
- libraries become unsearchable
- procedural generation becomes noise
- reuse is inefficient

ToneForge Classify transforms **sound into structured knowledge**, enabling:
- scalable asset creation
- intelligent discovery
- consistent reuse across projects

---

## 18. Summary

ToneForge Classify is the **semantic intelligence layer** of the ToneForge ecosystem.  
It bridges raw audio data and human understanding, enabling automated organization, discovery, and reuse at scale—without sacrificing determinism or transparency.

---

If you want next, the natural follow‑ups are:
- a PRD for ToneForge Library
- a detailed classifier interface spec
- or a roadmap for training and deployment
