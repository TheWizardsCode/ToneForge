import type { Arguments } from "yargs";
import { outputInfo, outputTable, outputError, isStdoutTty } from "../../output.js";
import { registry } from "../../recipes/index.js";
import { truncateTags } from "../../cli/helpers.js";

export const command = "list [resource]";
export const desc = "List available resources";

export function builder(yargs: any) {
  return yargs
    .positional("resource", {
      type: "string",
      describe: "Resource type to list (e.g. recipes)",
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

  if (res !== "recipes") {
    if (jsonMode) {
      // eslint-disable-next-line no-console
      console.error(JSON.stringify({ error: `Unknown resource: ${res}` }));
    } else {
      outputError(`Unknown resource: ${res}`);
    }
    return 1;
  }

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
  const rawSearch = typeof argv.search === "string" ? argv.search : undefined;
  const search = rawSearch && rawSearch.trim().length > 0 ? rawSearch.trim().toLowerCase() : undefined;
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
