// @vitest-environment happy-dom
/**
 * Widget kit tests: clamping/quantisation, keyboard operation, ARIA exposure,
 * programmatic `setValue` semantics and disposal.
 *
 * AC (TF-0MUV11U9D0087TTS): four widgets; bounds + change events; clamping and
 * step quantisation; keyboard operability; ARIA roles/values; no spurious
 * programmatic change; disposable and no globals/global CSS.
 */
import { afterEach, describe, expect, it, vi } from "vitest";
import {
  clampAxis,
  clampToBounds,
  createRotary,
  createSlider,
  createToggleSelect,
  createXYPad,
  formatValue,
  quantise,
  resolveStep,
} from "../index.js";

function press(element: HTMLElement, key: string): void {
  element.dispatchEvent(new KeyboardEvent("keydown", { key, bubbles: true }));
}

afterEach(() => {
  document.body.innerHTML = "";
  vi.restoreAllMocks();
});

describe("clamping and quantisation", () => {
  it("clamps below min and above max", () => {
    const bounds = { min: 0, max: 10, step: 0.5, label: "Level" };
    expect(clampToBounds(-5, bounds)).toBe(0);
    expect(clampToBounds(99, bounds)).toBe(10);
  });

  it("quantises to the nearest step", () => {
    const bounds = { min: 0, max: 1, step: 0.1, label: "Mix" };
    expect(clampToBounds(0.34, bounds)).toBe(0.3);
    expect(clampToBounds(0.36, bounds)).toBe(0.4);
    expect(clampToBounds(0.3, bounds)).toBe(0.3);
  });

  it("removes floating-point noise from stepped values", () => {
    expect(quantise(0.1 + 0.2, 0, 0.1)).toBe(0.3);
    const bounds = { min: 0, max: 1, step: 0.1, label: "Mix" };
    expect(clampToBounds(0.1 + 0.2, bounds)).toBe(0.3);
  });

  it("derives a default step of 1/100th of the range", () => {
    expect(resolveStep({ min: 0, max: 100 })).toBe(1);
    expect(resolveStep({ min: 0, max: 5 })).toBe(0.05);
  });

  it("clamps XY axes", () => {
    expect(clampAxis(999, { min: 10, max: 20 })).toBe(20);
    expect(clampAxis(0, { min: 10, max: 20 })).toBe(10);
  });

  it("formats values with units", () => {
    expect(formatValue(500, "Hz")).toBe("500 Hz");
    expect(formatValue(12.5)).toBe("12.5");
  });
});

describe("slider", () => {
  it("exposes role, label and value range", () => {
    const slider = createSlider({ min: 200, max: 2000, step: 10, unit: "Hz", value: 500, label: "Carrier" });
    const el = slider.element;
    expect(el.getAttribute("role")).toBe("slider");
    expect(el.getAttribute("aria-label")).toBe("Carrier");
    expect(el.getAttribute("aria-valuemin")).toBe("200");
    expect(el.getAttribute("aria-valuemax")).toBe("2000");
    expect(el.getAttribute("aria-valuenow")).toBe("500");
    expect(el.getAttribute("aria-valuetext")).toBe("500 Hz");
    expect(el.tabIndex).toBe(0);
    slider.dispose();
  });

  it("is keyboard operable", () => {
    const slider = createSlider({ min: 0, max: 100, step: 10, value: 50, label: "Level" });
    press(slider.element, "ArrowRight");
    expect(slider.getValue()).toBe(60);
    press(slider.element, "ArrowLeft");
    expect(slider.getValue()).toBe(50);
    press(slider.element, "Home");
    expect(slider.getValue()).toBe(0);
    press(slider.element, "End");
    expect(slider.getValue()).toBe(100);
    slider.dispose();
  });

  it("emits only when the value actually changes and not on setValue", () => {
    const slider = createSlider({ min: 0, max: 100, step: 10, value: 50, label: "Level" });
    const listener = vi.fn();
    slider.onChange(listener);

    slider.setValue(80);
    expect(slider.getValue()).toBe(80);
    expect(listener).not.toHaveBeenCalled();

    press(slider.element, "ArrowRight");
    expect(listener).toHaveBeenCalledTimes(1);
    expect(listener).toHaveBeenLastCalledWith(90);

    press(slider.element, "End");
    expect(listener).toHaveBeenCalledTimes(2); // 90 -> 100
    press(slider.element, "End");
    expect(listener).toHaveBeenCalledTimes(2); // unchanged

    slider.dispose();
  });

  it("dispatches a change CustomEvent with the value", () => {
    const slider = createSlider({ min: 0, max: 10, step: 1, value: 5, label: "Level" });
    const handler = vi.fn();
    slider.element.addEventListener("change", handler);
    press(slider.element, "ArrowRight");
    expect(handler).toHaveBeenCalledTimes(1);
    expect((handler.mock.calls[0][0] as CustomEvent).detail.value).toBe(6);
    slider.dispose();
  });

  it("stops emitting after dispose and is idempotent", () => {
    const slider = createSlider({ min: 0, max: 10, step: 1, value: 5, label: "Level" });
    const listener = vi.fn();
    slider.onChange(listener);
    slider.dispose();
    slider.dispose();
    press(slider.element, "ArrowRight");
    expect(listener).not.toHaveBeenCalled();
  });
});

