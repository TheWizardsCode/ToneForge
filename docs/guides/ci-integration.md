# ToneForge in CI

`toneforge pipeline` runs the whole Integrations pipeline — **generate →
validate → compile → export** — in a single non-interactive command. It is
designed for build servers: it never prompts, performs no network access,
fails fast on the first failing stage, and emits a structured JSON log.

Reference: [`docs/prd/INTEGRATIONS_PRD.md`](../prd/INTEGRATIONS_PRD.md)
sections 4.2 (Build Systems & CI), 7 (Deterministic Build Integration) and
10 (Validation & Compliance).

## Quick start

```bash
toneforge pipeline \
  --sounds  ./sounds.json \
  --library ./build/library \
  --output  ./build/export \
  --json
```

| Option | Meaning |
|---|---|
| `--sounds <file>` | Sounds manifest (JSON) describing the entries to generate. **(required)** |
| `--library <dir>` | Library directory written by the generate stage (default: `.toneforge-library`). |
| `--output <dir>` | Export output directory. **(required)** |
| `--compile-dir <dir>` | Compiled-artifact directory (default: `<output>/compile`). |
| `--ruleset <name>` | Validation ruleset override (`web`, `mobile`, `console`, `desktop`). |
| `--strictness <level>` | Validation strictness override (`info`, `warning`, `error`). |
| `--json` | Emit the structured run result as JSON. |

`--ruleset` and `--strictness` override the values declared in the sounds
manifest; the manifest supplies the defaults.

## Stages

| Stage | What it does | Reused API |
|---|---|---|
| `generate` | Renders each manifest entry offline and stores it in the library (index + WAV + metadata). | Library + core renderer |
| `validate` | Runs the platform ruleset over the library. Error-level findings abort the run. | Validator |
| `compile` | Applies the manifest's compile ruleset, baking/hybridising WAVs and writing a deterministic `manifest.json`. | Compiler |
| `export` | Copies the library WAVs into a category-based output tree. | Library export |

The pipeline **fails fast**: the first failing stage stops the run and later
stages are not attempted. A blocking validation finding therefore fails the
build *before* any compiled or exported artifact is written.

## Sounds manifest

The `--sounds` file is the same declarative format used by the Integrations
conformance harness. It is version-controlled alongside the project so a CI
run is fully reproducible:

```jsonc
{
  "name": "my-game-sfx",
  "version": "1.0",
  "compile":   { "ruleset": { "target": "web", "bake": { "category": ["Impact"] } } },
  "validation": { "ruleset": "web", "strictness": "warning" },
  "entries": [
    {
      "candidateId": "ui-confirm",
      "recipe": "ui-notification-chime",
      "seed": 42,
      "duration": 0.3,
      "category": "UI",
      "tags": ["ui", "confirm"],
      "peak": 0.6,
      "rms": 0.3
    }
  ]
}
```

Every `seed` is explicit, so the same manifest always renders the same WAVs
(see *Determinism* below).

## Structured log

With `--json` the run writes a single JSON object to stdout. It is emitted
on both success and a failing-stage failure, so a CI job can always parse it:

```jsonc
{
  "command": "pipeline",
  "status": "ok",                 // "ok" | "failed"
  "stages": ["generate", "validate", "compile", "export"],
  "failedStage": null,            // first failing stage, when status is "failed"
  "libraryDir": "…",
  "compileDir": "…",
  "exportDir": "…",
  "stageLogs": [
    {
      "stage": "generate",
      "status": "ok",
      "startedAt": "2026-01-01T00:00:00.000Z",
      "durationMs": 132,
      "summary": { "entryCount": 1, "entryIds": ["lib-ui-confirm"] }
    }
    // … one entry per executed stage
  ],
  "generated":   { "entryCount": 1, "entryIds": ["lib-ui-confirm"] },
  "validation":  { "status": "pass", "blocking": false, "…": "…" },
  "compilation": { "manifest": { "buildId": "tfc_…" }, "…": "…" },
  "exported":    { "count": 1, "files": ["UI/lib-ui-confirm.wav"] }
}
```

On failure the failing stage's log carries `status: "failed"` and an
`error` object with a stable `code` (for example `validation_failed`) and a
human-readable `message`.

Without `--json`, the pipeline prints `[n/4] <stage> ... ok (…ms)` progress
lines followed by a summary and uses the same exit codes.

## Exit codes

| Code | Meaning |
|---|---|
| `0` | Every stage succeeded. |
| `1` | Usage/IO error, or a stage failed (later stages were not run). |

## Determinism

All stage inputs are explicit (manifest seeds, ruleset, strictness) and no
live network or system audio is touched, so the same manifest produces
byte-identical WAVs, manifests and `buildId`s across runs. This makes the
pipeline safe to cache and safe to gate merges on.

## Engine export (optional)

The pipeline exports a platform-neutral, category-based tree. To package the
library for a specific game engine, follow it with the existing
[`toneforge sync`](../integrations.md) command:

```bash
toneforge pipeline --sounds ./sounds.json --output ./build --json
toneforge sync --target unity --library ./build/library \
  --output ./unity-project/Assets/Audio/ --json
```

`sync` re-validates at error strictness and writes the engine layout plus its
own `manifest.json`.

## Example GitHub Actions workflow

A ready-to-copy workflow is provided at
[`.github/workflows/toneforge-pipeline.yml.example`](../../.github/workflows/toneforge-pipeline.yml.example).
It is intentionally inert (the `.example` suffix keeps GitHub from running
it) until a maintainer commits it as `toneforge-pipeline.yml`:

```yaml
name: ToneForge assets

on:
  push:
    paths: ["sounds.json", "src/**"]
  pull_request:
  workflow_dispatch:

jobs:
  build-assets:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with:
          node-version: "22"
          cache: npm
      - run: npm ci
      - run: npm run build
      - name: Generate, validate, compile and export
        run: |
          node bin/dev-cli.js pipeline \
            --sounds  ./sounds.json \
            --library ./build/library \
            --output  ./build/export \
            --json | tee pipeline-result.json
      - uses: actions/upload-artifact@v4
        with:
          name: toneforge-assets
          path: build/export
```

The pipeline exits non-zero on the first failing stage, so the job fails the
build without any extra scripting.
