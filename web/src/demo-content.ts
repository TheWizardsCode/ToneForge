/**
 * Demo content — driven by markdown files in demos/.
 *
 * Imports demo markdown via Vite's ?raw suffix, parses it with the
 * shared parser, and re-exports the structured step data for the
 * wizard and tests to consume.
 *
 * No hardcoded demo content — all narrative comes from markdown.
 */

// Polyfill Buffer for browser environments (required by gray-matter)
import { Buffer } from "buffer";
if (typeof globalThis.Buffer === "undefined") {
  (globalThis as Record<string, unknown>).Buffer = Buffer;
}

import { parseDemoMarkdown } from "@toneforge/demo/parser.js";
import type { ParsedDemoStep, ParsedDemo, DemoMeta } from "@toneforge/demo/parser.js";

// Auto-discover all demo markdown files via Vite's import.meta.glob.
// New demos added to demos/ are picked up automatically — no manual
// imports needed.  README.md is excluded by the negative pattern.
const rawModules = import.meta.glob(
  ["@demos/*.md", "!@demos/README.md"],
  { query: "?raw", import: "default", eager: true },
) as Record<string, string>;

// ── Types ─────────────────────────────────────────────────────────

/** Re-export ParsedDemoStep as DemoStep for backward compatibility. */
export type DemoStep = ParsedDemoStep;

/** A loaded demo with its metadata and steps. */
export interface LoadedDemo {
  meta: DemoMeta;
  steps: DemoStep[];
}

// ── Parse all demos ───────────────────────────────────────────────

/** Registry of raw markdown sources keyed by demo id (derived from filename). */
const RAW_SOURCES: Record<string, string> = {};
for (const [path, raw] of Object.entries(rawModules)) {
  // Path is like "/@demos/mvp-1.md" or "../demos/mvp-1.md" depending on context.
  // Extract the filename stem as the demo id.
  const filename = path.split("/").pop()!;
  const id = filename.replace(/\.md$/, "");
  RAW_SOURCES[id] = raw;
}

function parseSafe(id: string, raw: string): ParsedDemo {
  try {
    return parseDemoMarkdown(raw);
  } catch (err) {
    console.error(`Failed to parse demo "${id}":`, err);
    return {
      meta: { title: `Error loading "${id}"`, id, description: "" },
      steps: [
        {
          id: "error",
          label: "Error",
          title: `Failed to load demo "${id}"`,
          description: `The demo markdown could not be parsed. Check the console for details.\n\n${String(err)}`,
          commands: [],
        },
      ],
    };
  }
}

/**
 * Compare two demos by their order field (lower first).
 * Demos without an order sort after ordered demos, then alphabetically by id.
 */
function compareByOrder(a: LoadedDemo, b: LoadedDemo): number {
  const aOrder = a.meta.order;
  const bOrder = b.meta.order;
  if (aOrder != null && bOrder != null) return aOrder - bOrder;
  if (aOrder != null) return -1;
  if (bOrder != null) return 1;
  return a.meta.id.localeCompare(b.meta.id);
}

/** All available demos, parsed and ready to use (sorted by order, then id). */
export const DEMOS: LoadedDemo[] = Object.entries(RAW_SOURCES)
  .map(([id, raw]) => {
    const parsed = parseSafe(id, raw);
    return { meta: parsed.meta, steps: parsed.steps };
  })
  .sort(compareByOrder);

/** List of demo titles and ids for selection UI. */
export const DEMO_LIST: Array<{ id: string; title: string }> = DEMOS.map(
  (d) => ({ id: d.meta.id, title: d.meta.title }),
);

/**
 * Default demo steps — the first demo in the registry.
 * Backward-compatible export consumed by wizard and tests.
 */
export const DEMO_STEPS: DemoStep[] = DEMOS.length > 0 ? DEMOS[0].steps : [];

/**
 * Look up a demo by its id.
 */
export function getDemoById(id: string): LoadedDemo | undefined {
  return DEMOS.find((d) => d.meta.id === id);
}
