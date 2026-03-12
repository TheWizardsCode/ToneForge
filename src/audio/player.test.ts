import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { EventEmitter } from "node:events";
import type { ChildProcess } from "node:child_process";

// ---------------------------------------------------------------------------
// Mocks — set up before importing the module under test
// ---------------------------------------------------------------------------

// Mock child_process: execFileSync (for `which` checks), execFile, spawn
const mockExecFileSync = vi.fn();
const mockExecFile = vi.fn();
const mockSpawn = vi.fn();
vi.mock("node:child_process", () => ({
  execFileSync: (...args: unknown[]) => mockExecFileSync(...args),
  execFile: (...args: unknown[]) => mockExecFile(...args),
  spawn: (...args: unknown[]) => mockSpawn(...args),
}));

// Mock fs (existsSync, readFileSync) — used for PulseAudio / WSL detection
const mockExistsSync = vi.fn().mockReturnValue(false);
const mockReadFileSync = vi.fn().mockReturnValue("");
vi.mock("node:fs", () => ({
  existsSync: (...args: unknown[]) => mockExistsSync(...args),
  readFileSync: (...args: unknown[]) => mockReadFileSync(...args),
}));

// Mock fs/promises (writeFile, unlink) — used in temp-file fallback
const mockWriteFile = vi.fn().mockResolvedValue(undefined);
const mockUnlink = vi.fn().mockResolvedValue(undefined);
vi.mock("node:fs/promises", () => ({
  writeFile: (...args: unknown[]) => mockWriteFile(...args),
  unlink: (...args: unknown[]) => mockUnlink(...args),
}));

// Mock wav-encoder
vi.mock("./wav-encoder.js", () => ({
  encodeWav: vi.fn().mockReturnValue(Buffer.from("RIFF-fake-wav")),
}));

// Mock profiler
vi.mock("../core/profiler.js", () => ({
  profiler: { mark: vi.fn() },
}));

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/** Create a fake ChildProcess EventEmitter with a writable stdin stub. */
function fakeChild(): ChildProcess & EventEmitter {
  const child = new EventEmitter() as ChildProcess & EventEmitter;
  (child as unknown as Record<string, unknown>).stdin = {
    end: vi.fn(),
    on: vi.fn(),
    once: vi.fn(),
    emit: vi.fn(),
    write: vi.fn(),
  };
  return child;
}

/**
 * Configure `mockExecFileSync` so that `which <cmd>` succeeds for the
 * listed commands and throws for anything else.
 */
function setAvailableCommands(...cmds: string[]): void {
  mockExecFileSync.mockImplementation(
    (bin: string, args: string[]) => {
      if (bin === "which" && cmds.includes(args[0])) return "";
      throw new Error(`not found: ${args?.[0]}`);
    },
  );
}

