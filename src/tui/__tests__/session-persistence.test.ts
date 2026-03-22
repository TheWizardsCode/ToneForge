import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import * as fs from "node:fs";
import { detectSessionFile, DEFAULT_SESSION_FILE } from "../session-persistence.js";

describe("session-persistence: detectSessionFile", () => {
  let origVitest: string | undefined;
  let origNodeEnv: string | undefined;

  beforeEach(() => {
    // Save original env values and avoid mutating global env permanently
    origVitest = process.env.VITEST;
    origNodeEnv = process.env.NODE_ENV;
    vi.restoreAllMocks();
  });

  afterEach(() => {
    // Restore original environment values
    if (origVitest === undefined) delete process.env.VITEST;
    else process.env.VITEST = origVitest;

    if (origNodeEnv === undefined) delete process.env.NODE_ENV;
    else process.env.NODE_ENV = origNodeEnv;

    vi.restoreAllMocks();
  });

  it("returns false when running under VITEST env", () => {
    process.env.VITEST = "true";
    // Create a session file on disk to ensure existsSync would return true
    fs.writeFileSync(DEFAULT_SESSION_FILE, "{}", "utf-8");

    try {
      expect(detectSessionFile(DEFAULT_SESSION_FILE)).toBe(false);
    } finally {
      fs.unlinkSync(DEFAULT_SESSION_FILE);
    }
  });

  it("returns false when NODE_ENV is test", () => {
    process.env.NODE_ENV = "test";
    fs.writeFileSync(DEFAULT_SESSION_FILE, "{}", "utf-8");

    try {
      expect(detectSessionFile(DEFAULT_SESSION_FILE)).toBe(false);
    } finally {
      fs.unlinkSync(DEFAULT_SESSION_FILE);
    }
  });

  it("defers to fs.existsSync when not in a test env", () => {
    // Ensure env is not indicating a test
    delete process.env.VITEST;
    delete process.env.NODE_ENV;

    fs.writeFileSync(DEFAULT_SESSION_FILE, "{}", "utf-8");

    try {
      expect(detectSessionFile(DEFAULT_SESSION_FILE)).toBe(true);
    } finally {
      fs.unlinkSync(DEFAULT_SESSION_FILE);
    }
  });
});
