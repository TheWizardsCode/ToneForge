---
title: "Network & Integrations -- Distributed & Embedded ToneForge"
id: network-integrations
order: 15000
description: >
  A walkthrough of ToneForge's two-window network demo (host/join, late join,
  deterministic behavioural sync) and the CI pipeline with engine export via
  the `sync` command.
---

## Intro

ToneForge is designed to operate **beyond a single machine**. Demo 15
introduces two pillars of that ambition:

1. **Network** -- deterministic behavioural synchronisation across
   multiple clients, using only compact behavioural events (not audio
   streams). Every peer resolves the same event identically, so
   playback is byte-for-byte identical without any bandwidth-hungry
   audio transport.

2. **Integrations** -- embedding ToneForge into real production
   pipelines: CI validation, compilation, and engine export via the
   `sync` command.

In this walkthrough you will:

1. Run the two-window browser demo to see host/join networking in
   action.
2. Observe late-join resynchronisation.
3. Run the CI pipeline command end-to-end.
4. Export a compiled library to a game engine layout with `toneforge sync`.

> [!prerequisite]
> Before starting, ensure you have run `npm install` and `npm run build`
> in the ToneForge root so the web demo assets are available.

## Act 1 -- The host

> You need to establish a source of truth -- a single machine whose
> behavioural events every other peer will replay identically.

Start the web demo server:

```bash
npm run dev:web
```

To run the two windows from another device on the same network, start the
dev stack with `npm run dev:web -- --host`: the launcher derives the host's
own hostnames/IPs and passes them to the backend as `ALLOWED_ORIGINS`
(dev-only).

Open two browser windows side by side. In the **host window**, navigate
to:

```
http://localhost:5173/network-demo.html?role=host
```

The host page displays an event log, a bandwidth readout, and a set of
state and surface buttons. The host is the **sole authority** for
emitting behavioural events -- it never plays them locally through a
remote server but instead resolves them through the same local runtime
pipeline that every client uses.

Press the **walk** button:

```
[state: walk]
```

The host's event log shows the emitted behavioural event and the local
runtime resolves the corresponding footstep recipe. The bandwidth readout
shows the cost of a single event -- typically well under **50 bytes** on
the wire (canonical JSON with lexicographic key ordering).

Now press **run** and then **sprint**, each time observing the state
transition in the event log:

```
[state: run]
[state: sprint]
```

Each state change produces a distinct recipe resolution:
`footsteps_walk` → `footsteps_run` → `footsteps_sprint`, and each
receives a fresh deterministic seed.

> [!commentary]
> The host is broadcasting *intent*, not audio. Each behavioural event
> is a compact serialisable object (see `src/network/types.ts`):
> version, event name, seed, timestamp, state label, and context. A
> typical event fits in well under 512 bytes. The determinism guarantee
> means that every client receiving this event will resolve the exact
> same recipe with the exact same seed -- producing byte-identical
> audio locally without ever streaming audio across the network.

## Act 2 -- The client

> You need a second peer that replays exactly what the host does,
> proving that deterministic local resolution is sufficient for
> synchronised playback.

In the **client window** (the second browser tab), navigate to:

```
http://localhost:5173/network-demo.html
```

The client page mirrors the host's interface but does not have authority
to emit events. Instead, it shows a connected/peer count readout, a
bandwidth counter, and a **fingerprint** display.

While the host presses walk → run → sprint, watch the client window:

```
[Received: state.movement = walk]
[Received: state.movement = run]
[Received: state.movement = sprint]
```

Both windows must display the **same fingerprint** at every step. The
fingerprint is a hash of the resolved recipe, state, seed, and timing --
a quick visual proof that both clients are producing identical output.

Press the **surface** buttons (stone, gravel, grass) on the host. The
client's context snapshot arrives and the recipe resolver switches
accordingly (e.g. `footstep-stone` → `footstep-gravel`):

```
[Context changed: surface stone → gravel]
```

The client plays the gravel footstep recipe with the same deterministic
seed the host used.

> [!commentary]
> The network transport layer uses WebSocket relay at
> `/ws/network` (`web/server/network-relay.ts`). Every frame is encoded
> through `encodeEvent`, which produces compact JSON with lexicographic
> key ordering. This means two equal events always produce the identical
> byte sequence on the wire -- even if the properties were inserted in a
> different order. `decodeEventStream` is the receiving counterpart: it
> returns `{status: "ok"}`, `{status: "unsupported-version"}`, or
> `{status: "malformed"}` -- it never throws.

## Act 3 -- Late join

> Playback has been running for a while. A new client joins late -- it
> missed the initial sequence. It must land on the current sound
> immediately, not replay the past.

While the host is in any state (for example, walking on gravel), open a
**third browser window** and navigate to:

```
http://localhost:5173/network-demo.html
```

