# Mixer Rules

ToneForge's Mixer applies **declarative, deterministic, auditable** mix rules
to avoid an unusable mix when many sounds play at once. This document defines
the rule schema, the built-in defaults, and the loader that reads rules from
`.toneforge/mixer/*.json`.

See [`docs/prd/MIXER_PRD.md`](prd/MIXER_PRD.md) for the product-level design.

## Mix groups

Mix groups are intent-based semantic categories (not channel strips). The six
confirmed groups are:

| Group | Default priority |
|---|---|
| `dialogue` | 100 |
| `alerts` | 90 |
| `ui` | 80 |
| `combat` | 60 |
| `footsteps` | 40 |
| `ambience` | 20 |

Group names are case-insensitive and normalised to lowercase.

## Defaults

| Default | Value | Meaning |
|---|---|---|
| `maxVoices` | 4 | Concurrent voices allowed per group |
| `duckDepthDb` | 6 | Attenuation applied by a duck action (positive magnitude, e.g. `6` = −6 dB) |
| `uiDuckDurationMs` | 200 | Duck duration applied to UI-triggered rules |

## Rule schema

Each file under `.toneforge/mixer/` is a JSON rule set:

```json
{
  "version": "1.0",
  "defaults": { "maxVoices": 4, "duckDepthDb": 6, "uiDuckDurationMs": 200 },
  "groups": {
    "combat": { "priority": 60, "maxVoices": 4 }
  },
  "rules": [
    {
      "id": "combat-focus",
      "when": { "state": "combat" },
      "then": {
        "duck": ["ambience"],
        "boost": ["combat"],
        "limit": ["ui"]
      }
    }
  ]
}
```

### `when` — triggers

At least one of `state` / `context` is required:

- `state` — a state name (e.g. `"combat"`).
- `context` — a map of context dimensions that must all match (e.g.
  `{ "surface": "metal" }`).

### `then` — actions

At least one of `duck` / `boost` / `limit` is required. Every target may be a
group-name string (using the built-in defaults) or an object with explicit
values:

| Action | String form | Object form | Defaults applied |
|---|---|---|---|
| `duck` | `"ambience"` | `{ "group": "ambience", "depthDb": 9, "durationMs": 500 }` | `duckDepthDb` (6); UI-triggered rules also default `durationMs` to `uiDuckDurationMs` (200) |
| `boost` | `"combat"` | `{ "group": "combat", "gainDb": 3 }` | none |
| `limit` | `"ui"` | `{ "group": "ui", "maxVoices": 2 }` | `maxVoices` (4) |

Rules are evaluated deterministically: the same state/context and rules always
produce the same decisions. Intelligence may *suggest* rules, but the Mixer
never auto-applies suggestions.

## Loading rules

```ts
import { loadMixRules } from "./src/mixer/index.js";

const rules = loadMixRules();
// → { version, defaults, groups, rules }
```

`loadMixRules(options)` accepts:

- `dir` — directory to read (`*.json`); defaults to `<cwd>/.toneforge/mixer`.
- `fallback` — rule set used when no files are present; defaults to the
  built-in rule set.
- `warn` — warning sink used on fallback; defaults to `console.warn`.

Behaviour:

- **No files present** (directory missing or containing no `.json`): a warning
  is emitted and the built-in defaults are returned.
- **Files present**: every file is validated in filename order and merged
  (later files override `defaults`/`groups`; rules concatenate). Invalid JSON
  or schema violations fail fast with field-level, actionable errors — a
  malformed rule file never silently falls back to defaults.
- **Group names are case-insensitive** (`"UI"` and `"ui"` are equivalent) and
  normalise to lowercase.

The committed seed file [`../.toneforge/mixer/rules.json`](../.toneforge/mixer/rules.json)
mirrors the built-in defaults and is covered by tests that guard against drift.

## Programmatic validation

`validateMixRuleSet(data, source)` returns an array of `ValidationError`
(empty = valid); `parseMixRuleSet(data, source)` validates and normalises,
throwing an actionable `Error` when invalid.

## Mixer runtime

The runtime arbitration engine lives in
[`src/mixer/runtime.ts`](../src/mixer/runtime.ts) and is reached through the
module index:

```ts
import { Mixer, loadMixRules } from "./src/mixer/index.js";

const mixer = new Mixer({ ruleSet: loadMixRules() });

mixer.setContext({ surface: "metal" });   // context-driven rules
mixer.updateState("combat");               // evaluates rules → decisions

const voice = mixer.startVoice("combat");  // null when at the voice cap
mixer.stopVoice("combat", voice!);

mixer.inspect();
// → { state, context, groups[], decisions[], voiceCount }
```

### Group registry

`inspect().groups` returns one `MixGroupState` per confirmed group with its
`priority`, effective `maxVoices`, `currentGain`, `activeVoices` and (while a
duck is active) `duckDurationMs`. Gains start at unity (`1`) and only move in
response to an explicit rule action.

### Voice ledger

`startVoice(group)` admits a voice only while the group is below its effective
`maxVoices` cap and returns a deterministic voice ID (`<group>-voice-<n>`), or
`null` when the group is full. `stopVoice(group, id)` releases a voice. Active
voices are tracked per group; a group never admits more voices than its cap.

### Rule evaluation

`applyRules()` (called implicitly by `updateState`/`setContext`) evaluates the
rule set against the current state/context. A rule matches when its `state`
matches the current state **and** every declared `context` dimension matches;
a rule declaring only one of the two is matched on that trigger alone. Each
pass resets gains to unity and caps to their configured values, so evaluation
is deterministic and idempotent for identical inputs.

Matching actions are applied in rule order:

- `duck` multiplies the target gain by `10 ** (-depthDb / 20)` (6 dB → ≈ 0.5);
- `boost` multiplies the target gain by `10 ** (gainDb / 20)` when `gainDb` is
declared, otherwise it records a decision without changing the gain;
- `limit` lowers the target's effective voice cap.

A cap lowered beneath the current active count does not retroactively stop
live voices; the effective cap is raised to the active count until they end, so
`activeVoices ≤ maxVoices` always holds.

The full ordered decision list from the most recent pass is available as
`inspect().decisions`. Evaluation is constant-time per rule and adds no
allocation-heavy work to the hot path; there is no ML inference and no
suggestion is ever auto-applied.

Reference: work item TF-0MMLC8B3T0Z1F7ZM.

### Testing

The Mixer is covered by three unit suites under
[`src/mixer/__tests__/`](../src/mixer/__tests__/):

- `schema.test.ts` and `rules-loader.test.ts` — rule parsing/validation and
  config loading;
- `runtime.test.ts` — the runtime API: group metadata, voice admission,
  rule decisions, default duck/UI values, determinism and a latency benchmark;
- `voice-limiting.test.ts` — the safety-critical voice-limit invariant under a
  seeded simulated load, fixture-verified duck/boost/limit outcomes for all
  six groups, and byte-stable determinism snapshots. Deterministic fixtures
  (seeded PRNG + fixed rule sets) live in `rules-fixtures.ts`.

Reference: work items TF-0MMLC8B3T0Z1F7ZM and TF-0MMLC8SQ302DVYOZ.
