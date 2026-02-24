/**
 * Markdown demo parser.
 *
 * Reads a demo markdown file (with YAML front matter and structured content)
 * and produces a typed array of demo steps. Platform-independent — no Node.js
 * or browser-specific APIs are used beyond standard ECMAScript.
 *
 * @module demo/parser
 */

import matter from "gray-matter";
import remarkGfm from "remark-gfm";
import remarkParse from "remark-parse";
import { unified } from "unified";
import type { Root, Content, Heading, Blockquote, Code, Paragraph, List, Table, TableRow } from "mdast";

// ── Public types ───────────────────────────────────────────────────

/** Front matter metadata extracted from the demo markdown. */
export interface DemoMeta {
  title: string;
  id: string;
  description: string;
  /** Explicit sort order (lower values appear first). Undefined means unordered. */
  order?: number;
}

/** A single step in a parsed demo walkthrough. */
export interface ParsedDemoStep {
  /** Kebab-cased identifier derived from the heading (e.g. "act-1"). */
  id: string;
  /** Short label for navigation (e.g. "1/4", "Intro", "Recap"). */
  label: string;
  /** Full heading text (e.g. "Unblock your build on day one"). */
  title: string;
  /** Problem statement extracted from blockquotes (undefined if none). */
  problem?: string;
  /** Solution narrative extracted from paragraphs after the problem. */
  solution?: string;
  /** General description text (used for intro/recap style steps). */
  description: string;
  /** CLI commands extracted from fenced bash code blocks. */
  commands: string[];
  /** Commentary extracted from `> [!commentary]` admonitions. */
  commentary?: string;
}

/** Result of parsing a demo markdown file. */
export interface ParsedDemo {
  meta: DemoMeta;
  steps: ParsedDemoStep[];
}

// ── Helpers ────────────────────────────────────────────────────────

const ACT_PATTERN = /^Act\s+(\d+)/i;
const COMMENTARY_PATTERN = /^\[!commentary\]\s*/i;

/**
 * Convert a heading string into a step id.
 * "Act 1 — Unblock your build" → "act-1"
 * "Intro" → "intro"
 * "Recap" → "recap"
 */
function headingToId(text: string): string {
  const actMatch = ACT_PATTERN.exec(text);
  if (actMatch) return `act-${actMatch[1]}`;
  return text.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
}

/**
 * Derive a short label from a heading.
 * "Act 1 — ..." → "1/4" (with totalActs)
 * "Intro" → "Intro"
 * "Recap" → "Recap"
 */
function headingToLabel(text: string, totalActs: number): string {
  const actMatch = ACT_PATTERN.exec(text);
  if (actMatch) return `${actMatch[1]}/${totalActs}`;
  return text.split(/\s*[—–-]\s*/)[0].trim();
}

/**
 * Extract the title portion from a heading (text after the act prefix).
 * "Act 1 — Unblock your build on day one" → "Unblock your build on day one"
 * "Intro" → "ToneForge MVP Demo"  (uses meta title as fallback for intro)
 * "Recap" → "What you just saw"   (kept as-is when no act prefix)
 */
function headingToTitle(text: string, metaTitle: string): string {
  const parts = text.split(/\s*[—–-]\s*/);
  if (parts.length > 1) return parts.slice(1).join(" — ").trim();
  if (text.toLowerCase() === "intro") return metaTitle;
  return text;
}

/**
 * Recursively extract plain text from an mdast node.
 */
function nodeToText(node: Content | Root): string {
  if ("value" in node && typeof node.value === "string") {
    return node.value;
  }
  if ("children" in node) {
    return (node.children as Content[]).map(nodeToText).join("");
  }
  return "";
}

/**
 * Extract text from a blockquote node, joining child paragraphs.
 */
function blockquoteToText(bq: Blockquote): string {
  return bq.children
    .map((child) => nodeToText(child))
    .join("\n")
    .trim();
}

/**
 * Check if a blockquote is a `[!commentary]` admonition.
 * Returns the commentary text (without the `[!commentary]` marker) or null.
 */
function extractCommentary(bq: Blockquote): string | null {
  const raw = blockquoteToText(bq);
  if (COMMENTARY_PATTERN.test(raw)) {
    return raw.replace(COMMENTARY_PATTERN, "").trim();
  }
  return null;
}

/**
 * Serialize a GFM table AST node back to markdown table syntax.
 * Preserves column alignment and inline text (bold, links, etc.)
 * by recursively extracting text from each cell.
 */
function tableToMarkdown(table: Table): string {
  const rows = table.children as TableRow[];
  if (rows.length === 0) return "";

  // Build a 2D string grid from the AST cells
  const grid: string[][] = rows.map((row) =>
    row.children.map((cell) => nodeToText(cell).trim()),
  );

  // Determine column widths (minimum 3 for the separator dashes)
  const colCount = Math.max(...grid.map((r) => r.length));
  const widths: number[] = Array.from({ length: colCount }, (_, col) =>
    Math.max(3, ...grid.map((row) => (row[col] ?? "").length)),
  );

  // Format a single row with pipe separators and padding
  const formatRow = (cells: string[]): string => {
    const padded = widths.map((w, i) => (cells[i] ?? "").padEnd(w));
    return "| " + padded.join(" | ") + " |";
  };

  // Build separator row using alignment hints from the AST
  const separator = widths.map((w, i) => {
    const align = table.align?.[i];
    if (align === "center") return ":" + "-".repeat(w - 2) + ":";
    if (align === "right") return "-".repeat(w - 1) + ":";
    return "-".repeat(w);
  });
  const sepRow = "| " + separator.join(" | ") + " |";

  // Header row + separator + data rows
  const lines = [formatRow(grid[0]), sepRow, ...grid.slice(1).map(formatRow)];
  return lines.join("\n");
}

