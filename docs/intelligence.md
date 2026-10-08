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

## Examples

```bash
toneforge intelligence audit --library ./library
toneforge intelligence audit --library ./library --json
```
