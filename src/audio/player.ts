/**
 * Audio Player
 *
 * Writes rendered audio to a temporary WAV file and plays it through the
 * platform's system audio player.
 *
 * Supported platforms:
 * - Linux:   aplay, paplay, ffplay, or sox play (first available)
 * - WSL:     mshta.exe (preferred, fire-and-forget) or powershell.exe fallback
 * - macOS:   afplay
 * - Windows: powershell Start-Process / [System.Media.SoundPlayer]
 *
 * On WSL, uses fire-and-forget playback: the CLI spawns a detached Windows
 * player process and returns immediately without waiting for audio to finish.
 * This reduces perceived CLI latency from ~2.5s to near-instant.
 */

import { execFile, execFileSync, spawn } from "node:child_process";
import { readFileSync } from "node:fs";
import { writeFile, unlink } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { randomBytes } from "node:crypto";
import { encodeWav } from "./wav-encoder.js";

/** Options for audio playback. */
export interface PlayOptions {
  /** Sample rate in Hz (default: 44100). */
  sampleRate?: number;
  /** Duration of the audio in seconds (used for fire-and-forget timeout). */
  duration?: number;
}

/** A candidate audio player with its command and argument builder. */
interface PlayerCandidate {
  /** Binary name to look up via `which`. */
  command: string;
  /** Build the argument list for this player given a WAV file path. */
  args: (filePath: string) => string[];
}

/** Result of resolving a player command, including spawn strategy. */
export interface PlayerCommand {
  /** Binary to execute. */
  command: string;
  /** Arguments to pass. */
  args: string[];
  /**
   * If true, the player should be spawned detached and unref'd so the CLI
   * can exit immediately while audio plays in the background.
   */
  fireAndForget: boolean;
}

/** Linux audio players in order of preference. */
const LINUX_PLAYERS: PlayerCandidate[] = [
  { command: "aplay", args: (f) => ["-q", f] },
  { command: "paplay", args: (f) => [f] },
  { command: "ffplay", args: (f) => ["-nodisp", "-autoexit", "-loglevel", "quiet", f] },
  { command: "play", args: (f) => ["-q", f] }, // sox
];

/**
 * Check if a command is available on the system PATH.
 */
function isCommandAvailable(command: string): boolean {
  try {
    execFileSync("which", [command], { stdio: "ignore" });
    return true;
  } catch {
    return false;
  }
}

/**
 * Detect whether we are running inside WSL (Windows Subsystem for Linux).
 */
function isWSL(): boolean {
  try {
    const release = readFileSync("/proc/version", "utf-8");
    return release.toLowerCase().includes("microsoft");
  } catch {
    return false;
  }
}

/**
 * Convert a Linux path to a Windows path using wslpath.
 * Falls back to the \\wsl$ UNC convention if wslpath is unavailable.
 */
function toWindowsPath(linuxPath: string): string {
  try {
    return execFileSync("wslpath", ["-w", linuxPath], {
      encoding: "utf-8",
    }).trim();
  } catch {
    // Fallback: construct UNC path manually
    return `\\\\wsl$\\${linuxPath}`;
  }
}

/**
 * Find the first available audio player on Linux.
 *
 * @returns The player candidate, or null if none found.
 */
function findLinuxPlayer(): PlayerCandidate | null {
  for (const candidate of LINUX_PLAYERS) {
    if (isCommandAvailable(candidate.command)) {
      return candidate;
    }
  }
  return null;
}

/**
 * Build an mshta.exe command that plays a WAV file via WMPlayer ActiveX
 * and auto-closes after the audio finishes.
 *
 * mshta.exe runs an inline HTML Application (HTA) containing JavaScript
 * that creates a WMPlayer.OCX ActiveXObject. The setTimeout ensures the
 * HTA window closes after playback completes.
 *
 * @param winPath  - Windows-format path to the WAV file.
 * @param timeoutMs - How long to keep the HTA alive before closing (ms).
 * @returns The mshta.exe argument string.
 */
function buildMshtaScript(winPath: string, timeoutMs: number): string {
  // Escape backslashes for JavaScript string literal inside the HTA
  const escaped = winPath.replace(/\\/g, "\\\\");
  return (
    `javascript:` +
    `var p=new ActiveXObject('WMPlayer.OCX');` +
    `p.URL='${escaped}';` +
    `p.controls.play();` +
    `setTimeout(function(){close()},${timeoutMs});`
  );
}