The third window joins as a new client. It does not receive a replay of
past events. Instead, the host's **late-join handshake** carries a
`StateSnapshot` (see `src/network/snapshot.ts`) containing the
current behavioural state label, context, seed, and session timestamp.

The late-join client applies this snapshot through
`applySnapshot()` (from `src/network/snapshot.ts`), resolves it
deterministically through the runtime bridge, and immediately plays the
correct current output:

```
[Received: state.movement = walk]
[Snapshot applied -- landed on current output]
```

The late-join window's fingerprint matches the existing peers
immediately.

> [!commentary]
> Late-join resynchronisation is the property that makes the network
> useful in practice. NETWORK_PRD §8.1 defines the handshake contract:
> the host sends the current state snapshot, the joiner resolves it
> locally, and lands on byte-identical output to already-connected peers.
> Past events are never replayed -- only the current state is shared.
> The `SnapshotTracker` on the host remembers the latest event, and
> `NetworkSession.snapshot()` / `onSnapshot(handler)` expose it on both
> host and client.

## Act 4 -- Latency, ordering, and drift

> The network is real. Packets arrive out of order, jitter, and clock
> drift are unavoidable. How does ToneForge keep clients aligned?

The client-side sync primitives live in `src/network/sync.ts` and form a
three-stage pipeline:

1. **Timestamp correction** -- `TimestampCorrector` smooths the
   host→local clock offset using an exponentially smoothed estimate
   seeded by the late-join snapshot. The offset is **bounded** to 2
   seconds (`DEFAULT_MAX_CLOCK_OFFSET_SECONDS`).

2. **Event sequencing** -- `EventSequencer` releases events in
   ascending timestamp order through a **100 ms reorder window**
   (`DEFAULT_REORDER_WINDOW_SECONDS`). Events arriving after their
   slot has been released are dropped gracefully rather than replayed
   out of order.

3. **Drift compensation** -- `DriftCompensator` adjusts playout timing
   per event, **clamped to ±250 ms** (`DEFAULT_MAX_DRIFT_SECONDS`).
   When a client falls further behind, the correction clamps at the
   bound and is reported as *degraded* rather than jumping.

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

Events are released based on event timestamps, never on wall-clock
time, so the same delivered event order always produces the same
result. The two-window demo proves this visually -- both windows
always display the same fingerprint even when one has higher latency.

> [!commentary]
> The deterministic jitter harness (`runJitterHarness` in
> `src/network/sync.ts`) asserts that two independently jittery clients
> remain aligned within the 250 ms tolerance. This is the property that
> makes ToneForge Network safe for real-time environments: no single
> network anomaly can produce an unbounded state jump.

## Act 5 -- The CI pipeline

> You need to generate, validate, compile, and export sounds
> automatically as part of a build process -- no human, no browser.

The `toneforge pipeline` command runs the entire Integrations pipeline
-- **generate → validate → compile → export** -- in one non-interactive
command, fails fast on the first failing stage, and emits a structured
JSON log suitable for CI.

First, create a sounds manifest:

```bash
cat > ./sounds.json << 'EOF'
{
  "name": "demo-sounds",
  "version": "1.0",
  "compile": { "ruleset": { "target": "web", "bake": { "category": ["UI", "Impact"] } } },
  "validation": { "ruleset": "web", "strictness": "warning" },
  "entries": [
    {
      "candidateId": "ui-confirm",
      "recipe": "ui-scifi-confirm",
      "seed": 42,
      "duration": 0.3,
      "category": "UI",
      "tags": ["ui", "confirm"],
      "peak": 0.6,
      "rms": 0.3
    },
    {
      "candidateId": "impact-crack",
      "recipe": "impact-crack",
      "seed": 100,
      "duration": 0.25,
      "category": "Impact",
      "tags": ["impact", "heavy"],
      "peak": 0.85,
      "rms": 0.4
    }
  ]
}
EOF
```

Now run the pipeline:

```bash
toneforge pipeline \
  --sounds  ./sounds.json \
  --library ./build/library \
  --output  ./build/export \
  --json
```

The structured JSON output includes:

- `command`: `"pipeline"`
- `status`: `"ok"` or `"failed"`
- `stages`: list of executed stages (`generate`, `validate`, `compile`, `export`)
- `stageLogs`: per-stage timing and summary
- `generated`/`validation`/`compilation`/`exported`: stage-specific results

On success:

```json
{
  "command": "pipeline",
  "status": "ok",
  "stages": ["generate", "validate", "compile", "export"],
  "failedStage": null,
  "generated":   { "entryCount": 2, "entryIds": ["lib-ui-confirm", "lib-impact-crack"] },
  "validation":  { "status": "pass", "blocking": false },
  "compilation": { "manifest": { "buildId": "tfc_..." } },
  "exported":    { "count": 2, "files": ["UI/lib-ui-confirm.wav", "Impact/lib-impact-crack.wav"] }
}
```

