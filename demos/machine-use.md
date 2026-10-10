---
title: "Machine Use: JSON-Driven Reporting for Sound Discovery"
id: machine-use
order: 99
description: >
  A walkthrough demonstrating how to consume ToneForge's --json output
  programmatically to build an automated reporting script that discovers
  available sounds in a category while filtering out already-used ones.
---

## Intro

You are building a card game and need to select placeholder sounds from
ToneForge's recipe library. You have already used several sounds in your
project and want to discover new candidates without manually cross-checking
a spreadsheet of what you have already placed.

ToneForge's CLI exposes `--json` on its commands so that machines and
agents can consume structured output. This walkthrough shows how to build
a small reporting script that:

1. Lists all recipes in a chosen category as JSON.
2. Reads your already-used sounds from a simple text file.
3. Filters out the used sounds and reports the remaining candidates.
4. Outputs a human-readable summary by default, or a structured JSON
   report when invoked with `--json` for further tooling.

This pattern — CLI as data source, bash script as orchestrator, Node.js
for JSON parsing — lets you compose ToneForge into larger automation
pipelines without adding any new runtime dependencies.

## Act 1 — Explore the category

> You are working on a card game and want to see all the Card Game
> category recipes ToneForge provides.

First, let's see the full JSON output for the Card Game category:

```bash
toneforge list recipes --category card-game --json
```

> [!commentary]
> The output is a JSON object with the following shape:
>
> ```json
> {
>   "command": "list",
>   "resource": "recipes",
>   "total": 35,
>   "recipes": [
>     {
>       "name": "card-flip",
>       "description": "Stylized card flip sound...",
>       "category": "Card Game",
>       "tags": ["card", "flip", "card-game", ...]
>     },
>     ...
>   ]
> }
> ```
>
> The `recipes` array contains one object per recipe with `name`,
> `description`, `category`, and `tags`. The `total` field tells you
> how many recipes exist in the full registry (before filtering).
>
> The `--category` flag normalises the input — `card-game`,
> `Card Game`, and `CARD_GAME` all match the same category.

You can also view the human-readable table by omitting `--json`:

```bash
toneforge list recipes --category card-game
```

> [!commentary]
> The text output shows a compact table with Recipe, Description,
> Category, and Tags columns. No JSON — just formatted text, suitable
> for human consumption in a terminal.

## Act 2 — Discover what you have already used

> You have placed several Card Game sounds in your project and want
> to track which ones are "used" so the reporting script skips them.

Create a plain text file listing the recipe names you have already
used — one per line. ToneForge ships with a committed fixture you can
use as a starting point:

```bash
cat demos/fixtures/used-sounds.txt
```

> [!commentary]
> The fixture contains nine recipe names, one per line:
> `card-flip`, `card-slide`, `card-place`, `card-draw`, `card-shuffle`,
> `card-success`, `card-failure`, `card-victory-fanfare`, and
> `card-defeat-sting`. Add or remove names from this file as your
> project evolves.

Any plain text file with one recipe name per line works — the script
does not require a specific format or tool to generate it.

## Act 3 — Run the reporting script (human-readable)

> Now let's see which Card Game recipes are still available — the ones
> not in your used-sounds list.

The reporting script `scripts/report-available-sounds.sh` does the work:

```bash
scripts/report-available-sounds.sh
```

> [!commentary]
> The script produces a human-readable report:
>
> ```
> === Available Sounds Report ===
> Category:        card-game
> Total recipes:   35
> Already used:    9
> Remaining:       26
>
> Remaining candidates:
>   - card-fan
>   - card-round-complete
>   - card-coin-collect
>   - ...
> ```
>
> It resolved the `toneforge` CLI automatically (falling back to
> `npx --prefix <repo-root> toneforge` when `toneforge` is not on
> your `PATH`), fetched the JSON output for the `card-game` category,
> filtered against your used-sounds list, and printed the result.
>
> By default it uses the `card-game` category and the fixture at
> `demos/fixtures/used-sounds.txt`. You can override both:
>
> ```bash
> scripts/report-available-sounds.sh --category ui --used-sounds my-used.txt
> ```

## Act 4 — Run the reporting script (JSON report)

> For automation pipelines and agent tooling, you need structured
> output. Invoke the script with `--json`:

```bash
scripts/report-available-sounds.sh --json
```

