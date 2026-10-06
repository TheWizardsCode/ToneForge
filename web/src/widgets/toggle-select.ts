/**
 * Toggle/select widget (plain DOM, accessible, keyboard-operable).
 *
 * Renders a `listbox` of discrete numeric options. Arrow keys move the
 * selection, Home/End jump to the ends, and Enter/Space toggle a two-option
 * control (or re-select the current option).
 */

import {
  type ScalarWidget,
  type ToggleOption,
  type ToggleSelectBounds,
  type Unsubscribe,
  type WidgetChangeDetail,
} from "./widget-types.js";

class ToggleSelectWidget implements ScalarWidget {
  readonly element: HTMLElement;

  private readonly options: ToggleOption[];
  private readonly optionElements: HTMLElement[] = [];
  private readonly listeners = new Set<(value: number) => void>();

  private currentValue: number;
  private disposed = false;

  private readonly boundHandleKey = (event: KeyboardEvent): void => {
    this.handleKey(event);
  };

  private readonly boundHandleClick = (event: MouseEvent): void => {
    const target = event.target as HTMLElement | null;
    const optionElement = target?.closest('[role="option"]') as HTMLElement | null;
    if (!optionElement) {
      return;
    }
    const index = this.optionElements.indexOf(optionElement);
    if (index >= 0) {
      this.selectIndex(index);
    }
  };

  constructor(bounds: ToggleSelectBounds) {
    if (!bounds.options || bounds.options.length === 0) {
      throw new Error("ToggleSelect requires at least one option");
    }
    this.options = [...bounds.options];
    this.currentValue = this.nearestOption(bounds.value ?? this.options[0].value);

    this.element = document.createElement("div");
    this.element.className = "tf-widget tf-toggle-select";
    this.element.setAttribute("role", "listbox");
    this.element.setAttribute("aria-label", bounds.label);
    this.element.tabIndex = 0;

    for (const option of this.options) {
      const optionElement = document.createElement("div");
      optionElement.className = "tf-toggle-select__option";
      optionElement.setAttribute("role", "option");
      optionElement.textContent = option.label;
      this.optionElements.push(optionElement);
      this.element.appendChild(optionElement);
    }

    this.element.addEventListener("keydown", this.boundHandleKey);
    this.element.addEventListener("click", this.boundHandleClick);
    this.render();
  }

  getValue(): number {
    return this.currentValue;
  }

  setValue(value: number): void {
    this.currentValue = this.nearestOption(value);
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
    this.element.removeEventListener("keydown", this.boundHandleKey);
    this.element.removeEventListener("click", this.boundHandleClick);
    this.element.remove();
  }

  private nearestOption(value: number): number {
    let best = this.options[0].value;
    let bestDistance = Number.POSITIVE_INFINITY;
    for (const option of this.options) {
      const distance = Math.abs(option.value - value);
      if (distance < bestDistance) {
        bestDistance = distance;
        best = option.value;
      }
    }
    return best;
  }

  private currentIndex(): number {
    const index = this.options.findIndex((o) => o.value === this.currentValue);
    return index < 0 ? 0 : index;
  }

  private selectValue(value: number): void {
    if (this.disposed || Object.is(value, this.currentValue)) {
      return;
    }
    this.currentValue = value;
    this.render();
    const detail: WidgetChangeDetail<number> = { value, name: undefined };
    this.element.dispatchEvent(new CustomEvent("change", { detail }));
    for (const listener of [...this.listeners]) {
      listener(value);
    }
  }

  private selectIndex(index: number): void {
    const clamped = Math.min(this.options.length - 1, Math.max(0, index));
    this.selectValue(this.options[clamped].value);
  }

  private handleKey(event: KeyboardEvent): void {
    if (this.disposed) {
      return;
    }
    switch (event.key) {
      case "ArrowDown":
      case "ArrowRight":
        this.selectIndex(this.currentIndex() + 1);
        break;
      case "ArrowUp":
      case "ArrowLeft":
        this.selectIndex(this.currentIndex() - 1);
        break;
      case "Home":
        this.selectIndex(0);
        break;
      case "End":
        this.selectIndex(this.options.length - 1);
        break;
      case "Enter":
      case " ":
        if (this.options.length === 2) {
          this.selectIndex(this.currentIndex() === 0 ? 1 : 0);
        } else {
          this.selectIndex(this.currentIndex());
        }
        break;
      default:
        return;
    }
    event.preventDefault();
  }

  private render(): void {
    const activeIndex = this.currentIndex();
    this.optionElements.forEach((element, index) => {
      const selected = index === activeIndex;
      element.setAttribute("aria-selected", String(selected));
      element.classList.toggle("is-selected", selected);
    });
  }
}

/** Create a toggle/select widget. */
export function createToggleSelect(bounds: ToggleSelectBounds): ScalarWidget {
  return new ToggleSelectWidget(bounds);
}
