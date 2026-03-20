# ToneForge CLI: Game‑dev Workflow (Tableau Card Game)

This short, copy‑pasteable CLI guide shows how to discover, author, iterate, and export game‑ready sounds for a tableau‑style card game. Commands assume you have the ToneForge CLI installed and the repository checked out.

## Definitions

- **Recipe:** A registered generator/orchestration invoked with `toneforge generate --recipe <name>`; it describes the process used to produce sounds (the workflow), not the final artifact. These are parameterized and can be customized and varied when played back.
- **Stack:** A layered combination of sources/effects defined in a stack preset, used for multi-layered or composite sounds. The sounds within a stack can be offset in time and mixed together, making them ideal for things like character actions or environmental sounds where multiple elements combine to create a richer effect.
- **Sequence:** A timed series of sound events defined in a sequence preset, typically used for single-shot or short, ordered sounds. Particularly usefule for things like weapon bursts, UI feedback, or short musical cues in which there are distinct sounds that need to play at specific times relative to each other.
- **Preview:** An ephemeral render played in-memory (omit `--output`) or written to a temporary file for auditioning; previews are for iteration, not canonical exports.

## Conventions

- Export path: `assets/sfx/tableau/<event>/<name>.wav`
- Events used in examples: `tableau_play_card`, `coin_collect`, `market_upgrade`, `rent_collect`, `turn_end`

Following consistent naming and export locations makes it simple for game code, CI, and artists to find and validate generated assets.

## Discovery — Recipes

Finding existing recipes helps you identify reusable, registered render flows and reduces duplication; explore recipes first to see if a ready-made generator fits your needs.

Display available recipes (implemented CLI):
```bash
# list all registered recipes (default resource)
toneforge list

# list recipes explicitly
toneforge list recipes

# search by keyword or category
toneforge list recipes --search "tableau"
toneforge list recipes --category "card-game"
```

## Preview Recipes — audition registered recipes

Audit a registered recipe before exporting assets. When you omit `--output` the CLI will render and play in memory (no WAV written).

```bash
# Play a registered recipe (renders and plays in memory)
toneforge generate --recipe ui-scifi-confirm --seed 42
```

## Discovery — Presets

Preset files (JSON) capture concrete parameter sets for sequences and stacks. Listing them helps you find editable files you can preview or version.

```bash
# list sequence presets
ls -1 presets/sequences/*.json || true

# list stack presets
ls -1 presets/stacks/*.json || true

# or show all preset files recursively
find presets -type f -name "*.json" -print
```

## Preview Presets — audition sequence & stack presets

Preview presets to validate parameters before committing or batch-rendering. For quick, ephemeral checks you can either play in-memory (omit `--output`) or write a temporary preview file and play it back.

In-memory playback (no file written):
```bash
# Play a sequence preset (renders and plays in memory)
toneforge sequence generate --preset presets/sequences/tableau_play_card.json --seed 42

# Play a stack preset (renders and plays in memory)
toneforge stack render --preset presets/stacks/card_play_landing.json --seed 42
```

Temporary preview files (safe, ephemeral):
```bash
# write a short preview file from a sequence preset
toneforge sequence generate --preset presets/sequences/tableau_play_card.json --seed 42 --output /tmp/preview_tableau.wav --duration 1.5

# play via ToneForge's playback helper (or fallback message)
toneforge play /tmp/preview_tableau.wav || echo "preview written to /tmp/preview_tableau.wav"

# stack preset -> write and preview
toneforge stack render --preset presets/stacks/card_play_landing.json --seed 42 --output /tmp/preview_landing.wav --duration 0.6
```

## Authoring — create or tweak a preset

Authoring presets (JSON files) is the canonical way to capture repeatable parameter sets; since the CLI lacks a create helper, editing presets directly keeps changes explicit and versionable.

The CLI does not implement a top-level `recipes create` helper. Author presets by adding or copying JSON files under `presets/sequences/` (for timed sequences) or `presets/stacks/` (for layer/stack definitions), then use the corresponding `sequence generate` or `stack render` commands.

Example: copy an existing sequence preset and edit it:
```bash
# create a new preset by copying an existing one (safe starting point)
mkdir -p presets/sequences
cp presets/sequences/tableau_play_card.json presets/sequences/tableau_coin_collect.json

# open in your editor and tweak parameters
${EDITOR:-vi} presets/sequences/tableau_coin_collect.json
```

After editing, render with `sequence generate` (or `stack render` for stacks). There is no generic `--overrides` flag implemented for ad-hoc parameter overrides; edit the JSON then re-run the generate/render command to test changes.

## Iteration — batch renders for multiple events/names

Batch renders produce the canonical assets you ship with the game; this section shows how to generate per-event files in the expected folder structure so they can be consumed by the build/QA process.

Create the export directory and render canonical files (use the implemented subcommands `sequence generate`, `stack render`, or `generate --recipe` where appropriate):
```bash
# make sure target directories exist
mkdir -p assets/sfx/tableau/{tableau_play_card,coin_collect,market_upgrade,rent_collect,turn_end}

# sequence preset -> generate a single file
toneforge sequence generate --preset presets/sequences/tableau_play_card.json --seed 42 --output assets/sfx/tableau/tableau_play_card/tableau_play_card_v1.wav --duration 1.5

# if you authored a new sequence preset (coin collect) use sequence generate as well
toneforge sequence generate --preset presets/sequences/tableau_coin_collect.json --seed 7 --output assets/sfx/tableau/coin_collect/coin_collect_plain_v1.wav --duration 0.8

# stack preset -> render a stacked/layered sound
toneforge stack render --preset presets/stacks/card_play_landing.json --seed 11 --output assets/sfx/tableau/tableau_play_card/landing_v1.wav --duration 0.6
```

## Export verification

Verification commands confirm that renders completed successfully and provide checksums for reproducibility or CI gating; run these as a quick smoke test after generation.

Simple checks to ensure files were written and names match expectations:
```bash
# list files (recursive)
ls -l assets/sfx/tableau || true

# checksum (sha256) each exported file (if sha256sum available)
find assets/sfx/tableau -type f -name "*.wav" -print0 | xargs -0 sha256sum || true

# simple verification helper: ensure at least one file exists per event
for e in tableau_play_card coin_collect market_upgrade rent_collect turn_end; do
  count=$(ls -1 assets/sfx/tableau/$e 2>/dev/null | wc -l || true)
  echo "$e: $count files"
done
```

## Notes & CI

Small practices to keep generation reproducible and CI-friendly; these notes help you ensure builds are deterministic and avoid checking generated audio into source control.

- Keep audio generation reproducible by pinning the ToneForge CLI version in `package.json` and recording the `node`/`npm` versions in CI logs.
- In CI, run the render steps and then verify with the `find`/`sha256sum` checks above; fail the job if expected files are missing.
- Do NOT commit generated audio. Commit only presets/recipes and the guide.

## References

- demos/card-game-sounds.md
- demos/recipe-filtering.md
- presets/sequences/tableau_play_card.json
- presets/stacks/card_play_landing.json
