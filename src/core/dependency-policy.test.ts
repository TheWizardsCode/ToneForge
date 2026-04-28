import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

function readPackageJson(relativePath: string): Record<string, unknown> {
  const absolutePath = resolve(process.cwd(), relativePath);
  return JSON.parse(readFileSync(absolutePath, "utf-8")) as Record<string, unknown>;
}

function dependencies(pkg: Record<string, unknown>): string[] {
  const deps = (pkg.dependencies ?? {}) as Record<string, string>;
  return Object.keys(deps);
}

describe("dependency policy", () => {
  it("does not include Tone.js runtime dependencies", () => {
    const rootPkg = readPackageJson("package.json");
    const webPkg = readPackageJson("web/package.json");

    const allDeps = [...dependencies(rootPkg), ...dependencies(webPkg)];

    expect(allDeps).not.toContain("tone");
    expect(allDeps).not.toContain("standardized-audio-context");
  });
});
