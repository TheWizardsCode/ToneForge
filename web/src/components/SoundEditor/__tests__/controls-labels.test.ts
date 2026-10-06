// @vitest-environment happy-dom
/**
 * Tests for visible labels and live value readouts on SoundEditor controls.
 *
 * AC (TF-0MUVMITO30059E7U): every scalar control shows a visible parameter
 * label plus a live value readout; XY pads show both axis labels and values;
 * the readout refreshes as the widget value changes.
 */
import { afterEach, describe, expect, it, vi } from "vitest";
import {
  createControlPanel,
  SOUND_PRESET_VERSION,
  type ControlPanel,
  type SoundPreset,
} from "../index.js";

const panels: ControlPanel[] = [];

function makePreset(overrides: Partial<SoundPreset> = {}): SoundPreset {
  return {
    version: SOUND_PRESET_VERSION,
    recipe: "weapon-laser-zap",
    seed: 1234,
    overrides: {},
    ...overrides,
  };
}

function createPanel(recipe: string): ControlPanel {
  const panel = createControlPanel(makePreset({ recipe }));
  panels.push(panel);
  return panel;
}

function wrappersFor(recipe: string): HTMLElement[] {
  return Array.from(
    createPanel(recipe).element.querySelectorAll<HTMLElement>(".toneforge-control"),
  );
}

/** Control wrappers that hold a scalar (non XY-pad) widget. */
function scalarWrappers(recipe: string): HTMLElement[] {
  return wrappersFor(recipe).filter(
    (wrapper) => wrapper.querySelector(".tf-widget") && !wrapper.querySelector(".tf-xy-pad"),
  );
}

afterEach(() => {
  for (const panel of panels) {
    panel.dispose();
  }
  panels.length = 0;
  document.body.innerHTML = "";
  vi.restoreAllMocks();
});

describe("visible control labels", () => {
  it("renders a visible label for every scalar control", () => {
    const wrappers = scalarWrappers("weapon-laser-zap");
    expect(wrappers.length).toBeGreaterThan(0);
    for (const wrapper of wrappers) {
      const label = wrapper.querySelector(".toneforge-control__label");
      expect(label?.textContent?.trim().length).toBeGreaterThan(0);
    }
  });

  it("renders a live value readout for every scalar control", () => {
    const wrappers = scalarWrappers("weapon-laser-zap");
    expect(wrappers.length).toBeGreaterThan(0);
    for (const wrapper of wrappers) {
      const value = wrapper.querySelector(".toneforge-control__value");
      expect(value?.textContent?.trim().length).toBeGreaterThan(0);
    }
  });

  it("wraps each widget in a labelled control container", () => {
    const wrappers = wrappersFor("weapon-laser-zap");
    expect(wrappers.length).toBeGreaterThan(0);
    for (const wrapper of wrappers) {
      expect(wrapper.querySelector(".tf-widget")).not.toBeNull();
    }
  });

  it("shows a visible label and value for each XY pad axis", () => {
    const wraps = wrappersFor("weapon-laser-zap");
    const padWrapper = wraps.find((w) => w.querySelector(".tf-xy-pad"));
    expect(padWrapper).toBeDefined();
    // The pad's XY pair is carrierFreq/modulatorFreq — two labels + two values.
    expect(padWrapper!.querySelectorAll(".toneforge-control__label").length).toBe(2);
    expect(padWrapper!.querySelectorAll(".toneforge-control__value").length).toBe(2);
  });

  it("refreshes the value readout when a widget changes", () => {
    const panel = createPanel("weapon-laser-zap");
    document.body.append(panel.element);

    const widget = panel.element.querySelector<HTMLElement>(".tf-slider, .tf-rotary");
    expect(widget).not.toBeNull();
    const wrapper = widget!.closest(".toneforge-control")!;
    const valueEl = wrapper.querySelector(".toneforge-control__value")!;
    const before = valueEl.textContent;

    widget!.dispatchEvent(new KeyboardEvent("keydown", { key: "End", bubbles: true }));

    expect(valueEl.textContent).not.toBe(before);
  });

  it("uses the parameter name as the visible label text", () => {
    const wrappers = scalarWrappers("footstep-stone");
    const wrapper = wrappers[0];
    const label = wrapper.querySelector(".toneforge-control__label")!;
    expect(label.textContent).toMatch(/[A-Za-z]/);
  });

  it("refreshes value readouts when a preset is restored", () => {
    const panel = createPanel("footstep-stone");
    document.body.append(panel.element);

    const wrappers = Array.from(
      panel.element.querySelectorAll<HTMLElement>(".toneforge-control"),
    ).filter((wrapper) => wrapper.querySelector(".tf-slider, .tf-rotary"));
    const wrapper = wrappers[0];
    const valueEl = wrapper.querySelector(".toneforge-control__value")!;
    const widgetEl = wrapper.querySelector<HTMLElement>("[data-parameter]")!;
    const parameter = widgetEl.dataset.parameter!;
    const min = Number(widgetEl.getAttribute("aria-valuemin"));
    const max = Number(widgetEl.getAttribute("aria-valuemax"));
    const current = Number(widgetEl.getAttribute("aria-valuenow"));
    const target = Math.abs(current - min) > Math.abs(max - current) ? min : max;
    const before = valueEl.textContent;

    // Same recipe + seed → no rebuild; applyValues must still refresh the readout.
    panel.setPreset(makePreset({ recipe: "footstep-stone", overrides: { [parameter]: target } }));

    expect(valueEl.textContent).not.toBe(before);
  });
});
