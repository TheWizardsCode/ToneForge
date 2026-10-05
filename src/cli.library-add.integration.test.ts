/**
 * CLI Integration Tests for `toneforge library add`.
 *
 * Exercises the command through the real yargs entrypoint (`main`), covering:
 *  - help output documenting file/inline/stdin input sources (AC1)
 *  - registration of an external ToneGraph file into the session registry (AC2)
 *  - recipe-name derivation from the filename basename (AC3)
 *  - rendering the newly registered recipe from the same registry (AC4)
 *  - clear errors on parse / schema-validation failure (AC5)
 *
 * Work item: TF-0MUUC9RTU008UJ18
 */

import { describe, it, expect, beforeEach, afterEach } from "vitest";
import {
  existsSync,
  mkdtempSync,
  rmSync,
  writeFileSync,
} from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { Readable } from "node:stream";

import { main } from "./cli.js";
import { registry } from "./recipes/index.js";

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

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

/** Replace process.stdin with a readable stream carrying `input`. */
function withStdin<T>(input: string, fn: () => Promise<T>): Promise<T> {
  const original = Object.getOwnPropertyDescriptor(process, "stdin");
  const stream = Readable.from([input]);
  Object.defineProperty(process, "stdin", {
    value: stream,
    configurable: true,
  });
  return fn().finally(() => {
    if (original) {
      Object.defineProperty(process, "stdin", original);
    }
  });
}

