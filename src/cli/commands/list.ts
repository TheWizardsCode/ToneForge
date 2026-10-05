import type { Arguments } from "yargs";
import { readdir, readFile } from "node:fs/promises";
import { join } from "node:path";
import { outputInfo, outputTable, outputError, isStdoutTty } from "../../output.js";
import { registry } from "../../recipes/index.js";
import { truncateTags } from "../../cli/helpers.js";

/** Absolute path to the repository root. */
const PROJECT_ROOT = join(import.meta.dirname, "../../..");

/** Known resource types that the list command supports. */
const VALID_RESOURCES = ["recipes", "sequences", "stacks"] as const;
type ValidResource = (typeof VALID_RESOURCES)[number];

/** Base directory for preset files by resource type. */
const RESOURCE_DIR: Record<Exclude<ValidResource, "recipes">, string> = {
  sequences: join(PROJECT_ROOT, "presets", "sequences"),
  stacks: join(PROJECT_ROOT, "presets", "stacks"),
};

/** Minimal preset shape extracted from JSON files. */
interface PresetEntry {
  name: string;
  description: string;
}

/**
 * Scan a preset directory and parse each JSON file to extract name and
 * description.  Malformed files are collected and reported by the caller so
 * the command can exit non-zero (AC #4).
 */
async function listPresets(dir: string): Promise<{ presets: PresetEntry[]; malformed: string[] }> {
  const presets: PresetEntry[] = [];
  const malformed: string[] = [];
  const files = await readdir(dir);

  for (const file of files.sort()) {
    if (!file.endsWith(".json")) continue;
    const filePath = join(dir, file);
    try {
      const raw = await readFile(filePath, "utf-8");
      const parsed: Record<string, unknown> = JSON.parse(raw);
      const name = typeof parsed.name === "string" ? parsed.name : file.replace(/\.json$/, "");
      const description = typeof parsed.description === "string" ? parsed.description : "";
      presets.push({ name, description });
    } catch (err) {
      malformed.push(`${file} (${err instanceof Error ? err.message : String(err)})`);
    }
  }

  return { presets, malformed };
}

export const command = "list [resource]";
export const desc = "List available resources";

export function builder(yargs: any) {
  return yargs
    .positional("resource", {
      type: "string",
      describe: "Resource type to list: recipes, sequences, or stacks",
      default: "recipes",
    })
    .option("search", { type: "string", describe: "Search filter" })
    .option("category", { type: "string", describe: "Filter by category" })
    .option("tags", { type: "string", describe: "Filter by tags" })
    .option("json", { type: "boolean", describe: "Output JSON" });
}

export async function handler(argv: Arguments) {
  const resource = argv.resource as string | undefined;
  const jsonMode = argv.json === true;
  const res = (resource || "recipes").toString();

  if (!(VALID_RESOURCES as readonly string[]).includes(res)) {
    if (jsonMode) {
      // eslint-disable-next-line no-console
      console.error(JSON.stringify({ error: `Unknown resource: ${res}` }));
    } else {
      outputError(`Unknown resource: ${res}`);
    }
    return 1;
  }

  const rawSearch = typeof argv.search === "string" ? argv.search : undefined;
  const search = rawSearch && rawSearch.trim().length > 0 ? rawSearch.trim().toLowerCase() : undefined;

  if (res === "sequences" || res === "stacks") {
    return handlePresets(res, RESOURCE_DIR[res], search, rawSearch, jsonMode);
  }

  return handleRecipes(argv, search, rawSearch, jsonMode);
}

/** Handle the `list sequences` and `list stacks` resource types. */
async function handlePresets(
  resource: "sequences" | "stacks",
  dir: string,
  search: string | undefined,
  rawSearch: string | undefined,
  jsonMode: boolean,
): Promise<number> {
  let presets: PresetEntry[];
  let malformed: string[];
  try {
    ({ presets, malformed } = await listPresets(dir));
  } catch (err) {
    const message = `Failed to read ${resource} directory: ${err instanceof Error ? err.message : String(err)}`;
    if (jsonMode) {
      // eslint-disable-next-line no-console
      console.error(JSON.stringify({ error: message }));
    } else {
      outputError(message);
    }
    return 1;
  }

  if (malformed.length > 0) {
    const message = `Malformed ${resource} preset file(s): ${malformed.join(", ")}`;
    if (jsonMode) {
      // eslint-disable-next-line no-console
      console.error(JSON.stringify({ error: message }));
    } else {
      outputError(message);
    }
    return 1;
  }

  const total = presets.length;
  const filtered = search
    ? presets.filter(
        (p) => p.name.toLowerCase().includes(search) || p.description.toLowerCase().includes(search),
      )
    : presets;

  if (jsonMode) {
    const out: any = {
      command: "list",
      resource,
      total,
      presets: filtered.map((p) => ({ name: p.name, description: p.description })),
    };
    if (search) out.filters = { search: rawSearch };
    // eslint-disable-next-line no-console
    console.log(JSON.stringify(out, null, 2));
    return 0;
  }

  if (filtered.length === 0) {
    if (search) {
      outputInfo(`Found 0 of ${total} ${resource}`);
    } else {
      outputInfo(`Showing 0 ${resource}`);
    }
    return 0;
  }

  const label = resource === "sequences" ? "Sequence" : "Stack";
  const rows = filtered.map((p) => [p.name, p.description.replace(/\s+/g, " ").trim()]);

  outputTable(
    [
      { header: label, width: 30 },
      { header: "Description", width: 60 },
    ],
    rows,
  );

  if (search) {
    outputInfo(`Found ${filtered.length} of ${total} ${resource}`);
  } else {
    outputInfo(`Showing ${filtered.length} ${resource}`);
  }

  return 0;
}

