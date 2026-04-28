# ToneGraph v0.1 Specification

This document defines the normative ToneGraph v0.1 contract for ToneForge recipe files.

ToneGraph v0.1 targets standard Web Audio API graph construction. This spec is the source of truth for loader, validation, and recipe authoring behavior.

## Scope

- Target runtime: `BaseAudioContext` (`OfflineAudioContext` or `AudioContext`)
- File formats: JSON and YAML
- In scope: static graph declaration, node parameters, deterministic randomness metadata, flat routing links, `chain()` shorthand
- Out of scope in v0.1: advanced routing patterns, complex automation DSLs, and sequence scheduling

## Version Compatibility

- `version` is required and must equal `"0.1"`.
- Loaders must hard-fail unsupported versions with a clear, actionable error.
- Recommended error text:
  - `Unsupported ToneGraph version: <value>. Expected 0.1.`

## Top-Level Shape

ToneGraph v0.1 documents must be an object with the following fields.

| Field | Required | Type | v0.1 behavior |
|---|---|---|---|
| `version` | yes | string | Must be `"0.1"`. |
| `engine` | no | object | Engine metadata. Defaults to `{ backend: "webaudio" }`. |
| `meta` | no | object | Human-facing metadata (name, description, tags, duration hint). |
| `random` | no | object | RNG metadata and optional seed hint. |
| `transport` | no | object | Timing metadata (for future scheduling). |
| `nodes` | yes | object map | Node definitions keyed by node id. |
| `routing` | yes | array | Connection declarations (`link` or `chain`). |
| `sequences` | no | any | Reserved for v0.2. Loaders must reject when present in strict mode. |
| `namespaces` | no | any | Reserved for v0.2. Loaders must reject when present in strict mode. |

### Top-Level Defaults

- `engine.backend`: `"webaudio"`
- `meta.duration`: optional (no default)
- `random.algorithm`: `"xorshift32"`
- `random.seed`: optional
- `transport.tempo`: `120`
- `transport.timeSignature`: `[4, 4]`
- `routing`: must be present, may be empty (`[]`)

## Engine Field

`engine` is descriptive metadata for compatibility checks.

```json
{
  "engine": {
    "backend": "webaudio"
  }
}
```

Rules:
- If present, `backend` must be `"webaudio"` in v0.1.
- Any non-`webaudio` backend value must fail validation.

## Meta Field

`meta` contains author-facing metadata and optional duration hints.

Supported keys in v0.1:
- `name` (string)
- `description` (string)
- `category` (string)
- `tags` (array of strings)
- `duration` (number, seconds, optional hint)

## Random Field

`random` declares deterministic randomization settings.

Supported keys in v0.1:
- `algorithm` (string, default `"xorshift32"`)
- `seed` (integer, optional)

Rules:
- When `seed` is provided, loaders should initialize deterministic RNG from this value unless runtime options explicitly override it.
- Unknown algorithms must fail validation.

## Transport Field

`transport` is metadata for temporal interpretation.

Supported keys in v0.1:
- `tempo` (number, BPM, default `120`)
- `timeSignature` (array `[numerator, denominator]`, default `[4, 4]`)

Note: v0.1 does not define sequence scheduling behavior; transport is metadata only.

## Nodes

`nodes` is a required object map. Each key is a unique node id used by routing.

### Node Definition Format

Each node object uses this structure:

```json
{
  "kind": "oscillator",
  "params": {
    "frequency": 880,
    "type": "sine"
  }
}
```

Rules:
- `kind` is required.
- `params` is optional; omitted params use kind-specific defaults.
- Node ids must be unique in `nodes`.
- `destination` kind is a special terminal node and should normally be declared once.

### Supported Node Kinds (v0.1)

- `destination`
- `gain`
- `oscillator`
- `noise`
- `biquadFilter`
- `bufferSource`
- `envelope`
- `lfo`
- `constant`
- `fmPattern`

Implementations may internally expand helper kinds, but validators/loaders must support at least the list above.

### Kind Parameters

#### `destination`
- No params.

#### `gain`
- `gain` (number, default `1.0`)

#### `oscillator`
- `type` (`sine`, `square`, `sawtooth`, `triangle`; default `sine`)
- `frequency` (number, Hz, default `440`)
- `detune` (number, cents, default `0`)

#### `noise`
- `color` (`white`, `pink`, `brown`; default `white`)
- `level` (number, default `1.0`)

#### `biquadFilter`
- `type` (`lowpass`, `highpass`, `bandpass`, default `lowpass`)
- `frequency` (number, Hz, default `1000`)
- `Q` (number, default `1`)
- `gain` (number, default `0`; used by applicable filter types)

#### `bufferSource`
- `sample` (string, required for sample playback)
- `loop` (boolean, default `false`)
- `playbackRate` (number, default `1.0`)

#### `envelope`
- `attack` (seconds, default `0.01`)
- `decay` (seconds, default `0.1`)
- `sustain` (0..1, default `0`)
- `release` (seconds, default `0`)

