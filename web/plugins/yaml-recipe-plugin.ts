import type { Plugin } from "vite";
import { resolve } from "node:path";
import yaml from "js-yaml";

/**
 * Vite/Vitest plugin that converts YAML recipe files to JSON module exports.
 *
 * `presets/recipes/*.yaml` documents are parsed with `js-yaml` (only available
 * at build time in Node) and emitted as `export default <json>` so the browser
 * bundle can import them as plain objects via `import.meta.glob` — without
 * shipping a YAML parser to the client.
 *
 * `projectRoot` is the repository root that contains `presets/recipes/`.
 */
export function yamlRecipePlugin(projectRoot: string): Plugin {
  const recipeDirectory = resolve(projectRoot, "presets/recipes");

  return {
    name: "toneforge-yaml-recipe-plugin",
    enforce: "pre",
    transform(code, id) {
      // `id` may carry a query suffix (e.g. `?used`); strip it before matching.
      const filePath = id.split("?")[0];
      const resolved = resolve(filePath);

      if (!resolved.startsWith(recipeDirectory + "/")) {
        return null;
      }
      if (!resolved.endsWith(".yaml") && !resolved.endsWith(".yml")) {
        return null;
      }

      const parsed = yaml.load(code) as Record<string, unknown>;
      return {
        code: `export default ${JSON.stringify(parsed)};`,
        map: null,
      };
    },
  };
}
