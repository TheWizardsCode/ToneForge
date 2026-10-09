# ToneForge Network

ToneForge Network is the **deterministic synchronization layer**: it shares
*behavioural intent* — never audio or visual buffers — so that every client
resolves the same sound and visuals locally.

See [`docs/prd/NETWORK_PRD.md`](prd/NETWORK_PRD.md) for the product-level
design (sections §4.1 and §7 define the event and API).

## Behavioural event

A behavioural event is a compact, serializable description of *what should
happen*. The canonical v1 shape is defined in `src/network/types.ts` and
matches NETWORK_PRD §4.1:

| Field | Type | Meaning |
|---|---|---|
| `version` | integer | Schema version (currently `1`). |
| `event` | non-empty string | Event identifier/type, e.g. `"footstep"`. |
| `seed` | integer | Deterministic seed for local synthesis. |
| `time` | finite number ≥ 0 | Timestamp in seconds. |
| `state` | non-empty string | State snapshot label, e.g. `"walk"`. |
| `context` | `Record<string, string>` | Context snapshot — flat dimensions. |

The `BehaviouralEvent` interface is the canonical model; `createBehaviouralEvent`
stamps the current version and validates, and `validateBehaviouralEvent`
returns structured errors instead of throwing.

## Canonical serialization

`encodeEvent` produces the canonical wire form: compact JSON (no whitespace)
with **object keys sorted lexicographically at every level**. This makes the
encoding a pure function of the event's structural content — two equal events
encode to the identical byte sequence regardless of property insertion order.

- The v1 form is bounded: a typical event (for example the PRD's
  `footstep` example) is well under 512 bytes.
- `decodeEvent(encodeEvent(e))` deep-equals `e`, and re-encoding the decoded
  event yields the identical string.
- Validation is strict within a version: unknown fields are rejected so the
  round-trip stays exact. Additive fields are gated behind a new `version`.

`canonicalStringify` exposes the same recursive key ordering for related
payloads (e.g. late-join snapshots).

## Versioning & forward compatibility

`BEHAVIOURAL_EVENT_VERSION` is the version this build emits;
`SUPPORTED_EVENT_VERSIONS` lists the versions it can decode.

| API | Behaviour |
|---|---|
| `decodeEvent(text)` | Returns `{status:"ok"}`, `{status:"unsupported-version"}` or `{status:"malformed"}` — never throws. |
| `decodeEventOrThrow(text)` | Throws `UnsupportedEventVersionError` / `MalformedEventError`. |
| `decodeEventStream(entries)` | Skips malformed or unsupported entries, returning the decoded events plus structured `warnings` (each tagged with its `index`) and a `skipped` count. |

An unsupported version is therefore **skipped gracefully with a structured
warning** rather than crashing the decoder, which is what lets newer peers
publish events that older clients simply ignore.

## API

```js
import { encodeEvent, decodeEventStream } from "./network/events.js";

const wire = encodeEvent({ version: 1, event: "footstep", seed: 1042, time: 123.45, state: "walk", context: { surface: "gravel" } });

const { events, warnings } = decodeEventStream([wire]);
network.onReceive((event) => runtime.execute(event));
```

## Transport & sessions

The session layer (`src/network/session.ts`) is **transport-agnostic**: it
only knows about the injectable [`Transport`](../src/network/transport.ts)
interface, so the core never depends on a WebSocket library.

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

- `host({ port, host?, transport? })` returns a session with `role: "host"`.
- `join("host:port", { transport? })` returns a session with `role: "client"`
  and a host-assigned `peerId`.
- `peers()` lists connected peer ids; `onPeerConnect` / `onPeerDisconnect`
  report lifecycle changes; the host also removes dropped peers.
- `emit()` on a **client** throws `NotAuthoritativeError`.
- Received events are delivered in deterministic, sequence-numbered order,
  even if the transport reorders frames.

### Authority model

