/**
 * XY touchpad widget (plain DOM, accessible, keyboard-operable).
 *
 * Because an XY pad has two values, it exposes two focusable `role="slider"`
 * axes inside a labelled `role="group"`, so every dimension keeps its own
 * ARIA value range and keyboard support.
 */

import {
  clampAxis,
  formatValue,
  resolveStep,
  type Unsubscribe,
  type WidgetChangeDetail,
  type XYAxisBounds,
  type XYPadBounds,
  type XYPadValue,
  type XYPadWidget,
} from "./widget-types.js";

class XYPadWidgetImpl implements XYPadWidget {
  readonly element: HTMLElement;

  private readonly bounds: XYPadBounds;
  private readonly xAxis: HTMLElement;
  private readonly yAxis: HTMLElement;
  private readonly thumb: HTMLElement;
  private readonly listeners = new Set<(value: XYPadValue) => void>();

  private x: number;
  private y: number;
  private disposed = false;

  private readonly boundHandleKey = (event: KeyboardEvent): void => {
    const target = event.target as HTMLElement | null;
    if (!target) {
      return;
    }
    const dimension = target.classList.contains("tf-xy-pad__axis--y") ? "y" : "x";
    this.handleKey(event, dimension);
  };

  constructor(bounds: XYPadBounds) {
    this.bounds = bounds;
    this.x = clampAxis(bounds.x.value ?? bounds.x.min, bounds.x);
    this.y = clampAxis(bounds.y.value ?? bounds.y.min, bounds.y);

    this.element = document.createElement("div");
    this.element.className = "tf-widget tf-xy-pad";
    this.element.setAttribute("role", "group");
    this.element.setAttribute("aria-label", bounds.label);

    const pad = document.createElement("div");
    pad.className = "tf-xy-pad__pad";
    this.thumb = document.createElement("div");
    this.thumb.className = "tf-xy-pad__thumb";
    pad.appendChild(this.thumb);

    this.xAxis = this.createAxis("x", bounds.x);
    this.yAxis = this.createAxis("y", bounds.y);

    this.element.append(pad, this.xAxis, this.yAxis);
    this.element.addEventListener("keydown", this.boundHandleKey);
    this.render();
  }

  private createAxis(dimension: "x" | "y", axis: XYAxisBounds): HTMLElement {
    const element = document.createElement("div");
    element.className = `tf-xy-pad__axis tf-xy-pad__axis--${dimension}`;
    element.setAttribute("role", "slider");
    element.tabIndex = 0;
    element.setAttribute("aria-label", `${this.bounds.label} ${dimension.toUpperCase()}`);
    element.setAttribute("aria-valuemin", String(axis.min));
    element.setAttribute("aria-valuemax", String(axis.max));
    return element;
  }

  getValue(): XYPadValue {
    return { x: this.x, y: this.y };
  }

  setValue(value: XYPadValue): void {
    this.x = clampAxis(value.x, this.bounds.x);
    this.y = clampAxis(value.y, this.bounds.y);
    this.render();
  }

  onChange(listener: (value: XYPadValue) => void): Unsubscribe {
    this.listeners.add(listener);
    return () => {
      this.listeners.delete(listener);
    };
  }

  dispose(): void {
    if (this.disposed) {
      return;
    }
    this.disposed = true;
    this.listeners.clear();
    this.element.removeEventListener("keydown", this.boundHandleKey);
    this.element.remove();
  }

  private handleKey(event: KeyboardEvent, dimension: "x" | "y"): void {
    if (this.disposed) {
      return;
    }
    const axis = dimension === "x" ? this.bounds.x : this.bounds.y;
    const step = resolveStep(axis);
    const current = dimension === "x" ? this.x : this.y;
    switch (event.key) {
      case "ArrowRight":
      case "ArrowUp":
        this.commitDimension(dimension, current + step);
        break;
      case "ArrowLeft":
      case "ArrowDown":
        this.commitDimension(dimension, current - step);
        break;
      case "Home":
        this.commitDimension(dimension, axis.min);
        break;
      case "End":
        this.commitDimension(dimension, axis.max);
        break;
      default:
        return;
    }
    event.preventDefault();
  }

  private commitDimension(dimension: "x" | "y", next: number): void {
    if (dimension === "x") {
      this.x = clampAxis(next, this.bounds.x);
    } else {
      this.y = clampAxis(next, this.bounds.y);
    }
    this.render();
    const value: XYPadValue = { x: this.x, y: this.y };
    const detail: WidgetChangeDetail<XYPadValue> = { value, name: this.bounds.name };
    this.element.dispatchEvent(new CustomEvent("change", { detail }));
    for (const listener of [...this.listeners]) {
      listener(value);
    }
  }

  private render(): void {
    const xSpan = this.bounds.x.max - this.bounds.x.min;
    const ySpan = this.bounds.y.max - this.bounds.y.min;
    const xRatio = xSpan > 0 ? (this.x - this.bounds.x.min) / xSpan : 0;
    const yRatio = ySpan > 0 ? (this.y - this.bounds.y.min) / ySpan : 0;
    this.thumb.style.left = `${Math.min(100, Math.max(0, xRatio * 100))}%`;
    this.thumb.style.top = `${Math.min(100, Math.max(0, (1 - yRatio) * 100))}%`;

    this.syncAxisAria(this.xAxis, this.bounds.x, this.x);
    this.syncAxisAria(this.yAxis, this.bounds.y, this.y);
  }

  private syncAxisAria(
    element: HTMLElement,
    axis: XYAxisBounds,
    value: number,
  ): void {
    element.setAttribute("aria-valuenow", String(value));
    element.setAttribute("aria-valuetext", formatValue(value, axis.label));
  }
}

/** Create an XY pad. */
export function createXYPad(bounds: XYPadBounds): XYPadWidget {
  return new XYPadWidgetImpl(bounds);
}
