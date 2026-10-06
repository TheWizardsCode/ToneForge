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
import { existsSync, lstatSync, readlinkSync } from "node:fs";
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
