/**
 * Unity engine adapter.
 *
 * Maps ToneForge categories onto Unity audio groups and tags onto mixer
 * buses, and lays synced assets out under `Assets/Audio/<category>/` as
 * Unity expects when importing into a project's audio folder.
 *
 * The mapping is metadata-only: ToneForge writes the WAVs plus an engine
 * `manifest.json`; it does not generate `.meta` files or mutate a Unity
 * project beyond the requested output directory.
 *
 * Reference: docs/prd/INTEGRATIONS_PRD.md Sections 4.1, 6, 9.
 *
 * Work item: TF-0MUZYS2VP007O99D.
 */

import type { LibraryEntry } from "../library/types.js";
import { safeSegment, type EngineAdapter } from "./adapter.js";

/** Category → Unity audio group. Unlisted categories fall back to `SFX`. */
export const UNITY_CATEGORY_AUDIO_GROUPS: Readonly<Record<string, string>> = {
  ui: "UI",
  ambient: "Ambience",
  music: "Music",
  character: "Voice",
  creature: "Voice",
};

/** Default Unity audio group. */
export const UNITY_DEFAULT_AUDIO_GROUP = "SFX";

/** Tag → Unity mixer bus. Unlisted tags fall back to `SFX`. */
export const UNITY_TAG_MIXER_BUSES: Readonly<Record<string, string>> = {
  ui: "UI",
  ambient: "Ambience",
  ambience: "Ambience",
  music: "Music",
  character: "Voice",
  creature: "Voice",
  voice: "Voice",
};

/** Default Unity mixer bus. */
export const UNITY_DEFAULT_MIXER_BUS = "SFX";

/** Normalise a mapping key (case- and whitespace-insensitive). */
function key(value: string): string {
  return value.trim().toLowerCase();
}

/** Unity engine adapter. */
export const unityAdapter: EngineAdapter = {
  target: "unity",

  audioGroupFor(category: string): string {
    return UNITY_CATEGORY_AUDIO_GROUPS[key(category)] ?? UNITY_DEFAULT_AUDIO_GROUP;
  },

  mixerBusFor(tags: readonly string[]): string {
    // Sort so the chosen bus is independent of tag ordering.
    for (const tag of [...tags].sort()) {
      const bus = UNITY_TAG_MIXER_BUSES[key(tag)];
      if (bus) return bus;
    }
    return UNITY_DEFAULT_MIXER_BUS;
  },

  assetPath(entry: LibraryEntry): string {
    return `Assets/Audio/${safeSegment(entry.category)}/${entry.id}.wav`;
  },

  compileRuleset() {
    // Empty bake rule matches every entry, so Unity receives real WAVs.
    return { target: "unity", bake: {} };
  },
};
