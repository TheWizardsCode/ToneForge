import { describe, it, expect, vi, afterEach } from "vitest";
import { readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const here = dirname(fileURLToPath(import.meta.url));

afterEach(() => {
  vi.unstubAllGlobals();
  vi.resetModules();
});

describe("browser runtime awareness", () => {
  it("uses the browser-native OfflineAudioContext global when not in Node", async () => {
    class FakeOfflineAudioContext {
      readonly numberOfChannels: number;
      readonly length: number;
      readonly sampleRate: number;

      constructor(numberOfChannels: number, length: number, sampleRate: number) {
        this.numberOfChannels = numberOfChannels;
        this.length = length;
        this.sampleRate = sampleRate;
      }
    }

    // Simulate a browser: no Node version string, but a native Web Audio
    // global. Deleting the (configurable) property is the least invasive way
    // to make isNodeRuntime() report false.
    const originalNodeVersion = process.versions.node;
    Reflect.deleteProperty(process.versions, "node");
    vi.stubGlobal("OfflineAudioContext", FakeOfflineAudioContext);
    vi.resetModules();

    try {
      const mod = await import("./web-audio.js");

      expect(mod.isNodeRuntime()).toBe(false);
      expect(mod.getOfflineAudioContextCtor()).toBe(FakeOfflineAudioContext);

      const ctx = new mod.OfflineAudioContext(2, 128, 48000);
      expect(ctx).toBeInstanceOf(FakeOfflineAudioContext);
      expect(ctx.sampleRate).toBe(48000);
    } finally {
      (process.versions as unknown as Record<string, unknown>).node =
        originalNodeVersion;
    }
  });
});

describe("node-web-audio-api packaging", () => {
  it("is an optional dependency, never a hard dependency", () => {
    const pkgPath = resolve(here, "..", "..", "package.json");
    const pkg = JSON.parse(readFileSync(pkgPath, "utf8")) as {
      dependencies?: Record<string, string>;
      optionalDependencies?: Record<string, string>;
    };

    expect(pkg.dependencies ?? {}).not.toHaveProperty("node-web-audio-api");
    expect(pkg.optionalDependencies ?? {}).toHaveProperty(
      "node-web-audio-api",
    );
  });
});
