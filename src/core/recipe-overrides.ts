/**
 * Declarative file-backed override mappings.
 *
 * File-backed recipes may attach an `overrides` list to each entry in
 * `meta.parameters`. Each entry maps the declared parameter onto one or more
 * node fields or automation event fields, optionally transforming it with a
 * small arithmetic expression. This lets a recipe express computed
 * relationships (for example `modulator.frequency = carrier.frequency *
 * modRatio`) without duplicating derived literals in the YAML.
 *
 * The mechanism is deliberately explicit: mappings win over the generic
 * name/default-value injection heuristic in `createFileBackedRegistration`,
 * and an invalid mapping (unknown parameter, node or field) fails loudly at
 * registration time.
 *
 * Declaration format:
 *
 * ```yaml
 * meta:
 *   parameters:
 *     - name: modRatio
 *       type: number
 *       min: 1
 *       max: 4
 *       overrides:
 *         - target: modulator.frequency
 *           expression: "carrier.frequency * modRatio"
 *     - name: modDepthEnd
 *       type: number
 *       min: 300
 *       max: 800
 *       overrides:
 *         - target: modDepth.automation.gain.linearRamp.value
 * ```
 *
 * Target paths are one of:
 * - `<node>.<field>` — a node `params` field.
 * - `<node>.automation.<param>.<index|kind>.<field>` — an automation event
 *   field, selected by zero-based event index or by event `kind`.
 */

import type { ToneGraphDocument } from "./tonegraph-schema.js";

/** A single declarative target for a parameter override. */
export interface FileBackedOverrideTarget {
  /** Dotted target path (see module documentation). */
  target: string;
  /**
   * Optional arithmetic expression evaluated against resolved parameters and
   * node fields. Supported operators: `*` and `/`. Operands are numeric
   * literals, declared parameter names, or `<node>.<field>` references.
   * When omitted, the parameter's resolved value is written directly.
   */
  expression?: string;
}

/** Mapping declared on a single parameter descriptor. */
export interface FileBackedParameterMapping {
  /** Declared parameter name the mapping belongs to. */
  parameter: string;
  /** Ordered targets for the parameter. */
  overrides: FileBackedOverrideTarget[];
}

type ParsedTarget =
  | { kind: "param"; node: string; field: string }
  | {
      kind: "automation";
      node: string;
      param: string;
      selector: EventSelector;
      field: string;
    };

type EventSelector =
  | { type: "index"; index: number }
  | { type: "kind"; kind: string };

const NUMERIC_LITERAL = /^-?\d+(\.\d+)?([eE][+-]?\d+)?$/;

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

/**
 * Parse the `meta.parameters[].overrides` declarations from a raw recipe
 * document. Returns an empty list when no mappings are declared. Throws when a
 * declaration is structurally malformed.
 */
export function parseFileBackedMappings(rawDoc: unknown): FileBackedParameterMapping[] {
  if (!isRecord(rawDoc)) {
    return [];
  }
  const meta = rawDoc.meta;
  if (!isRecord(meta)) {
    return [];
  }
  const parameters = meta.parameters;
  if (!Array.isArray(parameters)) {
    return [];
  }

  const mappings: FileBackedParameterMapping[] = [];
  for (const entry of parameters) {
    if (!isRecord(entry)) {
      continue;
    }
    const name = entry.name;
    if (typeof name !== "string" || name.length === 0) {
      continue;
    }
    const overridesRaw = entry.overrides;
    if (overridesRaw === undefined) {
      continue;
    }
    if (!Array.isArray(overridesRaw)) {
      throw new Error(
        `Override mapping for parameter "${name}" must be an array.`,
      );
    }

    const overrides: FileBackedOverrideTarget[] = [];
    for (const override of overridesRaw) {
      if (!isRecord(override)) {
        throw new Error(
          `Override mapping for parameter "${name}" must be an object with a "target".`,
        );
      }
      const target = override.target;
      if (typeof target !== "string" || target.length === 0) {
        throw new Error(
          `Override mapping for parameter "${name}" requires a non-empty "target".`,
        );
      }
      const expression = override.expression;
      if (expression !== undefined && typeof expression !== "string") {
        throw new Error(
          `Override mapping for parameter "${name}" has a non-string "expression".`,
        );
      }
      overrides.push({ target, expression });
    }

    if (overrides.length > 0) {
      mappings.push({ parameter: name, overrides });
    }
  }

  return mappings;
}

