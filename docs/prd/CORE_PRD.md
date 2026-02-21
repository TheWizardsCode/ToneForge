Below is a **fully revised, single‑document PRD** that **adds first‑class sample support** while preserving the procedural‑first philosophy.  
This version treats **samples as composable ingredients**, not replacements for synthesis.

Everything is self‑contained and implementation‑ready.

---

# 🎧 Procedural + Sample‑Hybrid SFX Recipe Library (Tone.js)

## Product Requirements Document (PRD)

---

## 1. Product Overview

### Product Name
**ToneForge SFX**

### Description
ToneForge SFX is a **procedural and sample‑hybrid sound‑effects generation system** built on **Tone.js**.

It supports:
- fully procedural synthesis
- sample‑based playback
- procedural manipulation of samples
- deterministic, seed‑based variation
- offline rendering and WAV export
- browser and Node.js compatibility

The system is designed so **samples enhance procedural sound**, rather than replacing it.

---

## 2. Design Philosophy

> **Samples are ingredients, not assets.**

Samples are:
- layered with synthesis
- filtered, enveloped, granularized
- pitch‑shifted and time‑warped
- randomized deterministically

This avoids static repetition while preserving realism.

---

## 3. System Architecture

```
┌────────────────────────────┐
│        UI / API Layer      │
├────────────────────────────┤
│     Preset & Seed System   │
├────────────────────────────┤
│     Recipe Registry        │
├────────────────────────────┤
│  Procedural + Sample DSP   │
├────────────────────────────┤
│ Offline Renderer / Export  │
└────────────────────────────┘
```

---

## 4. Core Concepts

### 4.1 Recipe
A recipe constructs a **Tone.js DSP graph**, optionally including:
- oscillators
- noise generators
- sample players
- granular players
- envelopes
- filters
- modulation

Each recipe exposes:

```ts
{
  start(time: number): void
  stop(time: number): void
  toDestination(): void
}
```

---

### 4.2 Seeded Randomness

All variation is deterministic.

```js
function createRng(seed) {
  let x = seed || 123456789;
  return () => {
    x ^= x << 13;
    x ^= x >>> 17;
    x ^= x << 5;
    return (x >>> 0) / 0xFFFFFFFF;
  };
}

function rr(rng, min, max) {
  return min + (max - min) * rng();
}
```

---

## 5. Sample Support

### 5.1 Sample Types

ToneForge SFX supports:
- **One‑shot samples** (`Tone.Player`)
- **Looped samples**
- **Granular samples** (`Tone.GrainPlayer`)
- **Multi‑sample sets** (randomized selection)

---

### 5.2 Sample Registry

```js
const SAMPLE_LIBRARY = {
  footsteps: {
    gravel: ["gravel1.wav", "gravel2.wav"],
    wood: ["wood1.wav", "wood2.wav"],
  },
  impacts: {
    metal: ["metal_hit.wav"],
  },
};
```

Samples are referenced symbolically, not hard‑coded.

---

### 5.3 Sample Player Wrapper

```js
function createSamplePlayer(rng, samples) {
  const url = samples[Math.floor(rr(rng, 0, samples.length))];
  const player = new Tone.Player(url);

  return player;
}
```

---

## 6. Recipe Categories

---

## 6.1 Procedural + Sample Footsteps

### Design
- Sample transient for realism
- Procedural noise tail
- Material‑specific filtering

```js
function createFootstep(rng, material) {
  const player = createSamplePlayer(rng, SAMPLE_LIBRARY.footsteps[material]);
  const noise = new Tone.Noise("white");

  const filter = new Tone.Filter(
    material === "snow" ? 600 : 1800,
    "bandpass"
  );

  const amp = new Tone.AmplitudeEnvelope({
    attack: 0.001,
    decay: 0.15,
    sustain: 0,
    release: 0,
  });

  player.chain(filter, amp);
  noise.chain(filter, amp);

  return {
    start: t => {
      player.start(t);
      noise.start(t);
      amp.triggerAttack(t);
    },
    stop: t => {
      player.stop(t);
      noise.stop(t);
    },
    toDestination: () => amp.toDestination(),
  };
}
```

---

## 6.2 Magic Spells (Hybrid)

### Charging
- FM oscillator
- Granular shimmer sample

```js
function createSpellCharge(rng) {
  const osc = new Tone.FMOscillator({
    frequency: rr(rng, 150, 300),
    modulationIndex: rr(rng, 10, 25),
  });

  const grain = new Tone.GrainPlayer({
    url: "magic_shimmer.wav",
    grainSize: rr(rng, 0.05, 0.15),
    overlap: 0.1,
  });

  const amp = new Tone.AmplitudeEnvelope({
    attack: 0.5,
    sustain: 1,
    release: 0.5,
  });

  osc.chain(amp);
  grain.chain(amp);

  return {
    start: t => {
      osc.start(t);
      grain.start(t);
      amp.triggerAttack(t);
    },
    stop: t => {
      osc.stop(t);
      grain.stop(t);
    },
    toDestination: () => amp.toDestination(),
  };
}
```

