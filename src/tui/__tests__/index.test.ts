import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { setTtyOverride } from "../../output.js";
import { launchWizard } from "../index.js";

describe("launchWizard", () => {
  // Capture stderr writes for assertion
  let stderrOutput: string;

  beforeEach(() => {
    stderrOutput = "";
    vi.spyOn(process.stderr, "write").mockImplementation((chunk) => {
      stderrOutput += String(chunk);
      return true;
    });
  });

  afterEach(() => {
    setTtyOverride(undefined);
    vi.restoreAllMocks();
  });

  it("returns exit code 1 and prints an error in non-TTY environments", async () => {
    setTtyOverride(false);

    const exitCode = await launchWizard();

    expect(exitCode).toBe(1);
    expect(stderrOutput).toContain("interactive terminal");
    expect(stderrOutput).toContain("TTY");
  });
});