/** Handle the existing `list recipes` resource type. */
function handleRecipes(
  argv: Arguments,
  search: string | undefined,
  rawSearch: string | undefined,
  jsonMode: boolean,
): number {
  // Gather registry entries
  const names = registry.list();
  const total = names.length;
  const items = names.map((n) => {
    const r = registry.getRegistration(n)!;
    return {
      name: n,
      description: r.description || "",
      category: r.category || "",
      categoryNorm: (r.category || "").toLowerCase().replace(/\s+/g, "-"),
      tags: r.tags ?? [],
    };
  });

  // Parse filters
  const rawCategory = typeof argv.category === "string" ? argv.category : undefined;
  const categoryNorm = rawCategory ? rawCategory.toLowerCase().replace(/\s+/g, "-") : undefined;
  const rawTags = typeof argv.tags === "string" ? argv.tags : undefined;
  const tags = rawTags ? rawTags.split(",").map((t) => t.trim()).filter(Boolean) : undefined;

  // matchedTags map: recipe name -> matched tag list (original-cased)
  const matchedTagsMap = new Map<string, string[]>();

  let filtered = items.slice();

  if (search) {
    filtered = filtered.filter((it) => {
      const nameMatch = it.name.toLowerCase().includes(search);
      const descMatch = it.description.toLowerCase().includes(search);
      const catMatch = it.category.toLowerCase().includes(search);
      const tagMatches = it.tags.filter((t) => t.toLowerCase().includes(search));
      if (tagMatches.length > 0) matchedTagsMap.set(it.name, tagMatches);
      return nameMatch || descMatch || catMatch || tagMatches.length > 0;
    });
  }

  if (categoryNorm) {
    filtered = filtered.filter((it) => it.categoryNorm === categoryNorm);
  }

  if (tags && tags.length > 0) {
    const tagsLower = tags.map((t) => t.toLowerCase());
    filtered = filtered.filter((it) => {
      const lower = it.tags.map((t) => t.toLowerCase());
      const ok = tagsLower.every((tg) => lower.includes(tg));
      if (ok) {
        const matched = it.tags.filter((t) => tagsLower.includes(t.toLowerCase()));
        if (matched.length > 0) matchedTagsMap.set(it.name, matched);
      }
      return ok;
    });
  }

  // JSON output
  if (jsonMode) {
    const out: any = {
      command: "list",
      resource: "recipes",
      total,
      recipes: filtered.map((it) => ({ name: it.name, description: it.description, category: it.category, tags: it.tags })),
    };
    if (search) out.filters = { ...(out.filters || {}), search: rawSearch };
    if (rawCategory) out.filters = { ...(out.filters || {}), category: rawCategory };
    if (rawTags) out.filters = { ...(out.filters || {}), tags: rawTags.split(",").map((t) => t.trim()).filter(Boolean) };
    // eslint-disable-next-line no-console
    console.log(JSON.stringify(out, null, 2));
    return 0;
  }

  // Human table output
  if (filtered.length === 0) {
    if (search || rawCategory || rawTags) {
      outputInfo(`Found 0 of ${total} recipes`);
    } else {
      outputInfo(`Showing 0 recipes`);
    }
    return 0;
  }

  const tty = isStdoutTty();
  const rows = filtered.map((it) => {
    const matched = matchedTagsMap.get(it.name) ?? [];
    const tagsCell = truncateTags(it.tags, 14, matched, tty);
    // Collapse whitespace in description to a single space to keep table tidy
    const oneLineDesc = it.description.replace(/\s+/g, " ").trim();
    return [it.name, oneLineDesc, it.category, tagsCell];
  });

  outputTable(
    [
      { header: "Recipe", width: 30 },
      { header: "Description", width: 40 },
      { header: "Category", width: 12 },
      { header: "Tags", width: 14 },
    ],
    rows,
  );

  if (search || rawCategory || rawTags) {
    outputInfo(`Found ${filtered.length} of ${total} recipes`);
  } else {
    outputInfo(`Showing ${filtered.length} recipes`);
  }

  return 0;
}

export default { command, desc, builder, handler };
