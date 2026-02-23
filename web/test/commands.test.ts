/**
 * Unit tests for demo content and command validation.
 *
 * Verifies that every wizard step's generate command references a valid
 * recipe name that exists in the ToneForge recipe registry.
 *
 * Validates ALL loaded demos (not just the first), ensuring that adding
 * new demos automatically gets coverage.
 *
 * AC 3: Each wizard step's command string is a valid ToneForge CLI command
 *        (recipe name exists in registry).
 */
import { describe, it, expect } from "vitest";
import { DEMOS, DEMO_STEPS } from "../src/demo-content.js";
import { registry } from "../../src/recipes/index.js";

/**
 * Extract the recipe name from a CLI command string.
 * Matches patterns like `--recipe ui-scifi-confirm`.
 */
function extractRecipeName(command: string): string | null {
  const match = command.match(/--recipe\s+(\S+)/);
  return match ? match[1] : null;
}

describe("Demo content structure", () => {
  it("has at least one demo loaded", () => {
    expect(DEMOS.length).toBeGreaterThan(0);
  });

  it("DEMO_STEPS matches the first demo's steps", () => {
    expect(DEMO_STEPS).toBe(DEMOS[0].steps);
  });

  it("every demo has valid metadata", () => {
    for (const demo of DEMOS) {
      expect(demo.meta.id).toBeTruthy();
      expect(demo.meta.title).toBeTruthy();
    }
  });

  it("every demo has at least one step", () => {
    for (const demo of DEMOS) {
      expect(demo.steps.length).toBeGreaterThan(0);
    }
  });

  it("every step has an id, label, and title", () => {
    for (const demo of DEMOS) {
      for (const step of demo.steps) {
        expect(step.id).toBeTruthy();
        expect(step.label).toBeTruthy();
        expect(step.title).toBeTruthy();
      }
    }
  });

  it("every step has a commands array", () => {
    for (const demo of DEMOS) {
      for (const step of demo.steps) {
        expect(Array.isArray(step.commands)).toBe(true);
      }
    }
  });
});

describe("Wizard step command validation (all demos)", () => {
  // Collect all generate commands across all demos and steps
  const generateCommands: Array<{ demoId: string; stepId: string; command: string }> = [];

  for (const demo of DEMOS) {
    for (const step of demo.steps) {
      for (const cmd of step.commands) {
        if (cmd.includes("generate") && cmd.includes("--recipe")) {
          generateCommands.push({ demoId: demo.meta.id, stepId: step.id, command: cmd });
        }
      }
    }
  }

  it("has at least one generate command across all demos", () => {
    expect(generateCommands.length).toBeGreaterThan(0);
  });

  it.each(generateCommands)(
    "[$demoId] step $stepId: command '$command' references a registered recipe",
    ({ command }) => {
      const recipeName = extractRecipeName(command);
      expect(recipeName).toBeTruthy();
      expect(
        registry.getRecipe(recipeName!),
        `Recipe '${recipeName}' is not registered in the ToneForge registry`,
      ).toBeDefined();
    },
  );

  it.each(generateCommands)(
    "[$demoId] step $stepId: command '$command' includes a --seed argument",
    ({ command }) => {
      expect(command).toMatch(/--seed(?:-range)?[= ]\d+/);
    },
  );
});

describe("Non-generate commands (all demos)", () => {
  const nonGenerateCommands: Array<{ demoId: string; stepId: string; command: string }> = [];

  for (const demo of DEMOS) {
    for (const step of demo.steps) {
      for (const cmd of step.commands) {
        if (!cmd.includes("generate")) {
          nonGenerateCommands.push({ demoId: demo.meta.id, stepId: step.id, command: cmd });
        }
      }
    }
  }

  if (nonGenerateCommands.length > 0) {
    it.each(nonGenerateCommands)(
      "[$demoId] step $stepId: non-generate command '$command' is a valid shell command",
      ({ command }) => {
        // Non-generate commands should be valid shell invocations (npx, node, etc.)
        expect(command.trim().length).toBeGreaterThan(0);
        // Should start with a recognizable command
        expect(command).toMatch(/^(npx|node|npm|toneforge|for|\.\/)/);
      },
    );
  }
});
