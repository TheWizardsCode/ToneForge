// @vitest-environment happy-dom
/**
 * Tests for data-driven parameter mapping and live update.
 *
 * AC (TF-0MUV11WH60061V9M): control set derived from descriptors; descriptor →
 * widget selection (incl. integer/boolean handling and XY pairs); override
 * write-through emits once per interaction; preset → controls restoration with
 * override markers.
 */
import { afterEach, describe, expect, it, vi } from "vitest";
import { registry } from "@toneforge/recipes/index.js";
import type { ParamDescriptor } from "@toneforge/core/recipe.js";
import {
  buildParameterMapping,
  chooseWidgetKind,
  createControlPanel,
  createSoundEditor,
  isBooleanDescriptor,
  isIntegerDescriptor,
  stepForDescriptor,
} from "../index.js";

function descriptorsFor(recipe: string): ParamDescriptor[] {
  const registration = registry.getRegistration(recipe);
  if (!registration) {
    throw new Error(`Recipe not registered: ${recipe}`);
  }
  return [...registration.params];
}

function press(element: HTMLElement, key: string): void {
  element.dispatchEvent(new KeyboardEvent("keydown", { key, bubbles: true }));
}

afterEach(() => {
  document.body.innerHTML = "";
  vi.restoreAllMocks();
});

describe("descriptor → widget selection", () => {
  it("derives one scalar per declared parameter", () => {
    const mapping = buildParameterMapping("footstep-stone", descriptorsFor("footstep-stone"));
    expect(mapping.pads).toEqual([]);
    expect(mapping.scalars.map((s) => s.name)).toEqual(
      descriptorsFor("footstep-stone").map((d) => d.name),
    );
  });

  it("selects a rotary dial for frequency parameters", () => {
    const mapping = buildParameterMapping("footstep-stone", descriptorsFor("footstep-stone"));
    expect(mapping.scalars.find((s) => s.name === "filterFreq")?.kind).toBe("rotary");
    expect(mapping.scalars.find((s) => s.name === "bodyDecay")?.kind).toBe("slider");
  });

  it("assigns declared XY pairs and removes them from the scalar list", () => {
    const mapping = buildParameterMapping("weapon-laser-zap", descriptorsFor("weapon-laser-zap"));
    expect(mapping.pads).toHaveLength(1);
    expect(mapping.pads[0].xName).toBe("carrierFreq");
    expect(mapping.pads[0].yName).toBe("modulatorFreq");
    const scalarNames = mapping.scalars.map((s) => s.name);
    expect(scalarNames).not.toContain("carrierFreq");
    expect(scalarNames).not.toContain("modulatorFreq");
  });

  it("handles integer and boolean descriptors deterministically", () => {
    const integer: ParamDescriptor = { name: "voices", min: 1, max: 8, unit: "int" };
    const bool: ParamDescriptor = { name: "loop", min: 0, max: 1, unit: "bool" };
    const numeric: ParamDescriptor = { name: "level", min: 0, max: 1, unit: "amplitude" };

    expect(isIntegerDescriptor(integer)).toBe(true);
    expect(stepForDescriptor(integer)).toBe(1);
    expect(chooseWidgetKind(integer)).toBe("slider");

    expect(isBooleanDescriptor(bool)).toBe(true);
    expect(chooseWidgetKind(bool)).toBe("toggle-select");

    expect(chooseWidgetKind(numeric)).toBe("slider");
    expect(stepForDescriptor(numeric)).toBeCloseTo(0.01, 10);
  });
});

describe("control panel write-through", () => {
  it("writes a widget change into overrides and emits once", () => {
    const panel = createControlPanel({
      version: 1,
      recipe: "footstep-stone",
      seed: 42,
      overrides: {},
    });
    const listener = vi.fn();
    panel.onChange(listener);

    const slider = panel.element.querySelector<HTMLElement>('[data-parameter="bodyDecay"]')!;
    expect(slider).not.toBeNull();
    press(slider, "ArrowRight");

    expect(listener).toHaveBeenCalledTimes(1);
    expect(panel.getOverrides().bodyDecay).toBeTypeOf("number");
    expect(slider.classList.contains("is-overridden")).toBe(true);

    panel.dispose();
  });

  it("emits once for an XY-pad interaction (batched axes)", () => {
    const panel = createControlPanel({
      version: 1,
      recipe: "weapon-laser-zap",
      seed: 1234,
      overrides: {},
    });
    const listener = vi.fn();
    panel.onChange(listener);

    const pad = panel.element.querySelector<HTMLElement>('[data-parameter="carrierFreq+modulatorFreq"]')!;
    const xAxis = pad.querySelector<HTMLElement>(".tf-xy-pad__axis--x")!;
    press(xAxis, "ArrowRight");

    expect(listener).toHaveBeenCalledTimes(1);
    expect(panel.getOverrides().carrierFreq).toBeTypeOf("number");

    panel.dispose();
  });
});

describe("preset → controls restoration", () => {
  it("restores overridden values and marks the control", () => {
    const panel = createControlPanel({
      version: 1,
      recipe: "footstep-stone",
      seed: 42,
      overrides: {},
    });

    panel.setPreset({
      version: 1,
      recipe: "footstep-stone",
      seed: 42,
      overrides: { filterFreq: 1200 },
    });

    const control = panel.element.querySelector<HTMLElement>('[data-parameter="filterFreq"]')!;
    // filterFreq step is (2000-400)/100 = 16, and 1200 is step-aligned.
    expect(control.getAttribute("aria-valuenow")).toBe("1200");
    expect(control.classList.contains("is-overridden")).toBe(true);

    panel.setPreset({
      version: 1,
      recipe: "footstep-stone",
      seed: 42,
      overrides: {},
    });
    expect(control.classList.contains("is-overridden")).toBe(false);

    panel.dispose();
  });
});

describe("editor integration", () => {
  it("renders controls in the editor and writes changes through onChange", () => {
    const container = document.createElement("div");
    document.body.appendChild(container);

    const editor = createSoundEditor({
      preset: {
        version: 1,
        recipe: "weapon-laser-zap",
        seed: 1234,
        overrides: {},
      },
    });
    editor.mount(container);

    const shadow = (container.firstElementChild as HTMLElement).shadowRoot!;
    const control = shadow.querySelector<HTMLElement>('[data-parameter="noiseBurstLevel"]');
    expect(control).not.toBeNull();

    const listener = vi.fn();
    editor.onChange(listener);
    press(control!, "ArrowRight");

    expect(listener).toHaveBeenCalledTimes(1);
    const next = listener.mock.calls[0][0];
    expect(next.overrides.noiseBurstLevel).toBeTypeOf("number");

    editor.dispose();
  });
});
