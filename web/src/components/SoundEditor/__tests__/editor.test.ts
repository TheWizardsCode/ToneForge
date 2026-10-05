// @vitest-environment happy-dom
/**
 * Lifecycle tests for the embeddable SoundEditor shell.
 *
 * Covers mount/dispose, scoped styles, lazy audio, change notification and the
 * no-leak contract (AC5 embeddable mount / clean dispose; AC6 foundation).
 */
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  createSoundEditor,
  SOUND_PRESET_VERSION,
  type SoundPreset,
} from "../index.js";

interface FakeResizeObserverInstance {
  observe: (target: Element) => void;
  disconnect: () => void;
  observed: Element[];
  disconnected: boolean;
}

let resizeObserverInstances: FakeResizeObserverInstance[] = [];

class FakeResizeObserver implements FakeResizeObserverInstance {
  observed: Element[] = [];
  disconnected = false;

  constructor(_callback: ResizeObserverCallback) {
    resizeObserverInstances.push(this);
  }

  observe(target: Element): void {
    this.observed.push(target);
  }

  unobserve(): void {}

  disconnect(): void {
    this.disconnected = true;
  }
}

function makePreset(overrides: Partial<SoundPreset> = {}): SoundPreset {
  return {
    version: SOUND_PRESET_VERSION,
    recipe: "weapon-laser-zap",
    seed: 1234,
    overrides: {},
    ...overrides,
  };
}

function makeContainer(): HTMLElement {
  const container = document.createElement("div");
  document.body.appendChild(container);
  return container;
}

beforeEach(() => {
  resizeObserverInstances = [];
  vi.stubGlobal("ResizeObserver", FakeResizeObserver);
});

