# Integrations conformance fixtures

Declarative, offline fixture **libraries** consumed by the Integrations
conformance harness (`src/integrations/harness.ts`) and its suite
(`src/integrations/__tests__/conformance.test.ts`).

Each fixture is a `library.json` describing the **inputs** to the four-stage
pipeline (generate → validate → compile → export). The harness renders each
entry through the project's offline renderer, materialises a real on-disk
library (index + WAV + metadata) using the Library API, then runs validation,
compilation and category export against it. Nothing here touches the network
or a system audio player.

## Fixtures

| Fixture | Purpose |
|---------|---------|
| `valid-library/library.json` | Conformant library; all stages succeed and produce golden output. |
| `invalid-library/library.json` | Negative control; declares peak-clipping and duration-bound violations so validation fails with structured errors. |

## Schema

```jsonc
{
  "name": "integrations-valid-library",
  "version": "1.0",
  "description": "…",
  "validation": { "ruleset": "web", "strictness": "warning" },
  "compile": {
    "ruleset": {
      "target": "web",
      "maxVoices": 32,
      "bake": { "category": ["Impact"] },
      "hybrid": { "durationAbove": 0.25 }
    }
  },
  "entries": [
    {
      "candidateId": "ui-confirm",     // stored id becomes lib-ui-confirm
      "recipe": "ui-notification-chime",
      "seed": 42,
      "duration": 0.3,                 // declared duration → validation metadata
      "renderDuration": 0.15,          // optional; defaults to duration
      "category": "UI",
      "tags": ["ui", "confirm"],
      "peak": 0.6,
      "rms": 0.3
    }
  ],
  "expected": {                        // golden expectations (valid fixture)
    "compileDecisions": { "lib-ui-confirm": "hybrid" },
    "compileFiles":     ["UI/lib-ui-confirm.wav"],
    "manifestFiles":    ["UI/lib-ui-confirm.wav"],
    "exportFiles":      ["UI/lib-ui-confirm.wav"]
  }
}
```

The stored library entry id is `lib-<candidateId>`. `renderDuration` is kept
separate from `duration` so a metadata-only violation (for example an
out-of-bounds declared duration) can still use a cheap, short render.

## Determinism

- The valid fixture renders every entry at a fixed seed and duration, and the
  compile ruleset is explicit — so the `manifest.json` and every emitted WAV
  are byte-identical across runs.
- `expected` records the golden compile/export layout; the suite asserts both
  the on-disk file structure and the manifest contents (decisions, counts,
  hashes, byte counts) against it.
- Keep these files hand-edited and read-only from engine code: a regression in
  a pipeline stage must never silently rewrite its own expected input.

## Reference

`docs/prd/INTEGRATIONS_PRD.md` Sections 4.2 (Build Systems & CI), 7
(Deterministic Build Integration), 9 (Library Synchronization).
