/**
 * ToneForge Intelligence — actionable command registry and validator.
 *
 * Intelligence suggestions reference concrete, runnable `toneforge`
 * commands (parent AC5). To guarantee those commands are valid against the
 * *real* CLI surface, every engine routes its emitted command through
 * {@link validateActionableCommand} (enforced by tests), and the validator
 * only accepts commands/options declared here.
 *
 * The registry is intentionally a subset of the CLI: only the read-only,
 * suggestion-oriented commands Intelligence is allowed to emit. Keeping the
 * list explicit means an emitted command can never drift into a mutating
 * surface without being added here.
 */

/** A recognised actionable command template. */
export interface CommandSpec {
  /** Command path, e.g. `["library", "similar"]`. */
  path: string[];

  /** Allowed option names (without the leading `--`). */
  options: string[];

  /** Options that must be present. */
  required?: string[];
}

/**
 * Commands Intelligence may emit.
 *
 * These mirror the real CLI surface (`src/cli.yargs.ts` /
 * `src/cli.runtime.ts`).
 */
export const ACTIONABLE_COMMAND_SPECS: readonly CommandSpec[] = [
  {
    path: ["explore", "sweep"],
    options: ["recipe", "seed-range", "rank-by", "keep-top", "clusters", "concurrency", "output", "json"],
    required: ["recipe"],
  },
  {
    path: ["explore", "mutate"],
    options: ["recipe", "seed", "jitter", "count", "rank-by", "output", "json"],
    required: ["recipe", "seed"],
  },
  {
    path: ["library", "similar"],
    options: ["id", "limit", "json"],
    required: ["id"],
  },
  {
    path: ["library", "list"],
    options: ["category", "json"],
  },
  {
    path: ["library", "search"],
    options: ["category", "intensity", "texture", "tags", "json"],
  },
  {
    path: ["library", "regenerate"],
    options: ["id", "json"],
    required: ["id"],
  },
  {
    path: ["analyze"],
    options: ["input", "recipe", "seed", "output", "format", "json"],
  },
  {
    path: ["generate"],
    options: ["recipe", "seed", "seed-range", "output", "json"],
    required: ["recipe"],
  },
  {
    path: ["list", "recipes"],
    options: ["search", "category", "tags", "dir", "json"],
  },
];

/** Parsed representation of an actionable command. */
export interface ParsedCommand {
  /** Command path, e.g. `["library", "similar"]`. */
  path: string[];

  /** Option name to value (`true` for boolean flags). */
  options: Record<string, string | true>;
}

/**
 * Parse a command string into its path and options.
 *
 * @param command - e.g. `toneforge explore sweep --recipe footstep-stone --seed-range 0:99`.
 * @returns The parsed command, or `null` when the shape cannot be parsed
 *          (empty, missing the `toneforge` prefix, or a malformed option).
 */
export function parseActionableCommand(command: string): ParsedCommand | null {
  const tokens = command.trim().split(/\s+/);
  if (tokens.length === 0 || tokens[0] === "") return null;
  if (tokens[0] !== "toneforge") return null;

  const path: string[] = [];
  const options: Record<string, string | true> = {};

  let i = 1;
  // Command path: consume tokens until the first option.
  for (; i < tokens.length; i++) {
    const token = tokens[i]!;
    if (token.startsWith("--")) break;
    path.push(token);
  }

  for (; i < tokens.length; i++) {
    const token = tokens[i]!;
    if (!token.startsWith("--")) return null; // stray positional
    const name = token.slice(2);
    if (name === "") return null;
    const next = tokens[i + 1];
    if (next !== undefined && !next.startsWith("--")) {
      options[name] = next;
      i++;
    } else {
      options[name] = true;
    }
  }

  return { path, options };
}

/**
 * Validate that a command is a real, read-only, runnable ToneForge command.
 *
 * @param command - The command string to validate.
 * @returns `{ valid, reason }`. `reason` is empty when valid.
 */
export function validateActionableCommand(command: string): { valid: boolean; reason: string } {
  const parsed = parseActionableCommand(command);
  if (!parsed) {
    return { valid: false, reason: "not a 'toneforge' command or malformed" };
  }

  // Match the longest declared path that is a prefix of the parsed path.
  let spec: CommandSpec | undefined;
  let specLength = 0;
  for (const candidate of ACTIONABLE_COMMAND_SPECS) {
    const matches =
      candidate.path.length <= parsed.path.length &&
      candidate.path.every((segment, idx) => parsed.path[idx] === segment);
    if (matches && candidate.path.length > specLength) {
      spec = candidate;
      specLength = candidate.path.length;
    }
  }

  if (!spec) {
    return { valid: false, reason: `unknown command '${parsed.path.join(" ")}'` };
  }
  if (spec.path.length !== parsed.path.length) {
    return {
      valid: false,
      reason: `unexpected trailing command segment '${parsed.path.slice(spec.path.length).join(" ")}'`,
    };
  }

  const allowed = new Set(spec.options);
  for (const name of Object.keys(parsed.options)) {
    if (!allowed.has(name)) {
      return { valid: false, reason: `unknown option '--${name}' for '${spec.path.join(" ")}'` };
    }
  }
  for (const name of spec.required ?? []) {
    if (parsed.options[name] === undefined) {
      return { valid: false, reason: `missing required option '--${name}'` };
    }
  }

  return { valid: true, reason: "" };
}

/**
 * Build a canonical `explore sweep` command.
 */
export function exploreSweepCommand(
  recipe: string,
  seedStart: number,
  seedEnd: number,
  rankBy = "rms",
): string {
  return `toneforge explore sweep --recipe ${recipe} --seed-range ${seedStart}:${seedEnd} --rank-by ${rankBy}`;
}

/**
 * Build a canonical `explore mutate` command.
 */
export function exploreMutateCommand(recipe: string, seed: number, jitter = 0.2, count = 20): string {
  return `toneforge explore mutate --recipe ${recipe} --seed ${seed} --jitter ${jitter} --count ${count}`;
}

/** Build a canonical `library similar` command. */
export function librarySimilarCommand(entryId: string, limit = 5): string {
  return `toneforge library similar --id ${entryId} --limit ${limit}`;
}

/** Build a canonical `library regenerate` command. */
export function libraryRegenerateCommand(entryId: string): string {
  return `toneforge library regenerate --id ${entryId}`;
}

/** Build a canonical `analyze` command for a recipe/seed pair. */
export function analyzeRecipeCommand(recipe: string, seed: number): string {
  return `toneforge analyze --recipe ${recipe} --seed ${seed}`;
}

/** Build a canonical `library list` command for a category. */
export function libraryListCommand(category: string): string {
  return `toneforge library list --category ${category}`;
}
