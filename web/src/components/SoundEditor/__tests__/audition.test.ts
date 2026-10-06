// @vitest-environment happy-dom
/**
 * Audition control tests: autoplay gesture gating, play/stop/loop, next-render
 * semantics, graceful degradation and disposal.
 *
 * AC (TF-0MUV11YIP0026H65): no AudioContext before a gesture; first click
 * resumes; playback via the Web Audio path; edits reflected on the next render;
 * previewed preset equals the current preset; graceful degradation; dispose
 * releases nodes and the context.
 */
import { afterEach, describe, expect, it, vi } from "vitest";
import {
  createAudition,
  type AuditionBuffer,
  type AuditionContext,
  type AuditionSource,
} from "../audition.js";
import type { SoundPreset } from "../../../models/preset.js";

class FakeBuffer implements AuditionBuffer {
  readonly data: Float32Array;
  constructor(public readonly length: number) {
    this.data = new Float32Array(length);
  }
  getChannelData(): Float32Array {
    return this.data;
  }
}

class FakeSource implements AuditionSource {
  buffer: AuditionBuffer | null = null;
  loop = false;
  onended: (() => void) | null = null;
  started = false;
  stopped = false;
  connected = false;
  disconnected = false;
  connect(): void {
    this.connected = true;
  }
  disconnect(): void {
    this.disconnected = true;
  }
  start(): void {
    this.started = true;
  }
  stop(): void {
    this.stopped = true;
  }
  /** Simulate the buffer finishing. */
  finish(): void {
    this.onended?.();
  }
}

class FakeContext implements AuditionContext {
  state = "suspended";
  readonly destination = {};
  readonly sources: FakeSource[] = [];
  resumeCalls = 0;
  closed = false;
  createBuffer(_channels: number, length: number, _sampleRate: number): AuditionBuffer {
    return new FakeBuffer(length);
  }
  createBufferSource(): AuditionSource {
    const source = new FakeSource();
    this.sources.push(source);
    return source;
  }
  async resume(): Promise<void> {
    this.resumeCalls += 1;
    this.state = "running";
  }
  async close(): Promise<void> {
    this.closed = true;
    this.state = "closed";
  }
}

function makePreset(overrides: Record<string, number> = {}): SoundPreset {
  return { version: 1, recipe: "weapon-laser-zap", seed: 1234, overrides };
}

function fakeRender() {
  return vi.fn(async (_preset: SoundPreset) => ({
    samples: new Float32Array(128).fill(0.25),
    sampleRate: 44100,
    duration: 0.01,
    numberOfChannels: 1,
  }));
}

const flush = (): Promise<void> => new Promise((resolve) => setTimeout(resolve, 0));

afterEach(() => {
  document.body.innerHTML = "";
  vi.restoreAllMocks();
});

describe("autoplay gate", () => {
  it("creates no AudioContext before a user gesture", async () => {
    const createContext = vi.fn(() => new FakeContext());
    const audition = createAudition({ getPreset: () => makePreset(), createContext });

    expect(createContext).not.toHaveBeenCalled();
    expect(audition.isEnabled()).toBe(false);
    expect(audition.element.querySelector(".tf-audition__enable")?.hasAttribute("hidden")).toBe(false);

    await audition.play();
    expect(createContext).not.toHaveBeenCalled();

    audition.dispose();
  });

  it("creates and resumes the context on the first gesture", async () => {
    const context = new FakeContext();
    const createContext = vi.fn(() => context);
    const audition = createAudition({ getPreset: () => makePreset(), createContext });

    audition.element.querySelector<HTMLButtonElement>(".tf-audition__enable")!.click();
    await flush();

    expect(createContext).toHaveBeenCalledTimes(1);
    expect(context.resumeCalls).toBe(1);
    expect(audition.isEnabled()).toBe(true);
    audition.dispose();
  });
});

