/**
 * Sound Module Index drift guard.
 *
 * Keeps `docs/modules/index.md` in lock-step with the code's authoritative
 * `ALLOWED_NODE_KINDS` (SA: docs node-kind catalogue). The catalogue is a
 * hand-written page, so this battery is the only thing preventing it from
 * silently drifting when a node kind is added to the schema:
 *
 *  1. Parity — the index lists exactly the allowed kinds (no omissions, no
 *     invented kinds).
 *  2. Placement — each kind appears once, under a primary-function group.
 *  3. Quality — every entry has a 2–3 sentence use-case description, an
 *     availability status and a link to the authoritative reference.
 *
 * The parser reads the *rendered* Markdown (headings plus prose), so it
 * asserts observable documentation structure rather than grepping source
 * strings.
 */

import { describe, it, expect } from "vitest";
import { readFileSync, existsSync } from "node:fs";
import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";

import { ALLOWED_NODE_KINDS } from "./tonegraph-schema.js";

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = resolve(__dirname, "..", "..");
const INDEX_PATH = resolve(ROOT, "docs", "modules", "index.md");

interface IndexEntry {
  /** Node kind, taken from the `### \`<kind>\`` entry heading. */
  kind: string;
  /** Nearest preceding `## ` heading — the primary-function group. */
  group: string;
  /** Prose paragraph(s) before the first bold label. */
  description: string;
  /** Value of the `**Availability:**` line, if present. */
  availability?: string;
  /** Value of the `**Reference:**` line, if present. */
  reference?: string;
}

const ENTRY_RE = /^###\s+`([A-Za-z][A-Za-z0-9]*)`\s*$/;
const GROUP_RE = /^##\s+(.+?)\s*$/;
const HEADING_RE = /^#{1,6}\s/;
const BOLD_LABEL_RE = /^\*\*[^*]+\*\*\s*:?/;

/** Extract a `**Label:** value` line from an entry body. */
function matchLabel(body: string, label: string): string | undefined {
  const match = body.match(new RegExp(`\\*\\*${label}:\\*\\*\\s*([^\\n]+)`));
  return match ? match[1]!.trim() : undefined;
}

/** Parse the catalogue into entries, tracking the current group heading. */
function parseIndex(content: string): IndexEntry[] {
  const lines = content.split(/\r?\n/);
  const entries: IndexEntry[] = [];
  let currentGroup = "";

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i]!;

    const groupMatch = line.match(GROUP_RE);
    if (groupMatch) {
      currentGroup = groupMatch[1]!.trim();
      continue;
    }

    const entryMatch = line.match(ENTRY_RE);
    if (!entryMatch) {
      continue;
    }

    const bodyLines: string[] = [];
    for (let j = i + 1; j < lines.length && !HEADING_RE.test(lines[j]!); j++) {
      bodyLines.push(lines[j]!);
    }

    const descriptionLines: string[] = [];
    for (const bodyLine of bodyLines) {
      if (BOLD_LABEL_RE.test(bodyLine.trim())) {
        break;
      }
      descriptionLines.push(bodyLine);
    }

    const body = bodyLines.join("\n");
    entries.push({
      kind: entryMatch[1]!,
      group: currentGroup,
      description: descriptionLines.join(" ").replace(/\s+/g, " ").trim(),
      availability: matchLabel(body, "Availability"),
      reference: matchLabel(body, "Reference"),
    });
  }

  return entries;
}

function loadEntries(): IndexEntry[] {
  return parseIndex(readFileSync(INDEX_PATH, "utf-8"));
}

describe("docs/modules/index.md", () => {
  it("exists", () => {
    expect(existsSync(INDEX_PATH), `${INDEX_PATH} does not exist`).toBe(true);
  });

  it("lists exactly the kinds accepted by ALLOWED_NODE_KINDS", () => {
    const entries = loadEntries();
    const indexKinds = entries.map((entry) => entry.kind);
    expect([...indexKinds].sort()).toEqual([...ALLOWED_NODE_KINDS].sort());
  });

  it("places each kind exactly once under a primary-function group", () => {
    const entries = loadEntries();

    const duplicates = entries
      .map((entry) => entry.kind)
      .filter((kind, index, all) => all.indexOf(kind) !== index);
    expect(duplicates, "Duplicate kinds: " + duplicates.join(", ")).toEqual([]);

    const ungrouped = entries
      .filter((entry) => !entry.group)
      .map((entry) => entry.kind);
    expect(ungrouped, "Ungrouped kinds: " + ungrouped.join(", ")).toEqual([]);

    const groups = new Set(entries.map((entry) => entry.group));
    expect(groups.size, "Expected several primary-function groups").toBeGreaterThanOrEqual(3);
  });

  it("gives every kind a 2–3 sentence use-case description", () => {
    const entries = loadEntries();
    const problems: string[] = [];

    for (const entry of entries) {
      const sentenceCount = entry.description.match(/[^.!?]+[.!?]+(?=\s|$)/g)?.length ?? 0;
      if (!entry.description) {
        problems.push(`${entry.kind}: empty description`);
      } else if (sentenceCount < 2 || sentenceCount > 3) {
        problems.push(`${entry.kind}: expected 2–3 sentences, found ${sentenceCount}`);
      }
    }

    expect(problems, problems.join("; ")).toEqual([]);
  });

  it("states availability and links the authoritative reference for every kind", () => {
    const entries = loadEntries();
    const problems: string[] = [];

    for (const entry of entries) {
      if (!/v0\.1/.test(entry.availability ?? "")) {
        problems.push(`${entry.kind}: missing availability status`);
      }
      if (!/\]\([^)]*tonegraph\.md[^)]*\)/.test(entry.reference ?? "")) {
        problems.push(`${entry.kind}: missing tonegraph.md reference link`);
      }
    }

    expect(problems, problems.join("; ")).toEqual([]);
  });
});
