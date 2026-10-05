/**
 * Embeddable SoundEditor shell.
 *
 * `createSoundEditor()` builds a framework-agnostic controller whose whole
 * public surface is `mount`, `dispose`, `onChange`, `getPreset` and
 * `setPreset`. The shell owns lifecycle only: it renders a scoped root element
 * (shadow DOM), tracks every disposable it creates, and tears them all down in
 * `dispose()`. Controls, audio and mapping are layered on by later slices.
 *
 * Invariants:
 * - mounting never constructs an `AudioContext` or starts audio;
 * - styles live in the shadow root (never `document.head`);
 * - no global symbols are created;
 * - `dispose()` is idempotent and clears all listeners, so `onChange` is never
 *   invoked after dispose.
 */

import { applyStyles } from "./styles.js";
import { createControlPanel, type ControlPanel } from "./controls.js";
import { createAudition, type Audition } from "./audition.js";
import {
  SOUND_PRESET_VERSION,
  type SoundEditorController,
  type SoundEditorOptions,
  type SoundPreset,
  type SoundPresetListener,
} from "./types.js";

/** Minimal valid preset used when the host does not supply one. */
const DEFAULT_PRESET: SoundPreset = {
  version: SOUND_PRESET_VERSION,
  recipe: "ui-scifi-confirm",
  seed: 0,
  overrides: {},
};

function clonePreset(preset: SoundPreset): SoundPreset {
  return {
    version: preset.version,
    recipe: preset.recipe,
    seed: preset.seed,
    overrides: { ...preset.overrides },
  };
}

function presetsEqual(a: SoundPreset, b: SoundPreset): boolean {
  if (a.version !== b.version || a.recipe !== b.recipe || a.seed !== b.seed) {
    return false;
  }
  const aKeys = Object.keys(a.overrides);
  const bKeys = Object.keys(b.overrides);
  if (aKeys.length !== bKeys.length) {
    return false;
  }
  return aKeys.every((key) => Object.is(a.overrides[key], b.overrides[key]));
}

/**
 * Create a new editor controller.
 *
 * @param options - Optional initial preset, audio engine and label.
 */
export function createSoundEditor(
  options: SoundEditorOptions = {},
): SoundEditorController {
  const disposables: Array<() => void> = [];
  const listeners = new Set<SoundPresetListener>();

  let preset: SoundPreset = clonePreset(options.preset ?? DEFAULT_PRESET);
  let disposed = false;
  let mounted = false;

  let root: HTMLElement | null = null;
  let recipeLabel: HTMLElement | null = null;
  let panel: ControlPanel | null = null;
  let audition: Audition | null = null;

  if (options.audioEngine?.dispose) {
    const engine = options.audioEngine;
    disposables.push(() => engine.dispose?.());
  }

  function assertUsable(): void {
    if (disposed) {
      throw new Error("SoundEditor has been disposed");
    }
  }

  function renderRecipeLabel(): void {
    if (recipeLabel) {
      recipeLabel.textContent = preset.recipe;
    }
  }

  function mount(container: HTMLElement): void {
    assertUsable();
    if (!container) {
      throw new Error("mount() requires a container element");
    }
    if (mounted) {
      throw new Error("SoundEditor is already mounted");
    }

    root = container.ownerDocument.createElement("div");
    root.className = "toneforge-editor";
    root.setAttribute("role", "group");
    root.setAttribute("aria-label", options.label ?? "Sound editor");

    const shadow = root.attachShadow({ mode: "open" });
    applyStyles(shadow);

    const body = container.ownerDocument.createElement("div");
    body.className = "toneforge-editor__body";

    const header = container.ownerDocument.createElement("div");
    header.className = "toneforge-editor__header";

    const title = container.ownerDocument.createElement("h2");
    title.className = "toneforge-editor__title";
    title.textContent = "Sound Editor";

    recipeLabel = container.ownerDocument.createElement("span");
    recipeLabel.className = "toneforge-editor__recipe";
    renderRecipeLabel();

    header.appendChild(title);
    header.appendChild(recipeLabel);

    const controls = container.ownerDocument.createElement("div");
    controls.className = "toneforge-editor__controls";

    // Data-driven controls: one widget per declared parameter of the preset's
    // recipe. Widget changes write through to preset.overrides.
    panel = createControlPanel(preset);
    controls.appendChild(panel.element);
    panel.onChange((nextOverrides) => {
      preset = { ...preset, overrides: { ...nextOverrides } };
      const snapshot = clonePreset(preset);
      for (const listener of [...listeners]) {
        listener(snapshot);
      }
    });

    body.appendChild(header);
    body.appendChild(controls);

    // Audition controls: lazily create audio only after an explicit gesture.
    audition = createAudition({ getPreset: () => clonePreset(preset) });
    body.appendChild(audition.element);

    shadow.appendChild(body);

    container.appendChild(root);
    mounted = true;

    // Responsive layout foundation: expose the host width to scoped styles.
    if (typeof globalThis.ResizeObserver !== "undefined") {
      const observer = new globalThis.ResizeObserver((entries) => {
        const entry = entries[0];
        if (!entry || !root) {
          return;
        }
        root.style.setProperty(
          "--tf-host-width",
          `${Math.round(entry.contentRect.width)}px`,
        );
      });
      observer.observe(root);
      disposables.push(() => observer.disconnect());
    }
  }

  function removeRoot(): void {
    if (panel) {
      panel.dispose();
      panel = null;
    }
    if (audition) {
      audition.dispose();
      audition = null;
    }
    if (root?.parentNode) {
      root.parentNode.removeChild(root);
    }
    root = null;
    recipeLabel = null;
    mounted = false;
  }

  function dispose(): void {
    if (disposed) {
      return;
    }
    disposed = true;

    for (const disposable of disposables.splice(0)) {
      disposable();
    }
    listeners.clear();
    removeRoot();
  }

  function onChange(listener: SoundPresetListener): () => void {
    assertUsable();
    listeners.add(listener);
    return () => {
      listeners.delete(listener);
    };
  }

  function getPreset(): SoundPreset {
    return clonePreset(preset);
  }

  function setPreset(next: SoundPreset): void {
    assertUsable();
    if (presetsEqual(preset, next)) {
      return;
    }
    preset = clonePreset(next);
    renderRecipeLabel();
    panel?.setPreset(preset);
    const snapshot = clonePreset(preset);
    for (const listener of [...listeners]) {
      listener(snapshot);
    }
  }

  return { mount, dispose, onChange, getPreset, setPreset };
}
