import { describe, it, expect } from "vitest";
import { VERSION } from "../index.js";

describe("ToneForge", () => {
  it("exports a version string", () => {
    expect(VERSION).toBe("0.1.0");
  });
});
