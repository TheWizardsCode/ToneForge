Below is a **complete, standalone Product Requirements Document (PRD)** for **ToneForge Palette**, written to integrate cleanly with Visualizer, Mixer, Intelligence, State, and Context while preserving ToneForge’s core philosophy: **deterministic behavior, inspectable intent, and production‑scale control**.

---

# 🎨 ToneForge Palette  
## Product Requirements Document (PRD)

---

## 1. Product Overview

### Product Name  
**ToneForge Palette**

### Description  
ToneForge Palette is the **style and aesthetic coordination layer** of the ToneForge ecosystem. It defines **cohesive visual and audio style systems**—color, motion, intensity, texture, and rhythm—that ensure all generated sound and visuals feel **intentional, consistent, and on‑brand** across scales and contexts.

ToneForge Palette does **not** generate sound or visuals.  
It defines **how things should feel**.

---

## 2. Role in the ToneForge Ecosystem

ToneForge Palette sits **above generation and below intent**, shaping expression without dictating behavior:

```
Context / State
        ↓
     Palette
        ↓
Visualizer / Mixer
        ↓
     Runtime
```

Its purpose is to:
- unify audio‑visual style
- prevent aesthetic drift
- enable rapid stylistic iteration
- support multi‑scale output (icon → fullscreen)
- provide a shared aesthetic vocabulary

---

## 3. Design Goals

### Primary Goals
- Explicit, inspectable style definitions
- Deterministic application
- Cross‑modal consistency (audio + visual)
- Scalable from micro to macro effects
- Human‑readable configuration

### Non‑Goals
- Asset authoring
- Procedural generation
- Runtime decision‑making
- AI‑driven creativity

---

## 4. Core Concepts

---

## 4.1 Palette

A **palette** is a named collection of stylistic constraints and preferences.

Examples:
- calm_ui
- high_energy_combat
- mystical_magic
- industrial_mechanical

Palettes are **semantic**, not technical.

---

## 4.2 Style Dimensions

Each palette defines values across multiple dimensions:

### Visual
- color ranges
- brightness curves
- motion profiles
- particle density
- shape language

### Audio
- perceived intensity scaling
- transient sharpness bias
- rhythmic emphasis
- spectral focus

These dimensions are **advisory**, not absolute.

---

## 4.3 Palette Inheritance

Palettes may inherit from others:

```json
{
  "name": "combat_heavy",
  "extends": "combat_base",
  "visual": { "motionIntensity": 0.9 }
}
```

This enables consistent variation without duplication.

---

## 5. Integration with Other Modules

---

### 5.1 ToneForge Visualizer

Visualizer uses Palette to:
- select color schemes
- scale motion amplitude
- choose particle styles
- maintain visual cohesion

Same sound + same palette = same visual feel.

---

### 5.2 ToneForge Mixer

Mixer uses Palette to:
- align visual intensity with audio loudness
- prevent sensory overload
- enforce stylistic balance

Example:
- calm palette caps both volume and motion.

---

### 5.3 ToneForge State

State selects or blends palettes based on behavior.

Example:
- idle → calm_ui
- combat → high_energy_combat

---

### 5.4 ToneForge Context

Context may override or bias palette selection.

Example:
- night context → darker palette variant
- accessibility mode → reduced motion palette

---

### 5.5 ToneForge Intelligence

Intelligence may:
- detect palette misuse
- suggest palette consolidation
- recommend intensity adjustments

Palette changes are **never automatic**.

---

## 6. Palette Definition Schema

```json
{
  "name": "calm_ui",
  "visual": {
    "colorRange": ["#88AABB", "#CCDDEE"],
    "motionIntensity": 0.3,
    "particleDensity": 0.2
  },
  "audio": {
    "intensityBias": -0.2,
    "transientSharpness": 0.4
  }
}
```

---

## 7. Runtime API

```js
palette.set("calm_ui");
palette.getCurrent();
```

Palette changes propagate to:
- Visualizer
- Mixer
- Runtime

---

## 8. Determinism & Safety

ToneForge Palette guarantees:
- no hidden randomness
- explicit value ranges
- reproducible application
- bounded influence

Palettes never override hard constraints.

---

## 9. Debugging & Tooling

Optional tooling includes:
- live palette inspection
- visual previews
- intensity overlays
- palette diffing

This makes aesthetic decisions **transparent**.

---

## 10. Performance Targets

- Constant‑time palette lookup
- Minimal memory footprint
- Safe for runtime switching
- Scales to many palettes

---

## 11. Use Cases

- UI feedback styling
- Combat vs exploration contrast
- Accessibility modes
- Brand consistency
- Seasonal or thematic shifts

---

## 12. Future Extensions

- Palette blending
- User‑selectable palettes
- Cross‑project palette libraries
- Marketplace‑ready style packs
- Palette‑aware analytics

---

## 13. Why ToneForge Palette Matters

Without a palette system:
- visuals drift stylistically
- audio and visuals misalign
- procedural systems feel generic

ToneForge Palette provides:
- cohesion
- clarity
- identity
- control

It ensures that **procedural does not mean chaotic**.

---

## 14. Summary

ToneForge Palette is the **aesthetic backbone** of the ToneForge ecosystem.  
It defines how sound and visuals *feel*—across scales, contexts, and behaviors—ensuring that procedural systems remain expressive, consistent, and intentional.

---

If you want next, the strongest follow‑ups are:
- a Palette + Visualizer interaction spec
- example palettes for different genres
- or a comparison to traditional style‑guide systems
