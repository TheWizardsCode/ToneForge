/**
 * Web engine adapter.
 *
 * Web delivery favours a shallow, cache-friendly tree: assets are written
 * to a flat `audio/<id>.wav` layout with a `manifest.json` describing the
 * category → audio-group and tag → mixer-bus mapping for a JS audio layer.
 *
 * Reference: docs/prd/INTEGRATIONS_PRD.md Sections 4.1, 6, 9.
 *
 * Work item: TF-0MUZYS2VP007O99D.
 */

import type { LibraryEntry } from "../library/types.js";
import type { EngineAdapter } from "./adapter.js";

/** Category → web audio group. Unlisted categories fall back to `sfx`. */
export const WEB_CATEGORY_AUDIO_GROUPS: Readonly<Record<string, string>> = {
  ui: "ui",
  ambient: "ambient",
  music: "music",
};

/** Default web audio group. */
export const WEB_DEFAULT_AUDIO_GROUP = "sfx";

/** Tag → web mixer bus. Unlisted tags fall back to `sfx`. */
export const WEB_TAG_MIXER_BUSES: Readonly<Record<string, string>> = {
  ui: "ui",
  ambient: "ambient",
  ambience: "ambient",
  music: "music",
  character: "voice",
  creature: "voice",
  voice: "voice",
};

/** Default web mixer bus. */
export const WEB_DEFAULT_MIXER_BUS = "sfx";

/** Normalise a mapping key (case- and whitespace-insensitive). */
function key(value: string): string {
  return value.trim().toLowerCase();
}

/** Web engine adapter. */
export const webAdapter: EngineAdapter = {
  target: "web",

  audioGroupFor(category: string): string {
    return WEB_CATEGORY_AUDIO_GROUPS[key(category)] ?? WEB_DEFAULT_AUDIO_GROUP;
  },

  mixerBusFor(tags: readonly string[]): string {
    for (const tag of [...tags].sort()) {
      const bus = WEB_TAG_MIXER_BUSES[key(tag)];
      if (bus) return bus;
    }
    return WEB_DEFAULT_MIXER_BUS;
  },

  assetPath(entry: LibraryEntry): string {
    return `audio/${entry.id}.wav`;
  },

  compileRuleset() {
    return { target: "web", bake: {} };
  },
};
