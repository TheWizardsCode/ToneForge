# Intent & Memory

ToneForge **Intent** and **Memory** are advisory modules that keep the human
in control: Intent expresses *what a person wants*, Memory remembers *what
happened and what mattered*. Neither mutates library or asset data on its
own.

- Intent is specified by [INTENT_PRD.md](prd/INTENT_PRD.md).
- Memory is specified by [MEMORY_PRD.md](prd/MEMORY_PRD.md).
- Demo narrative: [DEMO_ROADMAP.md](prd/DEMO_ROADMAP.md) §Demo 14.

## Intent

An Intent is a structured, inspectable expression of a goal:

```json
{
  "intent": "reduce_repetition",
  "scope": "footsteps",
  "priority": "medium",
  "constraints": { "preserve_style": true }
}
```

### `toneforge intent submit`

```bash
toneforge intent submit --goal "reduce repetition in footstep sounds" --scope footsteps
toneforge intent submit --intent calm_ui --scope ui --approve
toneforge intent submit --goal "heavier impact" --scope weapon --json
```

- `--goal` is mapped to a structured intent by a **deterministic** keyword/rule
  match over a controlled vocabulary. There is no NLP or LLM inference.
- `--intent <id>` selects an intent explicitly (validated against the
  vocabulary).
- `--priority`, `--constraint key=value` refine the resolved intent.
- `toneforge intent vocabulary` lists the controlled vocabulary.

### Approval gate

Intent submission routes through Intelligence and **never executes an action
without explicit human approval**:

- `--dry-run` never executes anything.
- Non-interactive / `--json` runs print suggestions only unless `--approve` is
  passed.
- Interactive runs prompt per suggestion and execute only confirmed commands.

Every suggestion references an actionable, runnable `toneforge` command.

## Memory

Memory is an **append-only, project-local** record of experience, stored as
JSONL at `.toneforge/memory/memory.jsonl`. Entries are versioned, timestamped
and attributable, and are tagged with a category (usage, preference, quality,
evolution, contextual).

### `toneforge memory query`

```bash
toneforge memory query --scope footsteps
toneforge memory query --scope ui --time-range 2026-02-01:2026-02-28 --json
```

The report is deterministic and scope/time-filtered, and includes counts of
generated / promoted / rejected, most-used seeds, rejected intents with
reasons, a quality trend, and recurring issues. Queries are **read-only**.

### `toneforge memory export` / `toneforge memory clear`

```bash
toneforge memory export --json
toneforge memory clear
```

`export` emits every record; `clear` is the only destructive operation and
must be invoked explicitly.

## Memory-aware Intelligence

Intelligence commands accept `--use-memory`. When supplied, they additively
include historical context (over-represented seeds, previously rejected
suggestions) and remain deterministic for identical library + memory inputs.
Without `--use-memory` the output is unchanged.

```bash
toneforge intelligence recommend --use-case "calm ui menu" --use-memory
```

## Privacy & opt-out

- Memory is **project-local** by default — there is no global or cross-user
  memory and no cross-project leakage.
- No personal data is stored.
- Memory can be exported or cleared at any time; deleting
  `.toneforge/memory/memory.jsonl` opts the project out of memory entirely.
