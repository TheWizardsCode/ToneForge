/**
 * ToneForge Context Module
 *
 * Environmental and situational context resolver. Provides a unified,
 * deterministic snapshot of the world state that informs how sound
 * should behave at any given moment.
 *
 * Context does not generate sound or behavior — it answers:
 * "What is happening around us right now?"
 *
 * Reference: docs/prd/CONTEXT_PRD.md
 */

export {
  createContext,
  type Context,
  type ContextSnapshot,
  type ContextDimensions,
  type ContextChangeRecord,
} from "./context.js";
