# SoundEditor (embeddable)

Framework-agnostic, single-sound editor shell. It mounts into any host
container, owns its own shadow DOM and lifecycle, and never leaks global CSS,
listeners or symbols into the host page.

> The editor is **single-sound** by design. Stacking, sequencing and mixing
> UIs are explicitly out of scope and belong to separate work items.

## Usage

```ts
import { createSoundEditor } from "./components/SoundEditor/index.js";

const editor = createSoundEditor({
  preset: { version: 1, recipe: "weapon-laser-zap", seed: 1234, overrides: {} },
  // Optional: an audio engine to release on dispose (built by later slices).
  audioEngine: { dispose: () => {} },
  // Optional: accessible label for the editor region.
  label: "Enemy sound",
});

editor.mount(document.getElementById("host")!);

const unsubscribe = editor.onChange((preset) => {
  // Persist / forward the preset to the host application.
  console.log(preset);
});

editor.setPreset({ ...editor.getPreset(), seed: 5678 });

unsubscribe();
editor.dispose();
```

## Public API

| Member | Description |
| --- | --- |
| `mount(container)` | Renders exactly one scoped root element into `container`. Throws if already mounted or disposed. Never constructs an `AudioContext`. |
| `dispose()` | Removes all DOM, disconnect observers, and disposes the audio engine. Idempotent. |
| `onChange(listener)` | Subscribes to state changes; returns an unsubscribe function. Listeners are cleared by `dispose()` and are never invoked afterwards. |
| `getPreset()` | Returns a defensive copy of the current `SoundPreset`. |
| `setPreset(preset)` | Replaces the current preset and notifies listeners when it actually changes. |

### `SoundPreset`

```ts
interface SoundPreset {
  version: number;                  // schema version (currently 1)
  recipe: string;                   // registered recipe name
  seed: number;                     // deterministic seed
  overrides: Record<string, number>; // parameter overrides (may be empty)
}
```

## Lifecycle & embedding guarantees

- **Scoped styles** — the stylesheet is injected into the editor's shadow root;
  nothing is written to `document.head` or the host page.
- **No globals** — mounting creates no properties on `globalThis` and adds no
  listeners to `document` or `window`.
- **Clean dispose** — the container is emptied, the `ResizeObserver` is
  disconnected, the audio engine is disposed, and the change-listener set is
  cleared.
- **Lazy audio** — audio is never created on mount; an `AudioEngine` is supplied
  by the host when auditioning is available (later slices) and is optional.
- **Graceful degradation** — the shell depends only on DOM APIs and does not
  throw when Web Audio is unavailable.

## WAV export

The editor renders offline (no live `AudioContext` required) and encodes with
the existing ToneForge WAV encoder:

```ts
const bytes: Uint8Array = await editor.exportWav();      // current preset
const other = await editor.exportWav(otherPreset);        // explicit preset
```

Hosts can build a download with the exported helper:

```ts
import { createWavDownload } from "./components/SoundEditor/index.js";

const wav = await createWavDownload(preset); // { bytes, filename, blob, download() }
wav.download(); // triggers a browser download (filename: <recipe>-seed-<seed>.wav)
```

Export is deterministic: the same preset always produces byte-identical WAV
bytes, and the bytes match the samples returned by `renderPreset`. Unknown
recipes throw a typed `PresetExportError`.

## Audition (play / stop / loop)

The editor includes audition controls. Per browser autoplay policy, **no
`AudioContext` is created until an explicit user gesture** — an "Enable audio"
button is shown until then. After the gesture, Play renders the current preset
and starts playback, Stop halts it, and Loop repeats until stopped. Edits made
while playing are picked up on the **next render** (loop boundary or next Play),
never by mutating live nodes. If Web Audio is unavailable the control disables
itself with an accessible message and the rest of the editor keeps working.

## Theming

Theme the editor with CSS custom properties on (or above) the host container:

| Property | Default | Purpose |
| --- | --- | --- |
| `--tf-editor-background` | `#16181d` | Editor background |
| `--tf-editor-foreground` | `#f5f5f5` | Text colour |
| `--tf-editor-accent` | `#6ea8fe` | Buttons / Loop active / focus accents |
| `--tf-editor-font` | `system-ui, sans-serif` | Font family |

```css
#enemy-gym .tg-sound-editor {
  --tf-editor-background: #101418;
  --tf-editor-accent: #ff9f1c;
}
```

## Accessibility

- **Labelled** — every control has a name (`aria-label` / visible label) sourced
  from the recipe parameter; the editor region is a labelled `role="group"`.
- **Keyboard operable** — sliders/dials: Arrow keys (±1 step), PageUp/PageDown
  (±10 steps), Home/End; XY pad: per-axis Arrow/Home/End; toggle/select: Arrow
  keys, Home/End, Enter/Space. Audition buttons are native `<button>`s.
- **Units & ranges exposed** — sliders/dials expose `aria-valuemin`,
  `aria-valuemax`, `aria-valuenow` and a unit-bearing `aria-valuetext`.
- **ARIA roles** — slider/rotary `role="slider"`; XY pad a labelled
  `role="group"` of two `role="slider"` axes; toggle/select `role="listbox"`
  with `role="option"` + `aria-selected`.
- **Focus order** — controls are appended in descriptor order (XY pads occupy
  the position of their first parameter), followed by the audition controls; the
  Tab order follows DOM order.

## Host integration

For hosts without framework/bundler integration, use the plain-DOM adapter:

```ts
import { mountEnemyGymEditor } from "./components/SoundEditor/adapters/enemy-gym.js";

const handle = mountEnemyGymEditor(panelElement, {
  preset,
  onChange: (next) => saveEnemySound(enemy, next),
});

// when the enemy panel is torn down:
handle.dispose();
```

See [`docs/guides/enemy-gym-sound-editor.md`](../../../docs/guides/enemy-gym-sound-editor.md)
for the full embedding guide and the AI_Hell parameter mapping.

## Scope

This component edits **one sound** (a recipe + seed + overrides). It does not
provide stacking, sequencing, mixing, project management, server rendering or
collaboration. Those are separate work items; keep the single-sound boundary.

## Testing

Component tests live in `__tests__/` and run under the shared happy-dom
environment:

```ts
// @vitest-environment happy-dom
```

Run with `npm test --prefix web`.
