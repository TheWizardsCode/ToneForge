/**
 * Data-driven parameter → control mapping.
 *
 * The control set is derived entirely from a recipe's declared parameter
 * descriptors (`registry.getRegistration(recipe).params`) — there are no
 * per-recipe control lists. Widget kind is chosen from the descriptor's unit /
 * name; an explicit, extensible table assigns pairs of parameters to an XY pad.
 *
 * Type handling (documented, deterministic):
 * - integer (`unit: "int"`/`"integer"`) → stepped slider (step 1)
 * - boolean (`unit: "bool"`/`"boolean"`/`"toggle"`) → toggle/select (off/on)
 * - frequency-like → rotary dial; envelope/time-like and everything else → slider
 * - parameters consumed by an XY pad are removed from the scalar list
 */

import type { ParamDescriptor } from "@toneforge/core/recipe.js";

/** Widget kinds the kit provides. */
export type WidgetKind = "slider" | "rotary" | "xy-pad" | "toggle-select";

/** A single scalar parameter bound to one widget. */
export interface ScalarControlSpec {
  type: "scalar";
  name: string;
  descriptor: ParamDescriptor;
  kind: "slider" | "rotary" | "toggle-select";
  step: number;
  unit?: string;
  label: string;
}

/** A pair of parameters bound to one XY pad. */
export interface XYControlSpec {
  type: "xy-pad";
  id: string;
  xName: string;
  yName: string;
  xDescriptor: ParamDescriptor;
  yDescriptor: ParamDescriptor;
  xStep: number;
  yStep: number;
  label: string;
}

/** The full control set for a recipe. */
export interface ParameterMapping {
  scalars: ScalarControlSpec[];
  pads: XYControlSpec[];
}

/** Explicit recipe → parameter pairs assigned to an XY pad (extensible). */
export const DEFAULT_XY_PAIRS: Record<string, ReadonlyArray<readonly [string, string]>> = {
  "weapon-laser-zap": [["carrierFreq", "modulatorFreq"]],
  "card-transform": [["modDepthStart", "modDepthEnd"]],
};

const INTEGER_UNITS = new Set(["int", "integer"]);
const BOOLEAN_UNITS = new Set(["bool", "boolean", "toggle"]);
const FREQUENCY_NAME = /(freq|pitch|rate|cutoff|\bq\b)/i;

/** True for integer-typed descriptors. */
export function isIntegerDescriptor(descriptor: ParamDescriptor): boolean {
  return INTEGER_UNITS.has(descriptor.unit.toLowerCase());
}

/** True for boolean-typed descriptors. */
export function isBooleanDescriptor(descriptor: ParamDescriptor): boolean {
  return BOOLEAN_UNITS.has(descriptor.unit.toLowerCase());
}

/** Quantisation step for a descriptor. */
export function stepForDescriptor(descriptor: ParamDescriptor): number {
  if (isIntegerDescriptor(descriptor) || isBooleanDescriptor(descriptor)) {
    return 1;
  }
  const span = Math.abs(descriptor.max - descriptor.min);
  return span > 0 ? span / 100 : 1;
}

/** Choose a scalar widget kind for a descriptor (rule-based). */
export function chooseWidgetKind(
  descriptor: ParamDescriptor,
): "slider" | "rotary" | "toggle-select" {
  if (isBooleanDescriptor(descriptor)) {
    return "toggle-select";
  }
  if (isIntegerDescriptor(descriptor)) {
    return "slider";
  }
  if (descriptor.unit.toLowerCase() === "hz" || FREQUENCY_NAME.test(descriptor.name)) {
    return "rotary";
  }
  return "slider";
}

/**
 * Build the control set for a recipe from its declared descriptors.
 *
 * @param recipe - Registered recipe name (used to look up XY pair assignments).
 * @param descriptors - Declared parameter descriptors.
 * @param xyPairs - Optional XY pair table (defaults to {@link DEFAULT_XY_PAIRS}).
 */
export function buildParameterMapping(
  recipe: string,
  descriptors: readonly ParamDescriptor[],
  xyPairs: Record<string, ReadonlyArray<readonly [string, string]>> = DEFAULT_XY_PAIRS,
): ParameterMapping {
  const byName = new Map(descriptors.map((d) => [d.name, d]));
  const claimed = new Set<string>();
  const pads: XYControlSpec[] = [];

  for (const [xName, yName] of xyPairs[recipe] ?? []) {
    const xDescriptor = byName.get(xName);
    const yDescriptor = byName.get(yName);
    if (!xDescriptor || !yDescriptor || claimed.has(xName) || claimed.has(yName)) {
      continue;
    }
    claimed.add(xName);
    claimed.add(yName);
    pads.push({
      type: "xy-pad",
      id: `${xName}+${yName}`,
      xName,
      yName,
      xDescriptor,
      yDescriptor,
      xStep: stepForDescriptor(xDescriptor),
      yStep: stepForDescriptor(yDescriptor),
      label: `${xName} / ${yName}`,
    });
  }

  const scalars: ScalarControlSpec[] = [];
  for (const descriptor of descriptors) {
    if (claimed.has(descriptor.name)) {
      continue;
    }
    const kind = chooseWidgetKind(descriptor);
    scalars.push({
      type: "scalar",
      name: descriptor.name,
      descriptor,
      kind,
      step: stepForDescriptor(descriptor),
      unit: descriptor.unit,
      label: descriptor.name,
    });
  }

  return { scalars, pads };
}
