#!/usr/bin/env node

// Capture process start as early as possible for profiling (--profile flag).
globalThis.__toneforgeProcessStart = process.hrtime.bigint();

// Dev-mode CLI loader for ToneForge.
// Registers tsx for on-the-fly TypeScript compilation so the CLI
// runs directly from src/ without a build step.
//
// Usage:  ./bin/dev-cli.js generate --recipe ui-scifi-confirm --seed 42
// After npm link:  tf generate --recipe ui-scifi-confirm --seed 42

import { register } from "tsx/esm/api";
register();

// Use the commander-based dev loader which scaffolds the future CLI framework
// while preserving the existing programmatic `main()` export in `src/cli.ts`.
const { commanderMain } = await import("../src/cli.commander.ts");
process.exitCode = await commanderMain();
