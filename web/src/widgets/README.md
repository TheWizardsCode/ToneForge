# Widget kit

Framework-agnostic, accessible, disposable controls for the SoundEditor. A
widget knows nothing about recipes or audio — it takes typed bounds and emits a
numeric value change.

| Factory | Kind | Value |
| --- | --- | --- |
| `createSlider(bounds)` | range slider | `number` |
| `createRotary(bounds)` | rotary dial | `number` |
| `createXYPad(bounds)` | XY touchpad | `{ x, y }` |
| `createToggleSelect(bounds)` | toggle / select | `number` (one of `options`) |

## Contract

```ts
const slider = createSlider({
  min: 200, max: 2000, step: 10, unit: "Hz",
  value: 500, label: "Carrier Frequency", name: "carrierFreq",
});

slider.element;                 // root element (not attached by the factory)
slider.getValue();              // 500
slider.setValue(700);           // clamps + renders; never emits
const off = slider.onChange((v) => console.log(v)); // keyboard/pointer changes
slider.element.addEventListener("change", (e) => console.log(e.detail.value));
off();
slider.dispose();               // removes listeners; emits nothing afterwards
```

- **Typed bounds** — `{ min, max, step?, unit?, value?, label, name? }`. `step`
  defaults to 1/100th of the range. Values are clamped to `[min, max]` and
  quantised to `step` (floating-point noise removed).
- **Change events** — a `change` `CustomEvent` (`detail.value`) is dispatched on
  the root element, and `onChange` listeners are invoked. Events fire only when
  the value actually changes; `setValue` is programmatic and silent.
- **Accessibility** — slider/rotary use `role="slider"` with
  `aria-label`/`aria-valuemin`/`aria-valuemax`/`aria-valuenow`/`aria-valuetext`.
  The XY pad is a labelled `role="group"` containing two `role="slider"` axes,
  each carrying its own `unit` (configured per axis via `x.unit`/`y.unit`) in
  `aria-valuetext`.
  Toggle/select is a labelled `role="listbox"` of `role="option"` children with
  `aria-selected`.
- **Keyboard** — Arrow keys (slider/rotary: ±1 step, Home/End; XY pad: per
  axis), PageUp/PageDown (±10 steps), toggle/select: arrows move, Home/End jump,
  Enter/Space toggle a two-option control.
- **Disposal** — `dispose()` removes listeners and is idempotent. Widgets create
  no globals and inject no global CSS.

Component tests run under happy-dom via `// @vitest-environment happy-dom` and
are run with `npm test --prefix web`.
