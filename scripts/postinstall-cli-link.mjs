#!/usr/bin/env node

import { spawnSync } from "node:child_process";

function runNpmLink() {
  return spawnSync("npm", ["link", "--ignore-scripts", "--silent"], {
    stdio: "ignore",
    shell: process.platform === "win32",
  });
}

const inCi = process.env.CI !== undefined && process.env.CI !== "";

if (inCi) {
  process.stdout.write("[toneforge] CI detected; skipping npm link. Use ./bin/dev-cli.js directly.\n");
  process.exit(0);
}

const result = runNpmLink();
if (result.status === 0) {
  process.stdout.write("[toneforge] CLI aliases installed: tf, toneforge\n");
  process.exit(0);
}

process.stdout.write("[toneforge] npm link unavailable; run CLI via ./bin/dev-cli.js\n");
process.exit(0);