describe("rotary dial", () => {
  it("exposes slider ARIA and responds to arrow keys", () => {
    const dial = createRotary({ min: 0, max: 360, step: 15, unit: "deg", value: 90, label: "Pan" });
    expect(dial.element.getAttribute("role")).toBe("slider");
    expect(dial.element.getAttribute("aria-valuenow")).toBe("90");
    press(dial.element, "ArrowUp");
    expect(dial.getValue()).toBe(105);
    expect(dial.element.getAttribute("aria-valuetext")).toBe("105 deg");
    dial.dispose();
  });

  it("does not emit on setValue", () => {
    const dial = createRotary({ min: 0, max: 1, step: 0.1, value: 0.5, label: "Mix" });
    const listener = vi.fn();
    dial.onChange(listener);
    dial.setValue(0.9);
    expect(dial.getValue()).toBe(0.9);
    expect(listener).not.toHaveBeenCalled();
    dial.dispose();
  });
});

describe("XY pad", () => {
  it("exposes a labelled group with two slider axes", () => {
    const pad = createXYPad({
      label: "Position",
      x: { min: 0, max: 100, step: 10, value: 20, label: "X" },
      y: { min: 0, max: 100, step: 10, value: 80, label: "Y" },
    });
    expect(pad.element.getAttribute("role")).toBe("group");
    expect(pad.element.querySelectorAll('[role="slider"]').length).toBe(2);
    expect(pad.getValue()).toEqual({ x: 20, y: 80 });
    expect(pad.element.querySelector('[aria-label="Position X"]')?.getAttribute("aria-valuenow")).toBe("20");
    expect(pad.element.querySelector('[aria-label="Position Y"]')?.getAttribute("aria-valuenow")).toBe("80");
    pad.dispose();
  });

  it("changes each axis with the keyboard", () => {
    const pad = createXYPad({
      label: "Position",
      x: { min: 0, max: 100, step: 10, value: 20 },
      y: { min: 0, max: 100, step: 10, value: 80 },
    });
    const xAxis = pad.element.querySelector<HTMLElement>(".tf-xy-pad__axis--x")!;
    const yAxis = pad.element.querySelector<HTMLElement>(".tf-xy-pad__axis--y")!;

    const listener = vi.fn();
    pad.onChange(listener);

    press(xAxis, "ArrowRight");
    expect(pad.getValue()).toEqual({ x: 30, y: 80 });
    press(yAxis, "ArrowDown");
    expect(pad.getValue()).toEqual({ x: 30, y: 70 });
    expect(listener).toHaveBeenCalledTimes(2);

    pad.setValue({ x: 0, y: 100 });
    expect(pad.getValue()).toEqual({ x: 0, y: 100 });
    expect(listener).toHaveBeenCalledTimes(2);
    pad.dispose();
  });
});

