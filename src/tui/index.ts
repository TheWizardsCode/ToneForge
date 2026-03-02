/**
 * TUI Wizard Entry Point.
 *
 * Orchestrates the four-stage wizard pipeline:
 *   1. Define -- Browse recipes and build a palette manifest
 *   2. Explore -- Sweep seeds, audition, and select candidates
 *   3. Review -- Review palette coherence and refine selections
 *   4. Export -- Promote to library and export WAV files
 *
 * This module is the main entry point invoked by `toneforge tui`.
 * It manages non-TTY detection, session state, cleanup handling,
 * and stage transitions.
 *
 * Reference: Parent epic TF-0MM7HULM506CGSOP
 */

import { isStdoutTty, outputError, outputInfo } from "../output.js";
import { VERSION } from "../index.js";
import { WizardSession } from "./state.js";
import { installCleanupHandler } from "./cleanup.js";
import { WIZARD_STAGES } from "./types.js";
import type { WizardStage } from "./types.js";

/** Stage display names for user-facing output. */
const STAGE_NAMES: Record<WizardStage, string> = {
  define: "Define Your Palette",
  explore: "Explore & Audition",
  review: "Review & Refine",
  export: "Export",
};

/**
 * Launch the TUI wizard.
 *
 * Checks for TTY environment, prints a welcome message, installs
 * the cleanup handler, and drives the stage pipeline.
 *
 * @returns Exit code (0 = success, 1 = error).
 */
export async function launchWizard(): Promise<number> {
  // Non-TTY guard: exit with a clear error in piped/non-interactive environments
  if (!isStdoutTty()) {
    outputError(
      "Error: ToneForge TUI wizard requires an interactive terminal (TTY).\n" +
      "The wizard uses interactive prompts that cannot work in piped or non-TTY environments.\n" +
      "Run 'toneforge tui' directly in a terminal.",
    );
    return 1;
  }

  // Install Ctrl+C cleanup handler
  installCleanupHandler();

  // Create session state
  const session = new WizardSession();

  // Welcome message
  const stageCount = WIZARD_STAGES.length;
  const stageList = WIZARD_STAGES.map(
    (stage, i) => `  ${i + 1}. ${STAGE_NAMES[stage]}`,
  ).join("\n");

  outputInfo(
    `\nWelcome to ToneForge v${VERSION} Sound Palette Builder!\n\n` +
    `This wizard will guide you through ${stageCount} stages to build a coherent sound palette:\n\n` +
    `${stageList}\n\n` +
    `Press Ctrl+C at any time to exit.\n`,
  );

  // Stage loop -- placeholder for future stage implementations
  // Each stage module will be implemented in subsequent work items.
  while (true) {
    const stage = session.currentStage;
    const stageNum = session.currentStageNumber;
    const stageName = STAGE_NAMES[stage];

    outputInfo(`\n--- Stage ${stageNum}/${stageCount}: ${stageName} ---\n`);

    // Stage dispatch -- implementations will be added by subsequent work items
    switch (stage) {
      case "define":
        // Stage 1: Define Your Palette (TF-0MM8S0Y021PI6KW1, TF-0MM8S17RQ0U4Y4H1)
        outputInfo("Stage 1 (Define) is not yet implemented. Coming soon!");
        return 0;

      case "explore":
        // Stage 2: Explore & Audition (TF-0MM8S1JZX1GYYQT0, TF-0MM8S1W4C0NQ1CW6)
        outputInfo("Stage 2 (Explore) is not yet implemented. Coming soon!");
        return 0;

      case "review":
        // Stage 3: Review & Refine (TF-0MM8S29GD0JJ1WTC)
        outputInfo("Stage 3 (Review) is not yet implemented. Coming soon!");
        return 0;

      case "export":
        // Stage 4: Export (TF-0MM8S2LKQ1WM38F4)
        outputInfo("Stage 4 (Export) is not yet implemented. Coming soon!");
        return 0;

      default: {
        // Exhaustive check -- should never reach here
        const _exhaustive: never = stage;
        outputError(`Unknown stage: ${_exhaustive}`);
        return 1;
      }
    }
  }
}
