/**
 * CLI Integration Tests for persistent external recipe registration.
 *
 * Verifies that `tf library add --file` persists recipes to an external
 * directory (AC1/AC2), keeps them discoverable by a separate `tf generate`
 * process, is idempotent (AC3), rejects invalid recipes without touching the
 * library (AC4), resolves relative/absolute paths (AC6), and surfaces external
 * recipes in `tf library list` (AC7).
 *
 * Work item: TF-0MUVC3DZ10089SAU
 */

import { describe, it, expect, beforeEach, afterEach } from "vitest";
import {
  existsSync,
  mkdtempSync,
  readFileSync,
  readdirSync,
  rmSync,
  writeFileSync,
} from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { execFileSync } from "node:child_process";

import { main } from "./cli.js";

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/** The worktree/project root (this test file lives in `src/`). */
const PROJECT_ROOT = resolve(import.meta.dirname, "..");
const CLI_ENTRY = join(PROJECT_ROOT, "bin", "dev-cli.js");

/** Capture stdout/stderr written during a CLI invocation. */
async function captureOutput(fn: () => Promise<number>): Promise<{
  code: number;
  stdout: string;
  stderr: string;
}> {
  const stdoutLines: string[] = [];
  const stderrLines: string[] = [];

  const origLog = console.log;
  const origError = console.error;
  const origStdoutWrite = process.stdout.write;
  const origStderrWrite = process.stderr.write;

  console.log = (...args: unknown[]) => {
    stdoutLines.push(args.map(String).join(" "));
  };
  console.error = (...args: unknown[]) => {
    stderrLines.push(args.map(String).join(" "));
  };
  process.stdout.write = ((chunk: string | Uint8Array) => {
    stdoutLines.push(String(chunk).replace(/\n$/, ""));
    return true;
  }) as typeof process.stdout.write;
  process.stderr.write = ((chunk: string | Uint8Array) => {
    stderrLines.push(String(chunk).replace(/\n$/, ""));
    return true;
  }) as typeof process.stderr.write;

  try {
    const code = await fn();
    return {
      code,
      stdout: stdoutLines.join("\n"),
      stderr: stderrLines.join("\n"),
    };
  } finally {
    console.log = origLog;
    console.error = origError;
    process.stdout.write = origStdoutWrite;
    process.stderr.write = origStderrWrite;
  }
}

/** Build a fake argv array matching `node cli.ts ...`. */
function argv(...args: string[]): string[] {
  return ["node", "cli.ts", ...args];
}

/** A minimal, schema-valid ToneGraph YAML document. */
function validToneGraphYaml(name: string): string {
  return `version: "0.1"
meta:
  name: ${name}
  description: External persistence test recipe.
  category: Test
  tags:
    - test
    - external
  duration: 0.1
  parameters:
    - name: frequency
      type: number
      min: 100
      max: 1000
      unit: Hz
      default: 440
nodes:
  osc:
    kind: oscillator
    params:
      type: sine
      frequency: 440
  gain:
    kind: gain
    params:
      gain: 0.5
  out:
    kind: destination
routing:
  - chain: [osc, gain, out]
`;
}

let tmpRoot: string;
let externalDir: string;
let originalRecipeDir: string | undefined;

beforeEach(() => {
  tmpRoot = mkdtempSync(join(tmpdir(), "tf-lib-persist-"));
  externalDir = join(tmpRoot, "external-recipes");
  originalRecipeDir = process.env["TONEFORGE_RECIPE_DIR"];
  process.env["TONEFORGE_RECIPE_DIR"] = externalDir;
});

afterEach(() => {
  if (originalRecipeDir === undefined) {
    delete process.env["TONEFORGE_RECIPE_DIR"];
  } else {
    process.env["TONEFORGE_RECIPE_DIR"] = originalRecipeDir;
  }
  try {
    rmSync(tmpRoot, { recursive: true, force: true });
  } catch {
    /* ignore */
  }
});

// ---------------------------------------------------------------------------
// Persistence (AC1, AC2)
// ---------------------------------------------------------------------------

