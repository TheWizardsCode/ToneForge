Below is a **complete, standalone Product Requirements Document (PRD)** for **ToneForge Analyze**, written to slot cleanly into the ToneForge family as a first‑class module.  
It assumes no prior documents and is implementation‑ready.

---

# 🔍 ToneForge Analyze  
## Product Requirements Document (PRD)

---

## 1. Product Overview

### Product Name  
**ToneForge Analyze**

### Description  
ToneForge Analyze is an **audio analysis and feature‑extraction module** within the ToneForge ecosystem. It operates on rendered audio (procedural, sample‑based, or hybrid) to extract **objective, machine‑readable descriptors** that support classification, quality control, search, and large‑scale sound library management.

ToneForge Analyze does **not** generate sound. It **measures, characterizes, and summarizes** sound.

---

## 2. Purpose & Role in the ToneForge Ecosystem

ToneForge Analyze sits **between rendering and classification**:

```
Generate → Stack → Render → Analyze → Classify → Store → Reuse
```

Its role is to:
- convert raw audio into structured data
- provide consistent metrics across thousands of sounds
- enable AI classification and similarity search
- support automated quality control
- preserve objective provenance alongside subjective tags

---

## 3. Design Goals

### Primary Goals
- Deterministic, repeatable analysis
- Fast batch processing
- JSON‑serializable outputs
- Compatible with browser and Node.js
- Scalable to tens of thousands of sounds
- Independent of AI models

### Non‑Goals
- Semantic interpretation (“this sounds scary”)
- Creative decision‑making
- Real‑time visualization tooling

---

## 4. Inputs & Outputs

### Inputs
- Rendered audio buffer (ToneAudioBuffer or WAV)
- Optional metadata (recipe, seed, layers)
- Optional analysis configuration

### Outputs
- Structured analysis object
- Numeric features
- Derived descriptors
- Quality flags

---

## 5. Core Analysis Features

---

## 5.1 Time‑Domain Analysis

### Metrics
- Duration
- Peak amplitude
- RMS loudness
- Crest factor
- Silence ratio
- Transient count

```json
{
  "duration": 0.312,
  "peak": 0.94,
  "rms": 0.21,
  "crestFactor": 4.47,
  "silenceRatio": 0.08,
  "transients": 2
}
```

---

## 5.2 Envelope Shape Analysis

### Extracted Features
- Attack time
- Decay time
- Sustain level
- Release time
- Envelope symmetry

Used to distinguish:
- impacts vs. drones
- UI clicks vs. ambience
- footsteps vs. explosions

---

## 5.3 Frequency‑Domain Analysis

### Metrics
- Spectral centroid
- Spectral rolloff
- Spectral flatness
- Band energy distribution
- Dominant frequency bands

```json
{
  "spectralCentroid": 1840,
  "rolloff": 6200,
  "flatness": 0.42,
  "bands": {
    "low": 0.38,
    "mid": 0.44,
    "high": 0.18
  }
}
```

---

## 5.4 Transient & Texture Analysis

### Features
- Transient density
- Noise vs. tonal ratio
- Temporal density
- Texture classification hints

Supports:
- footstep material inference
- impact sharpness detection
- UI sound validation

---

## 5.5 Loudness & Normalization Metrics

### Metrics
- Integrated loudness
- Short‑term loudness
- True peak
- Headroom

Used for:
- library consistency
- batch normalization
- export validation

---

## 6. Analysis Configuration

ToneForge Analyze supports configurable analysis depth.

```json
{
  "analysisLevel": "full",
  "includeSpectral": true,
  "includeEnvelope": true,
  "includeTransients": true,
  "normalize": false
}
```

Levels:
- **basic** – fast, minimal metrics
- **standard** – default for classification
- **full** – deep analysis for libraries

---

## 7. API Design

### Core API

```js
analyze(buffer, options)
```

### Example

```js
const analysis = analyze(audioBuffer, {
  analysisLevel: "standard"
});
```

### Output Structure

```json
{
  "time": {...},
  "envelope": {...},
  "spectral": {...},
  "texture": {...},
  "loudness": {...}
}
```

---

## 8. Batch Analysis

ToneForge Analyze is optimized for **large‑scale batch processing**.

```js
analyzeBatch(buffers, options)
```

Supports:
- parallel execution
- progress reporting
- partial failure recovery

---

## 9. Integration with Other Modules

### With ToneForge Classify
- Provides numeric features for AI models
- Reduces classifier ambiguity
- Enables hybrid rule‑based + AI classification

### With ToneForge Library
- Stored alongside presets and WAVs
- Enables filtering and search
- Supports similarity indexing

### With ToneForge Explore
- Used to rank and cluster generated sounds
- Enables “find extremes” or “find balance”

---

## 10. Quality Control & Validation

ToneForge Analyze can flag issues automatically:

- clipping detected
- silence too long
- duration out of bounds
- excessive loudness
- missing transients

```json
{
  "warnings": [
    "peak_clipping",
    "low_transient_density"
  ]
}
```

---

## 11. Determinism & Reproducibility

- Analysis results are deterministic for a given buffer
- No randomness or stochastic processes
- Same input → same output across platforms

---

## 12. Performance Targets

- <10 ms per short SFX (browser)
- <5 ms per SFX (Node.js)
- Linear scaling with batch size
- Memory‑safe for large libraries

---

## 13. Storage & Serialization

Analysis results are:
- JSON‑serializable
- Versioned
- Stored alongside presets

```json
{
  "analysisVersion": "1.0",
  "data": {...}
}
```

---

## 14. Future Extensions

- Perceptual loudness models
- Psychoacoustic metrics
- Cross‑sound comparison utilities
- Visualization hooks (optional)
- Real‑time preview analysis

---

## 15. Why ToneForge Analyze Matters

Without analysis:
- classification is guesswork
- libraries become unmanageable
- quality drifts over time

ToneForge Analyze provides:
- objective grounding
- scalable automation
- reproducible sound characterization

It turns **audio into data**, enabling everything else in the ToneForge ecosystem to work reliably.

---

## 16. Summary

ToneForge Analyze is the **measurement backbone** of the ToneForge family.  
It transforms rendered sound into structured, actionable information—powering classification, discovery, quality control, and long‑term reuse.

It does not replace creative judgment.  
It **supports it at scale**.

---

If you want next, the natural follow‑ups are:
- a PRD for ToneForge Classify
- a formal on‑disk schema for analysis data
- or a reference implementation plan
