#!/usr/bin/env node

// Dev-mode CLI loader for ToneForge.
// Registers tsx for on-the-fly TypeScript compilation so the CLI
// runs directly from src/ without a build step.
//
// Usage:  ./bin/dev-cli.js generate --recipe ui-scifi-confirm --seed 42
// After npm link:  tf generate --recipe ui-scifi-confirm --seed 42

import { register } from "tsx/esm/api";
register();

const { main } = await import("../src/cli.ts");
process.exitCode = await main();
