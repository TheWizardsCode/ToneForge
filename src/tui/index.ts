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
 * stage transitions, and session auto-save/resume.
 *
 * Reference: Parent epic TF-0MM7HULM506CGSOP
 * Reference: TF-0MM8S3BDR1QMN6TZ (Session Save/Resume)
 */

import { confirm } from "@inquirer/prompts";
import { isStdoutTty, outputError, outputInfo, outputWarning } from "../output.js";
import { VERSION } from "../index.js";
import { WizardSession } from "./state.js";
import { installCleanupHandler } from "./cleanup.js";
import { WIZARD_STAGES } from "./types.js";
import type { WizardStage } from "./types.js";
import { runDefineStage } from "./stages/define.js";
import { runExploreStage } from "./stages/explore.js";
import { runReviewStage } from "./stages/review.js";
import { runExportStage } from "./stages/export.js";
import {
  saveSession,
  loadSession,
  detectSessionFile,
  deleteSessionFile,
  DEFAULT_SESSION_FILE,
  SessionVersionMismatchError,
  SessionCorruptedError,
} from "./session-persistence.js";

/** Stage display names for user-facing output. */
const STAGE_NAMES: Record<WizardStage, string> = {
  define: "Define Your Palette",
  explore: "Explore & Audition",
  review: "Review & Refine",
  export: "Export",
};

/**
 * Options for launching the TUI wizard.
 */
export interface LaunchWizardOptions {
  /** Path to resume a session from. Mutually exclusive with sessionFile. */
  resume?: string;

  /** Custom path for the auto-save session file. */
  sessionFile?: string;
}

/**
 * Launch the TUI wizard.
 *
 * Checks for TTY environment, prints a welcome message, installs
 * the cleanup handler, handles session resume, and drives the
 * stage pipeline with auto-save on each stage transition.
 *
 * @param options - Optional session file and resume configuration.
 * @returns Exit code (0 = success, 1 = error).
 */
export async function launchWizard(
  options: LaunchWizardOptions = {},
): Promise<number> {
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

  // Determine session file path
  const sessionFilePath = options.resume ?? options.sessionFile ?? DEFAULT_SESSION_FILE;

  // Session resume or fresh start
  let session: WizardSession;

  if (options.resume) {
    // Explicit --resume flag: load from specified path
    const resumeResult = await tryResumeSession(options.resume);
    if (resumeResult.exitCode !== undefined) return resumeResult.exitCode;
    session = resumeResult.session!;
    outputInfo(`\nResumed session from ${options.resume}\n`);
  } else if (detectSessionFile(sessionFilePath)) {
    // Auto-detect existing session file
    const resumeResult = await handleExistingSession(sessionFilePath);
    if (resumeResult.exitCode !== undefined) return resumeResult.exitCode;
    session = resumeResult.session!;
  } else {
    // No existing session -- fresh start
    session = new WizardSession();
  }

  // Welcome message
  const stageCount = WIZARD_STAGES.length;
  const stageList = WIZARD_STAGES.map(
    (stage, i) => `  ${i + 1}. ${STAGE_NAMES[stage]}`,
  ).join("\n");

  const resumeNote = session.currentStage !== "define"
    ? `\nResuming at Stage ${session.currentStageNumber}: ${STAGE_NAMES[session.currentStage]}\n`
    : "";

  outputInfo(
    `\nWelcome to ToneForge v${VERSION} Sound Palette Builder!\n\n` +
    `This wizard will guide you through ${stageCount} stages to build a coherent sound palette:\n\n` +
    `${stageList}\n` +
    `${resumeNote}\n` +
    `Press Ctrl+C at any time to exit.\n`,
  );

  // Stage loop -- drives the wizard through all four stages
  // with back-navigation support and a top-level error boundary.
  try {
    while (true) {
      const stage = session.currentStage;
      const stageNum = session.currentStageNumber;
      const stageName = STAGE_NAMES[stage];

      outputInfo(`\n--- Stage ${stageNum}/${stageCount}: ${stageName} ---\n`);

      // Stage dispatch
      switch (stage) {
        case "define": {
          const defineResult = await runDefineStage(session);
          if (defineResult === "quit") {
            outputInfo("\nWizard cancelled. Goodbye!\n");
            return 0;
          }
          session.advance();
          await autoSave(session, sessionFilePath);
          break;
        }

        case "explore": {
          const exploreResult = await runExploreStage(session);
          if (exploreResult === "back") {
            session.goBack();
            await autoSave(session, sessionFilePath);
            break;
          }
          session.advance();
          await autoSave(session, sessionFilePath);
          break;
        }

        case "review": {
          const reviewResult = await runReviewStage(session);
          if (reviewResult === "back") {
            session.goBack();
            await autoSave(session, sessionFilePath);
            break;
          }
          session.advance();
          await autoSave(session, sessionFilePath);
          break;
        }

        case "export": {
          const exportResult = await runExportStage(session);
          if (exportResult === "back") {
            session.goBack();
            await autoSave(session, sessionFilePath);
            break;
          }
          // Export complete -- prompt to delete session file
          await promptDeleteSession(sessionFilePath);
          outputInfo("\nThank you for using ToneForge Sound Palette Builder!\n");
          return 0;
        }

        default: {
          const _exhaustive: never = stage;
          outputError(`Unknown stage: ${_exhaustive}`);
          return 1;
        }
      }
    }
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    outputError(`\nWizard encountered an unexpected error: ${message}\n`);
    outputError("Please report this issue at https://github.com/anomalyco/ToneForge/issues\n");
    return 1;
  }
}

