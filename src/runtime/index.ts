/**
 * ToneForge Runtime Module
 *
 * Lightweight, deterministic playback engine that ties together
 * State, Context, and Sequencer for real-time behavioral sound.
 *
 * Reference: docs/prd/RUNTIME_PRD.md
 */

export {
  createRuntime,
  type Runtime,
  type RuntimeOptions,
  type RuntimeEvent,
  type RuntimeLogEntry,
  type RuntimeInspection,
  type RuntimeListener,
} from "./runtime.js";
