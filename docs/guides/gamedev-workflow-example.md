---
title: "Game Dev Workflow: Tableau Card Game SFX"
id: gamedev-workflow-example
order: 10
description: >
  A step-by-step CLI guide for discovering, authoring, iterating, and exporting
  game-ready sound assets for a tableau-style card game (high-street economy
  example). Produces verified WAVs at assets/sfx/tableau/<event>/.
---

## Introduction

This guide walks you through the complete ToneForge workflow for a **tableau-style
card game** set in a high-street economy — the kind where players buy market cards,
collect rent, upgrade properties, and take turns managing a shared board.

You will learn to:

1. **Discover** — find relevant card-game recipes using `list` and `search`
2. **Inspect** — preview and understand recipes and presets before committing
3. **Iterate** — vary seeds and tweak parameters to find the right sound
4. **Export** — render final WAV files to `assets/sfx/tableau/<event>/`
5. **Verify** — confirm that expected files landed at the correct paths

The five game events covered are:

| Event | Description | Output path |
|---|---|---|
| `tableau_play_card` | Player slides a card onto the market tableau | `assets/sfx/tableau/tableau_play_card/` |
| `coin_collect` | Player collects coins from income sources | `assets/sfx/tableau/coin_collect/` |
| `market_upgrade` | Player upgrades a market property | `assets/sfx/tableau/market_upgrade/` |
| `rent_collect` | Player collects rent from owned properties | `assets/sfx/tableau/rent_collect/` |
| `turn_end` | Current player's turn ends; board resets for next player | `assets/sfx/tableau/turn_end/` |

> **No audio is committed to the repository.** This guide shows you how to
> generate assets locally. The `assets/sfx/` tree is listed in `.gitignore`.

---

## Prerequisites

- **Node 16+** and **npm** installed (`node --version` should print v16 or higher)
- Repository checked out: `git clone <repo-url> && cd ToneForge`
- Dependencies installed: `npm install` (also runs `npm link` to put `toneforge` on PATH)
- Verify the CLI is available:

```bash
toneforge --version
```

If `toneforge` is not on PATH, use the loader script directly:

```bash
./bin/dev-cli.js --version
```

> All commands in this guide use `toneforge`. Substitute `./bin/dev-cli.js` or
> the short alias `tf` if your environment requires it.

**Related reading:**

- [`demos/card-game-sounds.md`](../../demos/card-game-sounds.md) — full discovery
  and export walkthrough for all 34 card-game recipes
- [`demos/recipe-filtering.md`](../../demos/recipe-filtering.md) — detailed guide
  to `--search`, `--category`, and `--tags` filter flags
- [`demos/sequencer.md`](../../demos/sequencer.md) — sequencer inspect/simulate/generate
- [`demos/sound-stacking.md`](../../demos/sound-stacking.md) — stack inspect/render

---

## Step 1 — Discover Available Recipes

> You just installed ToneForge and want to know which card-game recipes exist.

List all recipes, then filter to card-game sounds:

```bash
toneforge list recipes --category card-game
```

The table shows four columns — Recipe, Description, Category, Tags — with a count
footer confirming the total. All 34 card-game recipes are prefixed `card-`.

Narrow further with a keyword search:

```bash
toneforge list recipes --category card-game --search coin
```

Find all positive-feedback sounds tagged for economy events:

```bash
toneforge list recipes --tags economy
```

Get JSON output for scripting or piping to build tools:

```bash
toneforge list recipes --category card-game --json
```

> **Tip:** See [`demos/recipe-filtering.md`](../../demos/recipe-filtering.md) for
> a complete reference on `--search`, `--category`, and `--tags` filtering.

---

## Step 2 — Preview Candidate Sounds

> You see recipe names but names don't tell you what they sound like.

Preview any recipe directly — omit `--output` to play through speakers immediately:

```bash
toneforge generate --recipe card-slide --seed 42
toneforge generate --recipe card-place --seed 42
toneforge generate --recipe card-coin-collect --seed 42
toneforge generate --recipe card-token-earn --seed 42
toneforge generate --recipe card-round-complete --seed 42
```

Vary the seed to hear different takes of the same recipe:

```bash
toneforge generate --recipe card-coin-collect --seed 1
toneforge generate --recipe card-coin-collect --seed 2
toneforge generate --recipe card-coin-collect --seed 3
```

> Same recipe, different seeds → same character, different detail. Note the seed
> numbers you like — those are your reproducible sound briefs.

Inspect a recipe's metadata and concrete parameter values for a given seed:

```bash
toneforge show card-slide --seed 42
toneforge show card-coin-collect --seed 42
```

---

## Step 3 — Inspect Existing Presets

Two relevant presets ship with ToneForge that you will use as worked examples.

### Sequence preset: `tableau_play_card`

```bash
toneforge sequence inspect --preset presets/sequences/tableau_play_card.json
```

