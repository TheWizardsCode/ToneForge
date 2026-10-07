# Browser Runtime Usage

ToneForge is **Runtime-aware**: the Runtime engine, the recipe registry, and
the offline renderer run unchanged in a browser using the **native Web Audio
API**. Web Audio is provided by the browser itself — no polyfill is required,
and the Node-only `node-web-audio-api` package is never loaded in the browser.

`node-web-audio-api` is an **optional dependency** (see `package.json`). It is
only needed when you render audio offline in Node.js (the CLI and the Node test
suite). Browser builds omit it automatically: the cross-platform abstraction in
`src/audio/web-audio.ts` loads it lazily, only when `isNodeRuntime()` is true.

## Prerequisites

- A modern browser with the Web Audio API (Chromium, Firefox, Safari, Edge).
- For the Node.js path only: Node.js >= 22.3 (the abstraction resolves
  `node:module` via `process.getBuiltinModule`).
- No Web Audio polyfill. Do not bundle `node-web-audio-api` for the browser.

## Installation

```bash
npm install toneforge
```

In a bundler (Vite, webpack, Next.js, Rollup) the abstraction is
tree-shakeable and browser-safe — the Node-only dependency is resolved lazily
inside a Node-guarded code path, so it never appears in the browser bundle.

## Cross-runtime audio abstraction

`src/audio/web-audio.ts` exposes the only audio entry points you need. Import
from it instead of importing `node-web-audio-api` directly:

| Export | Kind | Purpose |
|---|---|---|
| `OfflineAudioContext` | constructor | Offline rendering — native Web Audio in the browser, `node-web-audio-api` in Node.js |
| `AudioContext` | constructor | Real-time playback (browser-native; `node-web-audio-api` in Node.js) |
| `getAudioContext()` | function | Convenience factory returning a real-time `AudioContext` |
| `getOfflineAudioContextCtor()` | function | Resolve the active `OfflineAudioContext` constructor |
| `isNodeRuntime()` | function | `true` under Node.js, `false` in the browser |

```ts
import {
  OfflineAudioContext,
  getAudioContext,
  isNodeRuntime,
} from "@toneforge/audio/web-audio.js";

if (!isNodeRuntime()) {
  const ctx = getAudioContext();
  await ctx.resume(); // browsers require a user gesture before playback
}
```

> In the in-repo web demo the `@toneforge/*` alias maps to `src/*` (see
> `web/vite.config.ts`). Published packages resolve the same modules from the
> compiled `dist/` output.

## Runtime API

The Runtime is the deterministic playback engine that ties together State,
Context, and Sequencer. See
[docs/prd/RUNTIME_PRD.md](prd/RUNTIME_PRD.md) for the full specification.

### `createRuntime(options?): Runtime`

| Option | Type | Default | Purpose |
|---|---|---|---|
| `seed` | `number` | `42` | Base seed for deterministic event generation |
| `stateMachine` | `StateMachine` | — | Attach a state machine for state-driven sequences |
| `context` | `Context` | — | Attach a context for environment-driven recipe resolution |
| `sequences` | `Record<string, SequenceDefinition>` | `{}` | State/sequencer-name to sequence definition |
| `clock` | `() => number` | `Date.now` | Clock used for event timestamps |
| `recipeResolver` | `(event, context) => string` | identity | Map an event + context to a recipe name |
| `maxLogEntries` | `number` | `1000` | In-memory event-log retention |

### `Runtime` interface

| Method | Returns | Description |
|---|---|---|
| `start()` | `string` | Start a session; returns the session id |
| `stop()` | `void` | Stop the current session |
| `isRunning()` | `boolean` | Whether a session is active |
| `setState(name)` | `TransitionRecord` | Transition the attached state machine |
| `setContext(updates)` | `ContextChangeRecord[]` | Update context dimensions |
| `setSfxParameter(id, name, value)` | `SfxParameterResult` | Adjust a parameter of a playing continuous/looping sound |
| `inspect()` | `RuntimeInspection` | Snapshot of state, context, active sequences, event count |
| `log(limit?)` | `readonly RuntimeLogEntry[]` | Inspect the event log |
| `onEvent(listener)` | `() => void` | Subscribe to events; returns an unsubscribe |
| `sessionId()` | `string \| null` | Current session id |
| `simulateActive()` | `SimulationResult \| null` | Simulate the active sequence |
| `reset()` | `void` | Clear state, context, and logs |

