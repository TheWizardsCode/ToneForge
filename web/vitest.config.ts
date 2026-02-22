import { defineConfig } from "vitest/config";
import { resolve } from "node:path";

const projectRoot = resolve(__dirname, "..");

export default defineConfig({
  resolve: {
    alias: {
      "@toneforge": resolve(projectRoot, "src"),
      "@demos": resolve(projectRoot, "demos"),
    },
  },
  test: {
    include: ["test/**/*.test.ts"],
    testTimeout: 15_000,
  },
});
