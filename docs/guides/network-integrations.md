# Network & Integrations usage

This guide shows how to use the two delivery features introduced in Demo 15:

- **Network** — deterministic behavioural synchronisation across clients. It
  shares *intent* (compact behavioural events), never audio, so every peer
  resolves the same sound locally.
- **Integrations** — non-interactive CI (`toneforge pipeline`) and engine
  export (`toneforge sync`) for a compiled library.

For the product-level design see
[`docs/prd/NETWORK_PRD.md`](../prd/NETWORK_PRD.md) and
[`docs/prd/INTEGRATIONS_PRD.md`](../prd/INTEGRATIONS_PRD.md). For the module
references see [`docs/network.md`](../network.md) and
[`docs/integrations.md`](../integrations.md). For an end-to-end narrative see
the [Demo 15 walkthrough](../../demos/network-integrations.md).

## Network

### Behavioural events

A behavioural event is a compact, serialisable description of *what should
happen*. The canonical v1 shape (`src/network/types.ts`) is `version`, `event`,
`seed`, `time`, `state` and `context`. `encodeEvent` serialises it to compact
JSON with keys sorted lexicographically at every level, so two equal events
always produce the identical byte sequence.

```js
import { encodeEvent, decodeEventStream } from "./network/events.js";

const wire = encodeEvent({
  version: 1,
  event: "footstep",
  seed: 1042,
  time: 123.45,
  state: "walk",
  context: { surface: "gravel" },
});

const { events, warnings } = decodeEventStream([wire]);
network.onReceive((event) => runtime.execute(event));
```

`decodeEvent` / `decodeEventStream` never throw: malformed entries and
unsupported versions are skipped with structured warnings, so newer peers can
publish fields older clients ignore.

### Host, join and authority

The session layer is transport-agnostic — the core only knows the injectable
`Transport` interface (in-memory for tests, WebSocket in the browser/Node).

```js
import { host, join } from "./network/session.js";

// Host: starts a listener and owns authority.
const hostSession = await host({ port: 8080 });

// Client: connects and completes the welcome handshake.
const client = await join("127.0.0.1:8080");
client.onReceive((event) => runtime.execute(event));

// Only the host may emit authoritative events.
hostSession.emit({ event: "footstep", seed: 1042, time: 1.2, state: "run", context: {} });
```

Calling `emit()` on a client throws `NotAuthoritativeError`: authority decides
*who emits*, never how an event is resolved.

### Late join and drift

When a peer joins after playback has started, the host attaches a
`StateSnapshot` (state label, context, seed, session timestamp) to the welcome
handshake. The joiner resolves the current output immediately; past events are
never replayed.

```js
import { applySnapshot } from "./network/snapshot.js";

client.onSnapshot((snapshot) => {
  const event = applySnapshot(snapshot);
  runtime.execute(event);
});
```

Client-side ordering and timing use `SyncPipeline` (`src/network/sync.ts`):
bounded clock correction (2 s), a 100 ms reorder window, and drift correction
clamped to ±250 ms. Events are released by event timestamp, never wall-clock
time, so the same delivered order always produces the same result.

### Two-window demo

```bash
npm run dev:web
```

To run the two windows from another device on the same network, start the
dev stack with `npm run dev:web -- --host`: the launcher derives the host's
own hostnames/IPs and passes them to the backend as `ALLOWED_ORIGINS`
(dev-only).

Open a host window (<http://localhost:5173/network-demo.html?role=host>) and a
client window (<http://localhost:5173/network-demo.html>). Both windows play
the resolved sound and display the same fingerprint; the host's event log and
each window's bandwidth readout show that only behavioural intent crossed the
wire.

## Integrations

### CI pipeline — `toneforge pipeline`

Runs **generate → validate → compile → export** in one non-interactive command,
fails fast on the first failing stage, and emits a structured JSON log.

```bash
toneforge pipeline \
  --sounds  ./sounds.json \
  --library ./build/library \
  --output  ./build/export \
  --json
```

See the [CI integration guide](./ci-integration.md) for the sounds manifest
format, the structured log shape, exit codes and an example GitHub Actions
workflow.

### Engine export — `toneforge sync`

Validates the library at `error` strictness, compiles every entry through the
shared Compiler, then writes an engine-specific layout plus a deterministic
`manifest.json`.

```bash
toneforge sync --target unity --library ./build/library --output ./unity-project/Assets/Audio/
toneforge sync --target web   --library ./build/library --output ./dist/web/audio/
```

| Target | WAV layout | Manifest |
|---|---|---|
| `unity` | `Assets/Audio/<category>/<assetId>.wav` | `manifest.json` |
| `web` | `audio/<assetId>.wav` (flat) | `manifest.json` |

`sync` is **idempotent** — output depends only on the library inputs, so
re-running produces byte-identical files. `audioGroups` maps ToneForge
categories to engine audio groups (e.g. `Impact` → Unity's `SFX`); `mixerBuses`
maps tags to mixer buses. Adapters are pluggable via `registerAdapter`, so a
new engine needs no core changes.

## Determinism guarantees

- The same behavioural event stream resolves to the same sound on every peer.
- The same pipeline manifest produces byte-identical WAVs, manifests and
  `buildId`s across runs.
- The same library export is byte-identical, whatever the machine.

These properties are what make Network and Integrations safe to run in CI, safe
to cache, and safe to gate merges on.
