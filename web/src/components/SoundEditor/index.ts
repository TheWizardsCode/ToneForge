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
export { createControlPanel, type ControlPanel } from "./controls.js";
export {
  createAudition,
  type Audition,
  type AuditionBuffer,
  type AuditionContext,
  type AuditionOptions,
  type AuditionSource,
} from "./audition.js";
export {
  PresetExportError,
  createWavDownload,
  exportWav,
  wavFilename,
  type WavExport,
} from "./export.js";
export {
  mountEnemyGymEditor,
  type EnemyGymEditorHandle,
  type EnemyGymEditorOptions,
} from "./adapters/enemy-gym.js";
export {
  DEFAULT_XY_PAIRS,
  buildParameterMapping,
  chooseWidgetKind,
  isBooleanDescriptor,
  isIntegerDescriptor,
  stepForDescriptor,
  type ParameterMapping,
  type ScalarControlSpec,
  type WidgetKind,
  type XYControlSpec,
} from "./parameter-map.js";
export { EDITOR_STYLES, applyStyles } from "./styles.js";
export {
  SOUND_PRESET_VERSION,
  type AudioEngine,
  type SoundEditorController,
  type SoundEditorOptions,
  type SoundPreset,
  type SoundPresetListener,
} from "./types.js";
