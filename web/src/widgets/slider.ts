/**
 * Range slider widget (plain DOM, accessible, keyboard-operable).
 */

import { ScalarWidgetBase } from "./base-widget.js";
import type { ScalarBounds, ScalarWidget } from "./widget-types.js";

class SliderWidget extends ScalarWidgetBase {
  private readonly fill: HTMLElement;
  private readonly thumb: HTMLElement;
  private readonly track: HTMLElement;
  private pointerDragging = false;

  private readonly handlePointerDown = (event: PointerEvent): void => {
    if (this.isDisposed()) {
      return;
    }
    const isTrack = event.target === this.track || this.track.contains(event.target as Node);
    const isThumb = event.target === this.thumb || this.thumb.contains(event.target as Node);
    if (!isTrack && !isThumb) {
      return;
    }
    event.preventDefault();
    this.pointerDragging = true;
    this.updateFromPointer(event);
    document.addEventListener("pointermove", this.handlePointerMove);
    document.addEventListener("pointerup", this.handlePointerUp);
  };

  private readonly handlePointerMove = (event: PointerEvent): void => {
    if (this.isDisposed() || !this.pointerDragging) {
      return;
    }
    event.preventDefault();
    this.updateFromPointer(event);
  };

  private readonly handlePointerUp = (): void => {
    if (this.pointerDragging) {
      this.pointerDragging = false;
      document.removeEventListener("pointermove", this.handlePointerMove);
      document.removeEventListener("pointerup", this.handlePointerUp);
    }
  };

  private updateFromPointer(event: PointerEvent): void {
    const rect = this.track.getBoundingClientRect();
    const x = event.clientX - rect.left;
    const ratio = rect.width > 0 ? x / rect.width : 0;
    const next = this.bounds.min + ratio * (this.bounds.max - this.bounds.min);
    this.commit(next);
  }

  constructor(bounds: ScalarBounds) {
    super("div", "tf-widget tf-slider", bounds);

    this.track = document.createElement("div");
    this.track.className = "tf-slider__track";

    this.fill = document.createElement("div");
    this.fill.className = "tf-slider__fill";

    this.thumb = document.createElement("div");
    this.thumb.className = "tf-slider__thumb";

    this.track.append(this.fill, this.thumb);
    this.element.appendChild(this.track);
    this.element.style.touchAction = "none";
    this.element.style.userSelect = "none";
    this.track.addEventListener("pointerdown", this.handlePointerDown);
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
    this.track.removeEventListener("pointerdown", this.handlePointerDown);
    document.removeEventListener("pointermove", this.handlePointerMove);
    document.removeEventListener("pointerup", this.handlePointerUp);
  }
}

/** Create a range slider. */
export function createSlider(bounds: ScalarBounds): ScalarWidget {
  return new SliderWidget(bounds);
}