describe("toggle/select", () => {
  const options = [
    { label: "Sine", value: 0 },
    { label: "Square", value: 1 },
    { label: "Saw", value: 2 },
  ];

  it("exposes listbox/option roles", () => {
    const toggle = createToggleSelect({ label: "Waveform", options, value: 1 });
    expect(toggle.element.getAttribute("role")).toBe("listbox");
    expect(toggle.element.getAttribute("aria-label")).toBe("Waveform");
    const opts = toggle.element.querySelectorAll('[role="option"]');
    expect(opts.length).toBe(3);
    expect(opts[1].getAttribute("aria-selected")).toBe("true");
    toggle.dispose();
  });

  it("navigates with arrows, Home and End", () => {
    const toggle = createToggleSelect({ label: "Waveform", options, value: 0 });
    press(toggle.element, "ArrowRight");
    expect(toggle.getValue()).toBe(1);
    press(toggle.element, "End");
    expect(toggle.getValue()).toBe(2);
    press(toggle.element, "Home");
    expect(toggle.getValue()).toBe(0);
    toggle.dispose();
  });

  it("toggles a two-option control with Enter/Space", () => {
    const toggle = createToggleSelect({
      label: "Enabled",
      options: [
        { label: "Off", value: 0 },
        { label: "On", value: 1 },
      ],
      value: 0,
    });
    press(toggle.element, "Enter");
    expect(toggle.getValue()).toBe(1);
    press(toggle.element, " ");
    expect(toggle.getValue()).toBe(0);
    toggle.dispose();
  });

  it("does not emit on setValue and snaps to the nearest option", () => {
    const toggle = createToggleSelect({ label: "Waveform", options, value: 0 });
    const listener = vi.fn();
    toggle.onChange(listener);
    toggle.setValue(2);
    expect(toggle.getValue()).toBe(2);
    toggle.setValue(1.6);
    expect(toggle.getValue()).toBe(2);
    expect(listener).not.toHaveBeenCalled();
    toggle.dispose();
  });

  it("rejects an empty option list", () => {
    expect(() => createToggleSelect({ label: "Empty", options: [] })).toThrow(/at least one option/);
  });
});

describe("embedding hygiene", () => {
  it("creates no globals and writes no global styles", () => {
    const before = new Set(Object.keys(globalThis));
    const slider = createSlider({ min: 0, max: 1, value: 0.5, label: "Mix" });
    const pad = createXYPad({
      label: "Pos",
      x: { min: 0, max: 1 },
      y: { min: 0, max: 1 },
    });
    document.body.append(slider.element, pad.element);

    expect(document.head.querySelectorAll("style").length).toBe(0);
    const after = Object.keys(globalThis).filter((key) => !before.has(key));
    expect(after).toEqual([]);

    slider.dispose();
    pad.dispose();
  });
});

/* ── Pointer drag interaction tests ──────────────────────── */

