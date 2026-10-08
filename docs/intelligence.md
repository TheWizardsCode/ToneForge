# ToneForge Intelligence

ToneForge Intelligence is the **assistive reasoning layer** of the ToneForge
ecosystem. It reads library, analysis and classification data and produces
explainable, actionable suggestions. It is deliberately **not** autonomous:

> Intelligence suggests; the human decides.

Intelligence **never mutates library data**. Every command in the
`toneforge intelligence` group is read-only.

Reference: [`docs/prd/INTELLIGENCE_PRD.md`](./prd/INTELLIGENCE_PRD.md).

## Commands

```bash
toneforge intelligence audit --library <dir>
toneforge intelligence recommend --use-case <desc> --max-results <n>
toneforge intelligence suggest-exploration --recipe <r>
```

## `intelligence audit`

Audits a curated library for three classes of issue:

| Kind | Meaning |
|------|---------|
| **coverage-gap** | A category is missing a canonical intensity bucket (`soft`/`medium`/`hard`) or has limited material variety |
| **redundancy** | A cluster of perceptually similar entries that could be pruned to a representative subset |
| **quality** | Clipping, silence, or out-of-bounds duration derived from analysis metrics |

### Usage

```bash
toneforge intelligence audit [--library <dir>] [--json]
```

- `--library <dir>` — library directory containing `index.json`
  (default: `.toneforge-library`)
- `--json` — emit a structured `AuditReport` to stdout

### Explainability contract

Every audit finding carries:

- `confidence` — a number in the closed interval `[0, 1]`;
- `rationale` — a human-readable explanation;
- `suggestedCommand` — an actionable, runnable `toneforge` command.

The report is **deterministic**: the same library input produces
byte-identical JSON (no wall-clock timestamps or random ordering).

### JSON shape

```jsonc
{
  "command": "intelligence audit",
  "version": "1.0",
  "library": "./library",
  "totalEntries": 48,
  "categories": ["footstep", "ui", "weapon"],
  "findings": [
    {
      "id": "audit-coverage-weapon-soft",
      "kind": "coverage-gap",
      "summary": "No soft intensity sounds in category 'weapon'",
      "assets": ["lib-weapon-laser-zap_seed-00001"],
      "confidence": 0.75,
      "rationale": "Category 'weapon' has 3 entries but none in the 'soft' intensity bucket...",
      "suggestedCommand": "toneforge explore sweep --recipe weapon-laser-zap --seed-range 0:99 --rank-by rms",
      "supportingMetrics": { "category": "weapon", "bucket": "soft", "entryCount": 3 }
    }
  ],
  "summary": {
    "entries": 48,
    "categories": 3,
    "coverageGaps": 4,
    "redundancies": 2,
    "qualityIssues": 1
  }
}
```

## `intelligence recommend`

Ranks library sounds for a natural-language use case. The use case is mapped
onto category, intensity, texture and tag preferences, then every entry is
scored and ranked deterministically.

### Usage

```bash
toneforge intelligence recommend --use-case <desc> [--max-results <n>] [--library <dir>] [--json]
```

- `--use-case <desc>` — natural-language use case (required)
- `--max-results <n>` — maximum recommendations (default: 5)
- `--library <dir>` — library directory (default: `.toneforge-library`)
- `--json` — emit a structured `RecommendReport`

Every recommendation carries a `confidence` in `[0, 1]` and a
human-readable `rationale` referencing the supporting labels/metrics, plus
an actionable command.

### JSON shape

```jsonc
{
  "command": "intelligence recommend",
  "version": "1.0",
  "useCase": "sci-fi menu navigation",
  "maxResults": 5,
  "recommendations": [
    {
      "rank": 1,
      "entryId": "lib-ui-scifi-confirm_seed-00042",
      "recipe": "ui-scifi-confirm",
      "seed": 42,
      "category": "ui",
      "score": 0.85,
      "confidence": 0.85,
      "rationale": "category 'ui' matches...; intensity 'soft' matches 'soft'; ...",
      "suggestedCommand": "toneforge library similar --id lib-ui-scifi-confirm_seed-00042 --limit 5"
    }
  ]
}
```

## `intelligence suggest-exploration`

Inspects how a recipe is represented in the library and suggests concrete
exploration targets: an adjacent seed window, a distant seed region for
diversity, and parameter jitter for tightly clustered entries.

### Usage

```bash
toneforge intelligence suggest-exploration --recipe <r> [--library <dir>] [--json]
```

- `--recipe <r>` — recipe to explore (required)
- `--library <dir>` — library directory (default: `.toneforge-library`)
- `--json` — emit a structured `SuggestExplorationReport`

Every suggestion names the recipe, gives an explicit seed range, a
`confidence` in `[0, 1]`, a `rationale`, and a runnable `toneforge explore`
command.

### JSON shape

```jsonc
{
  "command": "intelligence suggest-exploration",
  "version": "1.0",
  "recipe": "footstep-stone",
  "suggestions": [
    {
      "recipe": "footstep-stone",
      "seedRange": { "start": 51, "end": 150 },
      "confidence": 0.7,
      "rationale": "Current coverage spans seeds 1-50 (12 entries); explore the adjacent range 51-150...",
      "suggestedCommand": "toneforge explore sweep --recipe footstep-stone --seed-range 51:150 --rank-by rms"
    }
  ]
}
```

## Conformance harness

Every Intelligence engine is validated by one deterministic harness
(`src/intelligence/__tests__/conformance.test.ts`) against a committed
fixture library (`src/test-utils/fixtures/intelligence/`). The harness asserts:

1. **Determinism** — byte-identical output across two consecutive runs;
2. **Read-only** — the fixture library is byte-identical before/after running
   all three engines;
3. **JSON contract** — required keys and types for `audit`, `recommend` and
   `suggest-exploration`, with `confidence` always in `[0, 1]`;
4. **Plant detection** — the fixture really contains the coverage,
   redundancy and quality issues the audit is expected to find.

Run it with:

```bash
npx vitest run src/intelligence/__tests__/conformance.test.ts
```

## Examples

```bash
toneforge intelligence audit --library ./library
toneforge intelligence audit --library ./library --json
toneforge intelligence recommend --use-case "sci-fi menu navigation" --max-results 5
toneforge intelligence recommend --use-case "aggressive weapon" --json
toneforge intelligence suggest-exploration --recipe footstep-stone
toneforge intelligence suggest-exploration --recipe weapon-laser-zap --json
```
