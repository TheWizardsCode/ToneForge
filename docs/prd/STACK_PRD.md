Below is a **complete, standalone Product Requirements Document (PRD)** for **ToneForge Stack**, written to integrate cleanly with the rest of the ToneForge family while remaining fully self‑contained and implementation‑ready.

---

# 🎚️ ToneForge Stack  
## Product Requirements Document (PRD)

---

## 1. Product Overview

### Product Name  
**ToneForge Stack**

### Description  
ToneForge Stack is the **sound‑event composition and layering module** within the ToneForge ecosystem. It provides a **mini‑DAW‑style timeline and layering system** that allows multiple procedural and/or sample‑based sounds to be **precisely timed, layered, mixed, and rendered** as a single cohesive sound event.

ToneForge Stack does not generate raw sound primitives. It **orchestrates and composes** them.

---

## 2. Role in the ToneForge Ecosystem

ToneForge Stack sits between sound generation and rendering:

```
Generate → Stack → Render → Analyze → Classify → Store → Reuse
```

Its purpose is to:
- combine multiple sound layers into a single event
- provide sample‑accurate timing control
- enable cinematic and complex SFX construction
- preserve deterministic reproducibility
- act as a lightweight alternative to a full DAW

---

## 3. Design Goals

### Primary Goals
- Sample‑accurate timing
- Deterministic playback
- JSON‑serializable compositions
- Offline‑friendly rendering
- Simple mental model (layers + timeline)
- Scalable to complex sound events

### Non‑Goals
- Full DAW feature parity
- MIDI sequencing
- Real‑time performance mixing
- Audio editing or waveform manipulation

---

## 4. Core Concepts

---

## 4.1 Layer

A **layer** represents a single sound source within a stack.  
It may be:
- a procedural recipe
- a sample player
- a hybrid recipe

Each layer has its own timing, gain, and pan.

---

## 4.2 Stack

A **stack** is a collection of layers that together form a single sound event.

Examples:
- Explosion (transient + body + tail)
- Spell cast (charge + release + impact)
- Footstep (sample transient + noise tail)
- UI interaction (click + tone + texture)

---

## 4.3 Timeline

The **timeline** defines when each layer starts and stops relative to a shared zero‑time origin.  
All timing is resolved **before rendering**.

---

## 5. Layer Definition Schema

```json
{
  "id": "impact_body",
  "recipe": "explosion",
  "variant": "heavy",
  "seed": 101,
  "startTime": 0.05,
  "duration": 1.5,
  "gain": 1.0,
  "pan": 0.0,
  "samples": true
}
```

---

## 6. Stack Definition Schema

```json
{
  "name": "explosion_heavy",
  "duration": 2.5,
  "layers": [
    {
      "id": "transient",
      "recipe": "impact",
      "seed": 100,
      "startTime": 0.0,
      "duration": 0.2,
      "gain": 1.2
    },
    {
      "id": "body",
      "recipe": "explosion",
      "seed": 101,
      "startTime": 0.05,
      "duration": 1.5
    },
    {
      "id": "tail",
      "recipe": "ambience",
      "seed": 102,
      "startTime": 0.3,
      "duration": 2.0,
      "gain": 0.6
    }
  ]
}
```

---

## 7. Timing & Precision

### Supported Time Formats
- Seconds (`0.125`)
- Milliseconds (`0.0125`)
- Musical time (`"16n"`, `"8t"`) via Tone.Time

All timing is normalized to seconds internally.

---

## 8. Layer Engine

### 8.1 Layer Construction

Each layer:
- instantiates its recipe
- applies gain and pan
- schedules start/stop times

```js
function buildLayer(layer) {
  const rng = createRng(layer.seed);
  const sfx = RECIPE_REGISTRY[layer.recipe](rng);

  const gain = new Tone.Gain(layer.gain ?? 1);
  const pan = new Tone.Panner(layer.pan ?? 0);

  sfx.toDestination = () => sfx.output.chain(pan, gain);

  return {
    sfx,
    start: layer.startTime,
    stop: layer.startTime + layer.duration
  };
}
```

---

## 9. Stack Rendering

### Offline Rendering

```js
function renderStack(stack) {
  return Tone.Offline(() => {
    stack.layers.forEach(layer => {
      const sfx = buildLayer(layer);
      sfx.sfx.toDestination();
      sfx.sfx.start(sfx.start);
      sfx.sfx.stop(sfx.stop);
    });
  }, stack.duration);
}
```

---

## 10. Mixing Controls

Each layer supports:
- gain
- pan
- mute / solo (UI‑level)
- optional per‑layer effects

Future extensions may include:
- buses
- sends
- stem routing

---

## 11. Determinism Guarantees

ToneForge Stack guarantees:
- fixed layer order
- absolute timing offsets
- per‑layer seeded randomness
- offline rendering consistency

Same stack definition → same rendered audio.

---

## 12. Preset Integration

Stacks are fully JSON‑serializable and stored as presets.

```json
{
  "type": "stack",
  "name": "spell_cast_fire",
  "layers": [
    { "recipe": "spell_charge", "startTime": 0.0, "duration": 1.2 },
    { "recipe": "spell_cast", "startTime": 1.1, "duration": 0.4 },
    { "recipe": "explosion", "startTime": 1.2, "duration": 1.5 }
  ]
}
```

---

## 13. Integration with Other Modules

### With ToneForge Core
- Uses procedural and sample‑hybrid recipes

### With ToneForge Analyze
- Provides per‑stack and per‑layer analysis

### With ToneForge Classify
- Enables classification of complex sound events

### With ToneForge Library
- Stores stacks as reusable sound assets
- Supports stem and full‑mix exports

---

## 14. UI Experience (Mini‑DAW)

### Visual Layout
- Vertical track list (layers)
- Horizontal timeline (seconds)
- Drag‑to‑offset layers
- Gain and pan controls per layer

### Controls
- Play stack
- Loop stack
- Solo / mute layers
- Export WAV
- Save preset
- Randomize seeds

---

## 15. Performance Targets

- Sample‑accurate scheduling
- Minimal overhead per layer
- Efficient offline rendering
- Scales to 20–50 layers per stack

---

## 16. Use Cases

- Cinematic impacts
- Spell casting sequences
- Creature vocalizations
- Vehicle events
- UI interactions
- Environmental sound events

---

## 17. Future Extensions

- Automation curves per layer
- Effect buses
- Stem exports
- Parameter modulation
- Runtime playback variants

---

## 18. Why ToneForge Stack Matters

Without a stacking system:
- complex SFX require manual DAW work
- procedural generation loses expressiveness
- reuse becomes fragmented

ToneForge Stack enables **DAW‑grade composition with procedural determinism**, bridging creative sound design and scalable production.

---

## 19. Summary

ToneForge Stack is the **composition engine** of the ToneForge ecosystem.  
It allows multiple procedural and sample‑based sounds to be layered, timed, and rendered as cohesive sound events—without sacrificing reproducibility, automation, or scale.

---

If you want next, the natural follow‑ups are:
- a PRD for ToneForge Explore
- a stem export specification
- or a runtime playback strategy