describe("CLI library add — persistent registration", () => {
  it("copies the recipe into TONEFORGE_RECIPE_DIR and persists JSON metadata", async () => {
    const file = join(tmpRoot, "persist-env.yaml");
    writeFileSync(file, validToneGraphYaml("persist-env"), "utf-8");

    const { code, stdout } = await captureOutput(
      () => main(argv("library", "add", "--file", file)),
    );

    expect(code).toBe(0);
    const persisted = join(externalDir, "persist-env.yaml");
    expect(existsSync(persisted)).toBe(true);
    expect(readFileSync(persisted, "utf-8")).toBe(
      validToneGraphYaml("persist-env"),
    );
    expect(stdout).toContain("Persisted to");
  });

  it("stores the persisted file under the --name override", async () => {
    const file = join(tmpRoot, "original-name.yaml");
    writeFileSync(file, validToneGraphYaml("ignored"), "utf-8");

    const { code } = await captureOutput(
      () => main(argv("library", "add", "--file", file, "--name", "renamed-recipe")),
    );

    expect(code).toBe(0);
    expect(existsSync(join(externalDir, "renamed-recipe.yaml"))).toBe(true);
    expect(existsSync(join(externalDir, "original-name.yaml"))).toBe(false);
  });

  it("honours --destination over TONEFORGE_RECIPE_DIR", async () => {
    const file = join(tmpRoot, "custom-dest.yaml");
    writeFileSync(file, validToneGraphYaml("custom-dest"), "utf-8");
    const customDest = join(tmpRoot, "custom-recipes");

    const { code } = await captureOutput(
      () => main(argv("library", "add", "--file", file, "--destination", customDest)),
    );

    expect(code).toBe(0);
    expect(existsSync(join(customDest, "custom-dest.yaml"))).toBe(true);
    expect(existsSync(join(externalDir, "custom-dest.yaml"))).toBe(false);
  });

  it("emits destination and persistedFile in --json mode", async () => {
    const file = join(tmpRoot, "json-dest.yaml");
    writeFileSync(file, validToneGraphYaml("json-dest"), "utf-8");

    const { code, stdout } = await captureOutput(
      () => main(argv("library", "add", "--file", file, "--json")),
    );

    expect(code).toBe(0);
    const json = JSON.parse(stdout);
    expect(json.command).toBe("library add");
    expect(json.destination).toBe(resolve(externalDir));
    expect(json.persistedFile).toBe(resolve(externalDir, "json-dest.yaml"));
    expect(existsSync(json.persistedFile)).toBe(true);
  });

  it("resolves a relative --destination against the CWD", async () => {
    const file = join(tmpRoot, "relative-dest.yaml");
    writeFileSync(file, validToneGraphYaml("relative-dest"), "utf-8");
    const relativeDest = join("relative-dest-dir");

    const originalCwd = process.cwd();
    process.chdir(tmpRoot);
    try {
      const { code, stdout } = await captureOutput(
        () => main(argv("library", "add", "--file", file, "--destination", relativeDest, "--json")),
      );
      expect(code).toBe(0);
      const json = JSON.parse(stdout);
      expect(json.destination).toBe(resolve(tmpRoot, relativeDest));
      expect(existsSync(join(tmpRoot, relativeDest, "relative-dest.yaml"))).toBe(true);
    } finally {
      process.chdir(originalCwd);
    }
  });

  it("persists inline input as YAML to the external directory", async () => {
    const { code } = await captureOutput(
      () => main(argv("library", "add", "--inline", validToneGraphYaml("inline-external"), "--name", "inline-external")),
    );

    expect(code).toBe(0);
    expect(existsSync(join(externalDir, "inline-external.yaml"))).toBe(true);
  });
});

// ---------------------------------------------------------------------------
// Idempotency (AC3)
// ---------------------------------------------------------------------------

describe("CLI library add — idempotency", () => {
  it("re-registering the same recipe twice is a clean no-op", async () => {
    const file = join(tmpRoot, "idempotent.yaml");
    writeFileSync(file, validToneGraphYaml("idempotent"), "utf-8");

    const first = await captureOutput(
      () => main(argv("library", "add", "--file", file)),
    );
    const second = await captureOutput(
      () => main(argv("library", "add", "--file", file)),
    );

    expect(first.code).toBe(0);
    expect(second.code).toBe(0);
    const files = readdirSync(externalDir).filter((f) => f.endsWith(".yaml"));
    expect(files).toEqual(["idempotent.yaml"]);
  });

  it("overwrites the persisted file with updated contents", async () => {
    const file = join(tmpRoot, "overwrite.yaml");
    writeFileSync(file, validToneGraphYaml("overwrite"), "utf-8");

    await captureOutput(() => main(argv("library", "add", "--file", file)));
    writeFileSync(
      file,
      validToneGraphYaml("overwrite").replace("category: Test", "category: Updated"),
      "utf-8",
    );
    await captureOutput(() => main(argv("library", "add", "--file", file)));

    const persisted = readFileSync(join(externalDir, "overwrite.yaml"), "utf-8");
    expect(persisted).toContain("category: Updated");
    expect(readdirSync(externalDir)).toEqual(["overwrite.yaml"]);
  });
});

// ---------------------------------------------------------------------------
// Validation and error handling (AC4)
// ---------------------------------------------------------------------------

