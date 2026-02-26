/**
 * Sequence Module — Barrel Export
 *
 * Re-exports all public APIs from the sequence module.
 */

export { loadSequencePreset, validateSequencePresetFile } from "./preset-loader.js";
export {
  validateSequencePreset,
  parseSequencePreset,
} from "./schema.js";
export type {
  SequencePresetJson,
  SequenceEventJson,
  SequenceRepeatJson,
  SequenceDefinition,
  SequenceEvent,
  ValidationError,
} from "./schema.js";
export {
  simulate,
  msToSamples,
  formatTimeline,
} from "./simulator.js";
export type {
  SimulationResult,
  TimelineEvent,
} from "./simulator.js";
export { renderSequence } from "./renderer.js";