This sequence layers three events:
- **card-slide** at 0 ms — the card leaving the player's hand
- **card-place** at 220 ms — the landing impact on the tableau
- **card-glow** at 350 ms (80 % probability) — an optional magical shimmer

Simulate the timeline before rendering to verify timing:

```bash
toneforge sequence simulate --preset presets/sequences/tableau_play_card.json --seed 42
```

### Stack preset: `card_play_landing`

```bash
toneforge stack inspect --preset presets/stacks/card_play_landing.json
```

This stack layers:
- **card-slide** at 0 ms, gain 1.0
- **card-place** at 80 ms, gain 0.9
- **card-glow** at 180 ms, gain 0.55

> Sequences are temporal patterns where each event fires at a specific time from a
> single root seed. Stacks layer multiple recipes that play simultaneously (with
> small offsets) into one mixed buffer. Use sequences for events that unfold over
> time; use stacks for layered single-moment impacts.

---

## Step 4 — Iterate and Choose Seeds

> Before exporting, sweep a seed range to find the best version of each sound.

Sweep 20 seeds for `card-coin-collect` ranked by RMS loudness and brightness:

```bash
toneforge explore sweep --recipe card-coin-collect --seed-range 0:19 --keep-top 3 --rank-by rms,spectral-centroid --clusters 2
```

Listen to the top candidate seeds reported by the sweep:

```bash
toneforge generate --recipe card-coin-collect --seed 0
toneforge generate --recipe card-coin-collect --seed 7
```

Found a seed you like? Generate close variations around it:

```bash
toneforge explore mutate --recipe card-coin-collect --seed 7 --jitter 0.12 --count 6 --rank-by rms
```

Once you settle on a seed, note it — you will use the same seed in every export
command for reproducibility.

---

## Step 5 — Export: `tableau_play_card`

> Player slides a card from hand and places it onto the market tableau.

The existing sequence preset covers this event perfectly. Render it to the
target asset path:

```bash
mkdir -p assets/sfx/tableau/tableau_play_card

toneforge sequence generate \
  --preset presets/sequences/tableau_play_card.json \
  --seed 42 \
  --output assets/sfx/tableau/tableau_play_card/tableau_play_card.wav
```

Preview the result before committing to the path:

```bash
toneforge play assets/sfx/tableau/tableau_play_card/tableau_play_card.wav
```

---

## Step 6 — Export: `coin_collect`

> Player collects coins from income sources on the board.

The `economy_income` sequence covers the full coin-collection arc — token earn,
two coin-collect chimes, and a chip-stack rattle:

```bash
toneforge sequence inspect --preset presets/sequences/economy_income.json
```

Export it:

```bash
mkdir -p assets/sfx/tableau/coin_collect

toneforge sequence generate \
  --preset presets/sequences/economy_income.json \
  --seed 42 \
  --output assets/sfx/tableau/coin_collect/coin_collect.wav
```

If you prefer a lighter, single-chime version, export the recipe directly:

```bash
toneforge generate \
  --recipe card-coin-collect \
  --seed 42 \
  --output assets/sfx/tableau/coin_collect/coin_collect_light.wav
```

---

## Step 7 — Export: `market_upgrade`

> Player upgrades a market property — spending coins to level up a card slot.

The `market_buy_event` stack layers coin-spend, chip-stack rattle, and a card
slide to create a rich transactional sound:

```bash
toneforge stack inspect --preset presets/stacks/market_buy_event.json
```

Export it:

```bash
mkdir -p assets/sfx/tableau/market_upgrade

toneforge stack render \
  --preset presets/stacks/market_buy_event.json \
  --seed 42 \
  --output assets/sfx/tableau/market_upgrade/market_upgrade.wav
```

To hear a punchier power-up variant alongside the transaction:

```bash
toneforge generate \
  --recipe card-power-up \
  --seed 42 \
  --output assets/sfx/tableau/market_upgrade/market_upgrade_powerup.wav
```

---

## Step 8 — Export: `rent_collect`

> Player collects rent from properties they own on the board.

Rent collection is a recurring income moment — multiple coins, a sense of
accumulation. Use the `economy_income` sequence at a different seed to keep it
distinct from `coin_collect`:

```bash
mkdir -p assets/sfx/tableau/rent_collect

toneforge sequence generate \
  --preset presets/sequences/economy_income.json \
  --seed 77 \
  --output assets/sfx/tableau/rent_collect/rent_collect.wav
```

For a lighter single-token variant (e.g., partial rent):

```bash
toneforge generate \
  --recipe card-token-earn \
  --seed 77 \
  --output assets/sfx/tableau/rent_collect/rent_collect_token.wav
```

---

## Step 9 — Export: `turn_end`

> Current player's turn ends; cards return to deck and the board resets.

The `round_end_cleanup` sequence covers this perfectly — round-complete chime,
cards return to deck, then shuffle for the next round:

```bash
toneforge sequence inspect --preset presets/sequences/round_end_cleanup.json
```

