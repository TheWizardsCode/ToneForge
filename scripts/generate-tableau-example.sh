#!/usr/bin/env bash
# Helper script to generate example tableau sounds into assets/sfx/tableau/
# By default the script runs in dry-run mode and only prints the commands it would run.
# To actually generate audio set RUN=1 in the environment: `RUN=1 bash scripts/generate-tableau-example.sh`

set -euo pipefail

RUN=${RUN:-0}

ROOT_DIR=$(dirname "$0")/..
ROOT_DIR=$(cd "$ROOT_DIR" && pwd)

OUTDIR="$ROOT_DIR/assets/sfx/tableau"

mkdir -p "$OUTDIR/{tableau_play_card,coin_collect,market_upgrade,rent_collect,turn_end}"

echo "Target output dir: $OUTDIR"

cmds=(
  "toneforge sequence generate --preset presets/sequences/tableau_play_card.json --seed 42 --output $OUTDIR/tableau_play_card/tableau_play_card_v1.wav --duration 1.5"
  "toneforge sequence generate --preset presets/sequences/tableau_coin_collect.json --seed 7 --output $OUTDIR/coin_collect/coin_collect_plain_v1.wav --duration 0.8"
  "toneforge stack render --preset presets/stacks/card_play_landing.json --seed 11 --output $OUTDIR/tableau_play_card/landing_v1.wav --duration 0.6"
)

echo
echo "Commands to run:"
for c in "${cmds[@]}"; do
  echo "  $c"
done

if [ "$RUN" != "1" ]; then
  echo
  echo "Dry-run mode (no audio will be generated)."
  echo "To execute and generate audio set RUN=1, e.g."
  echo "  RUN=1 bash $0"
  exit 0
fi

echo
echo "Executing..."
for c in "${cmds[@]}"; do
  echo "+ $c"
  # shellcheck disable=SC2086
  eval "$c"
done

echo
echo "Generation complete. Checksums:"
find "$OUTDIR" -type f -name "*.wav" -print0 | xargs -0 sha256sum || true

echo
echo "Summary per event:"
for e in tableau_play_card coin_collect market_upgrade rent_collect turn_end; do
  count=$(ls -1 "$OUTDIR/$e" 2>/dev/null | wc -l || true)
  echo "$e: $count files"
done

echo
echo "Reminder: do NOT commit generated audio. Commit only presets and this script."
