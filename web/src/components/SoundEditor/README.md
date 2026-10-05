# SoundEditor (embeddable)

Framework-agnostic, single-sound editor shell. It mounts into any host
container, owns its own shadow DOM and lifecycle, and never leaks global CSS,
listeners or symbols into the host page.

> This slice delivers the **shell and lifecycle API**. Controls, audio
> auditioning, mapping and WAV export are layered on by later work items.

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

## Testing

Component tests live in `__tests__/` and run under the shared happy-dom
environment:

```ts
// @vitest-environment happy-dom
```

Run with `npm test --prefix web`.
