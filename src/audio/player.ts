/**
 * Audio Player
 *
 * Writes rendered audio to a temporary WAV file and plays it through the
 * platform's system audio player. Cleans up the temp file after playback.
 *
 * Supported platforms:
 * - Linux:   aplay, paplay, ffplay, or sox play (first available)
 * - macOS:   afplay
 * - Windows: powershell Start-Process / [System.Media.SoundPlayer]
 */

import { execFile, execFileSync } from "node:child_process";
import { writeFile, unlink } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { randomBytes } from "node:crypto";
import { encodeWav } from "./wav-encoder.js";

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
 * On Linux, probes for available players in order of preference:
 * aplay, paplay, ffplay, play (sox).
 *
 * @param filePath - Path to the WAV file to play.
 * @returns Object with `command` and `args` for execFile.
 * @throws If no supported audio player is found.
 */
export function getPlayerCommand(filePath: string): { command: string; args: string[] } {
  switch (process.platform) {
    case "linux": {
      const player = findLinuxPlayer();
      if (!player) {
        throw new Error(
          "No audio player found. Install one of:\n" +
          "  sudo apt install alsa-utils      # provides aplay\n" +
          "  sudo apt install pulseaudio-utils # provides paplay\n" +
          "  sudo apt install ffmpeg           # provides ffplay\n" +
          "  sudo apt install sox              # provides play",
        );
      }
      return { command: player.command, args: player.args(filePath) };
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
 * Encodes the samples as a temporary WAV file, invokes the platform audio
 * player, and cleans up the temp file when playback completes.
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

  // Encode to WAV
  const wavBuffer = encodeWav(samples, { sampleRate });

  // Write to temp file with a unique name
  const tempName = `toneforge-${randomBytes(8).toString("hex")}.wav`;
  const tempPath = join(tmpdir(), tempName);

  await writeFile(tempPath, wavBuffer);

  try {
    const { command, args } = getPlayerCommand(tempPath);

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
