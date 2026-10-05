/**
 * Rotary dial widget (plain DOM, accessible, keyboard-operable).
 *
 * Renders a circular dial whose indicator rotates across a 270° arc. Uses the
 * same scalar contract, ARIA semantics and keyboard handling as the slider.
 */

import { ScalarWidgetBase } from "./base-widget.js";
import type { ScalarBounds, ScalarWidget } from "./widget-types.js";

const MIN_ANGLE = -135;
const MAX_ANGLE = 135;

class RotaryWidget extends ScalarWidgetBase {
  private readonly indicator: HTMLElement;

  constructor(bounds: ScalarBounds) {
    super("div", "tf-widget tf-rotary", bounds);

    const dial = document.createElement("div");
    dial.className = "tf-rotary__dial";

    this.indicator = document.createElement("div");
    this.indicator.className = "tf-rotary__indicator";

    dial.appendChild(this.indicator);
    this.element.appendChild(dial);
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
    // No listeners beyond the base keyboard handler.
  }
}

/** Create a rotary dial. */
export function createRotary(bounds: ScalarBounds): ScalarWidget {
  return new RotaryWidget(bounds);
}
