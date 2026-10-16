/**
 * Repository hygiene guards (not part of the shipped TypeScript build).
 *
 * These tests protect against accidentally committing local development
 * artefacts that break every fresh checkout. They run in the root Vitest
 * project (Node) and are excluded from `tsc` because `tsconfig.json` only
 * includes `src/**`.
 *
 * See the incident behind TF-0MUUEZE48002CLBX: a self-referential
 * `node_modules` symlink was committed to `dev` because the `.gitignore`
 * rule `node_modules/` does not match a *symlink* named `node_modules`.
 */
import { describe, it, expect } from "vitest";
import { execFileSync } from "node:child_process";
import {
  existsSync,
  lstatSync,
  readFileSync,
  readdirSync,
  readlinkSync,
} from "node:fs";
import { resolve } from "node:path";

const repoRoot = resolve(__dirname, "..");

function gitTrackedPaths(): string[] {
  const output = execFileSync("git", ["ls-files"], {
    cwd: repoRoot,
    encoding: "utf-8",
  });
  return output.split("\n").filter((line) => line.length > 0);
}

describe("repository hygiene", () => {
  it("never tracks a node_modules path", () => {
    const tracked = gitTrackedPaths();
    const offenders = tracked.filter(
      (path) => path === "node_modules" || path.includes("node_modules/"),
    );
    expect(
      offenders,
      `Tracked node_modules paths break fresh checkouts: ${offenders.join(", ")}`,
    ).toEqual([]);
  });

  it("ignores node_modules even when it is a symlink", () => {
    // `node_modules/` only matches a real directory. A symlink named
    // `node_modules` must also be ignored, otherwise cleanup tooling can
    // commit it. `git check-ignore` exits 0 when the path is ignored.
    const result = execFileSync(
      "git",
      ["check-ignore", "--no-index", "node_modules"],
      { cwd: repoRoot, encoding: "utf-8" },
    );
    expect(result.trim()).toContain("node_modules");
  });

  it("does not track the implement-session state file", () => {
    const tracked = gitTrackedPaths();
    expect(tracked).not.toContain(".implement_state.json");
  });

  it("keeps node_modules out of the working tree index as a symlink loop", () => {
    // If a node_modules symlink exists on disk it must not point at itself.
    const path = resolve(repoRoot, "node_modules");
    if (!existsSync(path) || !lstatSync(path).isSymbolicLink()) {
      return; // no symlink present (fresh clone, real dir, or absent)
    }
    const target = readlinkSync(path);
    const resolved = resolve(repoRoot, target.startsWith("/") ? target : resolve(repoRoot, "..", target));
    expect(
      resolved,
      "node_modules must not be a self-referential symlink",
    ).not.toBe(path);
  });
});

/**
 * Bundle/runtime-boundary integrity for the instruments real-time engine
 * (TF-0MV9WXN7H003QI88 dual-runtime child of the instruments epic).
 *
 * The browser bundle must never statically import `node-web-audio-api`: the
 * package is a Node-only runtime dependency and any value import of it would
 * leak into the web build. The only sanctioned mention is the lazy,
 * runtime-guarded loader in `src/audio/web-audio.ts` (a string literal inside
 * an `isNodeRuntime()` guard), which never appears as a static import.
 */
describe("web bundle integrity", () => {
  const browserSourceFiles = (): string[] =>
    gitTrackedPaths().filter(
      (path) =>
        (path.startsWith("src/") || path.startsWith("web/src/"))
        && path.endsWith(".ts")
        && !path.endsWith(".test.ts")
        && !path.includes("/__tests__/")
        && !path.includes(".d.ts"),
    );

  it("has no static node-web-audio-api import in browser-reachable source", () => {
    const offenders: string[] = [];
    for (const file of browserSourceFiles()) {
      const text = readFileSync(resolve(repoRoot, file), "utf8");
      // A static value import (ESM or evaluated require) of the package.
      // `import type` is erased at compile time and is safe; the lazy loader
      // in web-audio.ts uses a variable specifier, not a static one.
      const lines = text.split("\n");
      lines.forEach((line, index) => {
        if (/^import\s+(?!type\b)[\s\S]*?from\s+["']node-web-audio-api["']/.test(line)
          || /require\s*\(\s*["']node-web-audio-api["']\s*\)/.test(line)) {
          offenders.push(`${file}:${index + 1}: ${line.trim()}`);
        }
      });
    }
    expect(
      offenders,
      "Static node-web-audio-api imports leak into the browser bundle",
    ).toEqual([]);
  });

  it(
    "builds the web bundle cleanly without a node-web-audio-api reference",
    () => {
      execFileSync("npm", ["--prefix", "web", "run", "build"], {
        cwd: repoRoot,
        encoding: "utf-8",
        stdio: ["ignore", "pipe", "pipe"],
        timeout: 300_000,
      });

      const distAssets = resolve(repoRoot, "web", "dist", "assets");
      const assetFiles = existsSync(distAssets)
        ? readdirSync(distAssets).filter((name) => name.endsWith(".js"))
        : [];
      expect(assetFiles.length).toBeGreaterThan(0);

      const referencePattern =
        /(?:import\s*\(?|from\s*|require\s*\()["'`]node-web-audio-api["'`]/;
      const hits: string[] = [];
      for (const asset of assetFiles) {
        const text = readFileSync(resolve(distAssets, asset), "utf8");
        if (referencePattern.test(text)) {
          hits.push(asset);
        }
      }
      expect(
        hits,
        "Built web bundle references node-web-audio-api (must stay Node-only)",
      ).toEqual([]);
    },
    // A full vite build + tsc is CPU-bound; allow generous headroom for
    // full-suite parallel load (the default 20s is too tight under 16 workers).
    300_000,
  );
});
