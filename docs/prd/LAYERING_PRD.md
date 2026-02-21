Below is a **single, unified extension** to the PRD that introduces a **layering and timing system**—effectively a **mini‑DAW inside ToneForge SFX**—while remaining fully compatible with Tone.js, offline rendering, deterministic seeds, and sample‑hybrid recipes.

This section is designed to **drop directly into the existing document** as a new major capability.

---

# 🎚️ Layering & Timeline System (Mini‑DAW)

## 1. Overview

ToneForge SFX includes a **layering and timing engine** that allows multiple procedural and/or sample‑based sounds to be **stacked, offset, and synchronized** with sample‑accurate precision.

This system enables:
- multi‑layer SFX (e.g. explosion = transient + body + tail)
- precise timing offsets (milliseconds or musical time)
- deterministic layering via seeds
- offline rendering of complex sound events
- DAW‑like composition without a full sequencer

---

## 2. Design Goals

- Sample‑accurate timing
- Deterministic playback
- Simple mental model (tracks + clips)
- Offline‑friendly
- JSON‑serializable
- No real‑time transport dependency

---

## 3. Core Concepts

### 3.1 Layer
A **layer** is a single sound event:
- procedural recipe
- sample player
- hybrid recipe

Each layer has:
- start time offset
- duration
- gain
- pan
- optional effects

---

### 3.2 Stack
A **stack** is a collection of layers that together form a single SFX event.

Examples:
- Explosion stack
- Footstep stack
- Spell cast stack
- UI interaction stack

---

### 3.3 Timeline
A **timeline** is a lightweight scheduling system that places layers relative to a shared zero‑time origin.

All timing is resolved **before rendering**.

---

## 4. Layer Definition

```ts
type SfxLayer = {
  id: string
  recipe: string
  variant?: string
  seed: number
  startTime: number   // seconds
  duration: number
  gain?: number
  pan?: number
  samples?: boolean
}
```

---

## 5. Stack Definition (JSON‑Serializable)

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

## 6. Layer Engine

### 6.1 Layer Builder

```js
function buildLayer(layer, rng) {
  const recipeFn = RECIPE_REGISTRY[layer.recipe];
  const node = recipeFn(createRng(layer.seed));

  const gain = new Tone.Gain(layer.gain ?? 1);
  const pan = new Tone.Panner(layer.pan ?? 0);

  node.toDestination = () => node.output.chain(pan, gain);

  return {
    node,
    startTime: layer.startTime,
    duration: layer.duration,
  };
}
```

---

### 6.2 Stack Renderer

```js
function renderStack(stack) {
  return Tone.Offline(() => {
    stack.layers.forEach(layer => {
      const rng = createRng(layer.seed);
      const sfx = RECIPE_REGISTRY[layer.recipe](rng);

      sfx.toDestination();
      sfx.start(layer.startTime);
      sfx.stop(layer.startTime + layer.duration);
    });
  }, stack.duration);
}
```

---

## 7. Timing Precision

### Supported Time Formats
- seconds (`0.125`)
- milliseconds (`0.0125`)
- musical time (`"16n"`, `"8t"`) via Tone.Time

Internally normalized to seconds.

---

## 8. Layering Use Cases

### 8.1 Footsteps
- sample transient
- procedural noise tail
- optional debris layer

### 8.2 Magic Spells
- charge layer
- cast burst
- impact
- lingering shimmer tail

### 8.3 Creature Vocals
- FM growl
- granular texture
- breath noise

### 8.4 Vehicle Engines
- idle loop
- acceleration ramp
- gear‑shift transient

### 8.5 UI Interactions
- click transient
- tonal confirmation
- subtle noise texture

---

## 9. Preset Integration

### Stack Preset

```json
{
  "type": "stack",
  "name": "spell_cast_fire",
  "seed": 9001,
  "layers": [
    { "recipe": "spell_charge", "startTime": 0.0, "duration": 1.2 },
    { "recipe": "spell_cast", "startTime": 1.1, "duration": 0.4 },
    { "recipe": "explosion", "startTime": 1.2, "duration": 1.5 }
  ]
}
```

---

## 10. API Design

### High‑Level Stack API

```js
generateStack({
  name: "explosion_heavy",
  layers: [...],
  duration: 2.5,
});
```

### Batch Stack Export

```js
generateStacks([
  explosionStack,
  footstepStack,
  uiConfirmStack,
]);
```

---

## 11. UI Experience (Mini‑DAW)

### Visual Layout
- Vertical track list (layers)
- Horizontal timeline (seconds)
- Drag‑to‑offset layers
- Gain & pan per layer
- Solo / mute toggles

### Controls
- Play stack
- Loop stack
- Export WAV
- Save preset
- Randomize seeds

---

## 12. Determinism Guarantees

- Layer order is fixed
- Timing offsets are absolute
- Seeds are per‑layer
- Offline rendering ensures reproducibility

---

## 13. Why This Matters

This layering system allows ToneForge SFX to:
- replace static multi‑sample SFX
- generate cinematic sound events procedurally
- act as a **sound‑event compiler**
- integrate cleanly into asset‑light pipelines

It is **not a DAW**, but it provides **DAW‑grade control** where it matters most: timing, layering, and reproducibility.

---

If you want next steps, the obvious evolutions are:
- automation curves per layer
- effect buses
- stem exports
- Unity‑side stack playback
- CLI‑driven batch compilation

Just say where you want to push it next.
