/**
 * CLI End-to-End Tests (run via `npm run test:e2e`)
 *
 * These tests exercise the FULL pipeline including system audio player
 * detection and invocation. They are excluded from the default `npm test`
 * run because they require a working audio player (aplay, paplay, ffplay,
 * or sox) to be installed on the system.
 *
 * When run, these tests FAIL HARD if no audio player is found — that is
 * the exact bug they exist to catch. A cryptic "spawn aplay ENOENT" at
 * runtime should surface here first.
 *
 * Run:   npm run test:e2e
 * Requires: at least one of aplay, paplay, ffplay, play (sox)
 *
 * Work item: TF-0MLW2GCS31CTRQ4T
 */

import { describe, it, expect } from "vitest";
import { execFileSync } from "node:child_process";
import { existsSync } from "node:fs";
import { getPlayerCommand } from "./audio/player.js";

/**
 * Check if any supported audio player is available on this system.
 */
function detectAudioPlayer(): { available: boolean; command?: string; reason?: string } {
  try {
    const { command } = getPlayerCommand("/dev/null");
    return { available: true, command };
  } catch (error) {
    return {
      available: false,
      reason: error instanceof Error ? error.message : String(error),
    };
  }
}

describe("CLI E2E — audio player detection and playback", () => {
  it("fails if no supported audio player binary is installed", () => {
    const detection = detectAudioPlayer();

    if (!detection.available) {
      expect.fail(
        `No audio player found on this system. ` +
        `The 'toneforge generate' command will fail with ENOENT at runtime.\n\n` +
        `Install one of:\n` +
        `  - aplay   (sudo apt install alsa-utils)\n` +
        `  - paplay  (sudo apt install pulseaudio-utils)\n` +
        `  - ffplay  (sudo apt install ffmpeg)\n` +
        `  - play    (sudo apt install sox)\n\n` +
        `Detected: ${detection.reason}`,
      );
    }

    // Verify the detected command actually exists on PATH
    expect(detection.command).toBeDefined();
    const binaryPath = execFileSync("which", [detection.command!], {
      encoding: "utf-8",
    }).trim();
    expect(binaryPath.length).toBeGreaterThan(0);
    expect(existsSync(binaryPath)).toBe(true);
  });

  it("getPlayerCommand returns a valid command with the file path in args", () => {
    const detection = detectAudioPlayer();
    if (!detection.available) {
      expect.fail("Skipped: no audio player (see test above).");
    }

    const { command, args } = getPlayerCommand("/tmp/test.wav");
    expect(typeof command).toBe("string");
    expect(command.length).toBeGreaterThan(0);
    expect(Array.isArray(args)).toBe(true);
    expect(args.length).toBeGreaterThan(0);
    // The file path (or a platform-converted equivalent) must appear in the args
    // On WSL, the Linux path is converted to a Windows UNC path (e.g. \\wsl.localhost\...)
    const hasPath = args.some((a) => a.includes("test.wav"));
    expect(hasPath).toBe(true);
  });

  it("full CLI pipeline: generate renders and plays with exit code 0", async () => {
    const detection = detectAudioPlayer();
    if (!detection.available) {
      expect.fail("Skipped: no audio player (see test above).");
    }

    // Import main — no vi.mock on playAudio in this file
    const { main } = await import("./cli.js");

    const stdoutLines: string[] = [];
    const stderrLines: string[] = [];
    const origLog = console.log;
    const origError = console.error;
    console.log = (...args: unknown[]) => stdoutLines.push(args.map(String).join(" "));
    console.error = (...args: unknown[]) => stderrLines.push(args.map(String).join(" "));

    try {
      const code = await main([
        "node", "cli.ts", "generate",
        "--recipe", "ui-scifi-confirm",
        "--seed", "42",
      ]);

      const stdout = stdoutLines.join("\n");

      const stderr = stderrLines.join("\n");

      if (code !== 0) {
        expect.fail(
          `CLI exited with code ${code}.\n` +
          `stdout:\n${stdout}\n` +
          `stderr:\n${stderr}`,
        );
      }
      expect(stdout).toContain("Generating");
      expect(stdout).toContain("ui-scifi-confirm");
      expect(stdout).toContain("seed 42");
      expect(stdout).toContain("Rendered");
      expect(stdout).toContain("Playing...");
      expect(stdout).toContain("Done.");
    } finally {
      console.log = origLog;
      console.error = origError;
    }
  }, 15_000); // Allow extra time for rendering + playback
});
