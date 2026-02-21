Below is a **complete, standalone Product Requirements Document (PRD)** for **ToneForge Library**, written to integrate cleanly with the rest of the ToneForge family while remaining fully self‑contained and implementation‑ready.

---

# 🗂️ ToneForge Library  
## Product Requirements Document (PRD)

---

## 1. Product Overview

### Product Name  
**ToneForge Library**

### Description  
ToneForge Library is the **structured storage, indexing, and retrieval system** for the ToneForge ecosystem. It manages large collections of procedurally generated and sample‑hybrid sound effects, preserving **audio files, presets, metadata, analysis results, and AI classifications** in a unified, queryable library.

ToneForge Library is not a generator or classifier. It is the **system of record** for all ToneForge sound assets.

---

## 2. Role in the ToneForge Ecosystem

ToneForge Library sits at the end of the production pipeline and enables reuse:

```
Generate → Stack → Render → Analyze → Classify → Store → Reuse
```

Its responsibilities include:
- persistent storage of sound assets
- structured metadata management
- fast search and filtering
- similarity‑based discovery
- deterministic regeneration
- long‑term asset provenance

---

## 3. Design Goals

### Primary Goals
- Scalable storage for thousands of sounds
- Deterministic regeneration from presets
- Rich metadata and tagging
- Fast search and filtering
- Human‑friendly organization
- Machine‑friendly schemas

### Non‑Goals
- Audio editing or waveform manipulation
- Real‑time playback engine
- AI inference or analysis

---

## 4. Core Concepts

---

## 4.1 Library Entry

A **library entry** represents a single sound effect and all associated data.

Each entry includes:
- rendered audio file(s)
- procedural preset
- layer stack definition
- analysis data
- classification metadata
- provenance information

---

## 4.2 Deterministic Provenance

Every sound stored in the library can be **recreated exactly** using:
- recipe name
- variant
- seed(s)
- layer configuration
- sample references
- ToneForge version

---

## 5. Library Entry Schema

```json
{
  "id": "footstep_gravel_1042",
  "recipe": "footstep",
  "variant": "gravel",
  "seed": 1042,
  "duration": 0.31,
  "layers": ["sample", "noise"],
  "files": {
    "wav": "footstep_gravel_1042.wav"
  },
  "preset": "footstep_gravel_1042.json",
  "analysis": {
    "duration": 0.31,
    "rms": 0.21,
    "spectralCentroid": 1840
  },
  "classification": {
    "category": "footstep",
    "material": "gravel",
    "intensity": "medium",
    "tags": ["crunchy", "outdoor"]
  },
  "provenance": {
    "toneforgeVersion": "1.0",
    "analysisVersion": "1.0",
    "classificationVersion": "1.0"
  }
}
```

---

## 6. Storage Layout

### On‑Disk Structure

```
/toneforge-library
  /footsteps
    /gravel
      footstep_gravel_1042.wav
      footstep_gravel_1042.json
  /spells
  /ui
  /creatures
  /vehicles
  index.json
```

---

## 7. Indexing & Metadata

### 7.1 Global Index

The library maintains a global index for fast lookup:

```json
{
  "entries": [
    {
      "id": "footstep_gravel_1042",
      "category": "footstep",
      "tags": ["gravel", "crunchy"],
      "duration": 0.31
    }
  ]
}
```

---

### 7.2 Tag System

Tags are:
- hierarchical
- extensible
- human‑editable
- AI‑generated but overrideable

Examples:
- `material:metal`
- `intensity:soft`
- `usecase:ui`

---

## 8. Search & Query

### 8.1 Attribute Search

```js
findSfx({
  category: "footstep",
  material: "gravel",
  intensity: "soft"
});
```

---

### 8.2 Similarity Search

Uses embeddings generated during classification.

```js
findSimilar("footstep_gravel_1042", { limit: 10 });
```

---

### 8.3 Range Queries

```js
findSfx({
  duration: { max: 0.4 },
  rms: { min: 0.15 }
});
```

---

## 9. Regeneration & Reuse

### 9.1 Deterministic Regeneration

Any library entry can be regenerated:

```js
regenerateSfx(entry.preset);
```

This enables:
- higher‑quality re‑renders
- parameter tweaks
- future‑proofing

---

### 9.2 Variant Creation

```js
createVariant(entry, {
  seedOffset: 100,
  intensity: "hard"
});
```

---

## 10. Batch Operations

ToneForge Library supports batch workflows:

- bulk import
- bulk export
- bulk regeneration
- bulk deletion
- batch tagging

```js
exportLibrary({
  category: "ui",
  format: "wav",
  maxCount: 500
});
```

---

## 11. Versioning & History

Each entry tracks:
- creation timestamp
- modification history
- classification revisions
- preset changes

This supports:
- auditability
- rollback
- collaborative workflows

---

## 12. UI Experience

### Library Browser
- Category tree
- Tag filters
- Search bar
- Similarity view
- Waveform preview
- Play / regenerate / export actions

### Metadata Editor
- Edit tags
- Override classification
- Add notes
- Lock entries

---

## 13. Integration with Other Modules

### With ToneForge Analyze
- Stores analysis metrics
- Enables numeric filtering

### With ToneForge Classify
- Stores semantic labels
- Enables similarity search

### With ToneForge Stack
- Stores layered sound events
- Enables stem export

---

## 14. Performance Targets

- Instant lookup for libraries up to 100k entries
- Incremental index updates
- Low memory overhead
- File‑system‑friendly design

---

## 15. Determinism & Trust

ToneForge Library guarantees:
- no hidden mutation
- explicit versioning
- reproducible builds
- transparent metadata

This makes it suitable for:
- production pipelines
- long‑term projects
- collaborative teams

---

## 16. Future Extensions

- Cloud‑backed libraries
- Cross‑project sharing
- Permissioned access
- Library diffing & merging
- Asset dependency tracking

---

## 17. Why ToneForge Library Matters

Without a structured library:
- procedural generation becomes unmanageable
- reuse is inefficient
- quality drifts over time

ToneForge Library turns **procedural sound into durable assets**—without sacrificing reproducibility or flexibility.

---

## 18. Summary

ToneForge Library is the **organizational backbone** of the ToneForge ecosystem.  
It stores, indexes, and preserves procedurally generated sound effects as reusable, searchable, and regenerable assets—bridging creative generation and production reality.

---

If you want next, the natural follow‑ups are:
- a PRD for ToneForge Explore
- a formal on‑disk schema specification
- or a CLI workflow design
