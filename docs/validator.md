# ToneForge Validator

ToneForge Validator is the **quality gate** between authoring and shipping. It
scans library assets against declarative, platform-specific rules and answers a
single question: *is this safe, correct, and shippable?*

Validator **never mutates assets** and produces a deterministic,
machine-readable report that is safe to diff and to consume in CI.

Reference: [`docs/prd/VALIDATOR_PRD.md`](./prd/VALIDATOR_PRD.md).

## Core checks

| Check | Metric | Rule field |
|-------|--------|------------|
| `peak_clipping` | Peak amplitude (`analysis.metrics.time.peak`) | `peakClipping.maxPeak` |
| `duration_bounds` | Duration in seconds (`entry.duration`) | `duration.min` / `duration.max` |
| `silence_ratio` | Proportion of near-silent samples | `silenceRatio.maxRatio` / `silenceRatio.threshold` |

A check emits `pass` when the asset satisfies the rule, `skipped` when the
required metric is unavailable, and a violation (`info` / `warning` / `error`)
otherwise.

The silence ratio is computed from decoded audio samples when they are
supplied (or read from disk by `validateLibraryDir`). If no samples are
available and the analysis result carries no `silenceRatio` metric, the check is
reported as `skipped` rather than failing.

## Rulesets

Built-in rulesets are defined in `src/validator/rules.ts`:

| Ruleset | Max peak | Duration window | Max silence ratio |
|---------|----------|-----------------|-------------------|
| `mobile` | 0.95 | 0.02s – 1.5s | 0.35 |
| `web` | 0.98 | 0.02s – 5.0s | 0.40 |
| `console` | 0.99 | 0.02s – 10.0s | 0.50 |
| `desktop` | 0.99 | 0.02s – 8.0s | 0.50 |

Callers may pass a custom `Ruleset` object instead of a built-in name.

## Strictness

Strictness selects the severity assigned to every violation:

| Level | Effect |
|-------|--------|
| `info` | Violations are advisory; the run never blocks. |
| `warning` | Violations are reported as warnings; the run never blocks. |
| `error` | Violations are reported as errors; the run **blocks**. |

`validateLibrary` defaults to `warning`. `report.blocking` is `true` only when
at least one `error`-level finding is present.

## Report schema

```jsonc
{
  "ruleset": "mobile",
  "strictness": "warning",
  "entryCount": 2,
  "status": "warning",          // pass | info | warning | error
  "blocking": false,
  "counts": { "pass": 5, "info": 0, "warning": 1, "error": 0, "skipped": 0 },
  "perCheck": {
    "peak_clipping":   { "pass": 1, "info": 0, "warning": 1, "error": 0, "skipped": 0 },
    "duration_bounds": { "pass": 2, "info": 0, "warning": 0, "error": 0, "skipped": 0 },
    "silence_ratio":   { "pass": 2, "info": 0, "warning": 0, "error": 0, "skipped": 0 }
  },
  "assets": [
    {
      "assetId": "lib-weapon_seed-4821",
      "category": "weapon",
      "recipe": "weapon-laser-zap",
      "status": "pass",
      "checks": [
        {
          "check": "peak_clipping",
          "status": "pass",
          "value": 0.9,
          "limit": "<=0.95",
          "message": "peak 0.9 within <=0.95"
        }
      ]
    }
  ]
}
```

The report contains no timestamps, so identical inputs always produce
byte-identical JSON.

## API

```ts
import { validateLibrary, validateLibraryDir, RULESETS } from "./validator/index.js";

// Pure, in-memory validation of already-loaded entries.
const report = validateLibrary(entries, {
  ruleset: "mobile",
  strictness: "error",
  // Optional decoded samples, keyed by entry id.
  samples: new Map([["lib-a", float32Samples]]),
});

// Validate a library stored on disk (decodes each entry's WAV).
const diskReport = await validateLibraryDir("./library", {
  ruleset: "mobile",
  strictness: "warning",
});
```

| Export | Purpose |
|--------|---------|
| `RULESETS`, `RULESET_NAMES`, `getRuleset`, `resolveRuleset`, `isRulesetName`, `listRulesets` | Ruleset definitions and lookup |
| `computeSilenceRatio`, `extractAudioFacts` | Metric extraction helpers |
| `checkPeakClipping`, `checkDurationBounds`, `checkSilenceRatio`, `runChecks` | Individual and combined checks |
| `validateLibrary`, `validateLibraryDir` | Report engines |