### Example: a state-driven runtime in the browser

```ts
import { createRuntime } from "@toneforge/runtime/index.js";
import { createStateMachine } from "@toneforge/state/state.js";
import { createContext } from "@toneforge/context/context.js";
import { parseSequencePreset } from "@toneforge/sequence/schema.js";

const stateMachine = createStateMachine({
  name: "movement",
  initial: "idle",
  states: [
    { name: "idle" },
    { name: "walk", sequencer: "footsteps_walk" },
  ],
  transitions: [
    { from: "idle", to: "walk" },
    { from: "walk", to: "idle" },
  ],
});

const context = createContext({
  dimensions: { surface: ["stone", "gravel"] },
  initial: { surface: "stone" },
});

const footstepsWalk = parseSequencePreset(
  {
    version: "1.0",
    name: "footsteps_walk",
    events: [
      { time: 0, event: "footstep", seedOffset: 0, gain: 0.7 },
      { time: 0.6, event: "footstep", seedOffset: 1, gain: 0.65 },
    ],
  },
  "footsteps_walk",
);

const runtime = createRuntime({
  seed: 42,
  stateMachine,
  context,
  sequences: { footsteps_walk: footstepsWalk },
  // Context-driven recipe switching: "footstep" + surface:"gravel"
  // resolves to "footstep-gravel".
  recipeResolver: (event, ctx) =>
    ctx.surface ? `${event}-${ctx.surface}` : event,
});

runtime.onEvent((entry) => {
  // entry.event.type, entry.event.detail, entry.event.timestamp
});

runtime.start();
runtime.setState("walk");
runtime.setContext({ surface: "gravel" });
runtime.stop();
```

### Example: real-time parameter adjustment (engine loop)

`setSfxParameter(id, name, value)` updates a parameter of a sound that is
already playing. The initial supported scope is continuous/looping sounds — for
example an engine loop whose pitch and intensity track RPM. It supports
`intensity`, `gain`, `pitch`, and `filter`; values are validated against their
ranges before any state changes:

```ts
runtime.start();
runtime.setState("running"); // activates the engine loop sequence

// RPM rises: modulate the loop in real time.
runtime.setSfxParameter("engine-1", "intensity", 0.3);
runtime.setSfxParameter("engine-1", "pitch", 0.6);
// ... later, at higher RPM ...
runtime.setSfxParameter("engine-1", "intensity", 0.9);
runtime.setSfxParameter("engine-1", "pitch", 1.8);

// Invalid names or out-of-range values throw and leave playback untouched:
// runtime.setSfxParameter("engine-1", "bogus", 0.5);     // unknown parameter
// runtime.setSfxParameter("engine-1", "gain", 1.5);      // out of range
```

Each successful change is logged as a deterministic `parameter_change` event.
General real-time parameter automation for arbitrary one-shot sounds is a
documented future extension (see `docs/prd/RUNTIME_PRD.md` §16).

### Render-backed runtime playback (audible demo)

The runtime can drive audible playback by resolving its events to recipes and
mixing them with the offline renderer. `runRuntimeScenario(scenario)` runs a
declarative runtime scenario — state machine, context, sequences,
recipe resolver, and scripted steps — and returns the resolved event timeline,
the per-event renders, and the mixed buffer:

```ts
import { runRuntimeScenario } from "@toneforge/runtime/audio.js";
import { loadRuntimeScenario } from "@toneforge/runtime/scenario.js";

// Node: load a scenario from disk. In the browser, build the object with
// `parseRuntimeScenario` from inline JSON instead of reading a file.
const scenario = await loadRuntimeScenario("presets/runtime/footsteps.json");
const { render } = await runRuntimeScenario(scenario);
```

Play the mixed buffer on the shared `AudioContext` by wrapping it in an
`AudioBuffer` and scheduling an `AudioBufferSourceNode` via
`scheduleRuntimeBuffer` (the same abstraction `node-web-audio-api` exposes in
Node):

```ts
import { scheduleRuntimeBuffer } from "@toneforge/runtime/audio.js";
import { getAudioContext } from "@toneforge/audio/web-audio.js";

const ctx = getAudioContext();
await ctx.resume(); // browsers require a user gesture before playback
scheduleRuntimeBuffer(ctx, render.samples, render.sampleRate);
```

