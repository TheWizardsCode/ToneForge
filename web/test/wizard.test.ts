/**
 * @vitest-environment happy-dom
 *
 * Unit tests for the wizard sequential command execution logic.
 * Covers: async execution loop, button state transitions, failure handling,
 * global run guard, audio dispatch, and null terminal handling.
 */
import { describe, it, expect, vi, beforeEach, type Mock } from "vitest";
import type { TerminalController } from "../src/terminal.js";

// ── Mock audio module ─────────────────────────────────────────────
vi.mock("../src/audio.js", () => ({
  handleCommandAudio: vi.fn().mockResolvedValue(false),
}));

// ── Mock demo-content module ──────────────────────────────────────
// Provide two steps: one single-command step and one multi-command step.
vi.mock("../src/demo-content.js", () => ({
  DEMO_STEPS: [
    {
      id: "step-1",
      label: "Step 1",
      title: "Single Command",
      description: "A step with one command.",
      commands: ["echo hello"],
    },
    {
      id: "step-2",
      label: "Step 2",
      title: "Multi Command",
      description: "A step with multiple commands.",
      commands: ["cmd-a", "cmd-b", "cmd-c"],
    },
  ],
  DEMO_LIST: [{ id: "test-demo", title: "Test Demo" }],
  getDemoById: (id: string) => {
    if (id === "test-demo") {
      return {
        meta: { id: "test-demo", title: "Test Demo" },
        steps: [
          {
            id: "step-1",
            label: "Step 1",
            title: "Single Command",
            description: "A step with one command.",
            commands: ["echo hello"],
          },
          {
            id: "step-2",
            label: "Step 2",
            title: "Multi Command",
            description: "A step with multiple commands.",
            commands: ["cmd-a", "cmd-b", "cmd-c"],
          },
        ],
      };
    }
    return undefined;
  },
}));

import { createWizard } from "../src/wizard.js";
import { handleCommandAudio } from "../src/audio.js";

// ── Helpers ───────────────────────────────────────────────────────

type Resolver = (result: { exitCode: number }) => void;

interface MockTerminal extends TerminalController {
  /** Pending executeCommand resolvers in order of calls */
  _resolvers: Resolver[];
  /** Resolve the oldest pending executeCommand call */
  _resolve(exitCode: number): void;
  /** Calls recorded to executeCommand, in order */
  _executedCommands: string[];
}

function createMockTerminal(): MockTerminal {
  const resolvers: Resolver[] = [];
  const executedCommands: string[] = [];

  return {
    _resolvers: resolvers,
    _executedCommands: executedCommands,
    _resolve(exitCode: number) {
      const r = resolvers.shift();
      if (!r) throw new Error("No pending executeCommand to resolve");
      r({ exitCode });
    },
    sendCommand: vi.fn(),
    executeCommand: vi.fn((command: string) => {
      executedCommands.push(command);
      return new Promise<{ exitCode: number }>((resolve) => {
        resolvers.push(resolve);
      });
    }),
    onOutput: vi.fn(() => () => {}),
    dispose: vi.fn(),
  };
}

/** Query all Run buttons in the container */
function getRunButtons(container: HTMLElement): HTMLButtonElement[] {
  return Array.from(container.querySelectorAll<HTMLButtonElement>(".wizard-btn-run"));
}

/** Navigate to a step by clicking its nav button */
function navigateToStep(container: HTMLElement, stepIndex: number): void {
  const navBtns = container.querySelectorAll<HTMLButtonElement>(".wizard-nav-btn");
  navBtns[stepIndex]?.click();
}

/** Flush microtasks so async click handlers proceed */
function flush(): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, 0));
}

// ── Tests ─────────────────────────────────────────────────────────

