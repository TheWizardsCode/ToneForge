/**
 * Shared contracts for the framework-agnostic widget kit.
 *
 * Widgets know nothing about recipes or audio: they accept typed bounds and
 * emit numeric value changes. The mapping layer (a later slice) binds them to
 * recipe parameters.
 */

/** Bounds for a scalar (single-value) widget. */
export interface ScalarBounds {
  min: number;
  max: number;
  /** Quantisation step. Defaults to 1/100th of the range when omitted. */
  step?: number;
  /** Display unit, e.g. "Hz" or "s". */
  unit?: string;
  /** Initial value. Defaults to `min`. */
  value?: number;
  /** Accessible label. */
  label: string;
  /** Optional parameter name reported in change events. */
  name?: string;
}

/** Bounds for one axis of an XY pad. */
export interface XYAxisBounds {
  min: number;
  max: number;
  /** Quantisation step. Defaults to 1/100th of the range when omitted. */
  step?: number;
  /** Initial value. Defaults to `min`. */
  value?: number;
  /** Axis label, e.g. "X" or "Pitch". */
  label?: string;
}

/** Options for an XY pad (two scalar axes). */
export interface XYPadBounds {
  x: XYAxisBounds;
  y: XYAxisBounds;
  /** Accessible label for the pad as a whole. */
  label: string;
  /** Optional parameter name reported in change events. */
  name?: string;
}

/** An option in a toggle/select widget. */
export interface ToggleOption {
  label: string;
  value: number;
}

/** Options for a toggle/select widget. */
export interface ToggleSelectBounds {
  options: ToggleOption[];
  /** Initial value; defaults to the first option. */
  value?: number;
  /** Accessible label. */
  label: string;
  /** Optional parameter name reported in change events. */
  name?: string;
}

/** Unsubscribe function returned by `onChange`. */
export type Unsubscribe = () => void;

/** Details carried by a widget `change` CustomEvent. */
export interface WidgetChangeDetail<T = number> {
  value: T;
  name?: string;
}

/** Common widget lifecycle surface. */
export interface Widget {
  /** The widget's root element (not attached to the document by the factory). */
  readonly element: HTMLElement;
  /** Remove all listeners; the widget emits nothing afterwards. */
  dispose(): void;
}

/** A single-value widget. */
export interface ScalarWidget extends Widget {
  getValue(): number;
  setValue(value: number): void;
  onChange(listener: (value: number) => void): Unsubscribe;
}

/** A two-axis (XY) widget. */
export interface XYPadValue {
  x: number;
  y: number;
}

export interface XYPadWidget extends Widget {
  getValue(): XYPadValue;
  setValue(value: XYPadValue): void;
  onChange(listener: (value: XYPadValue) => void): Unsubscribe;
}

/** Default step when none is supplied: 1/100th of the range. */
export const DEFAULT_STEP_FRACTION = 100;

/** Resolve the effective step for bounds (never zero). */
export function resolveStep(bounds: { min: number; max: number; step?: number }): number {
  if (typeof bounds.step === "number" && Number.isFinite(bounds.step) && bounds.step > 0) {
    return bounds.step;
  }
  const span = Math.abs(bounds.max - bounds.min);
  return span > 0 ? span / DEFAULT_STEP_FRACTION : 1;
}

/** Number of decimal places used by a number's canonical string form. */
export function decimalsOf(value: number): number {
  if (!Number.isFinite(value)) return 0;
  const text = String(value);
  const exponentIndex = text.search(/[eE]/);
  if (exponentIndex >= 0) {
    const [mantissa, exponent] = text.split(/[eE]/);
    const mantissaDecimals = (mantissa.split(".")[1] ?? "").length;
    return Math.max(0, mantissaDecimals - Number(exponent));
  }
  const dot = text.indexOf(".");
  return dot < 0 ? 0 : text.length - dot - 1;
}

/** Quantise a value to the given step, removing floating-point noise. */
export function quantise(value: number, min: number, step: number): number {
  if (!(step > 0)) return value;
  const steps = Math.round((value - min) / step);
  const raw = min + steps * step;
  const decimals = Math.max(decimalsOf(step), decimalsOf(min));
  return decimals > 0 ? Number(raw.toFixed(decimals)) : raw;
}

/** Clamp + quantise a value into scalar bounds. */
export function clampToBounds(value: number, bounds: ScalarBounds): number {
  const step = resolveStep(bounds);
  const safe = Number.isFinite(value) ? value : bounds.min;
  const quantised = quantise(safe, bounds.min, step);
  return Math.min(bounds.max, Math.max(bounds.min, quantised));
}

/** Clamp + quantise a value into a single XY axis. */
export function clampAxis(value: number, axis: XYAxisBounds): number {
  const step = resolveStep(axis);
  const safe = Number.isFinite(value) ? value : axis.min;
  const quantised = quantise(safe, axis.min, step);
  return Math.min(axis.max, Math.max(axis.min, quantised));
}

/** Format a value + unit for display and `aria-valuetext`. */
export function formatValue(value: number, unit?: string): string {
  const text = Number.isInteger(value) ? String(value) : String(Number(value.toFixed(4)));
  return unit ? `${text} ${unit}` : text;
}