/**
 * Get the system audio player command and arguments for the current platform.
 *
 * On WSL, prefers mshta.exe (fast, ~0.5s startup) for fire-and-forget
 * playback. Falls back to powershell.exe if mshta.exe is unavailable.
 * On native Linux, probes for aplay, paplay, ffplay, play (sox).
 *
 * @param filePath   - Path to the WAV file to play.
 * @param durationMs - Audio duration in milliseconds (for fire-and-forget timeout).
 * @returns Object with `command`, `args`, and `fireAndForget` flag.
 * @throws If no supported audio player is found.
 */
export function getPlayerCommand(filePath: string, durationMs = 2000): PlayerCommand {
  switch (process.platform) {
    case "linux": {
      if (isWSL()) {
        const winPath = toWindowsPath(filePath);

        // Prefer mshta.exe: fast startup, fire-and-forget
        if (isCommandAvailable("mshta.exe")) {
          // Add 1.5s buffer to ensure audio finishes before HTA closes
          const timeoutMs = durationMs + 1500;
          return {
            command: "mshta.exe",
            args: [buildMshtaScript(winPath, timeoutMs)],
            fireAndForget: true,
          };
        }

        // Fallback: powershell.exe (synchronous, ~2.4s startup)
        if (isCommandAvailable("powershell.exe")) {
          return {
            command: "powershell.exe",
            args: [
              "-NoProfile",
              "-Command",
              `(New-Object System.Media.SoundPlayer '${winPath}').PlaySync()`,
            ],
            fireAndForget: false,
          };
        }
      }

      const player = findLinuxPlayer();
      if (!player) {
        const wslHint = isWSL()
          ? "\n  Or ensure powershell.exe is on your PATH (WSL detected)."
          : "";
        throw new Error(
          "No audio player found. Install one of:\n" +
          "  sudo apt install alsa-utils      # provides aplay\n" +
          "  sudo apt install pulseaudio-utils # provides paplay\n" +
          "  sudo apt install ffmpeg           # provides ffplay\n" +
          "  sudo apt install sox              # provides play" +
          wslHint,
        );
      }
      return { command: player.command, args: player.args(filePath), fireAndForget: false };
    }
    case "darwin":
      return { command: "afplay", args: [filePath], fireAndForget: false };
    case "win32":
      return {
        command: "powershell",
        args: [
          "-NoProfile",
          "-Command",
          `(New-Object System.Media.SoundPlayer '${filePath}').PlaySync()`,
        ],
        fireAndForget: false,
      };
    default:
      throw new Error(
        `Unsupported platform for audio playback: ${process.platform}`,
      );
  }
}

/**
 * Play audio samples through the system speakers.
 *
 * Encodes the samples as a temporary WAV file and invokes the platform audio
 * player. On WSL with mshta.exe, uses fire-and-forget: spawns a detached
 * player process and returns immediately. The temp file is intentionally NOT
 * cleaned up in fire-and-forget mode since the player is still using it;
 * the OS will clean tmpdir eventually.
 *
 * For synchronous players, waits for playback to complete and cleans up
 * the temp file afterward.
 *
 * @param samples - Float32Array of audio samples in [-1, 1] range.
 * @param options - Playback options.
 * @throws If encoding, file I/O, or playback fails.
 */
export async function playAudio(
  samples: Float32Array,
  options: PlayOptions = {},
): Promise<void> {
  const { sampleRate = 44100, duration } = options;

  // Encode to WAV
  const wavBuffer = encodeWav(samples, { sampleRate });

  // Write to temp file with a unique name
  const tempName = `toneforge-${randomBytes(8).toString("hex")}.wav`;
  const tempPath = join(tmpdir(), tempName);

  await writeFile(tempPath, wavBuffer);

  // Compute duration in ms for fire-and-forget timeout
  const durationMs = duration !== undefined
    ? Math.ceil(duration * 1000)
    : Math.ceil((samples.length / sampleRate) * 1000);

  const { command, args, fireAndForget } = getPlayerCommand(tempPath, durationMs);

  if (fireAndForget) {
    // Spawn detached: the player runs in the background, CLI exits immediately.
    // We intentionally skip temp file cleanup — the detached process needs
    // the file, and the OS will clean tmpdir on its own schedule.
    const child = spawn(command, args, {
      detached: true,
      stdio: "ignore",
    });
    child.unref();
    return;
  }

  // Synchronous path: wait for playback, then clean up
  try {
    await new Promise<void>((resolve, reject) => {
      execFile(command, args, (error) => {
        if (error) {
          reject(
            new Error(
              `Audio playback failed (${command}): ${error.message}`,
            ),
          );
        } else {
          resolve();
        }
      });
    });
  } finally {
    // Always clean up the temp file
    await unlink(tempPath).catch(() => {
      // Silently ignore cleanup errors — the OS will eventually clean tmpdir
    });
  }
}
