/**
 * Range slider widget (plain DOM, accessible, keyboard-operable).
 */

import { ScalarWidgetBase } from "./base-widget.js";
import type { ScalarBounds, ScalarWidget } from "./widget-types.js";

class SliderWidget extends ScalarWidgetBase {
  private readonly fill: HTMLElement;
  private readonly thumb: HTMLElement;

  constructor(bounds: ScalarBounds) {
    super("div", "tf-widget tf-slider", bounds);

    const track = document.createElement("div");
    track.className = "tf-slider__track";

    this.fill = document.createElement("div");
    this.fill.className = "tf-slider__fill";

    this.thumb = document.createElement("div");
    this.thumb.className = "tf-slider__thumb";

    track.append(this.fill, this.thumb);
    this.element.appendChild(track);
    this.render();
  }

  protected render(): void {
    const span = this.bounds.max - this.bounds.min;
    const ratio = span > 0 ? (this.currentValue - this.bounds.min) / span : 0;
    const percent = `${Math.min(100, Math.max(0, ratio * 100))}%`;
    this.fill.style.width = percent;
    this.thumb.style.left = percent;
    this.syncAria();
  }

  protected onDispose(): void {
    // No listeners beyond the base keyboard handler.
  }
}

/** Create a range slider. */
export function createSlider(bounds: ScalarBounds): ScalarWidget {
  return new SliderWidget(bounds);
}
