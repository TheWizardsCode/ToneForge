/**
 * ToneForge State Module
 *
 * Formal state-machine and behavioral context module. Defines discrete
 * states that drive how sound behaves over time.
 *
 * State does not generate sound — it defines why behavior changes.
 *
 * Reference: docs/prd/STATE_PRD.md
 */

export {
  createStateMachine,
  type StateMachine,
  type StateMachineDefinition,
  type StateDefinition,
  type TransitionDefinition,
  type TransitionRecord,
  type StateInspection,
  type StateListener,
  type StateMachineOptions,
} from "./state.js";
