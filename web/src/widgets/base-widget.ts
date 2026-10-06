/**
 * Shared base for scalar widgets (slider, rotary dial).
 *
 * Owns value clamping/quantisation, ARIA state, change notification and
 * disposal. Subclasses build the visible DOM and implement `render()` (visual
 * + ARIA update) and `onDispose()` (remove their own listeners).
 */

import {
  clampToBounds,
  formatValue,
  resolveStep,
  type ScalarBounds,
  type ScalarWidget,
  type Unsubscribe,
  type WidgetChangeDetail,
} from "./widget-types.js";

export abstract class ScalarWidgetBase implements ScalarWidget {
  readonly element: HTMLElement;
  protected readonly bounds: ScalarBounds;
  protected readonly step: number;
  protected currentValue: number;

  private readonly listeners = new Set<(value: number) => void>();
  private disposed = false;

  private readonly handleKeyDown = (event: KeyboardEvent): void => {
    if (this.disposed) {
      return;
    }
    switch (event.key) {
      case "ArrowRight":
      case "ArrowUp":
        this.nudge(1);
        break;
      case "ArrowLeft":
      case "ArrowDown":
        this.nudge(-1);
        break;
      case "PageUp":
        this.nudge(10);
        break;
      case "PageDown":
        this.nudge(-10);
        break;
      case "Home":
        this.commit(this.bounds.min);
        break;
      case "End":
        this.commit(this.bounds.max);
        break;
      default:
        return;
    }
    event.preventDefault();
  };

  constructor(tag: string, className: string, bounds: ScalarBounds) {
    this.element = document.createElement(tag);
    this.element.className = className;
    this.element.setAttribute("role", "slider");
    this.element.tabIndex = 0;

    this.bounds = bounds;
    this.step = resolveStep(bounds);
    this.currentValue = clampToBounds(bounds.value ?? bounds.min, bounds);

    this.element.setAttribute("aria-label", bounds.label);
    this.element.setAttribute("aria-valuemin", String(bounds.min));
    this.element.setAttribute("aria-valuemax", String(bounds.max));
    this.element.addEventListener("keydown", this.handleKeyDown);
  }

  getValue(): number {
    return this.currentValue;
  }

  /** Programmatic set: clamps + renders, never emits a change event. */
  setValue(value: number): void {
    this.currentValue = clampToBounds(value, this.bounds);
    this.render();
  }

  onChange(listener: (value: number) => void): Unsubscribe {
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
    this.element.removeEventListener("keydown", this.handleKeyDown);
    this.onDispose();
    this.element.remove();
  }

  protected isDisposed(): boolean {
    return this.disposed;
  }

  /** Apply an interaction value; emits only when the value actually changes. */
  protected commit(next: number): void {
    if (this.disposed) {
      return;
    }
    const clamped = clampToBounds(next, this.bounds);
    if (Object.is(clamped, this.currentValue)) {
      return;
    }
    this.currentValue = clamped;
    this.render();
    const detail: WidgetChangeDetail<number> = {
      value: clamped,
      name: this.bounds.name,
    };
    this.element.dispatchEvent(new CustomEvent("change", { detail }));
    for (const listener of [...this.listeners]) {
      listener(clamped);
    }
  }

  /** Move by a whole number of steps. */
  protected nudge(steps: number): void {
    this.commit(this.currentValue + steps * this.step);
  }

  /** Update `aria-valuenow`/`aria-valuetext` from the current value. */
  protected syncAria(): void {
    this.element.setAttribute("aria-valuenow", String(this.currentValue));
    this.element.setAttribute(
      "aria-valuetext",
      formatValue(this.currentValue, this.bounds.unit),
    );
  }

  protected abstract render(): void;
  protected abstract onDispose(): void;
}