describe("slider pointer drag", () => {
  function mockRect(track: HTMLElement, left: number, width: number): void {
    vi.spyOn(track, "getBoundingClientRect").mockReturnValue({
      left, width, top: 0, bottom: 1, right: left + width, x: left, y: 0, height: 1,
      toJSON: () => ({}),
    } as DOMRect);
  }

  it("pointer drag on track changes value", () => {
    const slider = createSlider({ min: 0, max: 100, step: 1, value: 50, label: "Level" });
    const track = slider.element.querySelector<HTMLElement>(".tf-slider__track")!;
    document.body.append(slider.element);
    mockRect(track, 0, 100);

    const changeHandler = vi.fn();
    slider.element.addEventListener("change", changeHandler);

    // Pointer at 75% of track → value 75
    track.dispatchEvent(new PointerEvent("pointerdown", { clientX: 75, bubbles: true }));
    document.dispatchEvent(new PointerEvent("pointermove", { clientX: 75, bubbles: true }));
    document.dispatchEvent(new PointerEvent("pointerup", { bubbles: true }));

    expect(slider.getValue()).toBe(75);
    expect(changeHandler).toHaveBeenCalledTimes(1);

    slider.dispose();
  });

  it("pointer drag on track respects clamping", () => {
    const slider = createSlider({ min: 10, max: 90, step: 1, value: 50, label: "Level" });
    const track = slider.element.querySelector<HTMLElement>(".tf-slider__track")!;
    document.body.append(slider.element);
    mockRect(track, 0, 100);

    // Pointer far left → clamped to min
    track.dispatchEvent(new PointerEvent("pointerdown", { clientX: -200, bubbles: true }));
    document.dispatchEvent(new PointerEvent("pointermove", { clientX: -200, bubbles: true }));
    document.dispatchEvent(new PointerEvent("pointerup", { bubbles: true }));

    expect(slider.getValue()).toBe(10);

    // Pointer far right → clamped to max
    track.dispatchEvent(new PointerEvent("pointerdown", { clientX: 300, bubbles: true }));
    document.dispatchEvent(new PointerEvent("pointermove", { clientX: 300, bubbles: true }));
    document.dispatchEvent(new PointerEvent("pointerup", { bubbles: true }));

    expect(slider.getValue()).toBe(90);

    slider.dispose();
  });

  it("pointer drag on thumb changes value", () => {
    const slider = createSlider({ min: 0, max: 100, step: 1, value: 50, label: "Level" });
    const thumb = slider.element.querySelector<HTMLElement>(".tf-slider__thumb")!;
    document.body.append(slider.element);
    mockRect(slider.element.querySelector<HTMLElement>(".tf-slider__track")!, 0, 100);

    const changeHandler = vi.fn();
    slider.element.addEventListener("change", changeHandler);

    thumb.dispatchEvent(new PointerEvent("pointerdown", { clientX: 25, bubbles: true }));
    document.dispatchEvent(new PointerEvent("pointermove", { clientX: 25, bubbles: true }));
    document.dispatchEvent(new PointerEvent("pointerup", { bubbles: true }));

    expect(slider.getValue()).toBe(25);
    expect(changeHandler).toHaveBeenCalledTimes(1);

    slider.dispose();
  });

  it("no change event when pointer drag results in no value change", () => {
    const slider = createSlider({ min: 0, max: 100, step: 1, value: 50, label: "Level" });
    const track = slider.element.querySelector<HTMLElement>(".tf-slider__track")!;
    document.body.append(slider.element);
    mockRect(track, 50, 100);

    const changeHandler = vi.fn();
    slider.element.addEventListener("change", changeHandler);

    // Start at 50% of track (value 50), move to same position
    track.dispatchEvent(new PointerEvent("pointerdown", { clientX: 100, bubbles: true }));
    document.dispatchEvent(new PointerEvent("pointermove", { clientX: 100, bubbles: true }));
    document.dispatchEvent(new PointerEvent("pointerup", { bubbles: true }));

    expect(changeHandler).not.toHaveBeenCalled();

    slider.dispose();
  });

  it("pointer move during drag updates the value live", () => {
    const slider = createSlider({ min: 0, max: 100, step: 1, value: 50, label: "Level" });
    const track = slider.element.querySelector<HTMLElement>(".tf-slider__track")!;
    document.body.append(slider.element);
    mockRect(track, 0, 100);

    const changeHandler = vi.fn();
    slider.element.addEventListener("change", changeHandler);

    // Pointer down at 25% of track
    track.dispatchEvent(new PointerEvent("pointerdown", { clientX: 25, bubbles: true }));
    expect(slider.getValue()).toBe(25);
    expect(changeHandler).toHaveBeenCalledTimes(1);

    // Move further to 50% — live update during drag
    slider.element.dispatchEvent(new PointerEvent("pointermove", { clientX: 50, bubbles: true }));
    expect(slider.getValue()).toBe(50);
    expect(changeHandler).toHaveBeenCalledTimes(2);

    // Release — no additional event
    slider.element.dispatchEvent(new PointerEvent("pointerup", { bubbles: true }));
    expect(changeHandler).toHaveBeenCalledTimes(2);

    slider.dispose();
  });

  it("stops updating after dispose", () => {
    const slider = createSlider({ min: 0, max: 100, step: 1, value: 50, label: "Level" });
    const track = slider.element.querySelector<HTMLElement>(".tf-slider__track")!;
    document.body.append(slider.element);
    mockRect(track, 0, 100);

    track.dispatchEvent(new PointerEvent("pointerdown", { clientX: 25, bubbles: true }));
    slider.dispose();

    // Even if we send move/up, no change
    document.dispatchEvent(new PointerEvent("pointermove", { clientX: 75, bubbles: true }));
    document.dispatchEvent(new PointerEvent("pointerup", { bubbles: true }));

    expect(slider.getValue()).toBe(25);

    slider.dispose(); // idempotent
  });
});

