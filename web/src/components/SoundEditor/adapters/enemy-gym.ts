/**
 * Enemy-Gym-style plain-DOM host adapter.
 *
 * A thin wrapper around `createSoundEditor()` for hosts that have no framework
 * or bundler integration: create an Editor inside a DOM container, receive
 * `onChange(preset)` callbacks and dispose it when the host view is torn down.
 *
 * The AI_Hell Enemy Gym Panel is the reference host; the AI_Hell migration
 * itself is tracked separately (AH-0MUTUOB7X007PR9J) and is NOT performed here.
 * See `docs/guides/enemy-gym-sound-editor.md`.
 */

import type { SoundPreset } from "../../../models/preset.js";
import { createSoundEditor } from "../index.js";

/** Options for {@link mountEnemyGymEditor}. */
export interface EnemyGymEditorOptions {
  /** Initial preset to load (recipe + seed + overrides). */
  preset: SoundPreset;
  /** Called whenever the user edits the sound. Persist/forward the preset. */
  onChange?: (preset: SoundPreset) => void;
  /** Accessible label for the editor region. */
  label?: string;
}

/** Handle returned to the host application. */
export interface EnemyGymEditorHandle {
  /** Remove the editor and release its DOM/audio resources. */
  dispose(): void;
  /** Current preset (defensive copy). */
  getPreset(): SoundPreset;
  /** Load a different preset (e.g. when the selected enemy changes). */
  setPreset(preset: SoundPreset): void;
  /** Export the current sound to WAV bytes. */
  exportWav(): Promise<Uint8Array>;
}

/**
 * Mount a ToneForge SoundEditor into `container` and return a host handle.
 *
 * ```ts
 * const handle = mountEnemyGymEditor(panelElement, {
 *   preset: enemyPreset,
 *   onChange: (preset) => saveEnemySound(enemy, preset),
 * });
 * // later, when the panel is removed:
 * handle.dispose();
 * ```
 */
export function mountEnemyGymEditor(
  container: HTMLElement,
  options: EnemyGymEditorOptions,
): EnemyGymEditorHandle {
  const editor = createSoundEditor({
    preset: options.preset,
    label: options.label ?? "Enemy sound",
  });

  const unsubscribe = options.onChange
    ? editor.onChange((preset) => options.onChange?.(preset))
    : undefined;

  editor.mount(container);

  return {
    dispose(): void {
      unsubscribe?.();
      editor.dispose();
    },
    getPreset: () => editor.getPreset(),
    setPreset: (preset) => editor.setPreset(preset),
    exportWav: () => editor.exportWav(),
  };
}
