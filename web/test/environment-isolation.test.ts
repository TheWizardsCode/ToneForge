/**
 * Environment-isolation guard.
 *
 * The SoundEditor component tests opt into happy-dom per file. This test
 * asserts the default environment stays Node-only, so enabling the DOM harness
 * cannot silently change the environment the existing web tests run in
 * (AC: "without breaking the existing Node-environment web tests").
 */
import { describe, it, expect } from "vitest";

describe("web test environment isolation", () => {
  it("keeps browser globals out of the default Node environment", () => {
    expect(typeof document).toBe("undefined");
    expect(typeof window).toBe("undefined");
  });
});