describe("wizard sequential command execution", () => {
  let container: HTMLElement;

  beforeEach(() => {
    vi.clearAllMocks();
    container = document.createElement("div");
    document.body.innerHTML = "";
    document.body.appendChild(container);
  });

  describe("single command step", () => {
    it("executes one command and restores button label on success", async () => {
      const terminal = createMockTerminal();
      createWizard(container, () => terminal);

      // Step 1 is shown by default (single command)
      const [runBtn] = getRunButtons(container);
      expect(runBtn).toBeDefined();
      const originalLabel = runBtn.textContent;

      // Click Run
      runBtn.click();
      await flush();

      // Button should show running state
      expect(runBtn.textContent).toBe("Running\u2026");
      expect(runBtn.classList.contains("wizard-btn-running")).toBe(true);
      expect(runBtn.disabled).toBe(true);

      // Resolve the command with success
      terminal._resolve(0);
      await flush();

      // Button should be restored
      expect(runBtn.textContent).toBe(originalLabel);
      expect(runBtn.classList.contains("wizard-btn-running")).toBe(false);
      expect(runBtn.classList.contains("wizard-btn-failed")).toBe(false);
      expect(runBtn.disabled).toBe(false);
    });
  });

  describe("multi-command step success", () => {
    it("executes all commands in sequence and verifies order", async () => {
      const terminal = createMockTerminal();
      createWizard(container, () => terminal);

      // Navigate to step 2 (multi-command)
      navigateToStep(container, 1);
      await flush();

      const [runBtn] = getRunButtons(container);
      runBtn.click();
      await flush();

      // First command should be dispatched
      expect(terminal._executedCommands).toEqual(["cmd-a"]);

      // Resolve first command — second should be dispatched
      terminal._resolve(0);
      await flush();
      expect(terminal._executedCommands).toEqual(["cmd-a", "cmd-b"]);

      // Resolve second command — third should be dispatched
      terminal._resolve(0);
      await flush();
      expect(terminal._executedCommands).toEqual(["cmd-a", "cmd-b", "cmd-c"]);

      // Resolve third command — done
      terminal._resolve(0);
      await flush();

      // Button should be restored to idle
      expect(runBtn.classList.contains("wizard-btn-running")).toBe(false);
      expect(runBtn.classList.contains("wizard-btn-failed")).toBe(false);
      expect(runBtn.disabled).toBe(false);
    });
  });

  describe("multi-command step failure", () => {
    it("halts on non-zero exit code and shows failed state", async () => {
      const terminal = createMockTerminal();
      createWizard(container, () => terminal);

      // Navigate to step 2 (multi-command)
      navigateToStep(container, 1);
      await flush();

      const [runBtn] = getRunButtons(container);
      runBtn.click();
      await flush();

      // First command succeeds
      terminal._resolve(0);
      await flush();
      expect(terminal._executedCommands).toEqual(["cmd-a", "cmd-b"]);

      // Second command fails
      terminal._resolve(1);
      await flush();

      // Third command should NOT have been dispatched
      expect(terminal._executedCommands).toEqual(["cmd-a", "cmd-b"]);

      // Button should show failed state
      expect(runBtn.textContent).toBe("\u2718 Failed");
      expect(runBtn.classList.contains("wizard-btn-failed")).toBe(true);
      expect(runBtn.classList.contains("wizard-btn-running")).toBe(false);
      expect(runBtn.disabled).toBe(false);
    });
  });

  describe("button state transitions", () => {
    it("transitions through running -> success states", async () => {
      const terminal = createMockTerminal();
      createWizard(container, () => terminal);

      const [runBtn] = getRunButtons(container);
      const originalLabel = runBtn.textContent;

      // Initial state
      expect(runBtn.disabled).toBe(false);
      expect(runBtn.classList.contains("wizard-btn-running")).toBe(false);

      // Click Run
      runBtn.click();
      await flush();

      // Running state
      expect(runBtn.textContent).toBe("Running\u2026");
      expect(runBtn.classList.contains("wizard-btn-running")).toBe(true);
      expect(runBtn.disabled).toBe(true);

      // Success
      terminal._resolve(0);
      await flush();

      expect(runBtn.textContent).toBe(originalLabel);
      expect(runBtn.classList.contains("wizard-btn-running")).toBe(false);
      expect(runBtn.disabled).toBe(false);
    });

    it("transitions through running -> failed states", async () => {
      const terminal = createMockTerminal();
      createWizard(container, () => terminal);

      const [runBtn] = getRunButtons(container);

      runBtn.click();
      await flush();

      expect(runBtn.textContent).toBe("Running\u2026");

      // Fail
      terminal._resolve(1);
      await flush();

      expect(runBtn.textContent).toBe("\u2718 Failed");
      expect(runBtn.classList.contains("wizard-btn-failed")).toBe(true);
      expect(runBtn.classList.contains("wizard-btn-running")).toBe(false);
      expect(runBtn.disabled).toBe(false);
    });

    it("clears failed state on re-run", async () => {
      const terminal = createMockTerminal();
      createWizard(container, () => terminal);

      const [runBtn] = getRunButtons(container);

      // First run — fail
      runBtn.click();
      await flush();
      terminal._resolve(1);
      await flush();

      expect(runBtn.classList.contains("wizard-btn-failed")).toBe(true);

      // Second run — the failed class should be removed
      runBtn.click();
      await flush();

      expect(runBtn.classList.contains("wizard-btn-failed")).toBe(false);
      expect(runBtn.classList.contains("wizard-btn-running")).toBe(true);

      // Complete successfully
      terminal._resolve(0);
      await flush();

      expect(runBtn.classList.contains("wizard-btn-running")).toBe(false);
      expect(runBtn.classList.contains("wizard-btn-failed")).toBe(false);
    });
  });

  describe("global run guard", () => {
    it("prevents concurrent execution across steps", async () => {
      const terminal = createMockTerminal();
      createWizard(container, () => terminal);

      // Step 1 is active — click its Run button
      const [runBtn1] = getRunButtons(container);
      runBtn1.click();
      await flush();

      expect(runBtn1.disabled).toBe(true);

      // Navigate to step 2 while step 1 is still running
      navigateToStep(container, 1);
      await flush();

      // The Run button on step 2 should be disabled due to global guard
      const [runBtn2] = getRunButtons(container);
      // The new button won't be in allRunButtons since render() was called
      // and allRunButtons was cleared. But isRunning is still true, so
      // clicking should be a no-op.
      runBtn2.click();
      await flush();

      // No new command should have been dispatched (only the original "echo hello")
      expect(terminal._executedCommands).toEqual(["echo hello"]);

      // Resolve the original command
      terminal._resolve(0);
      await flush();
    });

    it("re-enables all Run buttons after execution completes", async () => {
      const terminal = createMockTerminal();
      createWizard(container, () => terminal);

      const [runBtn] = getRunButtons(container);
      runBtn.click();
      await flush();

      // While running, the button is disabled
      expect(runBtn.disabled).toBe(true);

      // Complete
      terminal._resolve(0);
      await flush();

      // Button should be re-enabled
      expect(runBtn.disabled).toBe(false);
    });
  });

  describe("audio dispatch", () => {
    it("calls handleCommandAudio for each command at dispatch time", async () => {
      const terminal = createMockTerminal();
      createWizard(container, () => terminal);

      // Navigate to step 2 (multi-command: cmd-a, cmd-b, cmd-c)
      navigateToStep(container, 1);
      await flush();

      const [runBtn] = getRunButtons(container);
      runBtn.click();
      await flush();

      // After first command dispatched, audio should be called once
      expect(handleCommandAudio).toHaveBeenCalledTimes(1);
      expect(handleCommandAudio).toHaveBeenCalledWith("cmd-a");

      terminal._resolve(0);
      await flush();

      // After second command dispatched
      expect(handleCommandAudio).toHaveBeenCalledTimes(2);
      expect(handleCommandAudio).toHaveBeenCalledWith("cmd-b");

      terminal._resolve(0);
      await flush();

      // After third command dispatched
      expect(handleCommandAudio).toHaveBeenCalledTimes(3);
      expect(handleCommandAudio).toHaveBeenCalledWith("cmd-c");

      terminal._resolve(0);
      await flush();
    });

    it("calls handleCommandAudio for failed command before halting", async () => {
      const terminal = createMockTerminal();
      createWizard(container, () => terminal);

      // Navigate to step 2
      navigateToStep(container, 1);
      await flush();

      const [runBtn] = getRunButtons(container);
      runBtn.click();
      await flush();

      // First command dispatched
      expect(handleCommandAudio).toHaveBeenCalledTimes(1);

      // First fails
      terminal._resolve(1);
      await flush();

      // Audio was called for the first command only; second was never dispatched
      expect(handleCommandAudio).toHaveBeenCalledTimes(1);
    });
  });

  describe("null terminal handling", () => {
    it("does nothing when getTerminal returns null", async () => {
      createWizard(container, () => null);

      const [runBtn] = getRunButtons(container);
      const originalLabel = runBtn.textContent;

      runBtn.click();
      await flush();

      // Button should remain in its original state (no running, no failed)
      expect(runBtn.textContent).toBe(originalLabel);
      expect(runBtn.classList.contains("wizard-btn-running")).toBe(false);
      expect(runBtn.classList.contains("wizard-btn-failed")).toBe(false);
      expect(runBtn.disabled).toBe(false);
    });
  });

  describe("executeCommand rejection handling", () => {
    it("shows failed state when executeCommand rejects", async () => {
      const terminal = createMockTerminal();
      // Override executeCommand to reject
      (terminal.executeCommand as Mock).mockRejectedValueOnce(
        new Error("WebSocket not connected"),
      );

      createWizard(container, () => terminal);

      const [runBtn] = getRunButtons(container);
      runBtn.click();
      await flush();

      // Button should show failed state
      expect(runBtn.textContent).toBe("\u2718 Failed");
      expect(runBtn.classList.contains("wizard-btn-failed")).toBe(true);
      expect(runBtn.disabled).toBe(false);
    });
  });
});
