import { describe, it, expect } from "vitest";
import {
  saveSession,
  loadSession,
  detectSessionFile,
  deleteSessionFile,
  listBackups,
  SESSION_SCHEMA_VERSION,
  DEFAULT_SESSION_FILE,
  SessionVersionMismatchError,
  SessionCorruptedError,
} from "../session-persistence.js";
import { InMemorySessionStore } from "../session-store.js";
import type { WizardSessionData, CandidateSelection } from "../types.js";

// ---------------------------------------------------------------------------
// Fixtures
//
// Tests inject an in-memory store, so nothing here touches the developer's
// on-disk session files and no test relies on VITEST/NODE_ENV environment
// checks (removed by TF-0MN1QCTMC07ATYMS).
// ---------------------------------------------------------------------------

const SESSION_DIR = "/virtual/toneforge-sessions";
const SESSION_PATH = `${SESSION_DIR}/${DEFAULT_SESSION_FILE}`;

function makeSelection(recipe: string): CandidateSelection {
  return {
    recipe,
    // Persistence only serialises these values; minimal fixtures keep the
    // test focused on the store boundary rather than candidate synthesis.
    candidate: {
      id: `${recipe}_seed-00000`,
      recipe,
      seed: 0,
    } as unknown as CandidateSelection["candidate"],
    classification: {
      source: `${recipe}_seed-0`,
    } as unknown as CandidateSelection["classification"],
  };
}

function makeSessionData(
  overrides: Partial<WizardSessionData> = {},
): WizardSessionData {
  return {
    currentStage: "explore",
    manifest: {
      entries: [
        {
          recipe: "card-flip",
          description: "A flicked card impact",
          category: "card-game",
          tags: ["card", "ui"],
        },
      ],
    },
    selections: new Map([["card-flip", makeSelection("card-flip")]]),
    sweepCache: new Map(),
    exportDir: "./out",
    exportByCategory: true,
    ...overrides,
  };
}

// ---------------------------------------------------------------------------

describe("session-persistence: detectSessionFile", () => {
  it("reports absence through the injected store", async () => {
    const store = new InMemorySessionStore();
    expect(await detectSessionFile(SESSION_PATH, store)).toBe(false);
  });

  it("reports presence through the injected store", async () => {
    const store = new InMemorySessionStore();
    await store.writeFile(SESSION_PATH, "{}");
    expect(await detectSessionFile(SESSION_PATH, store)).toBe(true);
  });
});

describe("session-persistence: saveSession / loadSession", () => {
  it("round-trips session data and drops the sweep cache", async () => {
    const store = new InMemorySessionStore();
    const data = makeSessionData({
      sweepCache: new Map([
        ["card-flip", { recipe: "card-flip", candidates: [] }],
      ]),
    });

    await saveSession(data, SESSION_PATH, store);
    const loaded = await loadSession(SESSION_PATH, store);

    expect(loaded.currentStage).toBe("explore");
    expect(loaded.manifest).toEqual(data.manifest);
    expect(loaded.selections.size).toBe(1);
    expect(loaded.selections.get("card-flip")).toEqual(
      data.selections.get("card-flip"),
    );
    expect(loaded.exportDir).toBe("./out");
    expect(loaded.exportByCategory).toBe(true);
    // Sweep cache is deliberately not persisted; it re-runs on resume.
    expect(loaded.sweepCache.size).toBe(0);
  });

  it("throws SessionVersionMismatchError for an unsupported schema version", async () => {
    const store = new InMemorySessionStore();
    await store.writeFile(
      SESSION_PATH,
      JSON.stringify({
        schemaVersion: SESSION_SCHEMA_VERSION + 1,
        currentStage: "define",
        manifest: { entries: [] },
        selections: {},
      }),
    );

    await expect(loadSession(SESSION_PATH, store)).rejects.toBeInstanceOf(
      SessionVersionMismatchError,
    );
  });

  it("throws SessionCorruptedError for unparseable content", async () => {
    const store = new InMemorySessionStore();
    await store.writeFile(SESSION_PATH, "{ not-json");

    await expect(loadSession(SESSION_PATH, store)).rejects.toBeInstanceOf(
      SessionCorruptedError,
    );
  });

  it("creates a timestamped backup of the previous file on save", async () => {
    const store = new InMemorySessionStore();
    await store.writeFile(SESSION_PATH, "previous");

    await saveSession(makeSessionData(), SESSION_PATH, store);

    const backups = await listBackups(SESSION_PATH, store);
    expect(backups).toHaveLength(1);
    expect(await store.readFile(backups[0])).toBe("previous");
  });

  it("prunes backups beyond the retention limit", async () => {
    const store = new InMemorySessionStore();
    const base = `${SESSION_DIR}/.toneforge-session`;
    await store.writeFile(SESSION_PATH, "main");
    for (const ts of [
      "20000101T000000",
      "20000102T000000",
      "20000103T000000",
      "20000104T000000",
    ]) {
      await store.writeFile(`${base}.${ts}.json`, ts);
    }

    await saveSession(makeSessionData(), SESSION_PATH, store);

    const backups = await listBackups(SESSION_PATH, store);
    expect(backups).toHaveLength(3);
    // The two oldest backups are pruned, older than the seeded newest.
    expect(backups.some((p) => p.endsWith("20000104T000000.json"))).toBe(true);
    expect(backups.some((p) => p.endsWith("20000101T000000.json"))).toBe(false);
  });
});

describe("session-persistence: deleteSessionFile", () => {
  it("removes the session file and every backup", async () => {
    const store = new InMemorySessionStore();
    const backup = `${SESSION_DIR}/.toneforge-session.20000101T000000.json`;
    await store.writeFile(SESSION_PATH, "main");
    await store.writeFile(backup, "backup");

    await deleteSessionFile(SESSION_PATH, store);

    expect(await store.exists(SESSION_PATH)).toBe(false);
    expect(await store.exists(backup)).toBe(false);
    expect(await listBackups(SESSION_PATH, store)).toEqual([]);
  });
});
