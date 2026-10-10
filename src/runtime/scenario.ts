/**
 * Runtime Scenario
 *
 * A versioned, declarative description of a scripted runtime demo: a state
 * machine, an environment context, per-state sequences, a recipe resolver,
 * and a timeline of scripted steps. Loading a scenario yields everything
 * `createRuntime` needs, so the CLI (and tests) can run an audible,
 * deterministic runtime demo without hand-wiring State, Context, and the
 * Sequencer.
 *
 * Reference: docs/prd/RUNTIME_PRD.md §19 (Runtime ↔ Render/Playback Pipeline)
 */

import type { StateMachineDefinition } from "../state/state.js";
import type {
  ContextDimensions,
  ContextSnapshot,
} from "../context/context.js";
import {
  parseSequencePreset,
  validateSequencePreset,
} from "../sequence/schema.js";
import type { SequenceDefinition } from "../sequence/schema.js";
import type { RecipeResolver } from "./runtime.js";

// ── Types ─────────────────────────────────────────────────────────

/** A single scripted step: a state and/or context change at a point in time. */
export interface RuntimeScenarioStep {
  /** Absolute time offset from the start of the scenario, in seconds. */
  time: number;

  /** State to transition to at this time (optional). */
  state?: string;

  /** Context dimensions to set at this time (optional). */
  context?: Record<string, string>;
}

/** Environment context configuration for a scenario. */
export interface RuntimeScenarioContext {
  /** Allowed values per dimension. */
  dimensions?: ContextDimensions;

  /** Initial context values. */
  initial?: ContextSnapshot;
}

/** A parsed, validated runtime scenario. */
export interface RuntimeScenario {
  /** Schema version, e.g. "1.0". */
  version: string;

  /** Human-readable scenario name. */
  name: string;

  /** Optional description. */
  description?: string;

  /** Base seed for deterministic event generation and rendering. */
  seed: number;

  /** State machine definition (idle/walk/run/sprint, etc.). */
  stateMachine: StateMachineDefinition;

  /** Environment context configuration. */
  context?: RuntimeScenarioContext;

  /** Sequence definitions keyed by sequence name. */
  sequences: Record<string, SequenceDefinition>;

  /**
   * Declarative recipe resolver: event name → template string.
   *
   * Templates may reference context dimensions with `{dimension}`, e.g.
   * `"footstep": "footstep-{surface}"` resolves to `footstep-gravel` when
   * the context `surface` is `gravel`. Events absent from the map resolve to
   * themselves.
   */
  recipeResolver: Record<string, string>;

  /** Scripted steps, applied in ascending time order. */
  steps: RuntimeScenarioStep[];
}

/** A field-level validation error. */
export interface ScenarioValidationError {
  /** Path to the invalid field (e.g. "steps[1].time"). */
  field: string;
  /** Human-readable error message. */
  message: string;
}

// ── Helpers ───────────────────────────────────────────────────────

function isPlainObject(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

/**
 * Resolve a recipe template against a context snapshot.
 *
 * Replaces every `{dimension}` placeholder with the corresponding context
 * value. Throws when a referenced dimension is missing from the context so
 * scenario mistakes surface immediately rather than producing a bogus recipe
 * name that fails later during rendering.
 *
 * @param template - Template string, e.g. `"footstep-{surface}"`.
 * @param context - Current context snapshot.
 * @returns The resolved recipe name.
 */
export function resolveRecipeTemplate(
  template: string,
  context: Record<string, string>,
): string {
  return template.replace(/\{([^}]+)\}/g, (_match, dimension: string) => {
    const value = context[dimension];
    if (value === undefined) {
      throw new Error(
        `Recipe template "${template}" references context dimension ` +
          `"${dimension}", which is not set. ` +
          `Known dimensions: ${Object.keys(context).join(", ") || "(none)"}.`,
      );
    }
    return value;
  });
}

/**
 * Build a {@link RecipeResolver} from a declarative template map.
 *
 * Event names that are absent from the map resolve to themselves, preserving
 * the runtime's default identity behaviour.
 *
 * @param templates - Event name → template string.
 * @returns A resolver suitable for `createRuntime({ recipeResolver })`.
 */
export function createTemplateRecipeResolver(
  templates: Record<string, string>,
): RecipeResolver {
  return (eventName, context) => {
    const template = templates[eventName];
    if (template === undefined) return eventName;
    return resolveRecipeTemplate(template, context);
  };
}

// ── Validation ────────────────────────────────────────────────────

/**
 * Validate a parsed JSON object against the runtime scenario schema.
 *
 * Returns an array of validation errors. An empty array means the scenario
 * is valid.
 *
 * @param data - The parsed JSON data.
 * @param source - Source label for error messages (usually the file path).
 * @returns Array of validation errors (empty = valid).
 */
