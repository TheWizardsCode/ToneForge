#!/usr/bin/env bash
set -euo pipefail

# Fail the CI if legacy CLI runtime shims or imports are present.
# Scans the workspace for known legacy symbols/paths that must not exist
# after cutover. Exits 0 when the tree is clean, 1 otherwise.

ROOT_DIR=$(cd "$(dirname "$0")/.." && pwd)

echo "Checking for legacy CLI runtime artifacts..."

patterns=(
  "runLegacy\s*\("
  "\bcli\.core\b"
  "src/cli\.legacy\.ts"
  "src/cli\.core\.ts"
)

fail=0
for p in "${patterns[@]}"; do
  if grep -RIn --exclude-dir=node_modules --exclude-dir=dist --exclude-dir=.git -E "$p" "$ROOT_DIR" >/dev/null 2>&1; then
    echo "ERROR: Legacy runtime pattern found: $p"
    grep -RIn --exclude-dir=node_modules --exclude-dir=dist --exclude-dir=.git -E "$p" "$ROOT_DIR" || true
    fail=1
  fi
done

if [ "$fail" -ne 0 ]; then
  echo "Legacy CLI runtime artifacts detected. Please remove or migrate them before merging." >&2
  exit 1
fi

echo "No legacy runtime artifacts found."
exit 0