// ---------------------------------------------------------------------------
// Session resume helpers
// ---------------------------------------------------------------------------

interface ResumeResult {
  session?: WizardSession;
  exitCode?: number;
}

/**
 * Attempt to load a session from a file path.
 * Returns the restored session or an exit code on failure.
 */
async function tryResumeSession(filePath: string): Promise<ResumeResult> {
  if (!detectSessionFile(filePath)) {
    outputError(`Session file not found: ${filePath}\n`);
    return { exitCode: 1 };
  }

  try {
    const data = await loadSession(filePath);
    const session = WizardSession.fromData(data);
    return { session };
  } catch (err) {
    if (err instanceof SessionVersionMismatchError) {
      outputError(`\n${err.message}\n`);
      return { exitCode: 1 };
    }
    if (err instanceof SessionCorruptedError) {
      outputError(`\n${err.message}\n`);
      return { exitCode: 1 };
    }
    throw err;
  }
}

/**
 * Handle an auto-detected existing session file.
 *
 * Prompts the user to resume or start fresh. Starting fresh
 * backs up the existing session file before proceeding.
 */
async function handleExistingSession(
  filePath: string,
): Promise<ResumeResult> {
  outputInfo(`\nExisting session file detected: ${filePath}\n`);

  let data;
  try {
    data = await loadSession(filePath);
  } catch (err) {
    if (err instanceof SessionVersionMismatchError) {
      outputWarning(`\n${err.message}\n`);
      outputInfo("Starting a fresh session.\n");
      // Back up the incompatible file via auto-save (which creates a backup)
      return { session: new WizardSession() };
    }
    if (err instanceof SessionCorruptedError) {
      outputWarning(`\n${err.message}\n`);
      outputInfo("Starting a fresh session.\n");
      return { session: new WizardSession() };
    }
    throw err;
  }

  const stageIdx = WIZARD_STAGES.indexOf(data.currentStage) + 1;
  const entryCount = data.manifest.entries.length;
  const selCount = data.selections.size;

  outputInfo(
    `  Stage: ${stageIdx}/4 (${STAGE_NAMES[data.currentStage]})\n` +
    `  Recipes in palette: ${entryCount}\n` +
    `  Selections made: ${selCount}\n`,
  );

  const shouldResume = await confirm({
    message: "Resume this session? (Choosing No will archive the existing session and start fresh)",
    default: true,
  });

  if (shouldResume) {
    const session = WizardSession.fromData(data);
    return { session };
  }

  // Starting fresh -- back up the old file via saveSession (which creates a backup)
  outputInfo("Archiving existing session and starting fresh.\n");
  const freshSession = new WizardSession();
  await saveSession(freshSession.toData(), filePath);
  return { session: freshSession };
}

// ---------------------------------------------------------------------------
// Auto-save and cleanup helpers
// ---------------------------------------------------------------------------

/**
 * Auto-save session state after a stage transition.
 * Silently handles save errors (logs a warning but does not interrupt the wizard).
 */
async function autoSave(
  session: WizardSession,
  filePath: string,
): Promise<void> {
  try {
    await saveSession(session.toData(), filePath);
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    outputWarning(`Warning: Failed to auto-save session: ${message}\n`);
  }
}

/**
 * After successful export, prompt the user to delete the session file.
 */
async function promptDeleteSession(filePath: string): Promise<void> {
  if (!detectSessionFile(filePath)) return;

  try {
    const shouldDelete = await confirm({
      message: "Export complete! Delete the session save file?",
      default: true,
    });

    if (shouldDelete) {
      await deleteSessionFile(filePath);
      outputInfo("Session file and backups deleted.\n");
    } else {
      outputInfo("Session file retained.\n");
    }
  } catch {
    // If the prompt fails (e.g. Ctrl+C), just leave the file
  }
}
