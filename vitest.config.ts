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
    setupFiles: ["<rootDir>/test/setup-reset-globals.ts"],
  },
});
