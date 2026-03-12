#!/usr/bin/env bash
# scripts/generate-tableau-example.sh
#
# Generates all five tableau card-game SFX events for the high-street economy
# example and writes WAVs to assets/sfx/tableau/<event>/.
#
# Usage:
#   bash scripts/generate-tableau-example.sh
#
# Prerequisites:
#   - toneforge CLI on PATH (run `npm install` from the repo root)
#   - No audio hardware required — all commands write to disk only
#
# Output:
#   assets/sfx/tableau/tableau_play_card/tableau_play_card.wav
#   assets/sfx/tableau/coin_collect/coin_collect.wav
#   assets/sfx/tableau/market_upgrade/market_upgrade.wav
#   assets/sfx/tableau/rent_collect/rent_collect.wav
#   assets/sfx/tableau/turn_end/turn_end.wav
#
# See docs/guides/gamedev-workflow-example.md for the full workflow guide.

set -euo pipefail

SEED=42
RENT_SEED=77
BASE_DIR="assets/sfx/tableau"

echo "=== ToneForge Tableau Example Generator ==="
echo "Output root: $BASE_DIR"
echo ""

# ---------------------------------------------------------------------------
# tableau_play_card — card slides from hand and lands on the market tableau
# ---------------------------------------------------------------------------
EVENT="tableau_play_card"
OUTDIR="$BASE_DIR/$EVENT"
mkdir -p "$OUTDIR"
echo "Rendering $EVENT ..."
toneforge sequence generate \
  --preset presets/sequences/tableau_play_card.json \
  --seed "$SEED" \
  --output "$OUTDIR/$EVENT.wav"
echo "  -> $OUTDIR/$EVENT.wav"

# ---------------------------------------------------------------------------
# coin_collect — player collects coins from income sources on the board
# ---------------------------------------------------------------------------
EVENT="coin_collect"
OUTDIR="$BASE_DIR/$EVENT"
mkdir -p "$OUTDIR"
echo "Rendering $EVENT ..."
toneforge sequence generate \
  --preset presets/sequences/economy_income.json \
  --seed "$SEED" \
  --output "$OUTDIR/$EVENT.wav"
echo "  -> $OUTDIR/$EVENT.wav"

# Light single-chime variant
toneforge generate \
  --recipe card-coin-collect \
  --seed "$SEED" \
  --output "$OUTDIR/${EVENT}_light.wav"
echo "  -> $OUTDIR/${EVENT}_light.wav"

# ---------------------------------------------------------------------------
# market_upgrade — player upgrades a market property (spends coins)
# ---------------------------------------------------------------------------
EVENT="market_upgrade"
OUTDIR="$BASE_DIR/$EVENT"
mkdir -p "$OUTDIR"
echo "Rendering $EVENT ..."
toneforge stack render \
  --preset presets/stacks/market_buy_event.json \
  --seed "$SEED" \
  --output "$OUTDIR/$EVENT.wav"
echo "  -> $OUTDIR/$EVENT.wav"

# Power-up accent variant
toneforge generate \
  --recipe card-power-up \
  --seed "$SEED" \
  --output "$OUTDIR/${EVENT}_powerup.wav"
echo "  -> $OUTDIR/${EVENT}_powerup.wav"

# ---------------------------------------------------------------------------
# rent_collect — player collects rent from properties they own
# ---------------------------------------------------------------------------
EVENT="rent_collect"
OUTDIR="$BASE_DIR/$EVENT"
mkdir -p "$OUTDIR"
echo "Rendering $EVENT ..."
toneforge sequence generate \
  --preset presets/sequences/economy_income.json \
  --seed "$RENT_SEED" \
  --output "$OUTDIR/$EVENT.wav"
echo "  -> $OUTDIR/$EVENT.wav"

# Single-token variant (partial rent)
toneforge generate \
  --recipe card-token-earn \
  --seed "$RENT_SEED" \
  --output "$OUTDIR/${EVENT}_token.wav"
echo "  -> $OUTDIR/${EVENT}_token.wav"

# ---------------------------------------------------------------------------
# turn_end — current player's turn ends, board resets for next player
# ---------------------------------------------------------------------------
EVENT="turn_end"
OUTDIR="$BASE_DIR/$EVENT"
mkdir -p "$OUTDIR"
echo "Rendering $EVENT ..."
toneforge sequence generate \
  --preset presets/sequences/round_end_cleanup.json \
  --seed "$SEED" \
  --output "$OUTDIR/$EVENT.wav"
echo "  -> $OUTDIR/$EVENT.wav"

# Short transition variant (no full shuffle)
toneforge stack render \
  --preset presets/stacks/turn_transition_stack.json \
  --seed "$SEED" \
  --output "$OUTDIR/${EVENT}_transition.wav"
echo "  -> $OUTDIR/${EVENT}_transition.wav"

# ---------------------------------------------------------------------------
# Verify all required files exist and are non-empty
# ---------------------------------------------------------------------------
echo ""
echo "=== Verification ==="
REQUIRED=(
  "assets/sfx/tableau/tableau_play_card/tableau_play_card.wav"
  "assets/sfx/tableau/coin_collect/coin_collect.wav"
  "assets/sfx/tableau/market_upgrade/market_upgrade.wav"
  "assets/sfx/tableau/rent_collect/rent_collect.wav"
  "assets/sfx/tableau/turn_end/turn_end.wav"
)

ALL_OK=true
for f in "${REQUIRED[@]}"; do
  if [ -s "$f" ]; then
    echo "OK      $f"
  else
    echo "MISSING $f"
    ALL_OK=false
  fi
done

# ---------------------------------------------------------------------------
# Generate checksums for reproducibility
# Written to scripts/ so the file can be committed and used by CI to verify
# that re-running the script produces byte-identical output.
# ---------------------------------------------------------------------------
echo ""
echo "=== Checksums ==="
CHECKSUM_FILE="scripts/tableau-checksums.sha256"
sha256sum "${REQUIRED[@]}" | tee "$CHECKSUM_FILE"

echo ""
if [ "$ALL_OK" = true ]; then
  echo "All required files generated successfully."
else
  echo "ERROR: One or more required files are missing or empty."
  exit 1
fi