Export it:

```bash
mkdir -p assets/sfx/tableau/turn_end

toneforge sequence generate \
  --preset presets/sequences/round_end_cleanup.json \
  --seed 42 \
  --output assets/sfx/tableau/turn_end/turn_end.wav
```

For a shorter turn-transition cue (no full shuffle):

```bash
toneforge stack render \
  --preset presets/stacks/turn_transition_stack.json \
  --seed 42 \
  --output assets/sfx/tableau/turn_end/turn_end_transition.wav
```

---

## Step 10 — Verify Exported Assets

> Confirm all required WAV files are present at the correct paths.

List the directory tree:

```bash
ls -lR assets/sfx/tableau/
```

Expected output (minimum required files):

```
assets/sfx/tableau/
  coin_collect/
    coin_collect.wav
  market_upgrade/
    market_upgrade.wav
  rent_collect/
    rent_collect.wav
  tableau_play_card/
    tableau_play_card.wav
  turn_end/
    turn_end.wav
```

Check that each required file exists and is non-empty:

```bash
for f in \
  assets/sfx/tableau/tableau_play_card/tableau_play_card.wav \
  assets/sfx/tableau/coin_collect/coin_collect.wav \
  assets/sfx/tableau/market_upgrade/market_upgrade.wav \
  assets/sfx/tableau/rent_collect/rent_collect.wav \
  assets/sfx/tableau/turn_end/turn_end.wav; do
  if [ -s "$f" ]; then
    echo "OK  $f"
  else
    echo "MISSING $f"
  fi
done
```

Generate checksums for reproducibility verification. The helper script writes
checksums to `scripts/tableau-checksums.sha256` — a tracked file you can
commit so CI can verify re-runs produce byte-identical output:

```bash
sha256sum \
  assets/sfx/tableau/tableau_play_card/tableau_play_card.wav \
  assets/sfx/tableau/coin_collect/coin_collect.wav \
  assets/sfx/tableau/market_upgrade/market_upgrade.wav \
  assets/sfx/tableau/rent_collect/rent_collect.wav \
  assets/sfx/tableau/turn_end/turn_end.wav \
  > scripts/tableau-checksums.sha256

cat scripts/tableau-checksums.sha256
```

Verify against saved checksums at any time:

```bash
sha256sum --check scripts/tableau-checksums.sha256
```

> **Reproducibility guarantee:** ToneForge is fully deterministic. The same
> preset file + same seed always produces byte-identical WAV output, on any
> machine, across any number of runs. If `sha256sum --check` fails after
> regenerating, verify that you used the same preset file and seed value.

---

## Quick-Export Script

For convenience, a helper script is provided at `scripts/generate-tableau-example.sh`
that runs all five export commands in one shot:

```bash
bash scripts/generate-tableau-example.sh
```

The script creates all output directories, renders each event at the canonical
seed, and prints a checksum summary at the end. No audio is played — it runs
headlessly and is safe to use in CI.

---

## Naming Conventions

| Convention | Example |
|---|---|
| Event directory | `assets/sfx/tableau/<event_name>/` |
| Primary WAV | `<event_name>.wav` (seed 42) |
| Variant WAV | `<event_name>_<variant>.wav` (e.g. `_light`, `_powerup`, `_token`) |
| Preset reference | `presets/sequences/<name>.json` or `presets/stacks/<name>.json` |
| Seed for primary | 42 (canonical default for all primary exports) |
| Seed for variants | Document in commit message or preset comment |

---

## Recap

| Step | Command | What it does |
|---|---|---|
| Discover | `toneforge list recipes --category card-game` | List all 34 card-game recipes |
| Search | `toneforge list recipes --search coin` | Keyword search across all fields |
| Preview | `toneforge generate --recipe <name> --seed <n>` | Play through speakers instantly |
| Inspect | `toneforge show <recipe> --seed <n>` | View metadata and parameter values |
| Inspect preset | `toneforge sequence inspect --preset <file>` | View sequence structure |
| Simulate | `toneforge sequence simulate --preset <file> --seed <n>` | Show expanded timeline |
| Iterate | `toneforge explore sweep --recipe <name> --seed-range 0:19` | Rank seeds by metrics |
| Export sequence | `toneforge sequence generate --preset <file> --seed <n> --output <file>` | Render sequence to WAV |
| Export stack | `toneforge stack render --preset <file> --seed <n> --output <file>` | Render stack to WAV |
| Export recipe | `toneforge generate --recipe <name> --seed <n> --output <file>` | Render single recipe to WAV |
| Verify | `ls -lR assets/sfx/tableau/` | Confirm files exist at expected paths |
| Checksum | `sha256sum --check assets/sfx/tableau/checksums.sha256` | Verify reproducibility |

ToneForge's deterministic engine means the same commands always produce the same
sounds. Discover with confidence, iterate quickly, and export reproducible WAVs
into your game project.
