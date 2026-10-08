# ToneForge Compiler

ToneForge Compiler is the **build and packaging layer** that turns curated
library content into production-ready artifacts. For every asset it decides
whether to keep the recipe procedural, promote it to a hybrid, or fully bake it
to a WAV — then emits deterministic WAV files and a build manifest.

Compiler **never mutates the library**. It reads entries, writes only into its
own output directory, and produces a deterministic, diff-safe manifest.

Reference: [`docs/prd/COMPILER_PRD.md`](./prd/COMPILER_PRD.md).

## Procedural vs baked decisions

Each asset receives exactly one strategy per compilation run:

| Decision | Meaning | Emits a WAV |
|----------|---------|-------------|
| `procedural` | Keep the recipe; bake nothing. | No |
| `hybrid` | Bake the asset but keep a procedural core for the runtime. | Yes |
| `baked` | Fully bake the asset. | Yes |

Decisions are rule-driven and explainable: every plan entry carries a
human-readable `reason`. Bake rules take precedence over hybrid rules; assets
matching neither are left procedural.

### Ruleset schema

```jsonc
{
  "target": "mobile",
  "maxVoices": 16,
  "bake": {
    "category": ["Impact", "Creature"],
    "tags": ["cinematic"],
    "durationAbove": 1.0,
    "durationBelow": 5.0
  },
  "hybrid": {
    "durationAbove": 0.5
  }
}
```

All fields within a rule must match (logical AND). Within `category` and `tags`
any listed value matches (logical OR), case-insensitively. Duration bounds are
exclusive: `durationAbove` means strictly greater, `durationBelow` strictly
less. An empty rule (`{}`) matches every asset.

Built-in rulesets live in `src/compiler/engine.ts`:

| Ruleset | Target | Bake | Hybrid |
|---------|--------|------|--------|
| `web_defaults` | web | Impact/Creature, > 2.0s | > 1.0s |
| `mobile_aggressive` | mobile | Impact/Creature/Vehicle, > 1.0s | > 0.5s |

Callers may pass a custom `CompileRuleset` object instead of a built-in.

## WAV output

`src/compiler/output.ts` renders an entry's stored preset (`recipe`, `seed`,
`params`) to 16-bit PCM WAV via the project's offline renderer
(`renderPreset`) and encoder (`encodeWav`).

> **Note on the PRD.** `COMPILER_PRD.md` refers to "Tone.js Tone.Offline".
> ToneForge does not depend on Tone.js; the equivalent deterministic offline
> render path is `src/core/renderer.ts`. Reusing it avoids a new runtime
> dependency while preserving the required behaviour.

Assets are written under `<outputDir>/<category>/<assetId>.wav`, with
directories created on demand.

## Build manifests

Every non-dry run writes `<outputDir>/manifest.json`. The manifest records the
per-asset decision, output path, byte size, and the SHA-256 digest of each WAV,
plus a combined manifest hash and a hash-derived `buildId`.

```jsonc
{
  "buildId": "tfc_1f0c...",         // "tfc_" + first 16 hex chars of hash
  "target": "web",
  "hash": "1f0c...",                 // SHA-256 of canonical { target, assets }
  "proceduralAssets": 1,
  "hybridAssets": 1,
  "bakedAssets": 1,
  "assets": [
    {
      "assetId": "lib-ui_seed-2",
      "category": "UI",
      "recipe": "ui-notification-chime",
      "duration": 0.5,
      "decision": "baked",
      "file": "UI/lib-ui_seed-2.wav",
      "hash": "9a7d...",             // SHA-256 of the WAV bytes
      "bytes": 44144
    }
  ]
}
```

Manifest assets are sorted by `assetId` and serialised with recursively sorted
object keys (`canonicalStringify`). There are **no timestamps or host details**,
so the same inputs always produce byte-identical manifests. `buildId` and
`hash` therefore act as a deterministic build fingerprint.

### Dry runs

With `dryRun: true`, `compileLibrary` computes and returns the full plan and
manifest shape (with the intended `file` path) but writes **nothing** — every
`hash` and `bytes` field is `null` and no output directory is created. This
backs the CLI `compile --dry-run` flag: show the decisions without touching
disk.

## API

```ts
import {
  compileLibrary,
  compileLibraryDir,
  planBuild,
  decideAsset,
  getCompileRuleset,
} from "./compiler/index.js";

// Decide only (pure, in-memory).
const plan = planBuild(entries, { target: "web", bake: { durationAbove: 2 } });

// Compile already-loaded entries.
const result = await compileLibrary(entries, {
  ruleset: getCompileRuleset("mobile_aggressive"),
  outputDir: "./dist/mobile",
  dryRun: false,
});

// Compile a library stored on disk (optionally filtered).
const diskResult = await compileLibraryDir("./.toneforge-library", {
  ruleset: getCompileRuleset("web_defaults"),
  outputDir: "./dist/web",
  filter: { category: "Impact" },
});
```

| Export | Purpose |
|--------|---------|
| `COMPILE_RULESETS`, `listCompileRulesets`, `getCompileRuleset` | Built-in rulesets and lookup |
| `COMPILE_DECISIONS` | Canonical decision order |
| `decideAsset`, `planBuild` | Pure decision model |
| `compileLibrary`, `compileLibraryDir` | Compilation orchestration |
| `renderAsset`, `writeAsset`, `assetOutputPath` | WAV rendering and writing |
| `hashBytes`, `createManifest`, `serializeManifest`, `parseManifest`, `canonicalStringify` | Deterministic manifest utilities |

## Integration with the Validator

Validation is a separate concern (see [`docs/validator.md`](./validator.md)).
Callers that want a quality gate should run the Validator over the same entries
and treat a `blocking` report as a reason not to compile; the compiler core
itself is decision-only and does not silently drop failing assets.
