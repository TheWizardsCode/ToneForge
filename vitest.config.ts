import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    exclude: [
      "**/node_modules/**",
      "**/dist/**",
      "**/.worklog/**",
      "**/*.e2e.test.*",
      "web/**",
    ],
    // Raise the default 5s test timeout: several integration tests spawn child
    // processes and a number of render tests are CPU-bound, so under
    // full-suite parallel load (16 workers) they can exceed 5s even though they
    // finish in ~2s in isolation. 20s gives ~4x headroom over the worst
    // observed contention while still failing genuine hangs in reasonable time.
    testTimeout: 20_000,
    // Vitest resolves setupFiles relative to the project root — use a plain
    // repository-relative path so resolution works in all environments.
    setupFiles: ["test/setup-init-recipes.ts", "test/setup-reset-globals.ts"],
  },
});
