# Intelligence conformance fixture library

A small, deterministic library used by the Intelligence conformance harness
(`src/intelligence/__tests__/conformance.test.ts`). It deliberately plants one
of each issue the audit engine is expected to find, plus entries the
recommendation and exploration engines can rank against.

This directory is a **read-only fixture**: every Intelligence engine must
leave it byte-identical. Do not regenerate it from code — edit it by hand so
that a regression in an engine cannot silently rewrite the expected input.

## Planted issues

| Issue | Where | Expected finding |
|-------|-------|------------------|
| Coverage gap (intensity) | `footstep` entries are all `medium` | `audit-coverage-footstep-soft`, `audit-coverage-footstep-hard` |
| Coverage gap (material) | `footstep` entries are all `stone` | `audit-coverage-footstep-materials` |
| Redundancy | Three `footstep-stone` entries with near-identical embeddings (`[0.1,0.1,0.1]`, `[0.101,0.1,0.1]`, `[0.1,0.101,0.1]`) | one redundancy cluster of size 3 |
| Quality (silence) | `lib-fixture-footstep-01` has `quality.silence = true` | `audit-quality-lib-fixture-footstep-01-silence` |
| Quality (clipping) | `lib-fixture-weapon-01` has `quality.clipping = true` | `audit-quality-lib-fixture-weapon-01-clipping` |

## Recipes represented

- `footstep-stone` — seeds 1–3 (tightly clustered)
- `weapon-laser-zap` — seed 42
- `ui-scifi-confirm` — seed 7
- `ui-notification-chime` — seed 11

## Determinism

The fixture contains no timestamps that vary between runs and the entries are
stored in a stable order, so the same engine input always produces the same
output.
