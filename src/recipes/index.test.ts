/**
 * Tests for the recipe registry initialization entry point.
 *
 * File-backed ToneGraph recipes live on disk and are discovered
 * asynchronously. `initializeRecipeRegistry()` is the explicit, idempotent
 * entry point Node callers use to load them without a top-level await
 * (which browser build targets reject).
 */
import { describe, it, expect, vi } from "vitest";

const MIGRATED = [
  "ui-scifi-confirm",
  "weapon-laser-zap",
  "footstep-gravel",
  "ambient-wind-gust",
  "card-transform",
] as const;

type MigratedName = (typeof MIGRATED)[number];

describe("initializeRecipeRegistry", () => {
  it("loads file-backed recipes on demand and registers them", async () => {
    vi.resetModules();
    const { registry, initializeRecipeRegistry } = await import("./index.js");

    // Migrated recipes are file-backed: absent until initialization runs.
    expect(registry.getRegistration("ui-scifi-confirm")).toBeUndefined();

    const discovered = await initializeRecipeRegistry();

    for (const name of MIGRATED) {
      expect(discovered).toContain(name);
      expect(
        registry.getRegistration(name),
        `${name} should be registered`,
      ).toBeDefined();
    }
  });

  it("is idempotent across repeated calls", async () => {
    vi.resetModules();
    const { registry, initializeRecipeRegistry } = await import("./index.js");

    const first = await initializeRecipeRegistry();
    const second = await initializeRecipeRegistry();

    expect(second).toEqual(first);
    // Registration is not duplicated: each migrated recipe appears once.
    const migratedInRegistry = registry
      .list()
      .filter((name): name is MigratedName =>
        (MIGRATED as readonly string[]).includes(name),
      );
    expect(migratedInRegistry.sort()).toEqual([...MIGRATED].sort());
  });

  it("exposes parameters and duration for file-backed recipes", async () => {
    vi.resetModules();
    const { registry, initializeRecipeRegistry } = await import("./index.js");
    await initializeRecipeRegistry();

    const registration = registry.getRegistration("ui-scifi-confirm");
    expect(registration).toBeDefined();
    expect(registration!.params.length).toBeGreaterThan(0);
    expect(typeof registration!.getParams).toBe("function");
    expect(typeof registration!.getDuration).toBe("function");
  });
});
