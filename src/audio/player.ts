/**
 * Audio Player
 *
 * Plays rendered audio through the platform's system audio player.
 *
 * Two playback paths are available:
 * 1. **Stdin piping** (preferred): WAV data is piped directly to the
 *    player's stdin, avoiding filesystem I/O entirely.
 * 2. **Temp file** (fallback): WAV data is written to a temp file,
 *    the player reads the file, and the file is cleaned up afterward.
 *
 * Stdin piping is attempted first for players known to support it
 * (paplay, aplay, ffplay). If it fails, the temp-file path is used
 * automatically.
 *
 * Supported platforms:
 * - Linux:   aplay, paplay, ffplay, or sox play (first available)
 * - WSL:     powershell.exe via Windows audio (when interop is enabled)
 * - macOS:   afplay
 * - Windows: powershell Start-Process / [System.Media.SoundPlayer]
 */

import { existsSync } from "node:fs";
import { execFile, execFileSync, spawn } from "node:child_process";
import { readFileSync } from "node:fs";
import { writeFile, unlink } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { randomBytes } from "node:crypto";
import { encodeWav } from "./wav-encoder.js";
import { profiler } from "../core/profiler.js";

/** Options for audio playback. */
export interface PlayOptions {
  /** Sample rate in Hz (default: 44100). */
  sampleRate?: number;
}

/** A candidate audio player with its command and argument builder. */
interface PlayerCandidate {
  /** Binary name to look up via `which`. */
  command: string;
  /** Build the argument list for this player given a WAV file path. */
  args: (filePath: string) => string[];
}

/**
 * Detect whether a PulseAudio server is reachable.  WSLg exposes a
 * PulseAudio socket at /mnt/wslg/PulseServer which the ALSA `pulse`
 * plugin can use, but the default ALSA device (hw:0) won't exist
 * because there is no physical sound card.  When PulseAudio is
 * available we tell aplay to use `-D pulse` so it routes audio
 * through the WSLg / PulseAudio server instead of trying to open
 * non-existent hardware.
 */
function hasPulseAudio(): boolean {
  // Check the well-known WSLg socket first, then the PULSE_SERVER env
  // variable (which WSLg also sets).
  if (existsSync("/mnt/wslg/PulseServer")) return true;
  if (process.env.PULSE_SERVER) return true;
  return false;
}

/** Linux audio players in order of preference. */
const LINUX_PLAYERS: PlayerCandidate[] = [
  { command: "paplay", args: (f) => [f] },
  { command: "aplay", args: (f) => hasPulseAudio() ? ["-D", "pulse", "-q", f] : ["-q", f] },
  { command: "ffplay", args: (f) => ["-nodisp", "-autoexit", "-loglevel", "quiet", f] },
  { command: "play", args: (f) => ["-q", f] }, // sox
];

/**
 * A candidate audio player that supports receiving WAV data on stdin.
 * These players are checked before the temp-file path for lower latency.
 */
interface StdinPlayerCandidate {
  /** Binary name to look up via `which`. */
  command: string;
  /** Arguments to pass when piping WAV data on stdin. */
  stdinArgs: () => string[];
}

/**
 * Linux audio players that accept WAV data on stdin, in preference order.
 *
 * - paplay: reads WAV from stdin by default (no special args needed)
 * - aplay:  reads from stdin when given `-` as the file; honours `-D pulse`
 * - ffplay: reads from stdin with `-i pipe:0`
 */
const STDIN_PLAYERS: StdinPlayerCandidate[] = [
  { command: "paplay", stdinArgs: () => [] },
  {
    command: "aplay",
    stdinArgs: () =>
      hasPulseAudio() ? ["-D", "pulse", "-q", "-"] : ["-q", "-"],
  },
  {
    command: "ffplay",
    stdinArgs: () => ["-i", "pipe:0", "-nodisp", "-autoexit", "-loglevel", "quiet"],
  },
];

/**
 * Find the first available stdin-capable audio player.
 *
 * @returns The stdin player candidate, or null if none found.
 */
function findStdinPlayer(): StdinPlayerCandidate | null {
  for (const candidate of STDIN_PLAYERS) {
    if (isCommandAvailable(candidate.command)) {
      return candidate;
    }
  }
  return null;
}

/**
 * Play a WAV buffer by piping it to an audio player's stdin.
 *
 * @param wavBuffer - The complete WAV file as a Buffer.
 * @param player    - The stdin-capable player to use.
 * @returns A promise that resolves when playback completes.
 * @throws If the player process exits with an error.
 */
