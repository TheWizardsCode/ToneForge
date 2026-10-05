/**
 * Public entry point for the embeddable SoundEditor component.
 *
 * ```ts
 * import { createSoundEditor } from "./components/SoundEditor/index.js";
 *
 * const editor = createSoundEditor({ preset });
 * editor.mount(document.getElementById("host")!);
 * editor.onChange((next) => console.log(next));
 * // ...
 * editor.dispose();
 * ```
 */

export { createSoundEditor } from "./editor.js";
export { EDITOR_STYLES, applyStyles } from "./styles.js";
export {
  SOUND_PRESET_VERSION,
  type AudioEngine,
  type SoundEditorController,
  type SoundEditorOptions,
  type SoundPreset,
  type SoundPresetListener,
} from "./types.js";