describe("CLI library add — validation leaves the library unchanged", () => {
  it("rejects a schema-invalid recipe with a non-zero exit and no persisted file", async () => {
    const file = join(tmpRoot, "invalid-schema.yaml");
    writeFileSync(file, 'version: "0.1"\nmeta:\n  name: broken\n', "utf-8");

    const { code, stderr } = await captureOutput(
      () => main(argv("library", "add", "--file", file)),
    );

    expect(code).toBe(1);
    expect(stderr).toContain("nodes");
    expect(existsSync(externalDir)).toBe(false);
  });

  it("rejects a malformed recipe without creating the destination directory", async () => {
    const file = join(tmpRoot, "malformed.yaml");
    writeFileSync(file, "version: \"0.1\"\nnodes: {oops", "utf-8");

    const { code } = await captureOutput(
      () => main(argv("library", "add", "--file", file)),
    );

    expect(code).toBe(1);
    expect(existsSync(externalDir)).toBe(false);
  });

  it("rejects a recipe name containing path separators", async () => {
    const file = join(tmpRoot, "safe-file.yaml");
    writeFileSync(file, validToneGraphYaml("safe"), "utf-8");

    const { code, stderr } = await captureOutput(
      () => main(argv("library", "add", "--file", file, "--name", "../escape")),
    );

    expect(code).toBe(1);
    expect(stderr).toContain("Invalid recipe name");
    expect(existsSync(externalDir)).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// Listing (AC7)
// ---------------------------------------------------------------------------

describe("CLI library list — external recipes", () => {
  it("surfaces an externally registered recipe with its source directory (JSON)", async () => {
    const file = join(tmpRoot, "listed-external.yaml");
    writeFileSync(file, validToneGraphYaml("listed-external"), "utf-8");

    await captureOutput(() => main(argv("library", "add", "--file", file)));

    const { code, stdout } = await captureOutput(
      () => main(argv("library", "list", "--json")),
    );

    expect(code).toBe(0);
    const json = JSON.parse(stdout);
    const external = json.recipes.find(
      (r: { name: string }) => r.name === "listed-external",
    );
    expect(external).toBeDefined();
    expect(external.external).toBe(true);
    expect(external.source).toBe(resolve(externalDir));
    expect(json.externalRecipeCount).toBeGreaterThanOrEqual(1);
  });

  it("surfaces external recipes with source and kind in human output", async () => {
    const file = join(tmpRoot, "listed-human.yaml");
    writeFileSync(file, validToneGraphYaml("listed-human"), "utf-8");

    await captureOutput(() => main(argv("library", "add", "--file", file)));

    const { code, stdout } = await captureOutput(
      () => main(argv("library", "list")),
    );

    expect(code).toBe(0);
    expect(stdout).toContain("listed-human");
    expect(stdout).toContain("external");
    // The source column word-wraps long paths, so assert on the intact
    // temp-root prefix and the "external" kind rather than the full path.
    expect(stdout).toContain(tmpRoot);
    expect(stdout).toContain("external");
  });
});

// ---------------------------------------------------------------------------
// Separate process discovery (AC1) — the core requirement
// ---------------------------------------------------------------------------

describe("CLI library add — separate process discovery", () => {
  it(
    "a fresh `tf generate` process discovers and renders a persisted recipe",
    () => {
      const recipeFile = join(tmpRoot, "game-weapon.yaml");
      writeFileSync(recipeFile, validToneGraphYaml("game-weapon"), "utf-8");

      const childEnv = {
        ...process.env,
        TONEFORGE_RECIPE_DIR: externalDir,
      };

      // Process 1: register (persist) the recipe.
      execFileSync(
        process.execPath,
        [CLI_ENTRY, "library", "add", "--file", recipeFile, "--json"],
        { cwd: PROJECT_ROOT, env: childEnv, encoding: "utf-8", timeout: 120_000 },
      );
      expect(existsSync(join(externalDir, "game-weapon.yaml"))).toBe(true);

      // Process 2: a completely fresh process renders the recipe.
      const outputPath = join(tmpRoot, "game-weapon.wav");
      execFileSync(
        process.execPath,
        [
          CLI_ENTRY,
          "generate",
          "--recipe",
          "game-weapon",
          "--seed",
          "42",
          "--output",
          outputPath,
        ],
        { cwd: PROJECT_ROOT, env: childEnv, encoding: "utf-8", timeout: 120_000 },
      );

      expect(existsSync(outputPath)).toBe(true);
      const wav = readFileSync(outputPath);
      // RIFF/WAVE header sanity check.
      expect(wav.subarray(0, 4).toString("ascii")).toBe("RIFF");
      expect(wav.subarray(8, 12).toString("ascii")).toBe("WAVE");
    },
    180_000,
  );
});

// ---------------------------------------------------------------------------
// Help documentation (AC9)
// ---------------------------------------------------------------------------

describe("CLI library add — help documentation", () => {
  it("documents --destination, TONEFORGE_RECIPE_DIR and a worked example", async () => {
    const { code, stdout } = await captureOutput(
      () => main(argv("library", "add", "--help")),
    );
    expect(code).toBe(0);
    expect(stdout).toContain("--destination");
    expect(stdout).toContain("TONEFORGE_RECIPE_DIR");
    expect(stdout).toContain("~/.toneforge/recipes");
    expect(stdout).toContain("generate --recipe");
  });
});
