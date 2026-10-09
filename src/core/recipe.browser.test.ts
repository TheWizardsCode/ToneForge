/**
 * Browser-safety regression tests for file-backed recipe rendering.
 *
 * Running a recipe from the web demo previously failed with
 * `ReferenceError: process is not defined` at the `TF_DIAG` diagnostics check
 * in `createFileBackedRegistration().buildOfflineGraph` — the browser bundle
 * has no `process` global (TF-0MV1GGPSY00773DT). `isTfDiagnosticsEnabled()`
 * centralises that access behind a runtime guard.
 */
import { describe, it, expect, vi, afterEach } from "vitest";
import { OfflineAudioContext } from "node-web-audio-api";
import { isTfDiagnosticsEnabled } from "./recipe.js";
import { registry } from "../recipes/index.js";
import { createRng } from "./rng.js";

afterEach(() => {
  vi.unstubAllGlobals();
  delete process.env.TF_DIAG;
});

describe("isTfDiagnosticsEnabled", () => {
  it("does not throw and reports disabled when the process global is absent", () => {
    const saved = globalThis.process;
    try {
      // Simulate the browser bundle, which has no `process` global. A bare
      // `process.env.TF_DIAG` read here throws ReferenceError.
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      delete (globalThis as any).process;
      expect(isTfDiagnosticsEnabled()).toBe(false);
    } finally {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      (globalThis as any).process = saved;
    }
  });

  it("is enabled only when TF_DIAG is exactly '1'", () => {
    process.env.TF_DIAG = "1";
    expect(isTfDiagnosticsEnabled()).toBe(true);

    process.env.TF_DIAG = "0";
    expect(isTfDiagnosticsEnabled()).toBe(false);

    delete process.env.TF_DIAG;
    expect(isTfDiagnosticsEnabled()).toBe(false);
  });
});

describe("file-backed recipe rendering without a process global", () => {
  it("builds and renders ui-scifi-confirm in a browser-like runtime", async () => {
    const registration = registry.getRegistration("ui-scifi-confirm");
    expect(registration).toBeDefined();

    const seed = 42;
    const duration = registration!.getDuration(createRng(seed));
    const sampleRate = 44100;
    const length = Math.ceil(sampleRate * duration);
    const ctx = new OfflineAudioContext(1, length, sampleRate);

    // Reproduce the browser bundle's runtime shape: `process.env` is absent,
    // while the remaining process surface is left intact so the test runner
    // itself keeps working. A bare `process.env.TF_DIAG` read would throw here.
    const realProcess = globalThis.process;
    const browserLikeProcess = new Proxy({} as typeof realProcess, {
      get: (target, prop) =>
        prop === "env" ? undefined : (realProcess as Record<string | symbol, unknown>)[prop],
      set: (target, prop, value) => {
        (realProcess as Record<string | symbol, unknown>)[prop] = value;
        return true;
      },
    });
    vi.stubGlobal("process", browserLikeProcess);

    try {
      await expect(
        registration!.buildOfflineGraph(createRng(seed), ctx, duration),
      ).resolves.toBeUndefined();
      const rendered = await ctx.startRendering();
      expect(rendered.length).toBe(length);
    } finally {
      vi.unstubAllGlobals();
    }
  });
});