export function validateRuntimeScenario(
  data: unknown,
  source: string,
): ScenarioValidationError[] {
  const errors: ScenarioValidationError[] = [];

  if (!isPlainObject(data)) {
    errors.push({
      field: "(root)",
      message: `Invalid runtime scenario '${source}': expected a JSON object.`,
    });
    return errors;
  }

  if (typeof data["version"] !== "string" || data["version"].trim() === "") {
    errors.push({
      field: "version",
      message: `Missing or invalid 'version' (expected a non-empty string, e.g. "1.0").`,
    });
  }

  if (typeof data["name"] !== "string" || data["name"].trim() === "") {
    errors.push({
      field: "name",
      message: `Missing or invalid 'name' (expected a non-empty string).`,
    });
  }

  if (typeof data["seed"] !== "number" || !Number.isFinite(data["seed"])) {
    errors.push({
      field: "seed",
      message: `Missing or invalid 'seed' (expected a finite number).`,
    });
  }

  if (data["description"] !== undefined && typeof data["description"] !== "string") {
    errors.push({
      field: "description",
      message: `Invalid 'description' (expected a string).`,
    });
  }

  // ── state machine ──
  const stateMachine = data["stateMachine"];
  if (!isPlainObject(stateMachine)) {
    errors.push({
      field: "stateMachine",
      message: `Missing or invalid 'stateMachine' (expected an object).`,
    });
  } else {
    if (
      typeof stateMachine["name"] !== "string" ||
      stateMachine["name"].trim() === ""
    ) {
      errors.push({
        field: "stateMachine.name",
        message: `Missing or invalid 'name' (expected a non-empty string).`,
      });
    }
    if (
      typeof stateMachine["initial"] !== "string" ||
      stateMachine["initial"].trim() === ""
    ) {
      errors.push({
        field: "stateMachine.initial",
        message: `Missing or invalid 'initial' (expected a non-empty string).`,
      });
    }
    const states = stateMachine["states"];
    if (!Array.isArray(states) || states.length === 0) {
      errors.push({
        field: "stateMachine.states",
        message: `Missing or invalid 'states' (expected a non-empty array).`,
      });
    } else {
      states.forEach((state, i) => {
        if (!isPlainObject(state)) {
          errors.push({
            field: `stateMachine.states[${i}]`,
            message: `State must be an object.`,
          });
          return;
        }
        if (typeof state["name"] !== "string" || state["name"].trim() === "") {
          errors.push({
            field: `stateMachine.states[${i}].name`,
            message: `Missing or invalid state 'name'.`,
          });
        }
      });
    }
    const transitions = stateMachine["transitions"];
    if (transitions !== undefined && !Array.isArray(transitions)) {
      errors.push({
        field: "stateMachine.transitions",
        message: `Invalid 'transitions' (expected an array).`,
      });
    }
  }

  // ── context ──
  const context = data["context"];
  if (context !== undefined) {
    if (!isPlainObject(context)) {
      errors.push({
        field: "context",
        message: `Invalid 'context' (expected an object).`,
      });
    } else {
      const dimensions = context["dimensions"];
      if (dimensions !== undefined) {
        if (!isPlainObject(dimensions)) {
          errors.push({
            field: "context.dimensions",
            message: `Invalid 'dimensions' (expected an object).`,
          });
        } else {
          for (const [dimension, values] of Object.entries(dimensions)) {
            if (
              values !== undefined &&
              (!Array.isArray(values) ||
                values.some((v) => typeof v !== "string"))
            ) {
              errors.push({
                field: `context.dimensions.${dimension}`,
                message: `Invalid dimension values (expected an array of strings).`,
              });
            }
          }
        }
      }
      const initial = context["initial"];
      if (initial !== undefined) {
        if (
          !isPlainObject(initial) ||
          Object.values(initial).some((v) => typeof v !== "string")
        ) {
          errors.push({
            field: "context.initial",
            message: `Invalid 'initial' (expected an object of string values).`,
          });
        }
      }
    }
  }

  // ── sequences ──
  const sequences = data["sequences"];
  if (!isPlainObject(sequences) || Object.keys(sequences).length === 0) {
    errors.push({
      field: "sequences",
      message: `Missing or invalid 'sequences' (expected a non-empty object).`,
    });
  } else {
    for (const [sequenceName, preset] of Object.entries(sequences)) {
      const seqErrors = validateSequencePreset(preset, `${source}#${sequenceName}`);
      for (const err of seqErrors) {
        errors.push({
          field: `sequences.${sequenceName}.${err.field}`,
          message: err.message,
        });
      }
    }
  }

  // ── recipe resolver ──
  const resolver = data["recipeResolver"];
  if (resolver !== undefined) {
    if (!isPlainObject(resolver)) {
      errors.push({
        field: "recipeResolver",
        message: `Invalid 'recipeResolver' (expected an object of templates).`,
      });
    } else {
      for (const [eventName, template] of Object.entries(resolver)) {
        if (typeof template !== "string") {
          errors.push({
            field: `recipeResolver.${eventName}`,
            message: `Invalid template (expected a string).`,
          });
        }
      }
    }
  }

  // ── steps ──
  const steps = data["steps"];
  if (!Array.isArray(steps) || steps.length === 0) {
    errors.push({
      field: "steps",
      message: `Missing or invalid 'steps' (expected a non-empty array).`,
    });
  } else {
    steps.forEach((step, i) => {
      if (!isPlainObject(step)) {
        errors.push({
          field: `steps[${i}]`,
          message: `Step must be an object.`,
        });
        return;
      }
      if (typeof step["time"] !== "number" || step["time"] < 0) {
        errors.push({
          field: `steps[${i}].time`,
          message: `Missing or invalid 'time' (expected a number >= 0).`,
        });
      }
      if (step["state"] !== undefined && typeof step["state"] !== "string") {
        errors.push({
          field: `steps[${i}].state`,
          message: `Invalid 'state' (expected a string).`,
        });
      }
      const stepContext = step["context"];
      if (stepContext !== undefined) {
        if (
          !isPlainObject(stepContext) ||
          Object.values(stepContext).some((v) => typeof v !== "string")
        ) {
          errors.push({
            field: `steps[${i}].context`,
            message: `Invalid 'context' (expected an object of string values).`,
          });
        }
      }
      if (step["state"] === undefined && stepContext === undefined) {
        errors.push({
          field: `steps[${i}]`,
          message: `Step must set at least one of 'state' or 'context'.`,
        });
      }
    });
  }

  return errors;
}

