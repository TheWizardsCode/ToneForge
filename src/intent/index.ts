/**
 * ToneForge Intent — public API.
 *
 * Intent is the structured, inspectable representation of a human goal. It
 * routes through Intelligence and enforces a human approval gate; it never
 * mutates systems directly.
 */

export {
  INTENT_VERSION,
  INTENT_PRIORITIES,
  INTENT_VOCABULARY,
  findIntentDefinition,
  intentVocabularyIds,
  validateIntent,
  parseIntent,
} from "./types.js";
export type {
  Intent,
  IntentConstraintValue,
  IntentConstraints,
  IntentDefinition,
  IntentPriority,
} from "./types.js";

export {
  UnknownIntentError,
  UnknownIntentIdError,
  tokenize,
  parseGoalToIntent,
  resolveIntent,
} from "./parse.js";
export type { ParseGoalOptions, ResolveIntentOptions } from "./parse.js";

export { submitIntent, intentToUseCase } from "./submit.js";
export type {
  CommandExecutor,
  IntentSubmissionReport,
  IntentSuggestion,
  SubmitIntentOptions,
} from "./submit.js";
