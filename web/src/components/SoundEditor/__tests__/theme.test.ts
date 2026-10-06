// @vitest-environment happy-dom
/**
 * Theme + responsive-layout tests.
 *
 * AC (TF-0MUV120UZ00006UU): documented theme custom properties with defaults;
 * container-width-adaptive layout driven by ResizeObserver; no global CSS;
 * observer disconnected on dispose.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  COMPACT_CLASS,
  DEFAULT_COMPACT_BREAKPOINT,
  WIDE_CLASS,
  applyResponsiveLayout,
  applyTheme,
  createSoundEditor,
} from "../index.js";

interface FakeObserver {
  callback: ResizeObserverCallback;
  disconnected: boolean;
  observed: Element[];
}

let observers: FakeObserver[] = [];

class FakeResizeObserver {
  callback: ResizeObserverCallback;
  disconnected = false;
  observed: Element[] = [];

  constructor(callback: ResizeObserverCallback) {
    this.callback = callback;
    observers.push(this as unknown as FakeObserver);
  }
  observe(target: Element): void {
    this.observed.push(target);
  }
  unobserve(): void {}
  disconnect(): void {
    this.disconnected = true;
  }
}

function resize(width: number): void {
  const entry = { contentRect: { width } } as unknown as ResizeObserverEntry;
  observers[0].callback([entry], {} as ResizeObserver);
}

function makeContainer(): HTMLElement {
  const container = document.createElement("div");
  document.body.appendChild(container);
  return container;
}

const PRESET = {
  version: 1,
  recipe: "ui-scifi-confirm",
  seed: 42,
  overrides: {},
} as const;

beforeEach(() => {
  observers = [];
  vi.stubGlobal("ResizeObserver", FakeResizeObserver);
});

afterEach(() => {
  document.body.innerHTML = "";
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

describe("applyTheme", () => {
  it("writes only the provided theme keys as CSS custom properties", () => {
    const root = document.createElement("div");
    applyTheme(root, { accent: "#ff0000", background: "#000000" });

    expect(root.style.getPropertyValue("--tfe-accent")).toBe("#ff0000");
    expect(root.style.getPropertyValue("--tfe-background")).toBe("#000000");
    expect(root.style.getPropertyValue("--tfe-foreground")).toBe("");
    expect(root.style.getPropertyValue("--tfe-font")).toBe("");
  });

  it("is a no-op when no theme is supplied", () => {
    const root = document.createElement("div");
    applyTheme(root);
    expect(root.getAttribute("style")).toBeNull();
  });
});

describe("applyResponsiveLayout", () => {
  it("toggles compact/wide classes around the breakpoint", () => {
    const root = document.createElement("div");

    expect(applyResponsiveLayout(root, 300)).toBe(true);
    expect(root.classList.contains(COMPACT_CLASS)).toBe(true);
    expect(root.classList.contains(WIDE_CLASS)).toBe(false);

    expect(applyResponsiveLayout(root, DEFAULT_COMPACT_BREAKPOINT + 100)).toBe(false);
    expect(root.classList.contains(WIDE_CLASS)).toBe(true);
    expect(root.classList.contains(COMPACT_CLASS)).toBe(false);
    expect(root.style.getPropertyValue("--tf-host-width")).toBe("580px");
  });
});

describe("editor theming and responsive integration", () => {
  it("applies a theme object to the editor root", () => {
    const container = makeContainer();
    const editor = createSoundEditor({ preset: { ...PRESET }, theme: { accent: "#123456" } });
    editor.mount(container);

    const root = container.firstElementChild as HTMLElement;
    expect(root.style.getPropertyValue("--tfe-accent")).toBe("#123456");

    editor.dispose();
  });

  it("adapts the layout class on simulated container resize", () => {
    const container = makeContainer();
    const editor = createSoundEditor({ preset: { ...PRESET } });
    editor.mount(container);

    const root = container.firstElementChild as HTMLElement;
    // Initial measured width is 0 → compact.
    expect(root.classList.contains(COMPACT_CLASS)).toBe(true);

    resize(900);
    expect(root.classList.contains(WIDE_CLASS)).toBe(true);
    expect(root.classList.contains(COMPACT_CLASS)).toBe(false);

    resize(320);
    expect(root.classList.contains(COMPACT_CLASS)).toBe(true);

    editor.dispose();
  });

  it("honours a custom compact breakpoint", () => {
    const container = makeContainer();
    const editor = createSoundEditor({ preset: { ...PRESET }, theme: { compactBreakpoint: 900 } });
    editor.mount(container);

    const root = container.firstElementChild as HTMLElement;
    resize(800); // below the custom breakpoint
    expect(root.classList.contains(COMPACT_CLASS)).toBe(true);
    resize(1000);
    expect(root.classList.contains(WIDE_CLASS)).toBe(true);

    editor.dispose();
  });

  it("writes no global CSS", () => {
    const container = makeContainer();
    const sibling = document.createElement("div");
    sibling.className = "host-element";
    document.body.appendChild(sibling);

    const editor = createSoundEditor({ preset: { ...PRESET } });
    editor.mount(container);

    expect(document.head.querySelectorAll("style").length).toBe(0);
    expect(document.querySelectorAll("body > style").length).toBe(0);
    // No editor classes leak onto host elements outside the root.
    expect(sibling.classList.contains(COMPACT_CLASS)).toBe(false);
    expect(sibling.classList.contains(WIDE_CLASS)).toBe(false);

    editor.dispose();
  });

  it("disconnects the ResizeObserver on dispose", () => {
    const container = makeContainer();
    const editor = createSoundEditor({ preset: { ...PRESET } });
    editor.mount(container);
    expect(observers[0].disconnected).toBe(false);

    editor.dispose();
    expect(observers[0].disconnected).toBe(true);
  });
});
