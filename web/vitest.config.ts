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
    // Existing Node-environment suite plus SoundEditor component tests.
    // Component tests opt into happy-dom per file with the
    // `// @vitest-environment happy-dom` directive so the default Node
    // environment (used by the existing web tests) is unchanged.
    include: [
      "test/**/*.test.ts",
      "src/components/SoundEditor/**/*.test.ts",
    ],
    setupFiles: ["test/setup-init-recipes.ts"],
    testTimeout: 15_000,
  },
});
