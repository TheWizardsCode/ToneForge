---
title: "Embedding the Sound Editor in AI_Hell's Enemy Gym"
id: enemy-gym-sound-editor
order: 20
description: >
  How to embed the framework-agnostic ToneForge SoundEditor into a host view
  (AI_Hell Enemy Gym) via the plain-DOM adapter, hand a SoundPreset back to the
  host, theme it, and meet the accessibility contract. The AI_Hell migration is
  tracked separately (AH-0MUTUOB7X007PR9J); this guide documents the pattern.
---

## Overview

The ToneForge SoundEditor is a single-sound, framework-agnostic editor. It
mounts into any DOM container, renders one control per declared recipe
parameter, auditions the sound, and exports WAV — without adopting ToneForge's
build stack and without host-side framework changes.

The Enemy Gym panel in AI_Hell is the reference host. **This guide documents the
embedding pattern only**; migrating AI_Hell's procedural SFX to ToneForge is
tracked in `AH-0MUTUOB7X007PR9J`.

## Quick start (plain-DOM adapter)

```ts
import { mountEnemyGymEditor } from "@toneforge-web/components/SoundEditor/adapters/enemy-gym.js";

const handle = mountEnemyGymEditor(panelElement, {
  preset: { version: 1, recipe: "weapon-laser-zap", seed: 1234, overrides: {} },
  label: `${enemy.name} sound`,
  onChange: (preset) => {
    // Persist the sound alongside the enemy definition.
    enemy.sound = preset;
  },
});

// when the enemy panel is removed:
handle.setPreset(otherPreset); // switch enemy
handle.dispose();              // release DOM + audio
```

The adapter wraps `createSoundEditor()` and returns `{ dispose, getPreset,
setPreset, exportWav }`. See
[`web/src/components/SoundEditor/README.md`](../../web/src/components/SoundEditor/README.md)
for the full API.

## Mount / dispose API

| Member | Contract |
| --- | --- |
| `mount(container)` | Appends exactly one scoped root element (shadow DOM). Never constructs audio. |
| `dispose()` | Removes DOM, disconnects observers, disposes the audio engine; idempotent. |
| `onChange(listener)` | Fires once per committed edit with the current `SoundPreset`; returns an unsubscribe. |
| `getPreset()` / `setPreset(p)` | Read / load the preset. |
| `exportWav(preset?)` | Renders offline and returns WAV bytes; `createWavDownload` builds a Blob + download. |

## Handing `SoundPreset` to the host

```ts
interface SoundPreset {
  version: number;                   // schema version (currently 1)
  recipe: string;                    // registered recipe name
  seed: number;                      // deterministic seed
  overrides: Record<string, number>; // edited parameter overrides
}
```

Persist the JSON as-is (see the `SoundPreset` model docs). Reloading a preset
reproduces the same sound: the seed determines the baseline and the overrides
are re-applied deterministically.

## AI_Hell parameter mapping (recipe ↔ perceived traits)

Use this table to pick a starting recipe per perceived sound need, then tune the
seed/overrides in the editor:

| AI_Hell sound need | Starting recipe | Perceived traits |
| --- | --- | --- |
| Enemy laser / ranged attack | `weapon-laser-zap` | bright, zappy, aggressive, short |
| Enemy impact / hit | `impact-crack` | sharp transient, brittle, percussive |
| Enemy defeat sting | `card-defeat-sting` | descending, final, tonal |
| Arena ambience | `ambient-wind-gust` | airy, evolving, filtered noise |
| UI / notification confirm | `ui-scifi-confirm` | tonal, positive, short |
| Footstep on stone | `footstep-stone` | percussive, filtered noise, tactile |

The mapping is intentionally a starting point: any registered recipe can be
loaded and its declared parameters are exposed as controls automatically.

## Theming

Theme via CSS custom properties on (or above) the host container:

```css
.enemy-gym-panel {
  --tfe-background: #101418;
  --tfe-foreground: #f5f5f5;
  --tfe-accent: #ff9f1c;
  --tfe-font: system-ui, sans-serif;
}
```

## Accessibility contract

- **Labelled controls** — every control is named from its recipe parameter; the
  editor region is a labelled `role="group"`.
- **Keyboard operation** — sliders/dials: Arrow keys, PageUp/PageDown, Home/End;
  XY pad: per-axis arrows/Home/End; toggle/select: arrows, Home/End,
  Enter/Space; audition buttons are native buttons.
- **Ranges & units** — `aria-valuemin`/`aria-valuemax`/`aria-valuenow` plus a
  unit-bearing `aria-valuetext`.
- **Roles** — `role="slider"`, `role="listbox"`/`role="option"`, and a
  `role="group"` XY pad; the audition status uses `aria-live="polite"`.
- **Focus order** — DOM order: recipe controls (in descriptor order) then
  audition controls.

## Autoplay & graceful degradation

Browsers block audio until a user gesture. The editor shows an **Enable audio**
button until the first gesture and creates no `AudioContext` before it. If Web
Audio is unavailable, the audition control disables itself with an accessible
message; editing and WAV export (offline render) continue to work.

## Scope boundary

The editor is **single-sound only**. Stacking, sequencing and mixing UIs are out
of scope; requests for those belong to separate work items so the boundary is
maintained.
