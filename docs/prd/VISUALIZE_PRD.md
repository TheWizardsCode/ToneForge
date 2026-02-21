ToneForge Visualizer is not just a nice add‑on — it’s the **natural visual twin** to everything you’ve already designed. If ToneForge treats **sound as behavior**, Visualizer treats **visuals as a consequence of sound**.

Below is a **clean, system‑level definition** of where ToneForge Visualizer fits, what it does, and why it completes the platform without turning it into a bloated VFX tool.

---

# 🎨 ToneForge Visualizer  
## Automatic Audio‑Driven VFX Generation Module

---

## 1. What ToneForge Visualizer Is

**ToneForge Visualizer** is an **automatic, deterministic visual‑effects generator** that produces **audio‑synchronized visuals** directly from ToneForge sound events, stacks, and sequences.

It generates:
- **Full‑screen effects** (bursts, pulses, waves, distortions)
- **Icon‑scale visuals** (sprites, UI feedback, particles)
- **Procedural motion patterns** tied to sound behavior

Visualizer does **not** replace artists or VFX tools.  
It generates **baseline, reactive, and expressive visuals** that are *guaranteed* to match the sound.

---

## 2. Why Visualizer Belongs in ToneForge

ToneForge already knows:
- when sound happens (Sequencer)
- how it behaves (Stack)
- what it means (Classify)
- how intense it is (Analyze)
- why it changes (Intelligence)

Not generating visuals from that data would be leaving value on the table.

Visualizer turns **audio metadata into visual intent**.

---

## 3. Core Responsibilities

ToneForge Visualizer handles:

- Audio‑driven visual synthesis
- Deterministic visual generation
- Multi‑scale output (fullscreen → icon)
- Runtime‑safe playback
- Offline rendering for assets

It does **not**:
- author hand‑crafted animations
- replace VFX pipelines
- generate cinematic cutscenes

---

## 4. Visual Generation Inputs

Visualizer consumes **existing ToneForge outputs**:

### From Analyze
- amplitude envelope
- transient timing
- spectral centroid
- energy distribution

### From Classify
- category (impact, UI, magic, etc.)
- material (metal, organic, synthetic)
- intensity
- texture tags

### From Stack
- layer timing
- event structure

### From Sequencer
- rhythm
- repetition
- state transitions

### From Intelligence
- stylistic guidance
- variation control
- fatigue avoidance

---

## 5. Visual Output Types

---

### 5.1 Full‑Screen Effects

Used for:
- explosions
- spell casts
- environmental events
- cinematic feedback

Examples:
- shockwaves synced to transients
- screen distortion tied to low‑frequency energy
- color pulses driven by spectral centroid

---

### 5.2 Mid‑Scale Effects

Used for:
- character actions
- weapon feedback
- environmental interactions

Examples:
- particle bursts
- directional streaks
- procedural trails

---

### 5.3 Icon / Sprite‑Scale Effects

Used for:
- UI feedback
- inventory icons
- ability indicators
- HUD reactions

Examples:
- animated icons synced to UI sounds
- sprite pulses tied to confirmation tones
- micro‑particles for hover/click feedback

---

## 6. Deterministic Visual Recipes

Visualizer uses **visual recipes**, mirroring ToneForge Core:

```json
{
  "visualType": "impact_burst",
  "scale": "icon",
  "seed": 1042,
  "colorProfile": "energy",
  "motionProfile": "radial"
}
```

Same sound + same seed = same visual.

---

## 7. Sequencer Integration (Critical)

Visualizer is **sequencer‑aware**.

- Visuals follow sound timing
- Repetition introduces controlled variation
- State changes alter visual behavior

Example:
- walking footsteps → subtle rhythmic pulses
- sprinting → faster, sharper visuals
- stopping → decay animation

---

## 8. Runtime Integration

ToneForge Visualizer runs alongside **ToneForge Runtime**.

```js
playEvent({
  sound: "footstep_gravel",
  visual: true
});
```

- Visuals are lightweight
- GPU‑friendly
- Optional baked fallback
- Safe for real‑time environments

---

## 9. Offline Asset Generation

Visualizer can also generate:
- sprite sheets
- animated icons
- VFX textures
- preview videos

Used for:
- UI assets
- marketing
- fallback visuals
- engine import

---

## 10. Intelligence‑Driven Visual Guidance

ToneForge Intelligence can:
- reduce visual repetition
- suggest calmer or louder visuals
- align visual intensity with sound balance
- maintain stylistic consistency across libraries

Example insight:
> “These UI sounds are calm, but visuals are too aggressive — reduce motion amplitude by 20%.”

---

## 11. Where Visualizer Fits in the System

```
Core → Stack → Sequencer → Runtime
                 ↓
             Visualizer
                 ↑
           Analyze / Classify
                 ↑
            Intelligence
```

Visualizer is **downstream of sound**, never upstream.

---

## 12. What ToneForge Visualizer Is Not

| Not This | Why |
|--------|-----|
| Hand‑authored VFX tool | Too manual |
| Shader editor | Too low‑level |
| Cinematic renderer | Wrong scope |
| AI art generator | Needs determinism |

Visualizer is **procedural, reactive, and intentional**.

---

## 13. Why This Completes ToneForge

Without Visualizer:
- sound and visuals drift apart
- UI feedback feels inconsistent
- procedural audio lacks visual presence

With Visualizer:
- sound and visuals are born together
- feedback feels cohesive
- systems feel alive, not stitched together

---

## 14. Summary

**ToneForge Visualizer** is the visual expression of sound behavior.

It:
- listens to sound structure
- respects timing and intent
- scales from icons to full screen
- remains deterministic and inspectable

It completes ToneForge’s evolution into a **multi‑sensory behavior engine**, where sound and visuals are no longer separate pipelines — they are two outputs of the same system.

---

If you want next, the strongest follow‑ups are:
- a full PRD for ToneForge Visualizer
- a visual recipe taxonomy
- or a comparison against traditional audio‑driven VFX systems
