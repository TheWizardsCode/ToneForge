# SoundPreset model

Versioned, deterministic description of a single sound, used to hand sounds
between the editor, hosts and persistence.

## Schema (version 1)

```json
{
  "version": 1,
  "recipe": "weapon-laser-zap",
  "seed": 1234,
  "overrides": { "carrierFreq": 500 }
}
```

| Field | Type | Meaning |
| --- | --- | --- |
| `version` | `number` | Schema version. Only `1` is accepted by `parsePreset`. |
| `recipe` | `string` | Registered recipe name. |
| `seed` | `number` | Integer seed; fully determines baseline parameters. |
| `overrides` | `Record<string, number>` | Sparse parameter overrides on top of the seed baseline. |

## API

| Function | Behaviour |
| --- | --- |
| `createPreset(recipe, seed, overrides?)` | Builds a normalised preset. |
| `normalisePreset(preset)` | Validates recipe/seed; drops unknown/non-finite overrides; clamps out-of-range values; rounds integer (`unit: "int"`) parameters. |
| `serialisePreset(preset)` | Canonical JSON: fixed field order, sorted override keys → byte-identical for equal presets. |
| `parsePreset(json)` | Strict parse: rejects invalid JSON, unsupported version, unknown recipe, non-integer seed, unknown parameters, non-finite/out-of-range/integer violations. |
| `getBaselineParams(recipe, seed)` | Seed-derived parameter values, reusing `registry…getParams(rng)`. |
| `getEffectiveParams(preset)` | Baseline parameters with overrides applied. |
| `presetsEqual(a, b)` | Deep, order-independent equality. |

## Determinism

`parsePreset(serialisePreset(preset))` deep-equals `preset` and re-serialising
is byte-identical. Parameter definitions are never duplicated — descriptors and
baselines come from the shared recipe registry (`src/recipes/index.ts`).