// ---------------------------------------------------------------------------
// Import module under test (after mocks are wired)
// ---------------------------------------------------------------------------
import { playAudio, getPlayerCommand } from "./player.js";
import { profiler } from "../core/profiler.js";

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe("player", () => {
  const samples = new Float32Array([0, 0.5, -0.5]);

  beforeEach(() => {
    vi.clearAllMocks();
    // Default: Linux platform, no special env
    vi.stubGlobal("process", {
      ...process,
      platform: "linux",
      env: { ...process.env, PULSE_SERVER: undefined },
    });
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  // -----------------------------------------------------------------------
  // stdin piping path
  // -----------------------------------------------------------------------
  describe("stdin piping (fast path)", () => {
    it("pipes WAV to paplay stdin when paplay is available", async () => {
      setAvailableCommands("paplay");

      const child = fakeChild();
      mockSpawn.mockReturnValue(child);

      const promise = playAudio(samples);

      // spawn should have been called with paplay and no extra args
      expect(mockSpawn).toHaveBeenCalledWith("paplay", [], {
        stdio: ["pipe", "ignore", "ignore"],
      });

      // Simulate successful playback
      child.emit("close", 0);
      await promise;

      // WAV data should have been piped via stdin.end()
      expect((child.stdin as unknown as Record<string, ReturnType<typeof vi.fn>>).end).toHaveBeenCalled();

      // No temp file should have been written
      expect(mockWriteFile).not.toHaveBeenCalled();
      expect(mockUnlink).not.toHaveBeenCalled();

      // Profiler marks
      expect(profiler.mark).toHaveBeenCalledWith("wav_encode");
      expect(profiler.mark).toHaveBeenCalledWith("playback_launch");
    });

    it("pipes WAV to aplay stdin with PulseAudio args when available", async () => {
      setAvailableCommands("aplay");
      mockExistsSync.mockImplementation(
        (p: string) => p === "/mnt/wslg/PulseServer",
      );

      const child = fakeChild();
      mockSpawn.mockReturnValue(child);

      const promise = playAudio(samples);

      expect(mockSpawn).toHaveBeenCalledWith(
        "aplay",
        ["-D", "pulse", "-q", "-"],
        { stdio: ["pipe", "ignore", "ignore"] },
      );

      child.emit("close", 0);
      await promise;

      expect(mockWriteFile).not.toHaveBeenCalled();
    });

    it("pipes WAV to aplay stdin without PulseAudio args when PA unavailable", async () => {
      setAvailableCommands("aplay");
      mockExistsSync.mockReturnValue(false);

      const child = fakeChild();
      mockSpawn.mockReturnValue(child);

      const promise = playAudio(samples);

      expect(mockSpawn).toHaveBeenCalledWith(
        "aplay",
        ["-q", "-"],
        { stdio: ["pipe", "ignore", "ignore"] },
      );

      child.emit("close", 0);
      await promise;
    });

    it("pipes WAV to ffplay stdin when paplay and aplay are unavailable", async () => {
      setAvailableCommands("ffplay");

      const child = fakeChild();
      mockSpawn.mockReturnValue(child);

      const promise = playAudio(samples);

      expect(mockSpawn).toHaveBeenCalledWith(
        "ffplay",
        ["-i", "pipe:0", "-nodisp", "-autoexit", "-loglevel", "quiet"],
        { stdio: ["pipe", "ignore", "ignore"] },
      );

      child.emit("close", 0);
      await promise;
    });

    it("prefers paplay over aplay and ffplay", async () => {
      setAvailableCommands("paplay", "aplay", "ffplay");

      const child = fakeChild();
      mockSpawn.mockReturnValue(child);

      const promise = playAudio(samples);

      expect(mockSpawn).toHaveBeenCalledWith("paplay", [], expect.any(Object));

      child.emit("close", 0);
      await promise;
    });
  });

  // -----------------------------------------------------------------------
  // stdin piping failure → fallback to temp file
  // -----------------------------------------------------------------------
  describe("fallback from stdin to temp file", () => {
    it("falls back to temp file when stdin player exits with non-zero", async () => {
      setAvailableCommands("paplay");

      // Stdin path: spawn returns a child that exits with code 1
      const stdinChild = fakeChild();
      mockSpawn.mockReturnValue(stdinChild);

      // Temp-file path: execFile succeeds
      mockExecFile.mockImplementation(
        (_cmd: string, _args: string[], cb: (err: Error | null) => void) => {
          cb(null);
        },
      );

      const promise = playAudio(samples);

      // Trigger stdin failure
      stdinChild.emit("close", 1);
      await promise;

      // Temp file should have been written and cleaned up
      expect(mockWriteFile).toHaveBeenCalled();
      expect(mockUnlink).toHaveBeenCalled();
    });

    it("falls back to temp file when spawn emits an error", async () => {
      setAvailableCommands("paplay");

      const stdinChild = fakeChild();
      mockSpawn.mockReturnValue(stdinChild);

      mockExecFile.mockImplementation(
        (_cmd: string, _args: string[], cb: (err: Error | null) => void) => {
          cb(null);
        },
      );

      const promise = playAudio(samples);

      // Trigger spawn error
      stdinChild.emit("error", new Error("ENOENT"));
      await promise;

      expect(mockWriteFile).toHaveBeenCalled();
    });
  });

  // -----------------------------------------------------------------------
  // temp file path (no stdin player available)
  // -----------------------------------------------------------------------
  describe("temp file path (no stdin player)", () => {
    it("writes temp file and plays via execFile when no stdin player exists", async () => {
      // Only sox `play` is available — not in STDIN_PLAYERS list
      setAvailableCommands("play");

      mockExecFile.mockImplementation(
        (_cmd: string, _args: string[], cb: (err: Error | null) => void) => {
          cb(null);
        },
      );

      await playAudio(samples);

      // Should NOT have tried stdin
      expect(mockSpawn).not.toHaveBeenCalled();

      // Should have written temp file
      expect(mockWriteFile).toHaveBeenCalled();
      const writtenPath = mockWriteFile.mock.calls[0][0] as string;
      expect(writtenPath).toMatch(/toneforge-[0-9a-f]+\.wav$/);

      // Should have cleaned up
      expect(mockUnlink).toHaveBeenCalledWith(writtenPath);

      // Profiler marks for file path
      expect(profiler.mark).toHaveBeenCalledWith("wav_encode");
      expect(profiler.mark).toHaveBeenCalledWith("file_write");
      expect(profiler.mark).toHaveBeenCalledWith("playback_launch");
    });

    it("cleans up temp file even when playback fails", async () => {
      setAvailableCommands("play");

      mockExecFile.mockImplementation(
        (_cmd: string, _args: string[], cb: (err: Error | null) => void) => {
          cb(new Error("playback crashed"));
        },
      );

      await expect(playAudio(samples)).rejects.toThrow("Audio playback failed");

      // Temp file should still be cleaned up
      expect(mockUnlink).toHaveBeenCalled();
    });
  });

  // -----------------------------------------------------------------------
  // Lifecycle hooks
  // -----------------------------------------------------------------------
  describe("lifecycle hooks", () => {
    it("calls onProcessSpawned on the stdin path", async () => {
      setAvailableCommands("paplay");

      const child = fakeChild();
      mockSpawn.mockReturnValue(child);

      const onProcessSpawned = vi.fn();
      const promise = playAudio(samples, {
        lifecycle: { onProcessSpawned },
      });

      expect(onProcessSpawned).toHaveBeenCalledOnce();
      expect(onProcessSpawned).toHaveBeenCalledWith(child);

      child.emit("close", 0);
      await promise;
    });

    it("calls onProcessSpawned on the temp-file path", async () => {
      setAvailableCommands("play"); // sox — not in STDIN_PLAYERS

      const execChild = fakeChild();
      mockExecFile.mockImplementation(
        (_cmd: string, _args: string[], cb: (err: Error | null) => void) => {
          cb(null);
          return execChild;
        },
      );

      const onProcessSpawned = vi.fn();
      await playAudio(samples, {
        lifecycle: { onProcessSpawned },
      });

      expect(onProcessSpawned).toHaveBeenCalledOnce();
      expect(onProcessSpawned).toHaveBeenCalledWith(execChild);
    });

    it("calls onTempFileCreated and onTempFileRemoved on the temp-file path", async () => {
      setAvailableCommands("play"); // sox — not in STDIN_PLAYERS

      mockExecFile.mockImplementation(
        (_cmd: string, _args: string[], cb: (err: Error | null) => void) => {
          cb(null);
        },
      );

      const onTempFileCreated = vi.fn();
      const onTempFileRemoved = vi.fn();
      await playAudio(samples, {
        lifecycle: { onTempFileCreated, onTempFileRemoved },
      });

      expect(onTempFileCreated).toHaveBeenCalledOnce();
      const createdPath = onTempFileCreated.mock.calls[0]![0] as string;
      expect(createdPath).toMatch(/toneforge-[0-9a-f]+\.wav$/);

      expect(onTempFileRemoved).toHaveBeenCalledOnce();
      expect(onTempFileRemoved).toHaveBeenCalledWith(createdPath);
    });

    it("calls onTempFileRemoved even when playback fails", async () => {
      setAvailableCommands("play"); // sox

      mockExecFile.mockImplementation(
        (_cmd: string, _args: string[], cb: (err: Error | null) => void) => {
          cb(new Error("crash"));
        },
      );

      const onTempFileCreated = vi.fn();
      const onTempFileRemoved = vi.fn();
      await expect(
        playAudio(samples, {
          lifecycle: { onTempFileCreated, onTempFileRemoved },
        }),
      ).rejects.toThrow("Audio playback failed");

      // Temp file should still be cleaned up and hook notified
      expect(onTempFileRemoved).toHaveBeenCalledOnce();
      expect(onTempFileRemoved).toHaveBeenCalledWith(
        onTempFileCreated.mock.calls[0]![0],
      );
    });

    it("does not error when no lifecycle hooks are provided", async () => {
      setAvailableCommands("paplay");

      const child = fakeChild();
      mockSpawn.mockReturnValue(child);

      const promise = playAudio(samples); // no lifecycle option
      child.emit("close", 0);
      await promise; // should not throw
    });
  });

  // -----------------------------------------------------------------------
  // getPlayerCommand
  // -----------------------------------------------------------------------
  describe("getPlayerCommand", () => {
    it("returns paplay when available on Linux", () => {
      setAvailableCommands("paplay");
      const result = getPlayerCommand("/tmp/test.wav");
      expect(result.command).toBe("paplay");
      expect(result.args).toEqual(["/tmp/test.wav"]);
    });

    it("returns afplay on darwin", () => {
      vi.stubGlobal("process", { ...process, platform: "darwin" });
      const result = getPlayerCommand("/tmp/test.wav");
      expect(result.command).toBe("afplay");
    });

    it("throws on unsupported platform", () => {
      vi.stubGlobal("process", { ...process, platform: "freebsd" });
      expect(() => getPlayerCommand("/tmp/test.wav")).toThrow("Unsupported platform");
    });

    it("throws when no player found on Linux", () => {
      setAvailableCommands(); // none available
      mockReadFileSync.mockReturnValue("Linux 5.15"); // not WSL
      expect(() => getPlayerCommand("/tmp/test.wav")).toThrow("No audio player found");
    });
  });
});
