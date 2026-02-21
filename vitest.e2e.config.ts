import { defineConfig } from "vitest/config";

/**
 * E2E test configuration.
 *
 * Runs ONLY .e2e.test.* files. These tests require a system audio player
 * (aplay, paplay, ffplay, or sox) and will fail hard if none is found.
 *
 * Usage: npm run test:e2e
 */
export default defineConfig({
  test: {
    include: ["**/*.e2e.test.*"],
  },
});