/** A minimal, schema-valid ToneGraph YAML document. */
function validToneGraphYaml(name: string): string {
  return `version: "0.1"
meta:
  name: ${name}
  description: Integration test recipe for library add.
  category: Test
  tags:
    - test
    - library-add
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

/** A minimal, schema-valid ToneGraph JSON document. */
function validToneGraphJson(name: string): string {
  return JSON.stringify({
    version: "0.1",
    meta: {
      name,
      description: "Integration test recipe for library add (JSON).",
      category: "Test",
      tags: ["test", "library-add"],
      duration: 0.1,
    },
    nodes: {
      osc: { kind: "oscillator", params: { type: "sine", frequency: 440 } },
      gain: { kind: "gain", params: { gain: 0.5 } },
      out: { kind: "destination" },
    },
    routing: [{ chain: ["osc", "gain", "out"] }],
  });
}

let tmpRoot: string;

beforeEach(() => {
  tmpRoot = mkdtempSync(join(tmpdir(), "tf-library-add-"));
});

afterEach(() => {
  try {
    rmSync(tmpRoot, { recursive: true, force: true });
  } catch {
    /* ignore */
  }
});

// ---------------------------------------------------------------------------
// Help (AC1)
// ---------------------------------------------------------------------------

describe("CLI library add — help", () => {
  it("library add --help documents file, inline, and stdin input sources", async () => {
    const { code, stdout } = await captureOutput(
      () => main(argv("library", "add", "--help")),
    );
    expect(code).toBe(0);
    expect(stdout).toContain("--file");
    expect(stdout).toContain("--inline");
    expect(stdout).toContain("--stdin");
  });

  it("library --help lists the add subcommand", async () => {
    const { code, stdout } = await captureOutput(
      () => main(argv("library", "--help")),
    );
    expect(code).toBe(0);
    expect(stdout).toContain("**add**");
    expect(stdout).toContain("--file");
  });
});

// ---------------------------------------------------------------------------
// Validation errors (AC5)
// ---------------------------------------------------------------------------

describe("CLI library add — validation", () => {
  it("with no input source returns a clear error", async () => {
    const { code, stderr } = await captureOutput(
      () => main(argv("library", "add")),
    );
    expect(code).toBe(1);
    expect(stderr).toContain("input source is required");
  });

  it("with no input source returns a JSON error in --json mode", async () => {
    const { code, stderr } = await captureOutput(
      () => main(argv("library", "add", "--json")),
    );
    expect(code).toBe(1);
    const json = JSON.parse(stderr);
    expect(json.error).toContain("input source is required");
  });

  it("with multiple input sources returns a clear error", async () => {
    const file = join(tmpRoot, "multi.yaml");
    writeFileSync(file, validToneGraphYaml("multi"), "utf-8");

    const { code, stderr } = await captureOutput(
      () => main(argv("library", "add", "--file", file, "--inline", "version: \"0.1\"")),
    );
    expect(code).toBe(1);
    expect(stderr).toContain("Only one input source");
  });

  it("non-existent file returns a clear error", async () => {
    const missing = join(tmpRoot, "does-not-exist.yaml");
    const { code, stderr } = await captureOutput(
      () => main(argv("library", "add", "--file", missing)),
    );
    expect(code).toBe(1);
    expect(stderr).toContain("File not found");
  });

  it("malformed YAML returns a clear parse error", async () => {
    const file = join(tmpRoot, "malformed.yaml");
    writeFileSync(file, "version: \"0.1\"\nnodes: {oops", "utf-8");

    const { code, stderr } = await captureOutput(
      () => main(argv("library", "add", "--file", file)),
    );
    expect(code).toBe(1);
    expect(stderr).toContain("Error:");
  });

  it("malformed JSON returns a clear parse error", async () => {
    const file = join(tmpRoot, "malformed.json");
    writeFileSync(file, "{ this is not json", "utf-8");

    const { code, stderr } = await captureOutput(
      () => main(argv("library", "add", "--file", file)),
    );
    expect(code).toBe(1);
    expect(stderr).toContain("Error:");
  });

  it("schema-invalid ToneGraph returns a clear validation error", async () => {
    const file = join(tmpRoot, "invalid-schema.yaml");
    // Missing required `nodes` and `routing` fields.
    writeFileSync(file, 'version: "0.1"\nmeta:\n  name: broken\n', "utf-8");

    const { code, stderr } = await captureOutput(
      () => main(argv("library", "add", "--file", file)),
    );
    expect(code).toBe(1);
    expect(stderr).toContain("nodes");
  });

  it("unsupported extension returns a clear error", async () => {
    const file = join(tmpRoot, "recipe.txt");
    writeFileSync(file, validToneGraphYaml("text"), "utf-8");

    const { code, stderr } = await captureOutput(
      () => main(argv("library", "add", "--file", file)),
    );
    expect(code).toBe(1);
    expect(stderr).toContain("Unsupported file extension");
  });

  it("inline input without --name returns a clear error", async () => {
    const { code, stderr } = await captureOutput(
      () => main(argv("library", "add", "--inline", validToneGraphYaml("inline-noname"))),
    );
    expect(code).toBe(1);
    expect(stderr).toContain("--name");
  });

  it("parse failure is reported as JSON when --json is set", async () => {
    const file = join(tmpRoot, "bad.json");
    writeFileSync(file, "{ nope", "utf-8");

    const { code, stderr } = await captureOutput(
      () => main(argv("library", "add", "--file", file, "--json")),
    );
    expect(code).toBe(1);
    const json = JSON.parse(stderr);
    expect(typeof json.error).toBe("string");
    expect(json.error.length).toBeGreaterThan(0);
  });
});

// ---------------------------------------------------------------------------
// Registration (AC2, AC3)
// ---------------------------------------------------------------------------

describe("CLI library add — registration", () => {
  it("registers a YAML recipe and derives its name from the filename", async () => {
    const file = join(tmpRoot, "test-lib-add-yaml.yaml");
    writeFileSync(file, validToneGraphYaml("ignored-meta-name"), "utf-8");

    const { code, stdout } = await captureOutput(
      () => main(argv("library", "add", "--file", file)),
    );
    expect(code).toBe(0);
    expect(stdout).toContain("test-lib-add-yaml");

    // AC2/AC3: registered in the session registry under the basename.
    const registration = registry.getRegistration("test-lib-add-yaml");
    expect(registration).toBeDefined();
    expect(registration?.category).toBe("Test");
  });

  it("registers a JSON recipe under its basename", async () => {
    const file = join(tmpRoot, "test-lib-add-json.json");
    writeFileSync(file, validToneGraphJson("ignored-meta-name"), "utf-8");

    const { code } = await captureOutput(
      () => main(argv("library", "add", "--file", file)),
    );
    expect(code).toBe(0);
    expect(registry.getRegistration("test-lib-add-json")).toBeDefined();
  });

  it("registers an inline recipe with an explicit --name", async () => {
    const { code } = await captureOutput(
      () => main(argv("library", "add", "--inline", validToneGraphYaml("inline-src"), "--name", "test-lib-add-inline")),
    );
    expect(code).toBe(0);
    expect(registry.getRegistration("test-lib-add-inline")).toBeDefined();
  });

  it("registers a recipe read from stdin with an explicit --name", async () => {
    const { code } = await withStdin(
      validToneGraphYaml("stdin-src"),
      () => captureOutput(
        () => main(argv("library", "add", "--stdin", "--name", "test-lib-add-stdin")),
      ),
    );
    expect(code).toBe(0);
    expect(registry.getRegistration("test-lib-add-stdin")).toBeDefined();
  });

  it("honours the --name override for --file", async () => {
    const file = join(tmpRoot, "test-lib-add-override.yaml");
    writeFileSync(file, validToneGraphYaml("ignored"), "utf-8");

    const { code } = await captureOutput(
      () => main(argv("library", "add", "--file", file, "--name", "test-lib-add-renamed")),
    );
    expect(code).toBe(0);
    expect(registry.getRegistration("test-lib-add-renamed")).toBeDefined();
    expect(registry.getRegistration("test-lib-add-override")).toBeUndefined();
  });

  it("emits structured JSON on success with --json", async () => {
    const file = join(tmpRoot, "test-lib-add-jsonout.yaml");
    writeFileSync(file, validToneGraphYaml("ignored"), "utf-8");

    const { code, stdout } = await captureOutput(
      () => main(argv("library", "add", "--file", file, "--json")),
    );
    expect(code).toBe(0);

    const json = JSON.parse(stdout);
    expect(json.command).toBe("library add");
    expect(json.name).toBe("test-lib-add-jsonout");
    expect(json.file).toBe(file);
    expect(json.category).toBe("Test");
    expect(Array.isArray(json.params)).toBe(true);
    expect(json.params[0].name).toBe("frequency");
  });
});

// ---------------------------------------------------------------------------
// Rendering the newly added recipe from the same registry (AC4)
// ---------------------------------------------------------------------------

describe("CLI library add — generate integration", () => {
  it("renders the newly registered recipe from the same registry instance", async () => {
    const file = join(tmpRoot, "test-lib-add-render.yaml");
    writeFileSync(file, validToneGraphYaml("ignored"), "utf-8");

    const addResult = await captureOutput(
      () => main(argv("library", "add", "--file", file)),
    );
    expect(addResult.code).toBe(0);

    const outputPath = join(tmpRoot, "rendered.wav");
    const genResult = await captureOutput(
      () => main(argv("generate", "--recipe", "test-lib-add-render", "--seed", "42", "--output", outputPath)),
    );

    expect(genResult.code).toBe(0);
    expect(existsSync(outputPath)).toBe(true);
  });

  it("reports an unknown recipe before it is added", async () => {
    // Sanity check that the name is genuinely new and that lookup is
    // registry-backed — rendering an unregistered name fails.
    expect(registry.getRegistration("test-lib-add-never-added")).toBeUndefined();

    const outputPath = join(tmpRoot, "never.wav");
    const { code } = await captureOutput(
      () => main(argv("generate", "--recipe", "test-lib-add-never-added", "--seed", "1", "--output", outputPath)),
    );
    expect(code).toBe(1);
    expect(existsSync(outputPath)).toBe(false);
  });
});