/**
 * Serialize list, paragraph, and table nodes into description text.
 * Paragraphs and lists are separated by double newlines so renderers
 * can distinguish paragraph breaks from line breaks within a list.
 * Tables are serialized back to GFM markdown syntax.
 */
function nodesToDescription(nodes: Content[]): string {
  const blocks: string[] = [];
  for (const node of nodes) {
    if (node.type === "paragraph") {
      blocks.push(nodeToText(node));
    } else if (node.type === "list") {
      const list = node as List;
      const items = list.children.map((item, i) => {
        const text = nodeToText(item).trim();
        const prefix = list.ordered ? `${(list.start ?? 1) + i}. ` : "- ";
        return prefix + text;
      });
      blocks.push(items.join("\n"));
    } else if (node.type === "table") {
      blocks.push(tableToMarkdown(node as Table));
    }
  }
  return blocks.join("\n\n").trim();
}

// ── Core parser ────────────────────────────────────────────────────

/**
 * Parse a demo markdown string into structured step data.
 *
 * @param rawMarkdown - The full markdown content including YAML front matter.
 * @returns A {@link ParsedDemo} with metadata and an ordered array of steps.
 */
export function parseDemoMarkdown(rawMarkdown: string): ParsedDemo {
  const trimmed = rawMarkdown.trim();
  if (trimmed.length === 0) {
    return {
      meta: { title: "", id: "", description: "" },
      steps: [],
    };
  }

  // Extract front matter
  const { data, content } = matter(trimmed);
  const rawOrder = data.order;
  const meta: DemoMeta = {
    title: String(data.title ?? ""),
    id: String(data.id ?? ""),
    description: String(data.description ?? "").trim(),
    ...(rawOrder != null && Number.isFinite(Number(rawOrder)) && { order: Number(rawOrder) }),
  };

  // Parse markdown body to AST (remark-gfm enables GFM table support)
  const tree = unified().use(remarkParse).use(remarkGfm).parse(content) as Root;

  // Count total acts for label generation
  const totalActs = tree.children.filter(
    (node) =>
      node.type === "heading" &&
      (node as Heading).depth === 2 &&
      ACT_PATTERN.test(nodeToText(node))
  ).length;

  // Split AST children into sections by H2 headings
  const sections: { heading: string; nodes: Content[] }[] = [];
  for (const node of tree.children) {
    if (node.type === "heading" && (node as Heading).depth === 2) {
      sections.push({ heading: nodeToText(node).trim(), nodes: [] });
    } else if (sections.length > 0) {
      sections[sections.length - 1].nodes.push(node);
    }
    // Content before the first H2 is ignored (front matter already extracted)
  }

  // Convert each section into a ParsedDemoStep
  const steps: ParsedDemoStep[] = sections.map((section) => {
    const id = headingToId(section.heading);
    const label = headingToLabel(section.heading, totalActs);
    const title = headingToTitle(section.heading, meta.title);

    let problem: string | undefined;
    let solution: string | undefined;
    let commentary: string | undefined;
    const commands: string[] = [];
    const descriptionNodes: Content[] = [];

    // Classify child nodes
    let foundProblem = false;
    let foundSolution = false;

    for (const node of section.nodes) {
      // Fenced code blocks → commands
      if (node.type === "code" && (node as Code).lang === "bash") {
        const cmd = (node as Code).value.trim();
        if (cmd) commands.push(cmd);
        continue;
      }

      // Blockquotes → problem or commentary
      if (node.type === "blockquote") {
        const bq = node as Blockquote;
        const commentaryText = extractCommentary(bq);
        if (commentaryText !== null) {
          commentary = commentaryText;
        } else if (!foundProblem) {
          problem = blockquoteToText(bq);
          foundProblem = true;
        } else {
          // Additional blockquotes treated as description
          descriptionNodes.push(node);
        }
        continue;
      }

      // Paragraphs/lists/tables after a problem but before commands/commentary → solution
      if (
        foundProblem &&
        !foundSolution &&
        (node.type === "paragraph" || node.type === "list" || node.type === "table") &&
        commands.length === 0
      ) {
        const text = node.type === "table"
          ? tableToMarkdown(node as Table)
          : nodeToText(node).trim();
        if (text) {
          solution = solution ? solution + "\n" + text : text;
          foundSolution = true;
          continue;
        }
      }

      // Everything else → description
      descriptionNodes.push(node);
    }

    const description = nodesToDescription(descriptionNodes);

    return {
      id,
      label,
      title,
      ...(problem !== undefined && { problem }),
      ...(solution !== undefined && { solution }),
      description,
      commands,
      ...(commentary !== undefined && { commentary }),
    };
  });

  return { meta, steps };
}