/**
 * Validate declarative mappings against a resolved parameter set and graph.
 *
 * Called both at registration/discovery time (with the seed-independent
 * parameter names and canonical graph) and before each application, so an
 * invalid mapping fails loudly rather than rendering silently.
 *
 * @param mappings      - Parsed mappings from {@link parseFileBackedMappings}.
 * @param declaredNames - Set of declared parameter names.
 * @param graph         - Graph the targets are resolved against.
 */
export function validateFileBackedMappings(
  mappings: FileBackedParameterMapping[],
  declaredNames: Set<string>,
  graph: ToneGraphDocument,
): void {
  for (const mapping of mappings) {
    if (!declaredNames.has(mapping.parameter)) {
      throw new Error(
        `Override mapping references unknown parameter "${mapping.parameter}".`,
      );
    }
    for (const override of mapping.overrides) {
      const target = parseTargetPath(override.target);
      assertTargetExists(graph, target, override.target);
    }
  }
}

/**
 * Apply declarative mappings to a cloned graph.
 *
 * Resolution order: direct (expression-less) mappings are written first, then
 * computed mappings. Parameter references always read the post-override values
 * supplied in `derived`, so declaration order does not affect parameter
 * resolution. Node-field references read the current cloned graph, picking up
 * any previously written mapping.
 *
 * @param mappings - Parsed mappings from {@link parseFileBackedMappings}.
 * @param derived  - Resolved parameter values (seed-derived + overrides).
 * @param cloned   - Cloned graph mutated in place.
 */
export function applyFileBackedMappings(
  mappings: FileBackedParameterMapping[],
  derived: Record<string, number>,
  cloned: ToneGraphDocument,
): void {
  if (mappings.length === 0) {
    return;
  }

  const declaredNames = new Set(Object.keys(derived));

  // Validate every mapping before applying any so an invalid recipe fails
  // loudly rather than rendering silently.
  validateFileBackedMappings(mappings, declaredNames, cloned);

  const directWrites: Array<{ value: number; target: ParsedTarget; raw: string }> = [];
  const computedWrites: Array<{ expression: string; target: ParsedTarget; raw: string }> = [];

  for (const mapping of mappings) {
    const value = derived[mapping.parameter];
    if (typeof value !== "number" || !Number.isFinite(value)) {
      throw new Error(
        `Override mapping for parameter "${mapping.parameter}" has no finite resolved value.`,
      );
    }

    for (const override of mapping.overrides) {
      const target = parseTargetPath(override.target);
      if (override.expression === undefined) {
        directWrites.push({ value, target, raw: override.target });
      } else {
        computedWrites.push({
          expression: override.expression,
          target,
          raw: override.target,
        });
      }
    }
  }

  for (const { value, target } of directWrites) {
    writeTarget(cloned, target, value);
  }

  for (const { expression, target, raw } of computedWrites) {
    const value = evaluateExpression(expression, (reference) =>
      resolveReference(reference, derived, cloned, declaredNames),
    );
    if (!Number.isFinite(value)) {
      throw new Error(
        `Override expression "${expression}" for target "${raw}" did not produce a finite value.`,
      );
    }
    writeTarget(cloned, target, value);
  }
}

function parseTargetPath(raw: string): ParsedTarget {
  const parts = raw.split(".");
  if (parts.length === 2 && parts[0] && parts[1]) {
    return { kind: "param", node: parts[0], field: parts[1] };
  }
  if (
    parts.length === 5
    && parts[0]
    && parts[1] === "automation"
    && parts[2]
    && parts[3]
    && parts[4]
  ) {
    return {
      kind: "automation",
      node: parts[0],
      param: parts[2],
      selector: parseEventSelector(parts[3]),
      field: parts[4],
    };
  }
  throw new Error(
    `Invalid override target "${raw}": expected "<node>.<field>" or "<node>.automation.<param>.<index|kind>.<field>".`,
  );
}

function parseEventSelector(raw: string): EventSelector {
  const index = Number(raw);
  if (Number.isInteger(index) && index >= 0 && String(index) === raw) {
    return { type: "index", index };
  }
  return { type: "kind", kind: raw };
}

function findEvent(
  events: unknown[],
  selector: EventSelector,
): Record<string, unknown> | undefined {
  if (selector.type === "index") {
    const event = events[selector.index];
    return isRecord(event) ? event : undefined;
  }
  return events.find(
    (event) => isRecord(event) && event.kind === selector.kind,
  ) as Record<string, unknown> | undefined;
}

