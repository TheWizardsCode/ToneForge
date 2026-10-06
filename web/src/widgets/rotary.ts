/**
 * Rotary dial widget (plain DOM, accessible, pointer- and keyboard-operable).
 *
 * Renders a circular dial whose indicator rotates across a 270° arc. Pointer
 * dragging moves the value horizontally (the standard DAW knob gesture);
 * keyboard handling matches the slider.
 */

import { ScalarWidgetBase } from "./base-widget.js";
import type { ScalarBounds, ScalarWidget } from "./widget-types.js";

const MIN_ANGLE = -135;
const MAX_ANGLE = 135;

/** Horizontal pointer travel (px) that sweeps the full value range. */
const DRAG_RANGE_PX = 150;

class RotaryWidget extends ScalarWidgetBase {
  private readonly indicator: HTMLElement;
  private readonly dial: HTMLElement;
  private pointerDragging = false;
  private pointerStartX = 0;
  private pointerStartValue = 0;

  private readonly handlePointerDown = (event: PointerEvent): void => {
    if (this.isDisposed()) {
      return;
    }
    event.preventDefault();
    this.pointerDragging = true;
    this.pointerStartX = event.clientX;
    this.pointerStartValue = this.currentValue;
    document.addEventListener("pointermove", this.handlePointerMove);
    document.addEventListener("pointerup", this.handlePointerUp);
  };

  private readonly handlePointerMove = (event: PointerEvent): void => {
    if (this.isDisposed() || !this.pointerDragging) {
      return;
    }
    event.preventDefault();
    const delta = event.clientX - this.pointerStartX;
    const span = this.bounds.max - this.bounds.min;
    this.commit(this.pointerStartValue + (delta / DRAG_RANGE_PX) * span);
  };

  private readonly handlePointerUp = (): void => {
    if (this.pointerDragging) {
      this.pointerDragging = false;
      document.removeEventListener("pointermove", this.handlePointerMove);
      document.removeEventListener("pointerup", this.handlePointerUp);
    }
  };

  constructor(bounds: ScalarBounds) {
    super("div", "tf-widget tf-rotary", bounds);

    this.dial = document.createElement("div");
    this.dial.className = "tf-rotary__dial";

    this.indicator = document.createElement("div");
    this.indicator.className = "tf-rotary__indicator";

    this.dial.appendChild(this.indicator);
    this.dial.style.touchAction = "none";
    this.dial.style.userSelect = "none";
    this.dial.addEventListener("pointerdown", this.handlePointerDown);
    this.element.appendChild(this.dial);
    this.render();
  }

  protected render(): void {
    const span = this.bounds.max - this.bounds.min;
    const ratio = span > 0 ? (this.currentValue - this.bounds.min) / span : 0;
    const angle = MIN_ANGLE + Math.min(1, Math.max(0, ratio)) * (MAX_ANGLE - MIN_ANGLE);
    this.indicator.style.transform = `rotate(${angle}deg)`;
    this.syncAria();
  }

  protected onDispose(): void {
    this.dial.removeEventListener("pointerdown", this.handlePointerDown);
    document.removeEventListener("pointermove", this.handlePointerMove);
    document.removeEventListener("pointerup", this.handlePointerUp);
  }
}

/** Create a rotary dial. */
export function createRotary(bounds: ScalarBounds): ScalarWidget {
  return new RotaryWidget(bounds);
}