describe("rotary pointer drag", () => {
  it("horizontal drag rotates dial and changes value", () => {
    const dial = createRotary({ min: 0, max: 100, step: 1, value: 0, label: "Pan" });
    const dialEl = dial.element.querySelector<HTMLElement>(".tf-rotary__dial")!;
    document.body.append(dial.element);

    const changeHandler = vi.fn();
    dial.element.addEventListener("change", changeHandler);

    // 75px right of a 150px full-range sweep → +50 on a 0–100 range.
    dialEl.dispatchEvent(new PointerEvent("pointerdown", { clientX: 0, bubbles: true }));
    dial.element.dispatchEvent(new PointerEvent("pointermove", { clientX: 75, bubbles: true }));
    dial.element.dispatchEvent(new PointerEvent("pointerup", { bubbles: true }));

    expect(dial.getValue()).toBe(50);
    expect(changeHandler).toHaveBeenCalledTimes(1);

    dial.dispose();
  });

  it("horizontal drag clamps to min and max values", () => {
    const dial = createRotary({ min: 0, max: 100, step: 1, value: 50, label: "Pan" });
    const dialEl = dial.element.querySelector<HTMLElement>(".tf-rotary__dial")!;
    document.body.append(dial.element);

    // Drag far right → clamps to max.
    dialEl.dispatchEvent(new PointerEvent("pointerdown", { clientX: 0, bubbles: true }));
    dial.element.dispatchEvent(new PointerEvent("pointermove", { clientX: 1000, bubbles: true }));
    dial.element.dispatchEvent(new PointerEvent("pointerup", { bubbles: true }));

    expect(dial.getValue()).toBe(100);

    // Drag far left → clamps to min.
    dialEl.dispatchEvent(new PointerEvent("pointerdown", { clientX: 0, bubbles: true }));
    dial.element.dispatchEvent(new PointerEvent("pointermove", { clientX: -1000, bubbles: true }));
    dial.element.dispatchEvent(new PointerEvent("pointerup", { bubbles: true }));

    expect(dial.getValue()).toBe(0);

    dial.dispose();
  });

  it("stops updating after dispose", () => {
    const dial = createRotary({ min: 0, max: 100, step: 1, value: 50, label: "Pan" });
    const dialEl = dial.element.querySelector<HTMLElement>(".tf-rotary__dial")!;
    document.body.append(dial.element);

    dialEl.dispatchEvent(new PointerEvent("pointerdown", { clientX: 0, bubbles: true }));
    dial.dispose();

    dial.element.dispatchEvent(new PointerEvent("pointermove", { clientX: 1000, bubbles: true }));
    dial.element.dispatchEvent(new PointerEvent("pointerup", { bubbles: true }));

    // Value should stay at the starting value, unchanged by the drag.
    expect(dial.getValue()).toBe(50);

    dial.dispose();
  });
});