> [!commentary]
> The JSON report has this shape:
>
> ```json
> {
>   "command": "report-available-sounds",
>   "category": "card-game",
>   "total": 35,
>   "used": 9,
>   "remaining": 26,
>   "candidates": [
>     {
>       "name": "card-fan",
>       "description": "Smooth card fanning sound...",
>       "category": "Card Game",
>       "tags": ["card", "fan", "card-game", "manipulation", "tonal", "arcade"]
>     },
>     ...
>   ]
> }
> ```
>
> Every field is deterministic and machine-readable. The `candidates`
> array contains only the recipes that were NOT in your used-sounds
> list. Each candidate carries `name`, `description`, `category`, and
> `tags` — the same fields as the source CLI output.

## Act 5 — Compose with further tooling

> The JSON report from the previous step can be fed directly into
> downstream tooling — for example, a generation queue that picks
> the remaining candidates and generates WAV files for auditioning:

```bash
# Inspect the first available candidate, then generate it
scripts/report-available-sounds.sh --json | \
  node -e "
    const report = JSON.parse(require('fs').readFileSync('/dev/stdin','utf8'));
    const first = report.candidates[0];
    console.log('First available:', first.name);
  "
```

> [!commentary]
> The reporting script produces structured output that Node.js can
> parse directly — no `jq`, no `grep`, no fragile text scraping. The
> first available candidate in the fixture-backed example is
> `card-fan`.

Now generate the WAV for that candidate so it can be auditioned:

```bash
toneforge generate --recipe card-fan --seed 1 --output ./output/card-game/
```

> [!commentary]
> A `card-fan-seed-1.wav` file appears in `./output/card-game/`.
> Because the reporting script already filtered out your used sounds,
> you only ever spend time generating candidates you have not placed
> yet — no wasted renders on sounds already in your project.
>
> You can compose the whole pipeline: report the available sounds,
> iterate over the candidates, and generate each one. The same JSON
> can drive a CI job that updates an asset manifest, or an agent that
> queues generation tasks:
>
> ```bash
> scripts/report-available-sounds.sh --json | \
>   node -e "
>     const report = JSON.parse(require('fs').readFileSync('/dev/stdin','utf8'));
>     report.candidates.forEach(c => console.log(c.name));
>   "
> ```
>
> The key insight: `toneforge --json` gives you structured data that
> any scripting language or tool can consume, and `scripts/report-
> available-sounds.sh` turns that into a reusable, testable batch
> script.

> [!commentary]
> **Human output is unchanged.** Omitting `--json` from any of these
> commands still produces the original human-readable output — the
> reporting script only adds a machine-readable layer on top of the
> existing CLI contract.

## Act 6 — Verify with the integration test

> The reporting script comes with an automated integration test that
> validates filtering correctness, JSON validity, field presence, and
> the empty-result path (when every recipe is already used). Run it
> with:

```bash
npx vitest run src/demo/machine-use.integration.test.ts
```

> [!commentary]
> The test suite includes:
>
> - **Script existence** — verifies the script file exists with the
>   executable bit set.
> - **Fixture validation** — confirms the used-sounds fixture is
>   present and contains recipe names.
> - **Filtering correctness** — checks that used recipes are excluded
>   from the output and non-used recipes are included.
> - **JSON validity** — parses the `--json` output and asserts all
>   required fields (`command`, `category`, `total`, `used`,
>   `remaining`, `candidates`) are present with correct types.
> - **Empty-result path** — when all recipes in a category are
>   already used, the script exits 0 (not an error).
> - **Error handling** — a missing used-sounds file exits non-zero
>   with a clear diagnostic message.
>
> These tests act as a regression guard on the `list recipes --json`
> contract: if the CLI changes its output shape, this test suite will
> catch it.

## Summary

You have built a machine-use demo that demonstrates:

1. **Structured data from the CLI** — `toneforge list recipes --json`
   provides a stable, parseable JSON format that external tools can
   consume.
2. **Reusable batch scripts** — `scripts/report-available-sounds.sh`
   turns CLI output into a filtering report, with both human-readable
   and structured JSON output modes.
3. **No new dependencies** — the script uses only Node.js (already a
   project dependency) for JSON parsing; `jq` is not required.
4. **Automated regression testing** — the integration test ensures the
   script works correctly and guards against CLI output changes.

The same pattern — CLI as data source, script as orchestrator, JSON
as the interchange format — can be applied to any ToneForge command
that supports `--json`, enabling agents and automation authors to
build powerful pipelines on top of the CLI.