function playViaStdin(
  wavBuffer: Buffer,
  player: StdinPlayerCandidate,
): Promise<void> {
  return new Promise<void>((resolve, reject) => {
    const args = player.stdinArgs();
    const child = spawn(player.command, args, {
      stdio: ["pipe", "ignore", "ignore"],
    });

    child.on("error", (err) => {
      reject(
        new Error(
          `Stdin playback failed to spawn (${player.command}): ${err.message}`,
        ),
      );
    });

    child.on("close", (code) => {
      if (code === 0) {
        resolve();
      } else {
        reject(
          new Error(
            `Stdin playback failed (${player.command}): exited with code ${code}`,
          ),
        );
      }
    });

    // Write the entire WAV buffer and close stdin to signal EOF.
    child.stdin!.end(wavBuffer);
  });
}

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
 * Check whether WSL interop is enabled so that Windows .exe binaries
 * can actually be launched from inside WSL. When the binfmt_misc
 * registration exists the kernel knows how to execute PE binaries;
 * without it, attempting to run e.g. `powershell.exe` will cause the
 * shell to interpret the PE header as text (the "MZ...: not found"
 * error).
 */
function isWSLInteropEnabled(): boolean {
  try {
    return existsSync("/proc/sys/fs/binfmt_misc/WSLInterop");
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
 * Get the system audio player command and arguments for the current platform.
 *
 * On Linux, first tries native players (aplay, paplay, ffplay, sox).
 * On WSL with interop enabled and no native player available, falls back
 * to powershell.exe to play audio through the Windows host.
 *
 * @param filePath - Path to the WAV file to play.
 * @returns Object with `command` and `args` for execFile.
 * @throws If no supported audio player is found.
 */
export function getPlayerCommand(filePath: string): { command: string; args: string[] } {
  switch (process.platform) {
    case "linux": {
      // Prefer native Linux players — they work in both plain Linux and
      // WSL (when PulseAudio/ALSA are configured) and avoid the fragile
      // WSL-interop PE-binary execution path.
      const player = findLinuxPlayer();
      if (player) {
        return { command: player.command, args: player.args(filePath) };
      }

      // No native player found. On WSL with interop enabled, try
      // powershell.exe as a last resort to play through Windows audio.
      if (isWSL() && isWSLInteropEnabled() && isCommandAvailable("powershell.exe")) {
        const winPath = toWindowsPath(filePath);
        return {
          command: "powershell.exe",
          args: [
            "-NoProfile",
            "-Command",
            `(New-Object System.Media.SoundPlayer '${winPath}').PlaySync()`,
          ],
        };
      }

      const wslHint = isWSL()
        ? "\n  Or enable WSL interop so powershell.exe can be used (see https://learn.microsoft.com/windows/wsl/interop)."
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
    case "darwin":
      return { command: "afplay", args: [filePath] };
    case "win32":
      return {
        command: "powershell",
        args: [
          "-NoProfile",
          "-Command",
          `(New-Object System.Media.SoundPlayer '${filePath}').PlaySync()`,
        ],
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
 * Prefers piping WAV data directly to a player's stdin (zero disk I/O).
 * Falls back to writing a temp file when stdin piping is unavailable or
 * fails.
 *
 * @param samples - Float32Array of audio samples in [-1, 1] range.
 * @param options - Playback options.
 * @throws If encoding, file I/O, or playback fails.
 */
export async function playAudio(
  samples: Float32Array,
  options: PlayOptions = {},
): Promise<void> {
  const { sampleRate = 44100 } = options;

  // Validate samples contain non-silent audio
  if (samples.length === 0) {
    throw new Error("Cannot play empty audio buffer (0 samples).");
  }

  let peak = 0;
  for (let i = 0; i < samples.length; i++) {
    const abs = Math.abs(samples[i]);
    if (abs > peak) peak = abs;
  }
  if (peak === 0) {
    console.warn(
      "Audio buffer is completely silent (all zeros). " +
      "The recipe may have failed to produce output.",
    );
  } else if (peak < 0.001) {
    console.warn(
      `Audio buffer peak amplitude is very low (${peak.toFixed(6)}). ` +
      "Playback may be inaudible.",
    );
  }

  // Encode to WAV
  const wavBuffer = encodeWav(samples, { sampleRate });
  profiler.mark("wav_encode");

  // --- Fast path: pipe WAV to player stdin (no temp file) ---
  const stdinPlayer = findStdinPlayer();
  if (stdinPlayer) {
    try {
      profiler.mark("playback_launch");
      await playViaStdin(wavBuffer, stdinPlayer);
      return; // Success — skip temp-file path entirely.
    } catch {
      // Stdin piping failed; fall through to temp-file path.
    }
  }

  // --- Fallback path: write to temp file ---
  const tempName = `toneforge-${randomBytes(8).toString("hex")}.wav`;
  const tempPath = join(tmpdir(), tempName);

  await writeFile(tempPath, wavBuffer);
  profiler.mark("file_write");

  try {
    const { command, args } = getPlayerCommand(tempPath);
    profiler.mark("playback_launch");

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
