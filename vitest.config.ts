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
    // Vitest resolves setupFiles relative to the project root — use a plain
    // repository-relative path so resolution works in all environments.
    setupFiles: ["test/setup-reset-globals.ts"],
  },
});
