/**
 * Test helper that spawns the ToneForge CLI in a child process and captures
 * stdout, stderr, and exit code.
 *
 * Using a child process fully isolates each test invocation from the Vitest
 * worker's process-global state (process.stdout.write, console.*, TTY
 * overrides, module-scoped variables, etc.) — eliminating the class of
 * flaky failures caused by global-state leaks between tests.
 *
 * The child process uses the same dev-mode loader (bin/dev-cli.js) that a
 * real user would use, ensuring the test exercises the real CLI startup path.
 */

import { execFile } from "node:child_process";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { writeFileSync } from "node:fs";

/** Result of running a CLI command in a child process. */
export interface CliResult {
  /** Exit code (0 = success). */
  code: number;
  /** Captured stdout (trimmed). */
  stdout: string;
  /** Captured stderr (trimmed). */
  stderr: string;
}

/** Absolute path to the repository root. */
const PROJECT_ROOT = join(import.meta.dirname, "..");

/** Absolute path to the dev-mode CLI entry script. */
const CLI_ENTRY = join(PROJECT_ROOT, "bin", "dev-cli.js");

/**
 * Run a ToneForge CLI command in an isolated child process.
 *
 * @param args    CLI arguments (e.g. `["list", "--json"]`).
 * @param options Optional overrides for timeout and env.
 * @returns       A promise resolving to `{ code, stdout, stderr }`.
 */
export function runCli(
  args: string[],
  options: { timeoutMs?: number; env?: Record<string, string> } = {},
): Promise<CliResult> {
  const { timeoutMs = 30_000, env: extraEnv = {} } = options;

  return new Promise<CliResult>((resolve) => {
    const child = execFile(
      process.execPath, // current Node binary
      [CLI_ENTRY, ...args],
      {
        cwd: PROJECT_ROOT,
        timeout: timeoutMs,
        maxBuffer: 10 * 1024 * 1024, // 10 MB — generous for test output
        env: {
          ...process.env,
          // Force non-TTY / no-colour output so assertions match deterministic
          // plain text regardless of the ambient terminal.
          NO_COLOR: "1",
          // Prevent any user/CI-specific env from affecting behaviour.
          FORCE_COLOR: undefined as unknown as string,
          ...extraEnv,
        },
      },
      (error, stdout, stderr) => {
        const code =
          error && typeof (error as NodeJS.ErrnoException).code === "string"
            ? // execFile errors like ETIMEDOUT don't have `error.code` as a
              // number; fall back to a non-zero sentinel.
              1
            : error
              ? (error as { status?: number }).status ?? 1
              : 0;

        const result: CliResult = {
          code,
          stdout: stdout.trim(),
          stderr: stderr.trim(),
        };

        // Persist diagnostics for post-mortem analysis of unexpected failures.
        if (code !== 0) {
          try {
            const diagPath = join(
              tmpdir(),
              `toneforge-diagnostic-${Date.now()}-${Math.random().toString(36).slice(2)}.log`,
            );
            writeFileSync(
              diagPath,
              JSON.stringify(
                {
                  args,
                  code,
                  stdout: result.stdout,
                  stderr: result.stderr,
                  env: { NO_COLOR: "1" },
                },
                null,
                2,
              ),
            );
          } catch {
            // best-effort only
          }
        }

        resolve(result);
      },
    );

    // Safety: ensure the child is killed if the promise is never settled
    // (should not happen with the timeout above, but defence in depth).
    child.on("error", () => {
      /* handled via callback */
    });
  });
}