The demo uses **host-authoritative** synchronisation (NETWORK_PRD §4.3): the
host is the only writer, and clients relay/receive. Authority decides *who
emits events*, never how they are resolved — every peer resolves the same
event locally, deterministically.

### Transports

| Adapter | Where | Notes |
|---|---|---|
| `createInMemoryTransport(network?)` | tests, local use | Synchronous, in-process, offline. |
| `createWebSocketTransport(library)` | runtime (browser/Node) | Real sockets; the WebSocket implementation is **injected**. |

The WebSocket adapter reuses the repository's existing `ws` dependency without
adding one to the core:

```js
import { WebSocket, WebSocketServer } from "ws";
import { createWebSocketTransport } from "./network/ws-transport.js";

const transport = createWebSocketTransport({ WebSocket, WebSocketServer });
const hostSession = await host({ port: 8080, transport });
```

A browser client injects the platform WebSocket (`{ WebSocket: globalThis.WebSocket }`)
and only needs `WebSocketServer` when hosting.

## Late-join snapshots

The session layer tracks the current behavioural state on the host. When a peer
joins after playback has started, the welcome handshake carries a
`StateSnapshot` (`src/network/snapshot.ts`) — the state label, context, seed and
session timestamp of the most recent authoritative event — so the joiner can
resolve and play the *current* deterministic output immediately. Past events
are never replayed.

```js
import { applySnapshot } from "./network/snapshot.js";

const snapshot = client.snapshot();          // attached to the join handshake
client.onSnapshot((s) => {                    // fires immediately if present
  const event = applySnapshot(s);             // canonical, resolvable event
  runtime.execute(event);
});

// The host exposes the same snapshot it attaches to new peers:
hostSession.snapshot();
```

- `captureSnapshot(event)` produces a canonical snapshot from an emitted event;
- `validateSnapshot(value)` / `applySnapshot(snapshot)` validate and resolve it;
- `SnapshotTracker` is the small host-side helper that remembers the latest one;
- `NetworkSession.snapshot()` and `onSnapshot(handler)` expose the current state
  on both host and client (registering after `join()` still yields the current
  snapshot).

## Latency, ordering and drift

The client-side sync primitives live in `src/network/sync.ts` and are pure
functions of the delivered event order (no wall-clock reads, no hidden
randomness):

| Primitive | Responsibility | Documented bound |
|---|---|---|
| `TimestampCorrector` | Smooth, **bounded** host→local clock offset | `DEFAULT_MAX_CLOCK_OFFSET_SECONDS` (2 s) |
| `EventSequencer` | Release events in timestamp order | `DEFAULT_REORDER_WINDOW_SECONDS` (100 ms) |
| `DriftCompensator` | Bound the per-event timing adjustment | `DEFAULT_MAX_DRIFT_SECONDS` (250 ms) |
| `SyncPipeline` | Correct → order → bound, in one pass | — |
| `runJitterHarness` | Assert two jittery clients stay aligned | `DEFAULT_ALIGNMENT_TOLERANCE_SECONDS` (250 ms) |

Events that arrive after their ordering slot has been released are dropped
(graceful degradation) rather than replayed out of order; a drift request beyond
the bound is clamped and reported as `degraded`, so a client can never be pushed
by an unbounded state jump. Seed the clock estimate from the late-join snapshot:

```js
import { SyncPipeline } from "./network/sync.js";

const pipeline = new SyncPipeline();
pipeline.observeReference(snapshot.time, localNow);
client.onReceive((event) => {
  for (const scheduled of pipeline.ingest(event, localNow)) {
    runtime.execute(scheduled.event, { playoutTime: scheduled.playoutTime });
  }
});
```

## Related work

- `src/network/resolver.ts` / `harness.ts` — deterministic resolver and
  bandwidth conformance harness (`TF-0MUZYS1IL003MCKC`).
- `TF-0MUZYS2JC001AHJQ` — transport (host/join, broadcast, authority).
- `TF-0MUZYS377005ZSDT` — late-join snapshots and drift handling.