function assertTargetExists(
  cloned: ToneGraphDocument,
  target: ParsedTarget,
  raw: string,
): void {
  const node = (cloned.nodes as Record<string, unknown>)[target.node];
  if (!isRecord(node)) {
    throw new Error(
      `Override target "${raw}" references unknown node "${target.node}".`,
    );
  }

  if (target.kind === "param") {
    if (!isRecord(node.params)) {
      throw new Error(
        `Override target "${raw}" references a node with no params.`,
      );
    }
    if (!(target.field in node.params)) {
      throw new Error(
        `Override target "${raw}" references unknown param field "${target.field}" on node "${target.node}".`,
      );
    }
    return;
  }

  if (!isRecord(node.automation)) {
    throw new Error(
      `Override target "${raw}" references a node with no automation.`,
    );
  }
  const events = node.automation[target.param];
  if (!Array.isArray(events)) {
    throw new Error(
      `Override target "${raw}" references unknown automation param "${target.param}" on node "${target.node}".`,
    );
  }
  const event = findEvent(events, target.selector);
  if (!event) {
    const selectorLabel = target.selector.type === "index"
      ? `index ${target.selector.index}`
      : `kind "${target.selector.kind}"`;
    throw new Error(
      `Override target "${raw}" found no automation event matching ${selectorLabel}.`,
    );
  }
  if (!(target.field in event)) {
    throw new Error(
      `Override target "${raw}" references unknown automation field "${target.field}".`,
    );
  }
}

function writeTarget(
  cloned: ToneGraphDocument,
  target: ParsedTarget,
  value: number,
): void {
  const node = (cloned.nodes as Record<string, unknown>)[target.node];
  if (!isRecord(node)) {
    throw new Error(`Override target references unknown node "${target.node}".`);
  }

  if (target.kind === "param") {
    if (!isRecord(node.params)) {
      throw new Error(`Node "${target.node}" has no params.`);
    }
    node.params[target.field] = value;
    return;
  }

  if (!isRecord(node.automation)) {
    throw new Error(`Node "${target.node}" has no automation.`);
  }
  const events = node.automation[target.param];
  if (!Array.isArray(events)) {
    throw new Error(
      `Node "${target.node}" has no automation param "${target.param}".`,
    );
  }
  const event = findEvent(events, target.selector);
  if (!event) {
    throw new Error(
      `Node "${target.node}" has no matching automation event for "${target.param}".`,
    );
  }
  event[target.field] = value;
}

function evaluateExpression(
  expression: string,
  resolve: (reference: string) => number | undefined,
): number {
  const tokens = expression
    .split(/([*/])/)
    .map((token) => token.trim())
    .filter((token) => token.length > 0);

  if (tokens.length === 0) {
    throw new Error("Override expression is empty.");
  }

  let result = evaluateTerm(tokens[0], expression, resolve);
  for (let i = 1; i < tokens.length; i += 2) {
    const operator = tokens[i];
    const rightToken = tokens[i + 1];
    if (rightToken === undefined) {
      throw new Error(`Malformed override expression "${expression}".`);
    }
    const right = evaluateTerm(rightToken, expression, resolve);
    if (operator === "*") {
      result *= right;
    } else if (operator === "/") {
      if (right === 0) {
        throw new Error(`Division by zero in override expression "${expression}".`);
      }
      result /= right;
    } else {
      throw new Error(
        `Unsupported operator "${operator}" in override expression "${expression}".`,
      );
    }
  }
  return result;
}

function evaluateTerm(
  term: string,
  expression: string,
  resolve: (reference: string) => number | undefined,
): number {
  if (NUMERIC_LITERAL.test(term)) {
    return Number(term);
  }
  const value = resolve(term);
  if (value === undefined) {
    throw new Error(
      `Unknown reference "${term}" in override expression "${expression}".`,
    );
  }
  return value;
}

function resolveReference(
  reference: string,
  derived: Record<string, number>,
  cloned: ToneGraphDocument,
  declaredNames: Set<string>,
): number | undefined {
  // A declared parameter always wins over a node-field lookup.
  if (declaredNames.has(reference)) {
    const value = derived[reference];
    return typeof value === "number" && Number.isFinite(value) ? value : undefined;
  }

  const dot = reference.indexOf(".");
  if (dot > 0 && dot < reference.length - 1) {
    const nodeId = reference.slice(0, dot);
    const field = reference.slice(dot + 1);
    const node = (cloned.nodes as Record<string, unknown>)[nodeId];
    if (isRecord(node) && isRecord(node.params)) {
      const value = node.params[field];
      if (typeof value === "number" && Number.isFinite(value)) {
        return value;
      }
    }
  }
  return undefined;
}
