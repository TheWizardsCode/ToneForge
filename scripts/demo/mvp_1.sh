#!/usr/bin/env bash
# mvp_1.sh — ToneForge MVP Demo Walkthrough
#
# An interactive walkthrough that demonstrates how ToneForge accelerates
# development by generating placeholder audio instantly — so teams can
# build and test with sound from day one, without waiting for final assets.
#
# Each section presents a development problem, then demonstrates the
# ToneForge solution live.
# Press Enter to advance between sections. Make sure your speakers are on.

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(cd "$SCRIPT_DIR/../.." && pwd)"
cd "$PROJECT_ROOT"

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
  echo -e "  ${DIM}Placeholder audio at the speed of development${RESET}"
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

if [ ! -f "dist/cli.js" ]; then
  echo "Building ToneForge..."
  npm run build --silent
fi

CLI="node dist/cli.js"

# ── INTRO ────────────────────────────────────────────────────────────

banner

echo -e "  Every game, app, and interactive experience needs sound effects."
echo -e "  But final audio assets are one of the last things delivered."
echo ""
echo -e "  During development, teams either:"
echo ""
echo -e "    1. Build features in silence and bolt sounds on later"
echo -e "    2. Scrub through generic libraries for 'close enough' temps"
echo -e "    3. Wait for the sound designer before they can test anything"
echo ""
echo -e "  The result: integration surprises, wasted iteration cycles,"
echo -e "  and features that were never tested with audio feedback."
echo ""
echo -e "  ${BOLD}What if you could generate placeholder sounds from code?${RESET}"
echo -e "  ${BOLD}Instantly. Varied. Reproducible. Right from day one.${RESET}"
echo ""
echo -e "  That is ToneForge — placeholder audio at the speed of development."
echo -e "  Build and test with sound now. Drop in final assets when they're ready."

pause

# ── ACT 1: Generate a single sound ──────────────────────────────────

section_header "1/5" "Unblock your build on day one"

problem "You're building a sci-fi game UI. You need a confirmation\n  sound to test your button flow, but final audio assets\n  are weeks away. Development stalls — or proceeds in silence."

solution "ToneForge generates placeholder sounds from recipes in\n  milliseconds. No assets needed. One command, one sound."

run_cmd "$CLI generate --recipe ui-scifi-confirm --seed 42"

echo ""
echo -e "  ${DIM}That placeholder was synthesized entirely from code.${RESET}"
echo -e "  ${DIM}A sine oscillator shaped by a seed-derived envelope.${RESET}"
echo -e "  ${DIM}No files to find, no licenses to check, no designer to wait for.${RESET}"

pause

# ── ACT 2: Variation through seeds ──────────────────────────────────

section_header "2/5" "Explore the design space before your sound designer does"

problem "Your prototype has five different confirm actions and each\n  needs to feel distinct. Searching asset libraries for five\n  'close enough' temps is slow and none of them quite fit."

solution "Change the seed, change the sound. Same recipe, different\n  number, instant variation. Try three candidates in seconds:"

echo ""
echo -e "  ${DIM}Seed 100:${RESET}"
run_cmd "$CLI generate --recipe ui-scifi-confirm --seed 100"
echo ""

echo -e "  ${DIM}Seed 9999:${RESET}"
run_cmd "$CLI generate --recipe ui-scifi-confirm --seed 9999"
echo ""

echo -e "  ${DIM}Seed 7:${RESET}"
run_cmd "$CLI generate --recipe ui-scifi-confirm --seed 7"

echo ""
echo -e "  ${DIM}Three distinct placeholders. Same recipe. Three different integers.${RESET}"
echo -e "  ${DIM}Pick your favourites and hand the seeds to your sound designer${RESET}"
echo -e "  ${DIM}as a brief: 'this is the feel we prototyped with.'${RESET}"

pause

# ── ACT 3: Determinism ──────────────────────────────────────────────

section_header "3/5" "Reproducible placeholders across your team"

problem "A colleague asks 'what was that sound you used in the\n  prototype?' You need to reproduce it exactly — not hunt\n  through a downloads folder or re-scrub an asset library."

solution "ToneForge is deterministic. Same recipe + same seed = identical\n  audio, byte for byte. Share a seed, share a sound:"

run_cmd "$CLI generate --recipe ui-scifi-confirm --seed 42"

echo ""
echo -e "  ${DIM}That is the exact same sound you heard in Act 1.${RESET}"
echo -e "  ${DIM}Not similar. Identical. Any team member with the seed${RESET}"
echo -e "  ${DIM}gets the same placeholder — no file sharing needed.${RESET}"

pause

# ── ACT 4: Programmatic proof ────────────────────────────────────────

section_header "4/5" "Determinism you can verify in CI"

problem "Placeholder or not, if your integration tests depend on\n  audio output, you need a guarantee that the output never\n  drifts between runs. 'Probably the same' is not enough."

solution "ToneForge's test suite renders the same seed 10 times and\n  compares every sample byte-for-byte. Let's run it:"

echo ""
run_cmd "npx vitest run src/core/renderer.test.ts 2>&1 | tail -20"

echo ""
echo -e "  ${DIM}11 tests pass, including the 10-render determinism check.${RESET}"
echo -e "  ${DIM}Every one of those renders produced the exact same buffer.${RESET}"

pause

# ── ACT 5: The full test suite ───────────────────────────────────────

section_header "5/5" "Production-grade foundations"

problem "Placeholder tooling that breaks or behaves unpredictably\n  slows you down instead of speeding you up. Is this\n  actually reliable enough to depend on?"

solution "ToneForge has 62 tests across 8 test files covering the\n  RNG, recipe registry, renderer, WAV encoder, and CLI.\n  Strict TypeScript. Solid error handling. Let's prove it:"

echo ""
run_cmd "npx vitest run 2>&1 | tail -12"

echo ""
echo -e "  ${DIM}62 tests. 8 files. All passing.${RESET}"
echo -e "  ${DIM}Strict TypeScript. Vitest. No warnings.${RESET}"

pause

# ── FINALE ───────────────────────────────────────────────────────────

divider
echo -e "  ${BOLD}${CYAN}RECAP${RESET}"
echo ""
echo -e "  What you just saw:"
echo ""
echo -e "    ${GREEN}1.${RESET} Placeholder audio generated instantly — no waiting for assets"
echo -e "    ${GREEN}2.${RESET} Rapid variation — explore the design space with seed changes"
echo -e "    ${GREEN}3.${RESET} Reproducible across your team — share a seed, share a sound"
echo -e "    ${GREEN}4.${RESET} CI-verifiable determinism — proven by automated tests"
echo -e "    ${GREEN}5.${RESET} Production-grade engineering — 62 tests, strict types"
echo ""
echo -e "  ${BOLD}This is one recipe. One sound type. The beginning.${RESET}"
echo ""
echo -e "  Generate placeholders now. Prototype with real audio feedback."
echo -e "  Hand your favourite seeds to the sound designer as a brief."
echo -e "  Drop in final assets when they're ready."
divider
echo -e "  ${DIM}ToneForge MVP Demo complete.${RESET}"
echo ""
