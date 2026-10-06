import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import {
  InMemorySessionStore,
  NodeFsSessionStore,
  type SessionStore,
} from "../session-store.js";

interface StoreContext {
  store: SessionStore;
  dir: string;
}

/**
 * Both adapters must satisfy the same SessionStore contract so tests can
 * swap the in-memory double for the real node:fs-backed adapter without
 * changing persistence behaviour.
 */
const adapters: Array<{
  name: string;
  create: () => Promise<StoreContext>;
  cleanup?: (ctx: StoreContext) => Promise<void>;
}> = [
  {
    name: "NodeFsSessionStore",
    create: async () => ({
      store: new NodeFsSessionStore(),
      dir: await mkdtemp(join(tmpdir(), "toneforge-session-store-")),
    }),
    cleanup: async (ctx) => {
      await rm(ctx.dir, { recursive: true, force: true });
    },
  },
  {
    name: "InMemorySessionStore",
    create: async () => ({
      store: new InMemorySessionStore(),
      dir: "/virtual/toneforge-sessions",
    }),
  },
];

for (const { name, create, cleanup } of adapters) {
  describe(`${name} implements the SessionStore contract`, () => {
    let ctx: StoreContext;

    beforeEach(async () => {
      ctx = await create();
    });

    afterEach(async () => {
      if (cleanup) await cleanup(ctx);
    });

    it("writes and reads back UTF-8 content", async () => {
      const file = join(ctx.dir, "session.json");
      await ctx.store.writeFile(file, '{"hello":"world"}');
      expect(await ctx.store.readFile(file)).toBe('{"hello":"world"}');
    });

    it("reports existence and removes files", async () => {
      const file = join(ctx.dir, "gone.json");
      expect(await ctx.store.exists(file)).toBe(false);
      await ctx.store.writeFile(file, "x");
      expect(await ctx.store.exists(file)).toBe(true);
      await ctx.store.unlink(file);
      expect(await ctx.store.exists(file)).toBe(false);
    });

    it("rejects readFile for a missing file", async () => {
      await expect(
        ctx.store.readFile(join(ctx.dir, "missing.json")),
      ).rejects.toThrow();
    });

    it("rejects unlink for a missing file", async () => {
      await expect(
        ctx.store.unlink(join(ctx.dir, "missing.json")),
      ).rejects.toThrow();
    });

    it("copies a file to a new destination", async () => {
      const src = join(ctx.dir, "src.json");
      const dest = join(ctx.dir, "dest.json");
      await ctx.store.writeFile(src, "payload");
      await ctx.store.copyFile(src, dest);
      expect(await ctx.store.readFile(dest)).toBe("payload");
    });

    it("lists directory entries", async () => {
      await ctx.store.writeFile(join(ctx.dir, "a.json"), "a");
      await ctx.store.writeFile(join(ctx.dir, "b.json"), "b");
      expect((await ctx.store.readdir(ctx.dir)).sort()).toEqual([
        "a.json",
        "b.json",
      ]);
    });
  });
}
