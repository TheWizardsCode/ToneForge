# ToneForge Integrations

ToneForge Integrations is the **delivery layer**: it moves curated library
assets into game engines, build systems, and CI pipelines reliably and
deterministically.

The first shipped surface is **engine sync** via the `sync` command and the
`EngineAdapter` interface. It reuses the shipped Validator and Compiler — it
never re-implements validation, compilation, or WAV rendering.

Reference: [`docs/prd/INTEGRATIONS_PRD.md`](./prd/INTEGRATIONS_PRD.md)
(sections 4.1, 6, 7, 9, 13).

## `toneforge sync`

```bash
toneforge sync --target unity --library ./library --output ./unity-project/Assets/Audio/
toneforge sync --target web   --library ./library --output ./dist/web/audio/
toneforge sync --target unity --library ./library --output ./out/ --json
```

| Option | Meaning |
|---|---|
| `--target <engine>` | Registered engine target (`unity`, `web`); case-insensitive. **(required)** |
| `--library <dir>` | Library root (default: `.toneforge-library`). |
| `--output <dir>` | Output directory for engine assets. **(required)** |
| `--json` | Emit the structured result on stdout (errors as JSON on stderr). |

### Pipeline

1. **Resolve the adapter.** An unsupported target fails before any IO.
2. **Validate.** The library is validated against the `web` ruleset at
   `error` strictness. Any error-level finding aborts the sync — nothing is
   written.
3. **Compile.** Every entry is baked to a WAV through the shared Compiler
   (into a private staging directory).
4. **Map and write.** Compiled assets are mapped through the adapter into the
   target layout and a deterministic `manifest.json` is written.

Sync is **idempotent**: output depends only on the library inputs, so
re-running produces byte-identical files.

### Output layouts

| Target | WAV layout | Manifest |
|---|---|---|
| `unity` | `Assets/Audio/<category>/<assetId>.wav` | `manifest.json` |
| `web` | `audio/<assetId>.wav` (flat) | `manifest.json` |

### Manifest

```jsonc
{
  "target": "unity",
  "buildId": "tfs_0123456789abcdef",
  "audioGroups": { "Impact": "SFX", "UI": "UI" },   // category → audio group
  "mixerBuses":  { "impact": "SFX", "ui": "UI" },   // tag → mixer bus
  "assets": [
    {
      "assetId": "lib-impact-crack",
      "category": "Impact",
      "recipe": "impact-crack",
      "duration": 0.25,
      "audioGroup": "SFX",
      "mixerBus": "SFX",
      "tags": ["impact", "heavy"],
      "file": "Assets/Audio/Impact/lib-impact-crack.wav",
      "hash": "…sha256 of the WAV…",
      "bytes": 26460
    }
  ]
}
```

`audioGroups` and `mixerBuses` are sorted mapping tables; `assets` is sorted by
`assetId`. `buildId` is a hash of the canonical manifest content, so equal
inputs always yield the same id.

### Exit codes

- `0` — sync completed.
- `1` — usage/IO error, unsupported target, or a blocking validation finding.

JSON errors carry a stable `code` (`unsupported_target`, `validation_failed`)
plus actionable fields — for example unsupported targets include
`supportedTargets`.

## Mapping

Adapters map ToneForge metadata onto engine concepts:

| Concept | Source | Unity | Web |
|---|---|---|---|
| Audio group | `category` | `UI`, `Ambience`, `Music`, `Voice`, else `SFX` | `ui`, `ambient`, `music`, else `sfx` |
| Mixer bus | `tags` | `UI`, `Ambience`, `Music`, `Voice`, else `SFX` | `ui`, `ambient`, `music`, `voice`, else `sfx` |

Mappings are case- and whitespace-insensitive, and the chosen tag-derived bus
is independent of tag order.

## Programmatic API

```ts
import { syncLibrary, getAdapter, registerAdapter } from "toneforge/integrations";
// or, within the repository: "src/integrations/index.js"

const result = await syncLibrary({
  target: "unity",
  libraryDir: "./library",
  outputDir: "./unity-project/Assets/Audio/",
});
console.log(result.manifest.buildId, result.written);
```

## Custom adapters

Adapters are pluggable — adding an engine does not require core changes:

```ts
import { registerAdapter, type EngineAdapter } from "./src/integrations/index.js";

const godotAdapter: EngineAdapter = {
  target: "godot",
  audioGroupFor: (category) => (category.toLowerCase() === "ui" ? "UI" : "SFX"),
  mixerBusFor: (tags) => (tags.includes("music") ? "Music" : "SFX"),
  assetPath: (entry) => `audio/${entry.id}.wav`,
  compileRuleset: () => ({ target: "godot", bake: {} }),
};

registerAdapter(godotAdapter);
// `toneforge sync --target godot …` now works in this process.
```

An empty `bake: {}` compile rule matches every entry, so a target receives
real WAVs. `getAdapter` throws an `UnsupportedTargetError`, and `listTargets`
returns the sorted registered target names.
