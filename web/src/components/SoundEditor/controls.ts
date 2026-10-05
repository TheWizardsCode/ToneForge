/**
 * Control panel for the SoundEditor.
 *
 * Builds one widget per declared parameter (via {@link buildParameterMapping}),
 * binds widget changes to the preset's `overrides`, and restores control values
 * + override markers from a preset. It emits `onChange` once per committed
 * widget interaction.
 */

import type { ParamDescriptor } from "@toneforge/core/recipe.js";
import { registry } from "@toneforge/recipes/index.js";
import { getBaselineParams, type SoundPreset } from "../../models/preset.js";
import {
  createRotary,
  createSlider,
  createToggleSelect,
  createXYPad,
  type ScalarWidget,
  type XYPadWidget,
} from "../../widgets/index.js";
import {
  buildParameterMapping,
  type ParameterMapping,
} from "./parameter-map.js";

/** Public surface of the control panel. */
export interface ControlPanel {
  /** Root element (not attached by the factory). */
  readonly element: HTMLElement;
  /** Restore the panel from a preset (rebuilds if recipe/seed changed). */
  setPreset(preset: SoundPreset): void;
  /** Current sparse overrides (defensive copy). */
  getOverrides(): Record<string, number>;
  /** Subscribe to override changes. */
  onChange(listener: (overrides: Record<string, number>) => void): () => void;
  /** Dispose every widget and listener. */
  dispose(): void;
}

interface ScalarEntry {
  name: string;
  widget: ScalarWidget;
}

interface PadEntry {
  xName: string;
  yName: string;
  widget: XYPadWidget;
}

function descriptorsFor(recipe: string): ParamDescriptor[] {
  const registration = registry.getRegistration(recipe);
  return registration ? [...registration.params] : [];
}

/** Create a control panel for an initial preset. */
export function createControlPanel(initial: SoundPreset): ControlPanel {
  const element = document.createElement("div");
  element.className = "toneforge-controls";
  element.setAttribute("role", "group");
  element.setAttribute("aria-label", "Sound parameters");

  const listeners = new Set<(overrides: Record<string, number>) => void>();
  let scalarEntries: ScalarEntry[] = [];
  let padEntries: PadEntry[] = [];
  let mapping: ParameterMapping = { scalars: [], pads: [] };
  let overrides: Record<string, number> = { ...initial.overrides };
  let recipe = initial.recipe;
  let seed = initial.seed;
  let disposed = false;

  function emit(): void {
    if (disposed) {
      return;
    }
    const snapshot = { ...overrides };
    for (const listener of [...listeners]) {
      listener(snapshot);
    }
  }

  function setOverrides(
    updates: Array<{ name: string; value: number; baseline: number }>,
  ): void {
    for (const update of updates) {
      const overridden = !Object.is(update.value, update.baseline);
      if (overridden) {
        overrides[update.name] = update.value;
      } else {
        delete overrides[update.name];
      }
      markOverridden(update.name, overridden);
    }
    emit();
  }

  function markOverridden(name: string, overridden: boolean): void {
    const entry = scalarEntries.find((e) => e.name === name);
    if (entry) {
      entry.widget.element.classList.toggle("is-overridden", overridden);
    }
  }

  function tearDown(): void {
    for (const entry of scalarEntries) {
      entry.widget.dispose();
    }
    for (const entry of padEntries) {
      entry.widget.dispose();
    }
    scalarEntries = [];
    padEntries = [];
    element.replaceChildren();
  }

  function build(): void {
    tearDown();
    mapping = buildParameterMapping(recipe, descriptorsFor(recipe));
    const baseline = getBaselineParams(recipe, seed);

    for (const spec of mapping.scalars) {
      const value = overrides[spec.name] ?? baseline[spec.name] ?? spec.descriptor.min;
      let widget: ScalarWidget;
      if (spec.kind === "toggle-select") {
        widget = createToggleSelect({
          label: spec.label,
          name: spec.name,
          value,
          options: [
            { label: "Off", value: spec.descriptor.min },
            { label: "On", value: spec.descriptor.max },
          ],
        });
      } else if (spec.kind === "rotary") {
        widget = createRotary({
          min: spec.descriptor.min,
          max: spec.descriptor.max,
          step: spec.step,
          unit: spec.unit,
          value,
          label: spec.label,
          name: spec.name,
        });
      } else {
        widget = createSlider({
          min: spec.descriptor.min,
          max: spec.descriptor.max,
          step: spec.step,
          unit: spec.unit,
          value,
          label: spec.label,
          name: spec.name,
        });
      }
      widget.element.dataset.parameter = spec.name;
      widget.onChange((next) =>
        setOverrides([{ name: spec.name, value: next, baseline: baseline[spec.name] }]),
      );
      scalarEntries.push({ name: spec.name, widget });
      element.appendChild(widget.element);
    }

    for (const spec of mapping.pads) {
      const xValue = overrides[spec.xName] ?? baseline[spec.xName] ?? spec.xDescriptor.min;
      const yValue = overrides[spec.yName] ?? baseline[spec.yName] ?? spec.yDescriptor.min;
      const widget = createXYPad({
        label: spec.label,
        name: spec.id,
        x: {
          min: spec.xDescriptor.min,
          max: spec.xDescriptor.max,
          step: spec.xStep,
          value: xValue,
          label: spec.xName,
        },
        y: {
          min: spec.yDescriptor.min,
          max: spec.yDescriptor.max,
          step: spec.yStep,
          value: yValue,
          label: spec.yName,
        },
      });
      widget.element.dataset.parameter = spec.id;
      widget.onChange((value) => {
        setOverrides([
          { name: spec.xName, value: value.x, baseline: baseline[spec.xName] },
          { name: spec.yName, value: value.y, baseline: baseline[spec.yName] },
        ]);
      });
      padEntries.push({ xName: spec.xName, yName: spec.yName, widget });
      element.appendChild(widget.element);
    }
  }

  function applyValues(): void {
    const baseline = getBaselineParams(recipe, seed);
    for (const entry of scalarEntries) {
      const value = overrides[entry.name] ?? baseline[entry.name];
      if (typeof value === "number") {
        entry.widget.setValue(value);
      }
      markOverridden(entry.name, entry.name in overrides);
    }
    for (const entry of padEntries) {
      const x = overrides[entry.xName] ?? baseline[entry.xName];
      const y = overrides[entry.yName] ?? baseline[entry.yName];
      if (typeof x === "number" && typeof y === "number") {
        entry.widget.setValue({ x, y });
      }
    }
  }

  function setPreset(next: SoundPreset): void {
    if (disposed) {
      return;
    }
    const rebuild = next.recipe !== recipe || next.seed !== seed;
    recipe = next.recipe;
    seed = next.seed;
    overrides = { ...next.overrides };
    if (rebuild) {
      build();
    }
    applyValues();
  }

  build();
  applyValues();

  return {
    element,
    setPreset,
    getOverrides: () => ({ ...overrides }),
    onChange(listener) {
      listeners.add(listener);
      return () => {
        listeners.delete(listener);
      };
    },
    dispose() {
      if (disposed) {
        return;
      }
      disposed = true;
      listeners.clear();
      tearDown();
    },
  };
}
