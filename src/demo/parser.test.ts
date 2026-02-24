import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { parseDemoMarkdown } from "./parser.js";
import type { ParsedDemo, ParsedDemoStep } from "./parser.js";

const __dirname = dirname(fileURLToPath(import.meta.url));
const DEMOS_DIR = resolve(__dirname, "../../demos");

function readDemo(name: string): string {
  return readFileSync(resolve(DEMOS_DIR, name), "utf-8");
}

// ── Golden snapshot: mvp-1.md ──────────────────────────────────────

describe("parseDemoMarkdown — golden snapshot (mvp-1.md)", () => {
  let result: ParsedDemo;

  // Parse once for all golden tests
  it("parses without error", () => {
    const raw = readDemo("mvp-1.md");
    result = parseDemoMarkdown(raw);
    expect(result).toBeDefined();
  });

  it("extracts front matter metadata", () => {
    expect(result.meta.title).toBe("ToneForge MVP Demo");
    expect(result.meta.id).toBe("mvp-1");
    expect(result.meta.description).toMatch(/interactive walkthrough/);
    expect(result.meta.order).toBe(10);
  });

  it("produces 6 steps (intro, 4 acts, recap)", () => {
    expect(result.steps).toHaveLength(6);
  });

  it("parses intro step correctly", () => {
    const intro = result.steps[0];
    expect(intro.id).toBe("intro");
    expect(intro.label).toBe("Intro");
    expect(intro.title).toBe("ToneForge MVP Demo");
    expect(intro.commands).toHaveLength(0);
    expect(intro.problem).toBeUndefined();
    expect(intro.solution).toBeUndefined();
    expect(intro.commentary).toBeUndefined();
    expect(intro.description).toMatch(/Every game, app/);
    expect(intro.description).toMatch(/placeholder audio at the speed of development/);
  });

  it("parses Act 1 with problem, solution, command, and commentary", () => {
    const act1 = result.steps[1];
    expect(act1.id).toBe("act-1");
    expect(act1.label).toBe("1/4");
    expect(act1.title).toBe("Unblock your build on day one");
    expect(act1.problem).toMatch(/sci-fi game UI/);
    expect(act1.solution).toMatch(/placeholder sounds from recipes/);
    expect(act1.commands).toHaveLength(1);
    expect(act1.commands[0]).toContain("--recipe ui-scifi-confirm --seed 42");
    expect(act1.commentary).toMatch(/synthesized entirely from code/);
  });

  it("parses Act 2 with multiple commands", () => {
    const act2 = result.steps[2];
    expect(act2.id).toBe("act-2");
    expect(act2.label).toBe("2/4");
    expect(act2.commands).toHaveLength(3);
    expect(act2.commands[0]).toContain("--seed 100");
    expect(act2.commands[1]).toContain("--seed 9999");
    expect(act2.commands[2]).toContain("--seed 7");
    expect(act2.commentary).toMatch(/Three distinct placeholders/);
  });

  it("parses Act 3 correctly", () => {
    const act3 = result.steps[3];
    expect(act3.id).toBe("act-3");
    expect(act3.label).toBe("3/4");
    expect(act3.problem).toMatch(/reproduce it exactly/);
    expect(act3.solution).toMatch(/deterministic/i);
    expect(act3.commands).toHaveLength(1);
    expect(act3.commands[0]).toContain("--seed 42");
    expect(act3.commentary).toMatch(/exact same sound/);
  });

  it("parses Act 4 correctly", () => {
    const act4 = result.steps[4];
    expect(act4.id).toBe("act-4");
    expect(act4.label).toBe("4/4");
    expect(act4.problem).toMatch(/integration tests/);
    expect(act4.commands).toHaveLength(1);
    expect(act4.commands[0]).toContain("vitest run");
    expect(act4.commentary).toMatch(/11 tests pass/);
  });

  it("parses recap step correctly", () => {
    const recap = result.steps[5];
    expect(recap.id).toBe("recap-what-you-just-saw");
    expect(recap.label).toBe("Recap");
    expect(recap.title).toBe("What you just saw");
    expect(recap.commands).toHaveLength(0);
    expect(recap.problem).toBeUndefined();
    expect(recap.commentary).toBeUndefined();
    expect(recap.description).toMatch(/Placeholder audio generated instantly/);
  });

  it("contains no ANSI escape sequences in any step", () => {
    const ansiPattern = /\x1B\[[0-9;]*m/;
    for (const step of result.steps) {
      expect(step.description).not.toMatch(ansiPattern);
      if (step.problem) expect(step.problem).not.toMatch(ansiPattern);
      if (step.solution) expect(step.solution).not.toMatch(ansiPattern);
      if (step.commentary) expect(step.commentary).not.toMatch(ansiPattern);
    }
  });

  it("step fields match DEMO_STEPS structure from demo-content.ts", () => {
    // Verify structural compatibility with the web DemoStep interface
    for (const step of result.steps) {
      expect(typeof step.id).toBe("string");
      expect(typeof step.label).toBe("string");
      expect(typeof step.title).toBe("string");
      expect(typeof step.description).toBe("string");
      expect(Array.isArray(step.commands)).toBe(true);
      // problem, solution, commentary are optional strings
      if (step.problem !== undefined) expect(typeof step.problem).toBe("string");
      if (step.solution !== undefined) expect(typeof step.solution).toBe("string");
      if (step.commentary !== undefined) expect(typeof step.commentary).toBe("string");
    }
  });
});

// ── Edge cases ─────────────────────────────────────────────────────

describe("parseDemoMarkdown — edge cases", () => {
  it("returns empty steps for an empty string", () => {
    const result = parseDemoMarkdown("");
    expect(result.steps).toHaveLength(0);
    expect(result.meta.title).toBe("");
    expect(result.meta.id).toBe("");
  });

  it("returns empty steps for whitespace-only input", () => {
    const result = parseDemoMarkdown("   \n\n  \n  ");
    expect(result.steps).toHaveLength(0);
  });

  it("handles missing front matter", () => {
    const md = `## Step One\n\nSome content here.\n`;
    const result = parseDemoMarkdown(md);
    expect(result.meta.title).toBe("");
    expect(result.meta.id).toBe("");
    expect(result.steps).toHaveLength(1);
    expect(result.steps[0].id).toBe("step-one");
  });

  it("handles steps without commands", () => {
    const md = `---
title: Test
id: test
description: A test demo.
---

## Intro

Just some text here with no commands.

## Recap

More text, still no commands.
`;
    const result = parseDemoMarkdown(md);
    expect(result.steps).toHaveLength(2);
    expect(result.steps[0].commands).toEqual([]);
    expect(result.steps[1].commands).toEqual([]);
  });

  it("handles empty code blocks", () => {
    const md = `---
title: Test
id: test
description: Test.
---

## Step

\`\`\`bash
\`\`\`

Some paragraph.
`;
    const result = parseDemoMarkdown(md);
    expect(result.steps).toHaveLength(1);
    // Empty code block should not add an empty command
    expect(result.steps[0].commands).toEqual([]);
  });

  it("ignores non-bash code blocks", () => {
    const md = `---
title: Test
id: test
description: Test.
---

## Step

\`\`\`json
{"key": "value"}
\`\`\`

\`\`\`bash
echo "hello"
\`\`\`
`;
    const result = parseDemoMarkdown(md);
    expect(result.steps).toHaveLength(1);
    expect(result.steps[0].commands).toEqual(['echo "hello"']);
  });

  it("handles malformed admonition (missing commentary tag)", () => {
    const md = `---
title: Test
id: test
description: Test.
---

## Step

> This is a regular blockquote, not a commentary admonition.

> [!note]
> This is a note admonition, not commentary.
`;
    const result = parseDemoMarkdown(md);
    expect(result.steps).toHaveLength(1);
    // First blockquote treated as problem, second as description
    expect(result.steps[0].problem).toMatch(/regular blockquote/);
    expect(result.steps[0].commentary).toBeUndefined();
  });

  it("extracts commentary from [!commentary] admonition", () => {
    const md = `---
title: Test
id: test
description: Test.
---

## Step

> Problem statement here.

Solution text here.

\`\`\`bash
echo "run"
\`\`\`

> [!commentary]
> This is the commentary text.
`;
    const result = parseDemoMarkdown(md);
    expect(result.steps[0].commentary).toBe("This is the commentary text.");
    expect(result.steps[0].problem).toMatch(/Problem statement/);
    expect(result.steps[0].solution).toMatch(/Solution text/);
  });

  it("handles multiple H2 sections correctly", () => {
    const md = `---
title: Multi
id: multi
description: Multiple steps.
---

## First

Content A.

## Second

Content B.

## Third

Content C.
`;
    const result = parseDemoMarkdown(md);
    expect(result.steps).toHaveLength(3);
    expect(result.steps[0].id).toBe("first");
    expect(result.steps[1].id).toBe("second");
    expect(result.steps[2].id).toBe("third");
  });

  it("handles content before first H2 (ignored)", () => {
    const md = `---
title: Test
id: test
description: Test.
---

Some content before any heading.

## Actual Step

Step content.
`;
    const result = parseDemoMarkdown(md);
    expect(result.steps).toHaveLength(1);
    expect(result.steps[0].id).toBe("actual-step");
  });

  it("parses order field from front matter", () => {
    const md = `---
title: Ordered
id: ordered
description: Has order.
order: 3
---

## Step

Content.
`;
    const result = parseDemoMarkdown(md);
    expect(result.meta.order).toBe(3);
  });

  it("omits order when not present in front matter", () => {
    const md = `---
title: No Order
id: no-order
description: No order field.
---

## Step

Content.
`;
    const result = parseDemoMarkdown(md);
    expect(result.meta.order).toBeUndefined();
  });

  it("omits order when value is not a finite number", () => {
    const md = `---
title: Bad Order
id: bad-order
description: Non-numeric order.
order: banana
---

## Step

Content.
`;
    const result = parseDemoMarkdown(md);
    expect(result.meta.order).toBeUndefined();
  });
});

// ── GFM table support ─────────────────────────────────────────────

describe("parseDemoMarkdown — GFM table support", () => {
  it("preserves a table in description as markdown table syntax", () => {
    const md = `---
title: Table Test
id: table-test
description: Test tables.
---

## Step

Some introductory text.

| Header A | Header B |
|----------|----------|
| cell 1   | cell 2   |
| cell 3   | cell 4   |

\`\`\`bash
echo "after table"
\`\`\`
`;
    const result = parseDemoMarkdown(md);
    expect(result.steps).toHaveLength(1);
    const step = result.steps[0];
    // Table should end up in description since there is no preceding problem blockquote
    expect(step.description).toContain("Header A");
    expect(step.description).toContain("Header B");
    expect(step.description).toContain("cell 1");
    expect(step.description).toContain("cell 4");
    // Should be formatted as pipe-delimited markdown table
    expect(step.description).toContain("|");
    expect(step.description).toContain("---");
  });

  it("classifies a table between problem and commands as solution", () => {
    const md = `---
title: Table Solution
id: table-solution
description: Table as solution.
---

## Act 1 -- Dimension overview

> You want to understand the classification dimensions.

| Dimension | Description |
|-----------|-------------|
| category  | Primary type |
| intensity | Energy level |

\`\`\`bash
echo "classify"
\`\`\`

> [!commentary]
> This explains the dimensions.
`;
    const result = parseDemoMarkdown(md);
    expect(result.steps).toHaveLength(1);
    const step = result.steps[0];
    expect(step.problem).toMatch(/understand the classification/);
    // Table should be classified as solution (between problem and first command)
    expect(step.solution).toBeDefined();
    expect(step.solution).toContain("Dimension");
    expect(step.solution).toContain("category");
    expect(step.solution).toContain("intensity");
    expect(step.solution).toContain("|");
    expect(step.commentary).toMatch(/explains the dimensions/);
  });

  it("renders multi-column table with alignment preserved", () => {
    const md = `---
title: Alignment
id: alignment
description: Test alignment.
---

## Step

| Left | Center | Right |
|:-----|:------:|------:|
| a    | b      | c     |
`;
    const result = parseDemoMarkdown(md);
    const step = result.steps[0];
    // Table ends up in description (no problem blockquote)
    expect(step.description).toContain("Left");
    expect(step.description).toContain("Center");
    expect(step.description).toContain("Right");
  });

  it("handles bold text inside table cells", () => {
    const md = `---
title: Bold Cells
id: bold-cells
description: Bold in tables.
---

## Step

| Name | Value |
|------|-------|
| **bold** | normal |
`;
    const result = parseDemoMarkdown(md);
    const step = result.steps[0];
    expect(step.description).toContain("bold");
    expect(step.description).toContain("normal");
  });

  it("classification demo Act 2 table parses correctly", () => {
    // Simulate the exact structure from demos/classification.md Act 2
    const md = `---
title: Classification Demo
id: classification
description: Test.
---

## Act 2 -- What each dimension means

> You see labels but want to understand how each one is determined.

| Dimension | What it describes | How it is determined |
|-----------|-------------------|----------------------|
| **category** | Primary sound type | Recipe metadata first |
| **intensity** | Energy level | RMS loudness thresholds |

> [!commentary]
> Classification is hierarchical.
`;
    const result = parseDemoMarkdown(md);
    expect(result.steps).toHaveLength(1);
    const step = result.steps[0];
    expect(step.problem).toMatch(/understand how each one/);
    expect(step.solution).toBeDefined();
    expect(step.solution).toContain("Dimension");
    expect(step.solution).toContain("category");
    expect(step.solution).toContain("intensity");
    expect(step.solution).toContain("Primary sound type");
    expect(step.commentary).toMatch(/hierarchical/);
  });
});
