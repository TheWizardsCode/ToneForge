/**
 * Parser integration test: validates that parsed demo content produces
 * commands referencing valid, registered recipes.
 *
 * This test bridges the parser and the recipe registry, ensuring that
 * demo markdown files produce runnable commands — not just structurally
 * valid parse output.
 *
 * AC 6: Parser integration test exists — parse demos/mvp-1.md and
 *        validate each step has valid commands referencing registered recipes.
 */
import { describe, it, expect } from "vitest";
import { readFileSync, readdirSync } from "node:fs";
import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { parseDemoMarkdown } from "./parser.js";
import { registry } from "../recipes/index.js";

const __dirname = dirname(fileURLToPath(import.meta.url));
const DEMOS_DIR = resolve(__dirname, "../../demos");

/**
 * Extract the recipe name from a CLI command string.
 * Matches patterns like `--recipe ui-scifi-confirm`.
 */
function extractRecipeName(command: string): string | null {
  const match = command.match(/--recipe\s+(\S+)/);
  return match ? match[1] : null;
}

// ── Integration: every .md file in demos/ ─────────────────────────

const demoFiles = readdirSync(DEMOS_DIR).filter((f) => f.endsWith(".md") && f !== "README.md");

describe("Demo markdown integration — recipe validation", () => {
  it("discovers at least one demo markdown file", () => {
    expect(demoFiles.length).toBeGreaterThan(0);
  });

  for (const file of demoFiles) {
    describe(`${file}`, () => {
      const raw = readFileSync(resolve(DEMOS_DIR, file), "utf-8");
      const parsed = parseDemoMarkdown(raw);

      it("parses without error and has steps", () => {
        expect(parsed.steps.length).toBeGreaterThan(0);
      });

      it("has valid front matter with title and id", () => {
        expect(parsed.meta.title).toBeTruthy();
        expect(parsed.meta.id).toBeTruthy();
      });

      // Collect all generate commands across all steps
      const generateCommands: Array<{ stepId: string; command: string }> = [];

      for (const step of parsed.steps) {
        for (const cmd of step.commands) {
          if (cmd.includes("generate") && cmd.includes("--recipe")) {
            generateCommands.push({ stepId: step.id, command: cmd });
          }
        }
      }

      // Collect all stack commands (stack render / stack inspect)
      const stackCommands: Array<{ stepId: string; command: string }> = [];

      for (const step of parsed.steps) {
        for (const cmd of step.commands) {
          if (cmd.includes("stack") && (cmd.includes("render") || cmd.includes("inspect"))) {
            stackCommands.push({ stepId: step.id, command: cmd });
          }
        }
      }

      // Collect all explore commands (explore sweep / explore mutate / etc.)
      const exploreCommands: Array<{ stepId: string; command: string }> = [];

      for (const step of parsed.steps) {
        for (const cmd of step.commands) {
          if (cmd.includes("explore") && cmd.includes("--recipe")) {
            exploreCommands.push({ stepId: step.id, command: cmd });
          }
        }
      }

      // Collect all play commands (toneforge play <path>)
      const playCommands: Array<{ stepId: string; command: string }> = [];

      for (const step of parsed.steps) {
        for (const cmd of step.commands) {
          if (cmd.startsWith("toneforge play ")) {
            playCommands.push({ stepId: step.id, command: cmd });
          }
        }
      }

      it("contains at least one toneforge command (generate, stack, explore, or play)", () => {
        expect(generateCommands.length + stackCommands.length + exploreCommands.length + playCommands.length).toBeGreaterThan(0);
      });

      if (generateCommands.length > 0) {
        it.each(generateCommands)(
          "step $stepId: '$command' references a registered recipe",
          ({ command }) => {
            const recipeName = extractRecipeName(command);
            expect(recipeName).toBeTruthy();
            expect(
              registry.getRegistration(recipeName!),
              `Recipe '${recipeName}' from parsed markdown is not in the registry`,
            ).toBeDefined();
          },
        );

        it.each(generateCommands)(
          "step $stepId: '$command' includes a --seed or --seed-range argument",
          ({ command }) => {
            expect(command).toMatch(/--seed(?:-range)?[= ]\d+/);
          },
        );
      }

      if (stackCommands.length > 0) {
        it.each(stackCommands)(
          "step $stepId: '$command' is a valid stack command",
          ({ command }) => {
            // Stack commands should reference a --preset or --layer
            expect(command).toMatch(/--preset|--layer/);
          },
        );
      }

      if (exploreCommands.length > 0) {
        it.each(exploreCommands)(
          "step $stepId: '$command' references a registered recipe",
          ({ command }) => {
            const recipeName = extractRecipeName(command);
            expect(recipeName).toBeTruthy();
            expect(
              registry.getRegistration(recipeName!),
              `Recipe '${recipeName}' from parsed markdown is not in the registry`,
            ).toBeDefined();
          },
        );
      }

      // Validate every step has required fields
      it("every step has id, label, title, and commands array", () => {
        for (const step of parsed.steps) {
          expect(step.id, `step missing id`).toBeTruthy();
          expect(step.label, `step ${step.id} missing label`).toBeTruthy();
          expect(step.title, `step ${step.id} missing title`).toBeTruthy();
          expect(Array.isArray(step.commands), `step ${step.id} commands not array`).toBe(true);
        }
      });
    });
  }
});
