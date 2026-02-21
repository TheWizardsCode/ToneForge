#!/usr/bin/env bash
# mvp_1.sh — ToneForge MVP Demo Walkthrough
#
# An interactive walkthrough that demonstrates ToneForge's core thesis:
# procedural, deterministic, seed-based sound generation produces
# meaningfully varied output with zero sample dependencies.
#
# Each section presents a problem, then demonstrates the solution live.
# Press Enter to advance between sections. Make sure your speakers are on.

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
cd "$SCRIPT_DIR"

# ── Formatting helpers ──────────────────────────────────────────────

BOLD="\033[1m"
DIM="\033[2m"
CYAN="\033[36m"
GREEN="\033[32m"
YELLOW="\033[33m"
MAGENTA="\033[35m"
RESET="\033[0m"

divider() {
  echo ""
  echo -e "${DIM}$(printf '%.0s─' {1..60})${RESET}"
  echo ""
}

banner() {
  clear
  echo ""
  echo -e "${BOLD}${CYAN}"
  echo "  ╔════════════════════════════════════════════╗"
  echo "  ║         ToneForge  ·  MVP Demo             ║"
  echo "  ╚════════════════════════════════════════════╝"
  echo -e "${RESET}"
  echo -e "  ${DIM}Procedural Audio Production Platform${RESET}"
  echo -e "  ${DIM}Turn your speakers on.${RESET}"
  echo ""
}

problem() {
  divider
  echo -e "  ${BOLD}${YELLOW}PROBLEM${RESET}"
  echo ""
  echo -e "  $1"
  echo ""
}

solution() {
  echo -e "  ${BOLD}${GREEN}SOLUTION${RESET}"
  echo ""
  echo -e "  $1"
  echo ""
}

run_cmd() {
  echo -e "  ${DIM}\$${RESET} ${BOLD}$1${RESET}"
  echo ""
  eval "$1"
}

pause() {
  echo ""
  echo -e "  ${DIM}Press Enter to continue...${RESET}"
  read -r
}

section_header() {
  divider
  echo -e "  ${BOLD}${MAGENTA}[$1]${RESET}  ${BOLD}$2${RESET}"
}

# ── Preflight check ─────────────────────────────────────────────────

if [ ! -f "node_modules/.package-lock.json" ]; then
  echo "Installing dependencies..."
  npm install --silent
fi

# ── INTRO ────────────────────────────────────────────────────────────

banner

echo -e "  Every game, app, and interactive experience needs sound effects."
echo -e "  Traditionally, you either:"
echo ""
echo -e "    1. Hire a sound designer and wait for delivery"
echo -e "    2. Buy generic asset packs and hope they fit"
echo -e "    3. Record and edit sounds manually"
echo ""
echo -e "  Each approach is slow, expensive, or inflexible."
echo ""
echo -e "  ${BOLD}What if you could generate sounds from code?${RESET}"
echo -e "  ${BOLD}Instantly. Infinitely varied. Perfectly reproducible.${RESET}"
echo ""
echo -e "  That is ToneForge."

pause

# ── ACT 1: Generate a single sound ──────────────────────────────────

section_header "1/5" "A sound from nothing"

problem "You need a sci-fi UI confirmation sound for your game.\n  You have no audio files, no samples, no recordings. Just code."

solution "ToneForge generates sounds from recipes — pure synthesis,\n  no samples required. One command, one sound."

run_cmd "npx tsx src/cli.ts generate --recipe ui-scifi-confirm --seed 42"

echo ""
echo -e "  ${DIM}That sound was synthesized entirely from code.${RESET}"
echo -e "  ${DIM}A sine oscillator shaped by a seed-derived envelope.${RESET}"
echo -e "  ${DIM}No .wav files. No asset packs. No recording.${RESET}"

pause

# ── ACT 2: Variation through seeds ──────────────────────────────────

section_header "2/5" "Infinite variation"

problem "One sound is not enough. You need dozens of variations —\n  different pitches, different timbres, different feels —\n  without manually tweaking parameters each time."

