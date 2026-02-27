/**
 * Context Tests
 *
 * Tests for createContext(): set/get, dimension validation, change history,
 * listeners, and reset.
 *
 * Work item: TF-0MM1N6PCH1O8DLZN
 */

import { describe, it, expect, vi } from "vitest";
import { createContext } from "./context.js";
import type { ContextChangeRecord, ContextListener } from "./context.js";

// ── Helpers ───────────────────────────────────────────────────────

function fakeClock(): { now: () => number; advance: (ms: number) => void } {
  let time = 1000;
  return {
    now: () => time,
    advance: (ms: number) => {
      time += ms;
    },
  };
}

// ── createContext — basics ────────────────────────────────────────

describe("createContext — basics", () => {
  it("creates context with default empty snapshot", () => {
    const ctx = createContext();
    expect(ctx.get()).toEqual({});
  });

  it("creates context with initial values", () => {
    const ctx = createContext({ initial: { surface: "stone", weather: "clear" } });
    expect(ctx.get()).toEqual({ surface: "stone", weather: "clear" });
  });

  it("get() returns a copy, not a reference", () => {
    const ctx = createContext({ initial: { surface: "stone" } });
    const snap1 = ctx.get();
    const snap2 = ctx.get();
    expect(snap1).toEqual(snap2);
    expect(snap1).not.toBe(snap2);
  });

  it("getDimension() returns a single value", () => {
    const ctx = createContext({ initial: { surface: "stone" } });
    expect(ctx.getDimension("surface")).toBe("stone");
    expect(ctx.getDimension("weather")).toBeUndefined();
  });
});

// ── set ──────────────────────────────────────────────────────────

describe("createContext — set", () => {
  it("sets a new dimension value", () => {
    const ctx = createContext();
    const changes = ctx.set({ surface: "gravel" });
    expect(changes).toHaveLength(1);
    expect(ctx.get()).toEqual({ surface: "gravel" });
  });

  it("updates an existing dimension value", () => {
    const ctx = createContext({ initial: { surface: "stone" } });
    const changes = ctx.set({ surface: "gravel" });
    expect(changes).toHaveLength(1);
    expect(changes[0]!.previousValue).toBe("stone");
    expect(changes[0]!.newValue).toBe("gravel");
    expect(ctx.getDimension("surface")).toBe("gravel");
  });

  it("skips unchanged values (no-op)", () => {
    const ctx = createContext({ initial: { surface: "stone" } });
    const changes = ctx.set({ surface: "stone" });
    expect(changes).toHaveLength(0);
  });

  it("sets multiple dimensions at once", () => {
    const ctx = createContext();
    const changes = ctx.set({ surface: "gravel", weather: "rain" });
    expect(changes).toHaveLength(2);
    expect(ctx.get()).toEqual({ surface: "gravel", weather: "rain" });
  });

  it("change records have incrementing seq numbers", () => {
    const ctx = createContext();
    ctx.set({ surface: "stone" });
    const changes = ctx.set({ surface: "gravel" });
    expect(changes[0]!.seq).toBe(2);
  });

  it("change records include timestamps from clock", () => {
    const clock = fakeClock();
    const ctx = createContext({ clock: clock.now });
    clock.advance(500);
    const changes = ctx.set({ surface: "stone" });
    expect(changes[0]!.timestamp).toBe(1500);
  });
});

// ── dimension validation ─────────────────────────────────────────

describe("createContext — dimension validation", () => {
  it("accepts valid dimension values", () => {
    const ctx = createContext({
      dimensions: { surface: ["stone", "gravel", "wood"] },
    });
    expect(() => ctx.set({ surface: "stone" })).not.toThrow();
    expect(() => ctx.set({ surface: "gravel" })).not.toThrow();
  });

  it("rejects invalid dimension values", () => {
    const ctx = createContext({
      dimensions: { surface: ["stone", "gravel"] },
    });
    expect(() => ctx.set({ surface: "lava" })).toThrow(
      /Invalid value 'lava' for context dimension 'surface'/,
    );
  });

  it("allows any value for dimensions not in the schema", () => {
    const ctx = createContext({
      dimensions: { surface: ["stone", "gravel"] },
    });
    expect(() => ctx.set({ weather: "rain" })).not.toThrow();
    expect(ctx.getDimension("weather")).toBe("rain");
  });
});

// ── history ──────────────────────────────────────────────────────

describe("createContext — history", () => {
  it("starts with empty history", () => {
    const ctx = createContext();
    expect(ctx.history()).toEqual([]);
  });

  it("records changes in order", () => {
    const ctx = createContext();
    ctx.set({ surface: "stone" });
    ctx.set({ surface: "gravel" });
    const hist = ctx.history();
    expect(hist).toHaveLength(2);
    expect(hist[0]!.newValue).toBe("stone");
    expect(hist[1]!.newValue).toBe("gravel");
  });

  it("limits history with the limit param", () => {
    const ctx = createContext();
    ctx.set({ surface: "stone" });
    ctx.set({ surface: "gravel" });
    ctx.set({ surface: "wood" });
    const hist = ctx.history(2);
    expect(hist).toHaveLength(2);
    expect(hist[0]!.newValue).toBe("gravel");
    expect(hist[1]!.newValue).toBe("wood");
  });

  it("trims history when maxHistory is exceeded", () => {
    const ctx = createContext({ maxHistory: 3 });
    ctx.set({ a: "1" });
    ctx.set({ a: "2" });
    ctx.set({ a: "3" });
    ctx.set({ a: "4" }); // should trim oldest
    const hist = ctx.history();
    expect(hist).toHaveLength(3);
    expect(hist[0]!.newValue).toBe("2");
  });
});

// ── onChange ──────────────────────────────────────────────────────

describe("createContext — onChange", () => {
  it("notifies listeners of changes", () => {
    const ctx = createContext();
    const changes: ContextChangeRecord[] = [];
    ctx.onChange((c) => changes.push(c));
    ctx.set({ surface: "stone" });
    expect(changes).toHaveLength(1);
    expect(changes[0]!.newValue).toBe("stone");
  });

  it("unsubscribe stops notifications", () => {
    const ctx = createContext();
    const changes: ContextChangeRecord[] = [];
    const unsub = ctx.onChange((c) => changes.push(c));
    ctx.set({ surface: "stone" });
    unsub();
    ctx.set({ surface: "gravel" });
    expect(changes).toHaveLength(1);
  });

  it("multiple listeners all receive events", () => {
    const ctx = createContext();
    const a: ContextChangeRecord[] = [];
    const b: ContextChangeRecord[] = [];
    ctx.onChange((c) => a.push(c));
    ctx.onChange((c) => b.push(c));
    ctx.set({ surface: "stone" });
    expect(a).toHaveLength(1);
    expect(b).toHaveLength(1);
  });
});

// ── reset ────────────────────────────────────────────────────────

describe("createContext — reset", () => {
  it("resets to initial values", () => {
    const ctx = createContext({ initial: { surface: "stone" } });
    ctx.set({ surface: "gravel" });
    ctx.reset();
    expect(ctx.get()).toEqual({ surface: "stone" });
  });

  it("clears history", () => {
    const ctx = createContext();
    ctx.set({ surface: "stone" });
    ctx.reset();
    expect(ctx.history()).toEqual([]);
  });

  it("resets seq counter", () => {
    const ctx = createContext();
    ctx.set({ surface: "stone" });
    ctx.reset();
    const changes = ctx.set({ surface: "gravel" });
    expect(changes[0]!.seq).toBe(1);
  });
});