> [!commentary]
> The pipeline is fully deterministic: all inputs are explicit (manifest
> seeds, ruleset, strictness), no live network or system audio is
> touched, and the same manifest produces byte-identical WAVs, manifests,
> and `buildId`s across runs. This makes it safe to cache and safe to
> gate merges on. The exit code is `0` on success, `1` on any failure
> (usage error, IO error, or a stage failure).

## Act 6 -- Engine export with `toneforge sync`

> After the CI pipeline produces a compiled library, you need to package
> it for a specific game engine.

The `toneforge sync` command takes a compiled library, validates it
at error strictness, compiles the assets, and writes them in a
target-specific layout with a deterministic `manifest.json`.

```bash
toneforge sync --target unity \
  --library ./build/library \
  --output ./unity-project/Assets/Audio/ \
  --json
```

The output layout for Unity:

```
unity-project/Assets/Audio/
├── UI/
│   └── lib-ui-confirm.wav
├── Impact/
│   └── lib-impact-crack.wav
└── manifest.json
```

The `manifest.json` contains:

- `target`: the engine target
- `buildId`: a hash of the canonical manifest content (deterministic)
- `audioGroups`: category → audio group mapping (e.g. `"UI" → "UI"`)
- `mixerBuses`: tag → mixer bus mapping
- `assets`: sorted array of asset entries, each with `assetId`,
  `recipe`, `duration`, `audioGroup`, `mixerBus`, `tags`, `file`,
  `hash`, and `bytes`

For the web target, the layout is flatter:

```bash
toneforge sync --target web \
  --library ./build/library \
  --output ./dist/web/audio/ \
  --json
```

```
dist/web/audio/
├── lib-ui-confirm.wav
└── lib-impact-crack.wav
```

> [!commentary]
> Sync is **idempotent**: output depends only on the library inputs,
> so re-running produces byte-identical files. The `audioGroups` and
> `mixerBuses` mapping tables translate ToneForge categories and tags
> into engine-specific concepts. Unity maps `"UI"` to the `UI` audio
> group, while web maps it to `ui`. The manifest's `buildId` is a hash
> of the canonical manifest content -- equal inputs always yield the
> same id.

## Act 7 -- Anatomy of a behavioural event

> You want to see exactly what crosses the wire during the network demo.

A behavioural event is defined in `src/network/types.ts`:

```bash
cat src/network/types.ts | grep -A15 "export interface BehaviouralEvent"
```

The same local resolution the network performs can be run in isolation — the
runtime demo resolves state and context changes to recipes through the
identical resolver:

```bash
toneforge runtime demo --json
```

The canonical wire form is produced by `encodeEvent`
(`src/network/events.ts`), which serialises to compact JSON (no whitespace)
with **lexicographically sorted keys at every level**. The equivalent event
for a single gravel footstep looks like this on the wire:

```json
{"context":{"surface":"gravel"},"event":"footstep","seed":1042,"state":"walk","time":123.45,"version":1}
```

That single line is the *entire* network payload. It is a few dozen bytes,
while the audio it produces is tens of kilobytes of WAV data. Because every
peer resolves the event locally — through the same runtime pipeline and the
same deterministic seed — the audio is byte-identical without any audio ever
crossing the network.

`decodeEventStream` (`src/network/events.ts`) is the receiving counterpart: it
accepts a batch of wire strings and returns the decoded events plus structured
warnings for any entry it skips (malformed, or an unsupported `version`). A
newer peer can therefore publish fields an older client simply ignores.

> [!commentary]
> Key ordering is what makes the encoding a pure function of the event's
> structural content: two equal events always produce the identical byte
> sequence, no matter the order their properties were inserted. That is the
> foundation of deterministic sync — same events in, same sound out, on every
> machine.

## Wrapping up

You have now seen both halves of Demo 15:

- **Network** — a host broadcasts compact behavioural events; every client
  resolves them deterministically, late joiners land on the current output via
  a snapshot, and bounded clock/drift handling keeps peers aligned through
  jitter. Bandwidth stays well under 1 KB/s.
- **Integrations** — `toneforge pipeline` runs generate → validate → compile →
  export non-interactively in CI, and `toneforge sync --target unity|web`
  packages a compiled library into an engine-specific layout with a
  deterministic `manifest.json`.

Both pillars share the same property: the output is a pure function of the
inputs, so it is reproducible on any machine, safe to cache, and safe to gate
merges on.

## See also

- [Network module guide](../docs/network.md)
- [Integrations module guide](../docs/integrations.md)
- [CI integration guide](../docs/guides/ci-integration.md)
- [Network & Integrations usage guide](../docs/guides/network-integrations.md)
- [NETWORK_PRD.md](../docs/prd/NETWORK_PRD.md)
- [INTEGRATIONS_PRD.md](../docs/prd/INTEGRATIONS_PRD.md)
- [Demo roadmap](../docs/prd/DEMO_ROADMAP.md)