afterEach(() => {
  document.body.innerHTML = "";
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

describe("createSoundEditor public API", () => {
  it("exposes the documented controller surface", () => {
    const editor = createSoundEditor();
    expect(typeof editor.mount).toBe("function");
    expect(typeof editor.dispose).toBe("function");
    expect(typeof editor.onChange).toBe("function");
    expect(typeof editor.getPreset).toBe("function");
    expect(typeof editor.setPreset).toBe("function");
    editor.dispose();
  });

  it("returns a defensive copy of the preset", () => {
    const editor = createSoundEditor({ preset: makePreset() });
    const first = editor.getPreset();
    first.seed = 999;
    first.overrides.filterFreq = 1;
    expect(editor.getPreset().seed).toBe(1234);
    expect(editor.getPreset().overrides).toEqual({});
    editor.dispose();
  });
});

describe("mount", () => {
  it("injects exactly one scoped root element with a shadow root", () => {
    const container = makeContainer();
    const editor = createSoundEditor();
    editor.mount(container);

    expect(container.childElementCount).toBe(1);
    const root = container.firstElementChild as HTMLElement;
    expect(root.className).toBe("toneforge-editor");
    expect(root.shadowRoot).not.toBeNull();
    expect(root.shadowRoot?.querySelector('[data-toneforge-editor="styles"]')).not.toBeNull();

    editor.dispose();
  });

  it("scopes styles to the shadow root and never touches document.head", () => {
    const container = makeContainer();
    const editor = createSoundEditor();
    editor.mount(container);

    expect(document.head.querySelectorAll("style").length).toBe(0);
    expect(document.head.innerHTML).toBe("");
    const root = container.firstElementChild as HTMLElement;
    expect(root.shadowRoot?.querySelector("style")?.textContent).toContain(":host");

    editor.dispose();
  });

  it("uses the supplied accessible label", () => {
    const container = makeContainer();
    const editor = createSoundEditor({ label: "Enemy sound" });
    editor.mount(container);
    const root = container.firstElementChild as HTMLElement;
    expect(root.getAttribute("role")).toBe("group");
    expect(root.getAttribute("aria-label")).toBe("Enemy sound");
    editor.dispose();
  });

  it("renders the preset recipe name", () => {
    const container = makeContainer();
    const editor = createSoundEditor({ preset: makePreset() });
    editor.mount(container);
    const root = container.firstElementChild as HTMLElement;
    expect(root.shadowRoot?.querySelector(".toneforge-editor__recipe")?.textContent).toBe(
      "weapon-laser-zap",
    );
    editor.dispose();
  });

  it("does not construct an AudioContext and degrades when Web Audio is missing", () => {
    const constructed: string[] = [];
    class FakeAudioContext {
      constructor() {
        constructed.push("AudioContext");
      }
    }
    vi.stubGlobal("AudioContext", FakeAudioContext);
    vi.stubGlobal("webkitAudioContext", FakeAudioContext);

    const container = makeContainer();
    const editor = createSoundEditor();
    expect(() => editor.mount(container)).not.toThrow();
    expect(constructed).toEqual([]);

    editor.dispose();

    // Now with no Web Audio globals at all.
    vi.stubGlobal("AudioContext", undefined);
    vi.stubGlobal("webkitAudioContext", undefined);
    const emptyContainer = makeContainer();
    const second = createSoundEditor();
    expect(() => second.mount(emptyContainer)).not.toThrow();
    second.dispose();
  });

  it("observes the root with a ResizeObserver", () => {
    const container = makeContainer();
    const editor = createSoundEditor();
    editor.mount(container);
    expect(resizeObserverInstances.length).toBe(1);
    expect(resizeObserverInstances[0].observed.length).toBe(1);
    editor.dispose();
  });

  it("rejects a second mount", () => {
    const editor = createSoundEditor();
    editor.mount(makeContainer());
    expect(() => editor.mount(makeContainer())).toThrow(/already mounted/);
    editor.dispose();
  });
});

describe("onChange", () => {
  it("fires with a valid preset when the preset changes", () => {
    const editor = createSoundEditor({ preset: makePreset() });
    const seen: SoundPreset[] = [];
    editor.onChange((next) => seen.push(next));

    editor.setPreset(makePreset({ seed: 5678 }));

    expect(seen.length).toBe(1);
    expect(seen[0].version).toBe(SOUND_PRESET_VERSION);
    expect(seen[0].seed).toBe(5678);
    expect(typeof seen[0].recipe).toBe("string");
    expect(typeof seen[0].overrides).toBe("object");
    editor.dispose();
  });

  it("does not fire when the preset is unchanged", () => {
    const editor = createSoundEditor({ preset: makePreset() });
    const listener = vi.fn();
    editor.onChange(listener);

    editor.setPreset(makePreset());
    editor.setPreset(makePreset({ seed: 42 }));
    editor.setPreset(makePreset({ seed: 42 }));

    expect(listener).toHaveBeenCalledTimes(1);
    editor.dispose();
  });

  it("stops notifying once unsubscribed", () => {
    const editor = createSoundEditor({ preset: makePreset() });
    const listener = vi.fn();
    const unsubscribe = editor.onChange(listener);

    editor.setPreset(makePreset({ seed: 1 }));
    unsubscribe();
    editor.setPreset(makePreset({ seed: 2 }));

    expect(listener).toHaveBeenCalledTimes(1);
    editor.dispose();
  });

  it("never invokes listeners after dispose", () => {
    const editor = createSoundEditor({ preset: makePreset() });
    const listener = vi.fn();
    editor.onChange(listener);

    editor.setPreset(makePreset({ seed: 1 }));
    editor.dispose();

    expect(() => editor.setPreset(makePreset({ seed: 2 }))).toThrow(/disposed/);
    expect(listener).toHaveBeenCalledTimes(1);
  });
});

describe("dispose", () => {
  it("empties the container and is idempotent", () => {
    const container = makeContainer();
    const editor = createSoundEditor();
    editor.mount(container);
    expect(container.childElementCount).toBe(1);

    editor.dispose();
    expect(container.childElementCount).toBe(0);
    expect(container.innerHTML).toBe("");

    expect(() => editor.dispose()).not.toThrow();
    expect(container.childElementCount).toBe(0);
  });

  it("disconnects the ResizeObserver it created", () => {
    const container = makeContainer();
    const editor = createSoundEditor();
    editor.mount(container);
    expect(resizeObserverInstances[0].disconnected).toBe(false);

    editor.dispose();
    expect(resizeObserverInstances[0].disconnected).toBe(true);
  });

  it("disposes a supplied audio engine exactly once", () => {
    const audioEngine = { dispose: vi.fn() };
    const editor = createSoundEditor({ audioEngine });
    editor.mount(makeContainer());

    editor.dispose();
    editor.dispose();

    expect(audioEngine.dispose).toHaveBeenCalledTimes(1);
  });

  it("creates no new globals", () => {
    const before = new Set(Object.keys(globalThis));
    const editor = createSoundEditor();
    editor.mount(makeContainer());
    editor.dispose();
    const after = Object.keys(globalThis).filter((key) => !before.has(key));
    expect(after).toEqual([]);
  });

  it("adds no listeners to document or window", () => {
    const documentSpy = vi.spyOn(document, "addEventListener");
    const windowSpy = vi.spyOn(window, "addEventListener");

    const editor = createSoundEditor();
    editor.mount(makeContainer());
    editor.dispose();

    expect(documentSpy).not.toHaveBeenCalled();
    expect(windowSpy).not.toHaveBeenCalled();
  });

  it("cannot be mounted or subscribed to after dispose", () => {
    const editor = createSoundEditor();
    editor.dispose();
    expect(() => editor.mount(makeContainer())).toThrow(/disposed/);
    expect(() => editor.onChange(() => {})).toThrow(/disposed/);
  });
});
