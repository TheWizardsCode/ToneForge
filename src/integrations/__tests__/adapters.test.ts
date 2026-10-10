/**
 * Engine adapter mapping and registry unit tests.
 *
 * Covers the category → audio group and tags → mixer bus mapping for the
 * Unity and web adapters, the target registry lookup (including the
 * structured unsupported-target error), and third-party adapter
 * extensibility.
 *
 * Work item: TF-0MUZYS2VP007O99D. Reference: docs/prd/INTEGRATIONS_PRD.md
 * Sections 4.1 (Game Engines), 6 (Asset Mapping), 9 (Library Sync), 13.
 */

import { describe, it, expect } from "vitest";

import type { LibraryEntry } from "../../library/types.js";
import {
  UnsupportedTargetError,
  getAdapter,
  listTargets,
  registerAdapter,
  unregisterAdapter,
} from "../index.js";
import { unityAdapter } from "../unity.js";
import { webAdapter } from "../web.js";

/** Minimal entry stub; adapters only read `id` and `category`. */
function entry(id: string, category: string): LibraryEntry {
  return { id, category } as unknown as LibraryEntry;
}

describe("adapter registry", () => {
  it("registers the built-in unity and web targets", () => {
    expect(listTargets()).toEqual(["unity", "web"]);
  });

  it("resolves a target case-insensitively", () => {
    expect(getAdapter("unity")).toBe(unityAdapter);
    expect(getAdapter("Unity")).toBe(unityAdapter);
    expect(getAdapter("WEB")).toBe(webAdapter);
  });

  it("throws a structured UnsupportedTargetError for an unknown target", () => {
    expect.assertions(4);
    try {
      getAdapter("godot");
    } catch (error) {
      expect(error).toBeInstanceOf(UnsupportedTargetError);
      const unsupported = error as UnsupportedTargetError;
      expect(unsupported.code).toBe("unsupported_target");
      expect(unsupported.target).toBe("godot");
      expect(unsupported.supportedTargets).toEqual(["unity", "web"]);
    }
  });

  it("allows third-party adapters to be registered without core changes", () => {
    const custom = {
      target: "custom-engine",
      audioGroupFor: () => "Group",
      mixerBusFor: () => "Bus",
      assetPath: (e: LibraryEntry) => `assets/${e.id}.wav`,
      compileRuleset: () => ({ target: "custom-engine", bake: {} }),
    };
    registerAdapter(custom);
    try {
      expect(getAdapter("custom-engine")).toBe(custom);
      expect(listTargets()).toContain("custom-engine");
    } finally {
      expect(unregisterAdapter("custom-engine")).toBe(true);
    }
    expect(listTargets()).toEqual(["unity", "web"]);
  });
});

describe("unity adapter mapping", () => {
  it("maps categories to Unity audio groups with an SFX fallback", () => {
    expect(unityAdapter.audioGroupFor("UI")).toBe("UI");
    expect(unityAdapter.audioGroupFor("Ambient")).toBe("Ambience");
    expect(unityAdapter.audioGroupFor("Music")).toBe("Music");
    expect(unityAdapter.audioGroupFor("Character")).toBe("Voice");
    expect(unityAdapter.audioGroupFor("Impact")).toBe("SFX");
    expect(unityAdapter.audioGroupFor("uncategorized")).toBe("SFX");
  });

  it("maps tags to Unity mixer buses with an SFX fallback", () => {
    expect(unityAdapter.mixerBusFor(["ui"])).toBe("UI");
    expect(unityAdapter.mixerBusFor(["ambient"])).toBe("Ambience");
    expect(unityAdapter.mixerBusFor(["voice"])).toBe("Voice");
    expect(unityAdapter.mixerBusFor(["impact"])).toBe("SFX");
    expect(unityAdapter.mixerBusFor([])).toBe("SFX");
    // A recognised tag wins regardless of position in the tag list.
    expect(unityAdapter.mixerBusFor(["impact", "ui", "heavy"])).toBe("UI");
  });

  it("lays assets out under Assets/Audio/<category>/", () => {
    expect(unityAdapter.assetPath(entry("lib-impact-crack", "Impact"))).toBe(
      "Assets/Audio/Impact/lib-impact-crack.wav",
    );
  });

  it("bakes every asset so the engine receives real WAVs", () => {
    expect(unityAdapter.compileRuleset()).toEqual({ target: "unity", bake: {} });
  });
});

describe("web adapter mapping", () => {
  it("maps categories to lowercase web audio groups", () => {
    expect(webAdapter.audioGroupFor("UI")).toBe("ui");
    expect(webAdapter.audioGroupFor("Ambient")).toBe("ambient");
    expect(webAdapter.audioGroupFor("Music")).toBe("music");
    expect(webAdapter.audioGroupFor("Impact")).toBe("sfx");
  });

  it("maps tags to lowercase web mixer buses", () => {
    expect(webAdapter.mixerBusFor(["ui"])).toBe("ui");
    expect(webAdapter.mixerBusFor(["ambience"])).toBe("ambient");
    expect(webAdapter.mixerBusFor(["voice"])).toBe("voice");
    expect(webAdapter.mixerBusFor(["impact"])).toBe("sfx");
  });

  it("uses a flat web-appropriate audio/ layout", () => {
    expect(webAdapter.assetPath(entry("lib-ui-confirm", "UI"))).toBe(
      "audio/lib-ui-confirm.wav",
    );
  });

  it("targets the web compile ruleset", () => {
    expect(webAdapter.compileRuleset()).toEqual({ target: "web", bake: {} });
  });
});
