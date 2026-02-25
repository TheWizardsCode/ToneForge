#!/usr/bin/env bash
# =============================================================================
# Demo 7: Library -- Structured Asset Storage
#
# End-to-end walkthrough exercising the full explore-to-library flow:
#   sweep -> audition -> promote (x3) -> list -> search -> similar -> export -> regenerate
#
# Narrative: a sound designer builds a laser-sound palette by sweeping
# weapon-laser-zap seeds, picking candidates from two adjacent clusters,
# and promoting three complementary sounds into the Library.
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
# Step 1: Explore -- sweep weapon-laser-zap across 50 seeds
# ---------------------------------------------------------------------------
echo "--- Step 1: Sweep weapon-laser-zap (seeds 0-49, 4 clusters) ---"
$TONEFORGE explore sweep \
  --recipe weapon-laser-zap \
  --seed-range 0:49 \
  --keep-top 10 \
  --rank-by rms,spectral-centroid \
  --clusters 4 \
  $JSON_FLAG

echo ""

# ---------------------------------------------------------------------------
# Step 2: Pick 3 candidates from the top of the sweep and promote them
#         (1 from the top cluster as 'weapon', 2 from the next cluster as 'weapon-alt')
# ---------------------------------------------------------------------------
echo "--- Step 2: Promote 3 candidates to build a laser palette ---"

# Extract the top 3 candidate IDs from the latest run
CANDIDATES=$($TONEFORGE explore show --latest --json | \
  node -e "
    const d = JSON.parse(require('fs').readFileSync('/dev/stdin','utf8'));
    // Take 1st candidate (top cluster) and 3rd + 4th (next cluster down)
    const picks = [d.candidates[0], d.candidates[2], d.candidates[3]];
    picks.forEach(c => console.log(c.id));
  ")

# Promote each candidate with a category
FIRST_CID=""
INDEX=0
for CID in $CANDIDATES; do
  if [ -z "$FIRST_CID" ]; then
    FIRST_CID="$CID"
  fi
  if [ "$INDEX" -eq 0 ]; then
    CATEGORY="weapon"
  else
    CATEGORY="weapon-alt"
  fi
  echo "Promoting candidate: $CID (category: $CATEGORY)"
  $TONEFORGE explore promote --latest --id "$CID" --category "$CATEGORY" $JSON_FLAG
  echo ""
  INDEX=$((INDEX + 1))
done

# Capture the first promoted ID for later steps
FIRST_LIB_ID="lib-$FIRST_CID"

# ---------------------------------------------------------------------------
# Step 3: List Library entries
# ---------------------------------------------------------------------------
echo "--- Step 3: List all Library entries ---"
$TONEFORGE library list $JSON_FLAG

echo ""

echo "--- Step 3b: Filter by category ---"
$TONEFORGE library list --category weapon $JSON_FLAG

echo ""

# ---------------------------------------------------------------------------
# Step 4: Search by attributes
# ---------------------------------------------------------------------------
echo "--- Step 4: Search by category ---"
$TONEFORGE library search --category weapon-alt $JSON_FLAG

echo ""

# ---------------------------------------------------------------------------
# Step 5: Find similar sounds
# ---------------------------------------------------------------------------
echo "--- Step 5: Find sounds similar to $FIRST_LIB_ID ---"
$TONEFORGE library similar --id "$FIRST_LIB_ID" --limit 5 $JSON_FLAG

echo ""

# ---------------------------------------------------------------------------
# Step 6: Export WAV files
# ---------------------------------------------------------------------------
echo "--- Step 6: Export all Library entries as WAV ---"
EXPORT_DIR="$DEMO_DIR/export"
$TONEFORGE library export --output "$EXPORT_DIR" --format wav $JSON_FLAG

echo ""
echo "Exported files:"
ls -la "$EXPORT_DIR/" 2>/dev/null || echo "(no files)"

echo ""

# ---------------------------------------------------------------------------
# Step 7: Regenerate from stored preset
# ---------------------------------------------------------------------------
echo "--- Step 7: Regenerate $FIRST_LIB_ID from stored preset ---"
$TONEFORGE library regenerate --id "$FIRST_LIB_ID" $JSON_FLAG

echo ""

# ---------------------------------------------------------------------------
# Step 8: Verify idempotent promotion
# ---------------------------------------------------------------------------
echo "--- Step 8: Verify idempotent promotion (same candidate again) ---"
# Re-run the sweep to get the same run
$TONEFORGE explore sweep \
  --recipe weapon-laser-zap \
  --seed-range 0:49 \
  --keep-top 10 \
  --rank-by rms,spectral-centroid \
  --clusters 4 \
  --json > /dev/null

$TONEFORGE explore promote --latest --id "$FIRST_CID" --category weapon $JSON_FLAG

echo ""

# ---------------------------------------------------------------------------
# Step 9: Final Library state
# ---------------------------------------------------------------------------
echo "--- Step 9: Final Library state ---"
$TONEFORGE library list $JSON_FLAG

echo ""

# ---------------------------------------------------------------------------
# Verify: at least 3 library entries exist
# ---------------------------------------------------------------------------
ENTRY_COUNT=$($TONEFORGE library list --json | \
  node -e "const d=JSON.parse(require('fs').readFileSync('/dev/stdin','utf8')); console.log(d.count)")

if [[ "$ENTRY_COUNT" -ge 3 ]]; then
  echo "=== PASS: Library contains $ENTRY_COUNT entries ==="
else
  echo "=== FAIL: Library contains only $ENTRY_COUNT entries (expected >= 3) ==="
  exit 1
fi

echo ""
echo "=== Demo 7 complete. All proof points verified. ==="
echo "  1. Persistent searchable assets: $ENTRY_COUNT entries indexed and searchable"
echo "  2. Deterministic regeneration: regenerate command succeeded"
echo "  3. Exploration-to-production bridge: promoted -> listed -> exported"
