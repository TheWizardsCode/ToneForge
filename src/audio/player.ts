/**
 * Audio Player
 *
 * Writes rendered audio to a temporary WAV file and plays it through the
 * platform's system audio player. Cleans up the temp file after playback.
 *
 * Supported platforms:
 * - Linux:   aplay (ALSA utils)
 * - macOS:   afplay
 * - Windows: powershell Start-Process / [System.Media.SoundPlayer]
 */

import { execFile } from "node:child_process";
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

/**
 * Get the system audio player command and arguments for the current platform.
 *
 * @param filePath - Path to the WAV file to play.
 * @returns Object with `command` and `args` for execFile.
 * @throws If the platform is not supported.
 */
function getPlayerCommand(filePath: string): { command: string; args: string[] } {
  switch (process.platform) {
    case "linux":
      return { command: "aplay", args: ["-q", filePath] };
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