#### `lfo`
- `type` (`sine`, `square`, `sawtooth`, `triangle`; default `sine`)
- `rate` (Hz, default `1`)
- `depth` (number, default `1`)
- `offset` (number, default `0`)

#### `constant`
- `value` (number, default `0`)

#### `fmPattern`
- `carrierFrequency` (number, Hz, default `440`)
- `modulatorFrequency` (number, Hz, default `220`)
- `modulationIndex` (number, default `1`)

## Parameter Declaration Format

To support authoring UIs and param extraction, v0.1 supports a declarative parameter descriptor list in `meta.parameters`.

```json
{
  "meta": {
    "parameters": [
      { "name": "frequency", "type": "number", "min": 400, "max": 1200, "unit": "Hz" },
      { "name": "attack", "type": "number", "min": 0.001, "max": 0.01, "unit": "s" }
    ]
  }
}
```

Descriptor fields:
- `name` (string, required)
- `type` (`number`, `integer`, `boolean`, `string`; required)
- `min` (number, optional)
- `max` (number, optional)
- `step` (number, optional)
- `unit` (string, optional)
- `default` (type-matching value, optional)

Validation rules:
- `name` values must be unique within `meta.parameters`.
- If both `min` and `max` are present, `min <= max`.
- `default` must match `type` and be inside declared bounds when bounds exist.

## Routing

`routing` is a required array of connection entries.

### Flat Link Form

```json
{ "from": "osc", "to": "filter" }
```

Rules:
- `from` and `to` must reference existing node ids.
- Connection order is the declaration order in `routing`.

### `chain()` Shorthand Form

```json
{ "chain": ["osc", "filter", "env", "out"] }
```

Semantics:
- Equivalent to:
  - `{ "from": "osc", "to": "filter" }`
  - `{ "from": "filter", "to": "env" }`
  - `{ "from": "env", "to": "out" }`

Validation rules:
- `chain` length must be at least 2.
- Every id in `chain` must exist in `nodes`.

## Reserved v0.2 Fields

`sequences` and `namespaces` are reserved for v0.2.

v0.1 behavior:
- Producers should not emit these fields.
- Validators/loaders may run in either mode:
  - strict: reject when either field is present
  - permissive: ignore with warning
- For implementation consistency, strict mode is recommended by default.

## Complete Example (JSON)

The following example expresses a `ui-scifi-confirm` style graph.

```json
{
  "version": "0.1",
  "engine": {
    "backend": "webaudio"
  },
  "meta": {
    "name": "ui-scifi-confirm",
    "description": "Short sci-fi confirmation tone.",
    "category": "UI",
    "tags": ["sci-fi", "confirm", "ui"],
    "duration": 0.19,
    "parameters": [
      { "name": "frequency", "type": "number", "min": 400, "max": 1200, "unit": "Hz" },
      { "name": "attack", "type": "number", "min": 0.001, "max": 0.01, "unit": "s" },
      { "name": "decay", "type": "number", "min": 0.05, "max": 0.3, "unit": "s" },
      { "name": "filterCutoff", "type": "number", "min": 800, "max": 4000, "unit": "Hz" }
    ]
  },
  "random": {
    "algorithm": "xorshift32",
    "seed": 42
  },
  "transport": {
    "tempo": 120,
    "timeSignature": [4, 4]
  },
  "nodes": {
    "osc": {
      "kind": "oscillator",
      "params": {
        "type": "sine",
        "frequency": 880
      }
    },
    "filter": {
      "kind": "biquadFilter",
      "params": {
        "type": "lowpass",
        "frequency": 2200,
        "Q": 1
      }
    },
    "env": {
      "kind": "envelope",
      "params": {
        "attack": 0.005,
        "decay": 0.18,
        "sustain": 0,
        "release": 0
      }
    },
    "out": {
      "kind": "destination"
    }
  },
  "routing": [
    { "chain": ["osc", "filter", "env", "out"] }
  ]
}
```

## Complete Example (YAML)

This YAML is equivalent to the JSON example above.

```yaml
version: "0.1"
engine:
  backend: webaudio
meta:
  name: ui-scifi-confirm
  description: Short sci-fi confirmation tone.
  category: UI
  tags:
    - sci-fi
    - confirm
    - ui
  duration: 0.19
  parameters:
    - name: frequency
      type: number
      min: 400
      max: 1200
      unit: Hz
    - name: attack
      type: number
      min: 0.001
      max: 0.01
      unit: s
    - name: decay
      type: number
      min: 0.05
      max: 0.3
      unit: s
    - name: filterCutoff
      type: number
      min: 800
      max: 4000
      unit: Hz
random:
  algorithm: xorshift32
  seed: 42
transport:
  tempo: 120
  timeSignature: [4, 4]
nodes:
  osc:
    kind: oscillator
    params:
      type: sine
      frequency: 880
  filter:
    kind: biquadFilter
    params:
      type: lowpass
      frequency: 2200
      Q: 1
  env:
    kind: envelope
    params:
      attack: 0.005
      decay: 0.18
      sustain: 0
      release: 0
  out:
    kind: destination
routing:
  - chain: [osc, filter, env, out]
```