The Node CLI uses the same bridge and plays through `playAudio`:

```bash
toneforge runtime demo                  # play
toneforge runtime demo --json           # resolved event timeline
toneforge runtime demo --output ./out/  # export WAVs + timeline.json
```

### Live interactive session (host-embedded)

For a *live* host — where state and context change over time — use
`createRuntimeSession`. It owns a runtime, a bounded LRU buffer cache,
and a playback scheduler, and it renders each resolved event through the cache
at its sequence-relative time:

```ts
import { createRuntimeSession, createBufferCache } from "@toneforge/runtime/index.js";
import { scheduleRuntimeBuffer } from "@toneforge/runtime/audio.js";
import { getAudioContext } from "@toneforge/audio/web-audio.js";

const ctx = getAudioContext();
await ctx.resume();

const session = createRuntimeSession({
  scenario,
  cache: createBufferCache({ maxEntries: 64 }),
  // Browser playback: schedule each rendered buffer on the shared context.
  play: (result) => {
    scheduleRuntimeBuffer(ctx, result.samples, result.sampleRate);
  },
});

session.handleCommand("state walk");
session.handleCommand("context surface=gravel");
session.handleCommand("state sprint");
await session.waitForIdle();
session.stop();
```

The same engine runs in Node: the CLI passes `playAudio` as the `play` hook. In
headless mode (`--json`) rendering and playback are skipped entirely, so a
session can be replayed in CI without an audio device. Replaying a `--script`
with the virtual clock is deterministic: same commands + seed → same event log.

## Recipe rendering in the browser

`renderRecipe(recipeName, seed, duration?)` from `src/core/renderer.ts` uses the
cross-platform `OfflineAudioContext`, so the same call works in Node.js and the
browser:

```ts
import { renderRecipe } from "@toneforge/core/renderer.js";

const result = await renderRecipe("footstep-stone", 42);
// result.samples: Float32Array
// result.sampleRate: 44100
// result.duration: seconds
// result.numberOfChannels: 1
```

To play the rendered buffer in the browser:

```ts
import { getAudioContext } from "@toneforge/audio/web-audio.js";

const result = await renderRecipe("footstep-stone", 42);
const ctx = getAudioContext();
await ctx.resume();

const buffer = ctx.createBuffer(1, result.samples.length, result.sampleRate);
buffer.copyToChannel(result.samples, 0);
const source = ctx.createBufferSource();
source.buffer = buffer;
source.connect(ctx.destination);
source.start(0);
```

> Recipes are deterministic: the same recipe + seed produces identical samples
> on every platform. File-backed ToneGraph recipes are discovered on disk and
> are therefore only registered in Node.js; synchronously-registered built-in
> recipes and recipe modules you import yourself are available in the browser.

## Web demo

The `web/` directory contains a browser demo that renders and plays recipes
using the browser-native Web Audio API:

```bash
npm run dev:web
```

The demo runs the Terminal UI and wizard; when a `generate --recipe <name>
--seed <n>` command completes, the wizard renders the recipe offline in the
browser and plays the result. Browser playback is implemented in
`web/src/audio.ts`.

## Tests

The browser behaviour is covered by Playwright end-to-end tests in
`web/e2e/`:

```bash
npm run test:e2e:ci --prefix web   # builds the web demo and runs Playwright
```

`web/e2e/runtime-recipes.spec.ts` runs against Chromium and Firefox and verifies
Runtime start/stop, state transitions, context changes, event-log determinism,
and non-silent deterministic recipe rendering.

`web/e2e/tonegraph-smoke.spec.ts` proves that at least one file-backed
ToneGraph recipe (`ui-scifi-confirm`) is discoverable in the browser bundle,
renders a non-zero buffer, and produces no Node-only console errors.

The Playwright web server binds the first free port at or after 3000 so the
suite still runs when the default port is occupied (for example by another
dev server). Set `PORT=<n>` to pin a specific port.

The `Web Playwright E2E` workflow (`.github/workflows/web-playwright.yml`) runs
the suite on pushes and pull requests that touch `web/`, `presets/`, or `src/`.
On CI the config retries failures twice and writes an HTML report plus failure
traces, which the workflow uploads as `playwright-report` and
`playwright-test-results` artifacts.