describe("playback", () => {
  it("renders and plays the current preset (with overrides)", async () => {
    const context = new FakeContext();
    const render = fakeRender();
    const preset = makePreset({ carrierFreq: 900 });
    const audition = createAudition({
      getPreset: () => preset,
      render,
      createContext: () => context,
    });

    audition.element.querySelector<HTMLButtonElement>(".tf-audition__enable")!.click();
    await flush();
    audition.element.querySelector<HTMLButtonElement>(".tf-audition__play")!.click();
    await flush();

    expect(render).toHaveBeenCalledTimes(1);
    expect(render.mock.calls[0][0]).toEqual(preset);
    expect(context.sources[0].started).toBe(true);
    expect(context.sources[0].connected).toBe(true);
    expect(audition.isPlaying()).toBe(true);
    audition.dispose();
  });

  it("stops playback", async () => {
    const context = new FakeContext();
    const audition = createAudition({
      getPreset: () => makePreset(),
      render: fakeRender(),
      createContext: () => context,
    });

    audition.element.querySelector<HTMLButtonElement>(".tf-audition__enable")!.click();
    await flush();
    audition.element.querySelector<HTMLButtonElement>(".tf-audition__play")!.click();
    await flush();

    audition.element.querySelector<HTMLButtonElement>(".tf-audition__stop")!.click();
    expect(audition.isPlaying()).toBe(false);
    expect(context.sources[0].stopped).toBe(true);
    expect(context.sources[0].disconnected).toBe(true);
    audition.dispose();
  });

  it("re-renders on the next loop iteration so edits are reflected", async () => {
    const context = new FakeContext();
    const render = fakeRender();
    let preset = makePreset();
    const audition = createAudition({
      getPreset: () => preset,
      render,
      createContext: () => context,
    });

    audition.element.querySelector<HTMLButtonElement>(".tf-audition__enable")!.click();
    await flush();
    audition.element.querySelector<HTMLButtonElement>(".tf-audition__loop")!.click(); // enable loop
    expect(audition.isLooping()).toBe(true);
    audition.element.querySelector<HTMLButtonElement>(".tf-audition__play")!.click();
    await flush();
    expect(render).toHaveBeenCalledTimes(1);

    // Edit the preset while playing, then let the loop boundary pass.
    preset = makePreset({ carrierFreq: 1500 });
    context.sources[0].finish();
    await flush();

    expect(render).toHaveBeenCalledTimes(2);
    expect(render.mock.calls[1][0]).toEqual(preset);
    expect(context.sources.length).toBe(2);
    audition.dispose();
  });
});

describe("graceful degradation", () => {
  it("disables itself with an accessible message when audio is unavailable", async () => {
    const createContext = vi.fn(() => {
      throw new Error("AudioContext unavailable");
    });
    const audition = createAudition({ getPreset: () => makePreset(), createContext });

    expect(() =>
      audition.element.querySelector<HTMLButtonElement>(".tf-audition__enable")!.click(),
    ).not.toThrow();
    await flush();

    expect(audition.isEnabled()).toBe(false);
    expect(audition.element.dataset.state).toBe("unsupported");
    expect(audition.element.querySelector(".tf-audition__status")?.textContent).toMatch(
      /unavailable/i,
    );
    expect(
      audition.element.querySelector<HTMLButtonElement>(".tf-audition__play")!.disabled,
    ).toBe(true);
    audition.dispose();
  });
});

describe("dispose", () => {
  it("stops playback, releases nodes and closes the context", async () => {
    const context = new FakeContext();
    const audition = createAudition({
      getPreset: () => makePreset(),
      render: fakeRender(),
      createContext: () => context,
    });

    audition.element.querySelector<HTMLButtonElement>(".tf-audition__enable")!.click();
    await flush();
    audition.element.querySelector<HTMLButtonElement>(".tf-audition__play")!.click();
    await flush();

    audition.dispose();
    await flush();
    audition.dispose(); // idempotent

    expect(audition.isPlaying()).toBe(false);
    expect(context.sources[0].stopped).toBe(true);
    expect(context.sources[0].disconnected).toBe(true);
    expect(context.closed).toBe(true);
  });
});
