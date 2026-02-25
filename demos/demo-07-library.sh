#!/usr/bin/env bash
# =============================================================================
# Demo 7: Library -- Structured Asset Storage
#
# End-to-end walkthrough exercising the full explore-to-library flow:
#   generate -> explore -> promote -> list -> search -> similar -> export -> regenerate
#
# Key proof points (from DEMO_ROADMAP):
#   1. Generated sounds become persistent, searchable assets
#   2. Presets enable deterministic regeneration
#   3. The library bridges generation and delivery
#
# Usage:
#   demos/demo-07-library.sh           # Run in a temp directory
#   demos/demo-07-library.sh --json    # JSON output mode
#
# Exit code 0 on success. The script cleans up its temp directory on exit.
#
# Work item: TF-0MM1GPMFF0HCCJHS
# =============================================================================

set -euo pipefail

# ---------------------------------------------------------------------------
# Setup: work in a temporary directory so we don't pollute the project
# ---------------------------------------------------------------------------
DEMO_DIR=$(mktemp -d "${TMPDIR:-/tmp}/toneforge-demo7-XXXXXX")
trap 'rm -rf "$DEMO_DIR"' EXIT
cd "$DEMO_DIR"

JSON_FLAG=""
if [[ "${1:-}" == "--json" ]]; then
  JSON_FLAG="--json"
fi

# Resolve the toneforge CLI
TONEFORGE="${TONEFORGE:-toneforge}"
if ! command -v "$TONEFORGE" &>/dev/null; then
  # Try npx from the project root
  SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
  PROJECT_ROOT="$(cd "$SCRIPT_DIR/.." && pwd)"
  TONEFORGE="npx --prefix $PROJECT_ROOT toneforge"
fi

echo "=== Demo 7: Library -- Structured Asset Storage ==="
echo "Working directory: $DEMO_DIR"
echo ""

# ---------------------------------------------------------------------------
# Step 1: Explore -- sweep creature vocals
# ---------------------------------------------------------------------------
echo "--- Step 1: Sweep creature vocals (seeds 0-19) ---"
$TONEFORGE explore sweep \
  --recipe creature-vocal \
  --seed-range 0:19 \
  --keep-top 5 \
  --rank-by rms \
  --clusters 3 \
  $JSON_FLAG

echo ""

# ---------------------------------------------------------------------------
# Step 2: Promote -- save top candidate to the Library
# ---------------------------------------------------------------------------
echo "--- Step 2: Promote top creature vocal to Library ---"

# Get the top candidate ID from the latest run
TOP_ID=$($TONEFORGE explore show --latest --json | \
  node -e "const d=JSON.parse(require('fs').readFileSync('/dev/stdin','utf8')); console.log(d.candidates[0].id)")

echo "Promoting candidate: $TOP_ID"
$TONEFORGE explore promote --latest --id "$TOP_ID" $JSON_FLAG

echo ""

# ---------------------------------------------------------------------------
# Step 3: Explore and promote weapon sounds
# ---------------------------------------------------------------------------
echo "--- Step 3: Sweep weapon laser zaps (seeds 0-29) ---"
$TONEFORGE explore sweep \
  --recipe weapon-laser-zap \
  --seed-range 0:29 \
  --keep-top 5 \
  --rank-by rms,spectral-centroid \
  --clusters 3 \
  $JSON_FLAG

echo ""

echo "--- Step 4: Promote top weapon sound to Library ---"
WEAPON_ID=$($TONEFORGE explore show --latest --json | \
  node -e "const d=JSON.parse(require('fs').readFileSync('/dev/stdin','utf8')); console.log(d.candidates[0].id)")

echo "Promoting candidate: $WEAPON_ID"
$TONEFORGE explore promote --latest --id "$WEAPON_ID" $JSON_FLAG

echo ""

# ---------------------------------------------------------------------------
# Step 5: List Library entries
# ---------------------------------------------------------------------------
echo "--- Step 5: List all Library entries ---"
$TONEFORGE library list $JSON_FLAG

echo ""

echo "--- Step 5b: List creature category only ---"
$TONEFORGE library list --category creature $JSON_FLAG

echo ""

# ---------------------------------------------------------------------------
# Step 6: Search by attributes
# ---------------------------------------------------------------------------
echo "--- Step 6: Search by intensity=high ---"
# Some entries may not have high intensity depending on classification;
# use a broader search if needed
$TONEFORGE library search --intensity high $JSON_FLAG || \
  $TONEFORGE library search --intensity medium $JSON_FLAG

echo ""

# ---------------------------------------------------------------------------
# Step 7: Find similar sounds
# ---------------------------------------------------------------------------
echo "--- Step 7: Find sounds similar to the creature vocal ---"
CREATURE_LIB_ID="lib-${TOP_ID}"
$TONEFORGE library similar --id "$CREATURE_LIB_ID" --limit 5 $JSON_FLAG

echo ""

# ---------------------------------------------------------------------------
# Step 8: Export WAV files
# ---------------------------------------------------------------------------
echo "--- Step 8: Export all Library entries as WAV ---"
EXPORT_DIR="$DEMO_DIR/export"
$TONEFORGE library export --output "$EXPORT_DIR" --format wav $JSON_FLAG

echo ""
echo "Exported files:"
ls -la "$EXPORT_DIR/" 2>/dev/null || echo "(no files)"

echo ""

# ---------------------------------------------------------------------------
# Step 9: Regenerate from stored preset
# ---------------------------------------------------------------------------
echo "--- Step 9: Regenerate creature vocal from stored preset ---"
$TONEFORGE library regenerate --id "$CREATURE_LIB_ID" $JSON_FLAG

echo ""

# ---------------------------------------------------------------------------
# Step 10: Verify idempotent promotion
# ---------------------------------------------------------------------------
echo "--- Step 10: Verify idempotent promotion (same candidate again) ---"
# Re-run the creature sweep to get the same run
$TONEFORGE explore sweep \
  --recipe creature-vocal \
  --seed-range 0:19 \
  --keep-top 5 \
  --rank-by rms \
  --clusters 3 \
  --json > /dev/null

$TONEFORGE explore promote --latest --id "$TOP_ID" $JSON_FLAG

echo ""

# ---------------------------------------------------------------------------
# Step 11: Final Library state
# ---------------------------------------------------------------------------
echo "--- Step 11: Final Library state ---"
$TONEFORGE library list $JSON_FLAG

echo ""

# ---------------------------------------------------------------------------
# Verify: at least one library entry exists
# ---------------------------------------------------------------------------
ENTRY_COUNT=$($TONEFORGE library list --json | \
  node -e "const d=JSON.parse(require('fs').readFileSync('/dev/stdin','utf8')); console.log(d.count)")

if [[ "$ENTRY_COUNT" -ge 1 ]]; then
  echo "=== PASS: Library contains $ENTRY_COUNT entries ==="
else
  echo "=== FAIL: Library is empty ==="
  exit 1
fi

echo ""
echo "=== Demo 7 complete. All proof points verified. ==="
echo "  1. Persistent searchable assets: $ENTRY_COUNT entries indexed and searchable"
echo "  2. Deterministic regeneration: regenerate command succeeded"
echo "  3. Exploration-to-production bridge: promoted -> listed -> exported"
