import { describe, it, expect } from "vitest";
import {
  isNodeRuntime,
  getOfflineAudioContextCtor,
  OfflineAudioContext,
} from "./web-audio.js";

describe("isNodeRuntime", () => {
  it("returns true in Node.js", () => {
    expect(isNodeRuntime()).toBe(true);
  });

  it("is a function that reports a boolean", () => {
    expect(typeof isNodeRuntime()).toBe("boolean");
  });
});

describe("getOfflineAudioContextCtor", () => {
  it("returns a constructor that can be used with new", () => {
    const Ctor = getOfflineAudioContextCtor();
    const ctx = new Ctor(1, 44100, 44100);
    expect(ctx).toBeDefined();
    expect(ctx.length).toBe(44100);
    expect(ctx.sampleRate).toBe(44100);
  });

  it("returns a constructor with startRendering method", () => {
    const Ctor = getOfflineAudioContextCtor();
    const ctx = new Ctor(1, 4410, 44100);
    expect(typeof ctx.startRendering).toBe("function");
  });

  it("returns the same constructor on repeated calls (cached)", () => {
    const first = getOfflineAudioContextCtor();
    const second = getOfflineAudioContextCtor();
    expect(first).toBe(second);
  });
});

describe("OfflineAudioContext", () => {
  it("is constructable via new", () => {
    const ctx = new OfflineAudioContext(1, 44100, 44100);
    expect(ctx).toBeDefined();
    expect(ctx.length).toBe(44100);
    expect(ctx.sampleRate).toBe(44100);
  });

  it("produces instances with the expected audio graph API", () => {
    const ctx = new OfflineAudioContext(1, 4410, 44100);
    expect(typeof ctx.createOscillator).toBe("function");
    expect(typeof ctx.createGain).toBe("function");
    expect(typeof ctx.createBuffer).toBe("function");
    expect(typeof ctx.createBufferSource).toBe("function");
    expect(typeof ctx.startRendering).toBe("function");
  });

  it("renders a silent buffer end-to-end", async () => {
    const ctx = new OfflineAudioContext(1, 4410, 44100);
    const rendered = await ctx.startRendering();
    expect(rendered.numberOfChannels).toBe(1);
    expect(rendered.length).toBe(4410);
  });
});