/**
 * Parse and validate a runtime scenario JSON object.
 *
 * @param data - The parsed JSON data.
 * @param source - Source label for error messages (usually the file path).
 * @returns A validated {@link RuntimeScenario}.
 * @throws If validation fails with descriptive, field-level messages.
 */
export function parseRuntimeScenario(
  data: unknown,
  source: string,
): RuntimeScenario {
  const errors = validateRuntimeScenario(data, source);
  if (errors.length > 0) {
    const messages = errors.map((e) => `  ${e.field}: ${e.message}`).join("\n");
    throw new Error(`Invalid runtime scenario '${source}':\n${messages}`);
  }

  const obj = data as Record<string, unknown>;
  const stateMachine = obj["stateMachine"] as StateMachineDefinition;

  const sequences: Record<string, SequenceDefinition> = {};
  const rawSequences = obj["sequences"] as Record<string, unknown>;
  for (const [sequenceName, preset] of Object.entries(rawSequences)) {
    sequences[sequenceName] = parseSequencePreset(
      preset,
      `${source}#${sequenceName}`,
    );
  }

  const recipeResolver: Record<string, string> = {};
  const rawResolver = obj["recipeResolver"];
  if (isPlainObject(rawResolver)) {
    for (const [eventName, template] of Object.entries(rawResolver)) {
      recipeResolver[eventName] = template as string;
    }
  }

  const context = obj["context"] as RuntimeScenarioContext | undefined;
  const steps = (obj["steps"] as RuntimeScenarioStep[]).map((step) => ({
    time: step.time,
    ...(step.state !== undefined ? { state: step.state } : {}),
    ...(step.context !== undefined ? { context: { ...step.context } } : {}),
  }));

  return {
    version: obj["version"] as string,
    name: obj["name"] as string,
    ...(obj["description"] !== undefined
      ? { description: obj["description"] as string }
      : {}),
    seed: obj["seed"] as number,
    stateMachine,
    ...(context !== undefined ? { context } : {}),
    sequences,
    recipeResolver,
    steps,
  };
}

/**
 * Load and validate a runtime scenario from a JSON file.
 *
 * @param filePath - Path to the scenario JSON file.
 * @returns A validated {@link RuntimeScenario}.
 * @throws If the file cannot be read, parsed, or validated.
 */
export async function loadRuntimeScenario(
  filePath: string,
): Promise<RuntimeScenario> {
  // `node:fs` is imported dynamically so this module stays browser-bundleable;
  // file loading is a Node-only entry point.
  const { readFile } = await import("node:fs/promises");

  let raw: string;
  try {
    raw = await readFile(filePath, "utf-8");
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    throw new Error(`Failed to read runtime scenario '${filePath}': ${message}`);
  }

  let data: unknown;
  try {
    data = JSON.parse(raw);
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    throw new Error(
      `Failed to parse runtime scenario '${filePath}': ${message}`,
    );
  }

  return parseRuntimeScenario(data, filePath);
}
