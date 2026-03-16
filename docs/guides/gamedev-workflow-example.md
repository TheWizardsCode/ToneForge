# ToneForge CLI: Game‑dev Workflow (Tableau Card Game)

This short, copy‑pasteable CLI guide shows how to discover, author, iterate, and export game‑ready sounds for a tableau‑style card game. Commands assume you have the ToneForge CLI installed and the repository checked out.

## Prerequisites

- Node 16+ and npm
- ToneForge CLI on PATH (e.g. `npm install` and `npm run build` or `npm link`)
- Working repository checkout

These prerequisites ensure the ToneForge CLI and local environment can execute the commands in this guide; missing them will cause generation or playback to fail.

## Conventions

- Export path: `assets/sfx/tableau/<event>/<name>.wav`
- Events used in examples: `tableau_play_card`, `coin_collect`, `market_upgrade`, `rent_collect`, `turn_end`

Following consistent naming and export locations makes it simple for game code, CI, and artists to find and validate generated assets.

## Discovery — find recipes and presets

Finding existing recipes and presets helps you identify reusable sounds and reduces duplication; use these commands to explore the registry and narrow choices before authoring.

Display available recipes and presets (implemented CLI):
```bash
# list all registered recipes (default resource)
toneforge list

# list recipes explicitly
toneforge list recipes

# search by keyword or category
toneforge list recipes --search "tableau"
toneforge list recipes --category "card-game"
```

## Preview / quick play (safe, ephemeral)

Quick previews let you validate changes without producing committed assets — iterate rapidly by generating short samples and listening before doing batch renders.

Create a short preview of an existing preset and play it using `toneforge play` (the CLI writes a file then plays it):
```bash
# sequence preset -> use `sequence generate`
toneforge sequence generate --preset presets/sequences/tableau_play_card.json --seed 42 --output /tmp/preview_tableau.wav --duration 1.5

# play via ToneForge's playback helper (or fallback message)
toneforge play /tmp/preview_tableau.wav || echo "preview written to /tmp/preview_tableau.wav"

# stack preset -> use `stack render` (example)
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