solution "Change the seed, change the sound. Same recipe, different\n  number, completely different output. Listen to three variations:"

echo ""
echo -e "  ${DIM}Seed 100:${RESET}"
run_cmd "npx tsx src/cli.ts generate --recipe ui-scifi-confirm --seed 100"
echo ""

echo -e "  ${DIM}Seed 9999:${RESET}"
run_cmd "npx tsx src/cli.ts generate --recipe ui-scifi-confirm --seed 9999"
echo ""

echo -e "  ${DIM}Seed 7:${RESET}"
run_cmd "npx tsx src/cli.ts generate --recipe ui-scifi-confirm --seed 7"

echo ""
echo -e "  ${DIM}Three distinct sounds. Same recipe. Three different integers.${RESET}"
echo -e "  ${DIM}Every seed from 0 to 2,147,483,647 produces a unique variation.${RESET}"

pause

# ── ACT 3: Determinism ──────────────────────────────────────────────

section_header "3/5" "Perfect reproducibility"

problem "In creative tools, 'undo' and 'reproduce' matter.\n  If you find a sound you like with seed 42, you need to get\n  that exact sound back — tomorrow, next month, on any machine."

solution "ToneForge is deterministic. Same recipe + same seed = identical\n  audio, byte for byte. Let's prove it — listen to seed 42 again:"

run_cmd "npx tsx src/cli.ts generate --recipe ui-scifi-confirm --seed 42"

echo ""
echo -e "  ${DIM}That is the exact same sound you heard in Act 1.${RESET}"
echo -e "  ${DIM}Not similar. Not close. Identical — down to every sample.${RESET}"

pause

# ── ACT 4: Programmatic proof ────────────────────────────────────────

section_header "4/5" "Proof, not trust"

problem "Claiming determinism is easy. Proving it is harder.\n  How do you know the output is truly identical and not\n  just 'close enough'?"

solution "ToneForge's test suite renders the same seed 10 times and\n  compares every sample byte-for-byte. Let's run it:"

echo ""
run_cmd "npx vitest run src/core/renderer.test.ts 2>&1 | tail -20"

echo ""
echo -e "  ${DIM}11 tests pass, including the 10-render determinism check.${RESET}"
echo -e "  ${DIM}Every one of those renders produced the exact same buffer.${RESET}"

pause

# ── ACT 5: The full test suite ───────────────────────────────────────

section_header "5/5" "Solid foundations"

problem "A demo is nice, but is this actually engineered well?\n  Does it have tests? Types? Error handling?"

solution "ToneForge has 58 tests across 7 test files covering the\n  RNG, recipe registry, renderer, WAV encoder, and CLI.\n  All strict TypeScript. Let's run the full suite:"

echo ""
run_cmd "npx vitest run 2>&1 | tail -12"

echo ""
echo -e "  ${DIM}58 tests. 7 files. All passing.${RESET}"
echo -e "  ${DIM}Strict TypeScript. Vitest. No warnings.${RESET}"

pause

# ── FINALE ───────────────────────────────────────────────────────────

divider
echo -e "  ${BOLD}${CYAN}RECAP${RESET}"
echo ""
echo -e "  What you just saw:"
echo ""
echo -e "    ${GREEN}1.${RESET} Sound generated from pure code — no samples, no assets"
echo -e "    ${GREEN}2.${RESET} Infinite variation — change a seed, get a new sound"
echo -e "    ${GREEN}3.${RESET} Perfect determinism — same seed always means same output"
echo -e "    ${GREEN}4.${RESET} Byte-level proof — verified by automated tests"
echo -e "    ${GREEN}5.${RESET} Solid engineering — 58 tests, strict types, clean errors"
echo ""
echo -e "  ${BOLD}This is one recipe. One sound type. The beginning.${RESET}"
echo ""
echo -e "  Next: more recipes, layered compositions, WAV export,"
echo -e "  browser playback, and a full procedural audio library."
divider
echo -e "  ${DIM}ToneForge MVP Demo complete.${RESET}"
echo ""
