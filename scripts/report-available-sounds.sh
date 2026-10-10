#!/usr/bin/env bash
# =============================================================================
# report-available-sounds.sh — JSON-driven reporting batch script
#
# Consumes `toneforge list recipes --category <c> --json`, removes recipes
# recorded in an already-used-sounds file, and reports the remaining candidates.
#
# Usage:
#   report-available-sounds.sh [--json] [--category <cat>] [--used-sounds <file>]
#
# Defaults:
#   category    = card-game
#   used-sounds = demos/fixtures/used-sounds.txt  (relative to repo root)
#
# Exit codes:
#   0 — success (even when every category item is already used)
#   1 — input error (missing file, malformed input, CLI failure)
#
# Work item: TF-0MUX0XKCC0088GV4
# =============================================================================

set -euo pipefail

# ---------------------------------------------------------------------------
# Resolve the repository root (parent of the scripts/ directory)
# ---------------------------------------------------------------------------
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(cd "$SCRIPT_DIR/.." && pwd)"

# ---------------------------------------------------------------------------
# Resolve the toneforge CLI
# ---------------------------------------------------------------------------
TONEFORGE="${TONEFORGE:-toneforge}"
if ! command -v "$TONEFORGE" &>/dev/null; then
  TONEFORGE="npx --prefix $PROJECT_ROOT toneforge"
fi

# ---------------------------------------------------------------------------
# Parse arguments
# ---------------------------------------------------------------------------
JSON_REPORT=false
CATEGORY="card-game"
USED_SOUNDS_FILE=""

while [[ $# -gt 0 ]]; do
  case "$1" in
    --json)
      JSON_REPORT=true
      shift
      ;;
    --category)
      CATEGORY="$2"
      shift 2
      ;;
    --used-sounds)
      USED_SOUNDS_FILE="$2"
      shift 2
      ;;
    -h|--help)
      echo "Usage: $0 [--json] [--category <cat>] [--used-sounds <file>]"
      echo ""
      echo "Defaults: category=card-game, used-sounds=demos/fixtures/used-sounds.txt"
      echo ""
      echo "Exit 0 on success (including empty candidate list)."
      echo "Exit 1 on input error."
      exit 0
      ;;
    *)
      echo "Error: unknown argument '$1'" >&2
      exit 1
      ;;
  esac
done

# Default used-sounds path
if [[ -z "$USED_SOUNDS_FILE" ]]; then
  USED_SOUNDS_FILE="$PROJECT_ROOT/demos/fixtures/used-sounds.txt"
fi

# ---------------------------------------------------------------------------
# Validate inputs
# ---------------------------------------------------------------------------
if [[ ! -f "$USED_SOUNDS_FILE" ]]; then
  echo "Error: used-sounds file not found: $USED_SOUNDS_FILE" >&2
  exit 1
fi

# ---------------------------------------------------------------------------
# Fetch recipes from the CLI
# ---------------------------------------------------------------------------
CLI_OUTPUT=$("$TONEFORGE" list recipes --category "$CATEGORY" --json 2>&1) || {
  echo "Error: toneforge CLI call failed (exit $?): toneforge list recipes --category $CATEGORY --json" >&2
  echo "Output: $CLI_OUTPUT" >&2
  exit 1
}

# Validate that CLI output is parseable JSON
echo "$CLI_OUTPUT" | node -e "
  const raw = require('fs').readFileSync('/dev/stdin', 'utf8');
  JSON.parse(raw);
" || {
  echo "Error: CLI output is not valid JSON:" >&2
  echo "$CLI_OUTPUT" >&2
  exit 1
}

# ---------------------------------------------------------------------------
# Filter recipes against the used-sounds list
# ---------------------------------------------------------------------------
export TONEFORGE_USED_SOUNDS="$USED_SOUNDS_FILE"
export TONEFORGE_CATEGORY="$CATEGORY"
export TONEFORGE_JSON="$JSON_REPORT"

CLI_OUTPUT="$CLI_OUTPUT" node -e "
const usedContent = require('fs').readFileSync(process.env.TONEFORGE_USED_SOUNDS, 'utf8');
const cliData     = JSON.parse(process.env.CLI_OUTPUT);
const jsonMode    = process.env.TONEFORGE_JSON === 'true';
const category    = process.env.TONEFORGE_CATEGORY;

// Parse used-sounds list (one name per line, skip blanks)
const usedSet = new Set(
  usedContent
    .split(/\r?\n/)
    .map(l => l.trim())
    .filter(l => l.length > 0)
);

// Filter: keep recipes NOT in the used set
const recipes      = cliData.recipes || [];
const total        = recipes.length;
const used         = recipes.filter(r => usedSet.has(r.name));
const remaining    = recipes.filter(r => !usedSet.has(r.name));

// Output
if (jsonMode) {
  console.log(JSON.stringify({
    command:   'report-available-sounds',
    category:  category,
    total:     total,
    used:      used.length,
    remaining: remaining.length,
    candidates: remaining.map(r => ({
      name:        r.name,
      description: r.description,
      category:    r.category,
      tags:        r.tags,
    })),
  }, null, 2));
} else {
  console.log('=== Available Sounds Report ===');
  console.log('Category:        ' + category);
  console.log('Total recipes:   ' + total);
  console.log('Already used:    ' + used.length);
  console.log('Remaining:       ' + remaining.length);
  console.log('');
  if (remaining.length > 0) {
    console.log('Remaining candidates:');
    remaining.forEach(r => console.log('  - ' + r.name));
  } else {
    console.log('All recipes in this category are already used.');
  }
}
"

exit 0