describe("xy pad pointer drag", () => {
  function mockRect(pad: HTMLElement, left: number, top: number, width: number): void {
    vi.spyOn(pad, "getBoundingClientRect").mockReturnValue({
      left, top, width, height: width, right: left + width, x: left, y: top,
      toJSON: () => ({}),
    } as DOMRect);
  }

  it("pointer drag moves thumb and updates values", () => {
    const pad = createXYPad({
      label: "Position",
      x: { min: 0, max: 100, step: 1, value: 50 },
      y: { min: 0, max: 100, step: 1, value: 50 },
    });
    const padEl = pad.element.querySelector<HTMLElement>(".tf-xy-pad__pad")!;
    document.body.append(pad.element);
    mockRect(padEl, 0, 0, 100);

    const changeHandler = vi.fn();
    pad.element.addEventListener("change", changeHandler);

    // Pointer at bottom-right of pad → x=100, y=0 (Y is inverted)
    padEl.dispatchEvent(new PointerEvent("pointerdown", { clientX: 100, clientY: 100, bubbles: true }));
    document.dispatchEvent(new PointerEvent("pointermove", { clientX: 100, clientY: 100, bubbles: true }));
    document.dispatchEvent(new PointerEvent("pointerup", { bubbles: true }));

    expect(pad.getValue()).toEqual({ x: 100, y: 0 });
    expect(changeHandler).toHaveBeenCalledTimes(1);

    pad.dispose();
  });

  it("pointer drag clamps values to axis bounds", () => {
    const pad = createXYPad({
      label: "Position",
      x: { min: 10, max: 90, step: 1, value: 50 },
      y: { min: 10, max: 90, step: 1, value: 50 },
    });
    const padEl = pad.element.querySelector<HTMLElement>(".tf-xy-pad__pad")!;
    document.body.append(pad.element);
    mockRect(padEl, 0, 0, 100);

    // Pointer far outside → clamped
    padEl.dispatchEvent(new PointerEvent("pointerdown", { clientX: -200, clientY: -200, bubbles: true }));
    document.dispatchEvent(new PointerEvent("pointermove", { clientX: -200, clientY: -200, bubbles: true }));
    document.dispatchEvent(new PointerEvent("pointerup", { bubbles: true }));

    expect(pad.getValue()).toEqual({ x: 10, y: 90 }); // x clamped to min, y clamped to max (inverted)

    pad.dispose();
  });

  it("pointer drag to center of pad", () => {
    const pad = createXYPad({
      label: "Position",
      x: { min: 0, max: 100, step: 1, value: 50 },
      y: { min: 0, max: 100, step: 1, value: 50 },
    });
    const padEl = pad.element.querySelector<HTMLElement>(".tf-xy-pad__pad")!;
    document.body.append(pad.element);
    mockRect(padEl, 0, 0, 100);

    padEl.dispatchEvent(new PointerEvent("pointerdown", { clientX: 50, clientY: 50, bubbles: true }));
    document.dispatchEvent(new PointerEvent("pointermove", { clientX: 50, clientY: 50, bubbles: true }));
    document.dispatchEvent(new PointerEvent("pointerup", { bubbles: true }));

    // Center of pad: xRatio=0.5 → x=50, yRatio=0.5 → y=50
    expect(pad.getValue()).toEqual({ x: 50, y: 50 });

    pad.dispose();
  });

  it("stops updating after dispose", () => {
    const pad = createXYPad({
      label: "Position",
      x: { min: 0, max: 100, step: 1, value: 50 },
      y: { min: 0, max: 100, step: 1, value: 50 },
    });
    const padEl = pad.element.querySelector<HTMLElement>(".tf-xy-pad__pad")!;
    document.body.append(pad.element);
    mockRect(padEl, 0, 0, 100);

    padEl.dispatchEvent(new PointerEvent("pointerdown", { clientX: 25, clientY: 25, bubbles: true }));
    pad.dispose();

    document.dispatchEvent(new PointerEvent("pointermove", { clientX: 75, clientY: 75, bubbles: true }));
    document.dispatchEvent(new PointerEvent("pointerup", { bubbles: true }));

    expect(pad.getValue()).toEqual({ x: 25, y: 75 }); // value at time of pointer down, unchanged

    pad.dispose();
  });
});