---

## 6.3 Sci‑Fi UI Suite (Sample‑Optional)

### Design
- Procedural tone for clarity
- Optional click sample for texture

```js
function createUiConfirm(rng) {
  const osc = new Tone.Oscillator(880, "sine");
  const click = new Tone.Player("ui_click.wav");

  const amp = new Tone.AmplitudeEnvelope({
    attack: 0.001,
    decay: 0.08,
    sustain: 0,
    release: 0,
  });

  osc.chain(amp);
  click.chain(amp);

  return {
    start: t => {
      osc.start(t);
      click.start(t);
      amp.triggerAttack(t);
    },
    stop: t => osc.stop(t),
    toDestination: () => amp.toDestination(),
  };
}
```

---

## 6.4 Creature Vocalizations (Granular + FM)

### Design
- FM oscillator for pitch body
- Granular animal texture sample
- Formant‑style filtering

```js
function createCreatureVocal(rng) {
  const osc = new Tone.FMOscillator({
    frequency: rr(rng, 80, 220),
    modulationIndex: rr(rng, 8, 30),
  });

  const grain = new Tone.GrainPlayer({
    url: "creature_texture.wav",
    grainSize: rr(rng, 0.1, 0.25),
    overlap: 0.15,
  });

  const filter = new Tone.Filter(rr(rng, 300, 1200), "bandpass");
  const amp = new Tone.AmplitudeEnvelope({
    attack: 0.05,
    decay: 0.4,
    sustain: 0,
    release: 0,
  });

  osc.chain(filter, amp);
  grain.chain(filter, amp);

  return {
    start: t => {
      osc.start(t);
      grain.start(t);
      amp.triggerAttack(t);
    },
    stop: t => {
      osc.stop(t);
      grain.stop(t);
    },
    toDestination: () => amp.toDestination(),
  };
}
```

---

## 6.5 Vehicle Engines (Loop + Modulation)

### Design
- Looping engine sample
- Oscillator reinforcement
- LFO pitch modulation

```js
function createEngine(rng) {
  const loop = new Tone.Player({
    url: "engine_loop.wav",
    loop: true,
  });

  const osc = new Tone.Oscillator(rr(rng, 40, 80), "sawtooth");
  const lfo = new Tone.LFO(rr(rng, 1, 4), -5, 5);

  const filter = new Tone.Filter(400, "lowpass");
  const amp = new Tone.AmplitudeEnvelope({
    attack: 0.2,
    sustain: 1,
    release: 0.5,
  });

  lfo.connect(loop.playbackRate);
  osc.chain(filter, amp);
  loop.chain(filter, amp);

  return {
    start: t => {
      loop.start(t);
      osc.start(t);
      lfo.start(t);
      amp.triggerAttack(t);
    },
    stop: t => {
      loop.stop(t);
      osc.stop(t);
    },
    toDestination: () => amp.toDestination(),
  };
}
```

---

## 7. Preset System (Sample‑Aware)

### JSON Preset

```json
{
  "type": "footstep",
  "variant": "gravel",
  "seed": 42,
  "duration": 0.3,
  "samples": {
    "enabled": true,
    "intensity": 0.7
  }
}
```

Presets remain deterministic even with samples.

---

## 8. Offline Rendering & WAV Export

### Offline Rendering

```js
Tone.Offline(() => {
  const sfx = recipe(rng);
  sfx.toDestination();
  sfx.start(0);
  sfx.stop(duration);
}, duration);
```

### WAV Export
- Browser: Blob download
- Node.js: WAV encoder + filesystem

---

## 9. API Design

### High‑Level API

```js
generateSfx({
  type: "creature",
  seed: 1337,
  duration: 1.2,
  samples: true,
});
```

### Batch Export

```js
generateBatch([
  { type: "footstep", variant: "wood", seed: 1 },
  { type: "engine", seed: 2 },
]);
```

---

## 10. UI Experience

### Web UI
- Recipe selector
- Sample toggle (on/off)
- Seed input
- Parameter sliders
- Play / Stop
- Export WAV
- Preset save/load

### Developer Workflow
- JSON preset files
- CLI batch export
- Deterministic builds
- Asset‑light pipelines

---

## 11. Additional Recipe Ideas

- Weather layers (rain + wind samples)
- Doors (sample transient + procedural tail)
- Weapons (sample attack + synthesized body)
- Horror stingers (granular sample + noise)
- Robot speech (sample phonemes + FM)

---

## 12. Summary

ToneForge SFX is a **procedural‑first, sample‑enhanced sound‑effects system** built on Tone.js.  
It combines the realism of samples with the flexibility of synthesis, enabling **reproducible, scalable, and expressive audio pipelines** for games and tools.

---

If you want next steps, the natural continuations are:
- formalizing the recipe registry
- defining a sample‑pack format
- building the UI
- or turning this into a publishable npm package
