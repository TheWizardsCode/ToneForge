import type { Arguments } from "yargs";
import { existsSync } from "node:fs";
import { playAudio, getPlayerCommand } from "../../audio/player.js";
import { decodeWavFile } from "../../audio/wav-decoder.js";
import { outputInfo, outputError } from "../../output.js";

export const command = "play <file>";
export const desc = "Play a WAV file";

export function builder(yargs: any) {
  return yargs
    .positional("file", { type: "string", describe: "Path to WAV file to play" })
    .option("json", { type: "boolean", describe: "Output JSON" });
}

export async function handler(argv: Arguments) {
  const file = argv.file as string;
  const jsonMode = argv.json === true;
  if (!existsSync(file)) {
    outputError(`File not found: ${file}`);
    return 1;
  }

  try {
    const wav = await decodeWavFile(file);
    if (!jsonMode) outputInfo(`Playing ${file}...`);
    await playAudio(wav.samples, { sampleRate: wav.sampleRate });
    return 0;
  } catch (err) {
    outputError(`Failed to play ${file}: ${String(err)}`);
    return 1;
  }
}

export default { command, desc, builder, handler };
