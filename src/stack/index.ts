/**
 * Stack Module — Barrel Export
 *
 * Re-exports all public APIs from the stack module.
 */

export { renderStack } from "./renderer.js";
export type { StackDefinition, StackLayer } from "./renderer.js";
export { loadPreset } from "./preset-loader.js";
export { validatePreset } from "./schema.js";
export type { PresetJson, PresetLayerJson } from "./schema.js";
export { parseLayer, parseLayers } from "./layer-parser.js";
