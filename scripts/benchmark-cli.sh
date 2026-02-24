#!/usr/bin/env bash
#
# ToneForge CLI Benchmark Script
#
# Runs N iterations of `toneforge generate` and reports statistical summary.
# Measures wall-clock time for the full CLI lifecycle (process start to exit).
#
# Usage:
#   ./scripts/benchmark-cli.sh [OPTIONS]
#
# Options:
#   -n <count>     Number of iterations (default: 10)
#   -r <recipe>    Recipe name (default: ui-scifi-confirm)
#   -s <seed>      Seed value (default: 42)
#   --dev-only     Only benchmark the dev (tsx) path
#   --dist-only    Only benchmark the compiled (dist/) path
#   -h, --help     Show this help message
#
# Prerequisites:
#   - Node.js installed
#   - Dependencies installed (npm install)
#   - For dist/ benchmarks: run `npm run build` first
#
# Output:
#   Prints mean, median, min, max, and p95 wall-clock times in milliseconds.
#
# Reference: TF-0MM0YUBFR0MCXGLE (End-to-End Benchmark Suite)
#

set -euo pipefail

# --- Defaults ---
ITERATIONS=10
RECIPE="ui-scifi-confirm"
SEED=42
RUN_DEV=true
RUN_DIST=true

# --- Parse arguments ---
while [[ $# -gt 0 ]]; do
  case "$1" in
    -n) ITERATIONS="$2"; shift 2 ;;
    -r) RECIPE="$2"; shift 2 ;;
    -s) SEED="$2"; shift 2 ;;
    --dev-only) RUN_DIST=false; shift ;;
    --dist-only) RUN_DEV=false; shift ;;
    -h|--help)
      head -29 "$0" | tail -25
      exit 0
      ;;
    *) echo "Unknown option: $1"; exit 1 ;;
  esac
done

# --- Helpers ---
SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
PROJECT_DIR="$(cd "$SCRIPT_DIR/.." && pwd)"
TMP_DIR=$(mktemp -d)
trap "rm -rf $TMP_DIR" EXIT

# Compute statistics from a file of numbers (one per line)
compute_stats() {
  local file="$1"
  local label="$2"
  node --input-type=module -e "
    import { readFileSync } from 'node:fs';
    const nums = readFileSync('${file}', 'utf-8')
      .trim().split('\\n').map(Number).sort((a, b) => a - b);
    const n = nums.length;
    const sum = nums.reduce((a, b) => a + b, 0);
    const mean = sum / n;
    const median = n % 2 === 0
      ? (nums[n/2 - 1] + nums[n/2]) / 2
      : nums[Math.floor(n/2)];
    const min = nums[0];
    const max = nums[n - 1];
    const p95idx = Math.ceil(0.95 * n) - 1;
    const p95 = nums[p95idx];
    console.log('  ${label}:');
    console.log('    iterations: ' + n);
    console.log('    mean:       ' + mean.toFixed(1) + 'ms');
    console.log('    median:     ' + median.toFixed(1) + 'ms');
    console.log('    min:        ' + min.toFixed(1) + 'ms');
    console.log('    max:        ' + max.toFixed(1) + 'ms');
    console.log('    p95:        ' + p95.toFixed(1) + 'ms');
  "
}

# Time a single command execution (returns ms to stdout)
time_cmd() {
  local start end elapsed_ms
  start=$(node -e "process.stdout.write(String(Date.now()))")
  "$@" > /dev/null 2>&1
  end=$(node -e "process.stdout.write(String(Date.now()))")
  elapsed_ms=$((end - start))
  echo "$elapsed_ms"
}

echo "=== ToneForge CLI Benchmark ==="
echo ""
echo "Config:"
echo "  recipe:     $RECIPE"
echo "  seed:       $SEED"
echo "  iterations: $ITERATIONS"
echo "  platform:   $(uname -s) $(uname -m)"
echo "  node:       $(node --version)"
echo ""

# --- Dev path benchmark ---
if [ "$RUN_DEV" = true ]; then
  echo "Benchmarking dev path (bin/dev-cli.js via tsx)..."
  DEV_RESULTS="$TMP_DIR/dev-times.txt"
  > "$DEV_RESULTS"

  for i in $(seq 1 "$ITERATIONS"); do
    ms=$(time_cmd node "$PROJECT_DIR/bin/dev-cli.js" generate --recipe "$RECIPE" --seed "$SEED" --output "$TMP_DIR/bench-dev.wav")
    echo "$ms" >> "$DEV_RESULTS"
    printf "  iteration %d/%d: %sms\n" "$i" "$ITERATIONS" "$ms"
  done

  echo ""
  compute_stats "$DEV_RESULTS" "Dev path (tsx)"
  echo ""
fi

# --- Dist path benchmark ---
if [ "$RUN_DIST" = true ]; then
  DIST_CLI="$PROJECT_DIR/dist/cli.js"
  if [ ! -f "$DIST_CLI" ]; then
    echo "Compiled CLI not found at $DIST_CLI. Run 'npm run build' first."
    echo "Skipping dist path benchmark."
  else
    echo "Benchmarking compiled path (dist/cli.js)..."
    DIST_RESULTS="$TMP_DIR/dist-times.txt"
    > "$DIST_RESULTS"

    for i in $(seq 1 "$ITERATIONS"); do
      ms=$(time_cmd node "$PROJECT_DIR/dist/cli.js" generate --recipe "$RECIPE" --seed "$SEED" --output "$TMP_DIR/bench-dist.wav")
      echo "$ms" >> "$DIST_RESULTS"
      printf "  iteration %d/%d: %sms\n" "$i" "$ITERATIONS" "$ms"
    done

    echo ""
    compute_stats "$DIST_RESULTS" "Compiled path (dist/)"
    echo ""
  fi
fi

echo "=== Benchmark Complete ==="
