#!/usr/bin/env npx tsx
/**
 * CLI Demo Runner
 *
 * Reads a demo markdown file from demos/ and presents an interactive
 * terminal walkthrough with ANSI formatting, live command execution,
 * and pause prompts between sections.
 *
 * Usage:
 *   npx tsx scripts/demo/run.ts                  # Interactive picker
 *   npx tsx scripts/demo/run.ts --demo mvp-1     # Run specific demo
 *   npx tsx scripts/demo/run.ts --list            # List available demos
 *
 * @module scripts/demo/run
 */

import { readFileSync, readdirSync, existsSync } from "node:fs";
import { resolve, dirname, basename } from "node:path";
import { fileURLToPath } from "node:url";
import { execSync } from "node:child_process";
import { createInterface } from "node:readline";
import { parseDemoMarkdown } from "../../src/demo/parser.js";
import type { ParsedDemoStep, DemoMeta } from "../../src/demo/parser.js";

// ── Paths ──────────────────────────────────────────────────────────

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const PROJECT_ROOT = resolve(__dirname, "../..");
const DEMOS_DIR = resolve(PROJECT_ROOT, "demos");

// ── ANSI formatting helpers ────────────────────────────────────────

const BOLD = "\x1b[1m";
const DIM = "\x1b[2m";
const CYAN = "\x1b[36m";
const GREEN = "\x1b[32m";
const YELLOW = "\x1b[33m";
const MAGENTA = "\x1b[35m";
const RED = "\x1b[31m";
const RESET = "\x1b[0m";

function bold(text: string): string {
  return `${BOLD}${text}${RESET}`;
}
function dim(text: string): string {
  return `${DIM}${text}${RESET}`;
}
function cyan(text: string): string {
  return `${CYAN}${text}${RESET}`;
}
function green(text: string): string {
  return `${GREEN}${text}${RESET}`;
}
function yellow(text: string): string {
  return `${YELLOW}${text}${RESET}`;
}
function magenta(text: string): string {
  return `${MAGENTA}${text}${RESET}`;
}

// ── Display helpers ────────────────────────────────────────────────

function divider(): void {
  console.log();
  console.log(`  ${dim("─".repeat(60))}`);
  console.log();
}

function banner(title: string, subtitle?: string): void {
  console.clear();
  console.log();
  console.log(`${BOLD}${CYAN}`);
  console.log("  ╔════════════════════════════════════════════╗");
  console.log(`  ║         ${title.padEnd(36)}║`);
  console.log("  ╚════════════════════════════════════════════╝");
  console.log(RESET);
  if (subtitle) {
    console.log(`  ${dim(subtitle)}`);
  }
  console.log(`  ${dim("Turn your speakers on.")}`);
  console.log();
}

function printProblem(text: string): void {
  divider();
  console.log(`  ${BOLD}${YELLOW}PROBLEM${RESET}`);
  console.log();
  for (const line of text.split("\n")) {
    console.log(`  ${line}`);
  }
  console.log();
}

function printSolution(text: string): void {
  console.log(`  ${BOLD}${GREEN}SOLUTION${RESET}`);
  console.log();
  for (const line of text.split("\n")) {
    console.log(`  ${line}`);
  }
  console.log();
}

function printCommentary(text: string): void {
  console.log();
  for (const line of text.split("\n")) {
    console.log(`  ${dim(line)}`);
  }
}

function printDescription(text: string): void {
  for (const line of text.split("\n")) {
    console.log(`  ${line}`);
  }
}

function printSectionHeader(label: string, title: string): void {
  divider();
  console.log(
    `  ${BOLD}${MAGENTA}[${label}]${RESET}  ${BOLD}${title}${RESET}`
  );
}

// ── Interactive helpers ────────────────────────────────────────────

function pause(): Promise<void> {
  return new Promise((resolve) => {
    console.log();
    console.log(`  ${dim("Press Enter to continue...")}`);
    const rl = createInterface({ input: process.stdin, output: process.stdout });
    rl.once("line", () => {
      rl.close();
      resolve();
    });
  });
}

function prompt(question: string): Promise<string> {
  return new Promise((resolve) => {
    const rl = createInterface({ input: process.stdin, output: process.stdout });
    rl.question(question, (answer) => {
      rl.close();
      resolve(answer.trim());
    });
  });
}

function runCommand(cmd: string): void {
  console.log(`  ${DIM}\$${RESET} ${BOLD}${cmd}${RESET}`);
  console.log();
  try {
    execSync(cmd, {
      cwd: PROJECT_ROOT,
      stdio: "inherit",
    });
  } catch {
    console.log(`  ${RED}Command failed${RESET}`);
  }
}

// ── Demo discovery ─────────────────────────────────────────────────

interface DemoInfo {
  filename: string;
  id: string;
  title: string;
  description: string;
  order?: number;
}

function discoverDemos(): DemoInfo[] {
  if (!existsSync(DEMOS_DIR)) return [];

  const files = readdirSync(DEMOS_DIR).filter(
    (f) => f.endsWith(".md") && f !== "README.md"
  );

  return files
    .map((filename) => {
      const raw = readFileSync(resolve(DEMOS_DIR, filename), "utf-8");
      const { meta } = parseDemoMarkdown(raw);
      return {
        filename,
        id: meta.id || basename(filename, ".md"),
        title: meta.title || basename(filename, ".md"),
        description: meta.description || "",
        order: meta.order,
      };
    })
    .sort((a, b) => {
      if (a.order != null && b.order != null) return a.order - b.order;
      if (a.order != null) return -1;
      if (b.order != null) return 1;
      return a.id.localeCompare(b.id);
    });
}

// ── Preflight checks ──────────────────────────────────────────────

function preflight(): void {
  if (!existsSync(resolve(PROJECT_ROOT, "node_modules/.package-lock.json"))) {
    console.log("  Installing dependencies...");
    execSync("npm install --silent", { cwd: PROJECT_ROOT, stdio: "inherit" });
  }

  if (!existsSync(resolve(PROJECT_ROOT, "dist/cli.js"))) {
    console.log("  Building ToneForge...");
    execSync("npm run build --silent", { cwd: PROJECT_ROOT, stdio: "inherit" });
  }

  // Ensure the `toneforge` command is available via npm link
  try {
    execSync("command -v toneforge", { stdio: "ignore" });
  } catch {
    console.log("  Linking toneforge command...");
    execSync("npm link", { cwd: PROJECT_ROOT, stdio: "inherit" });
  }
}

// ── Step rendering ─────────────────────────────────────────────────

async function renderStep(
  step: ParsedDemoStep,
  meta: DemoMeta,
  isFirst: boolean
): Promise<void> {
  // Intro step gets the banner
  if (step.id === "intro" && isFirst) {
    banner(meta.title, meta.description);
  } else if (step.id === "recap") {
    divider();
    console.log(`  ${BOLD}${CYAN}RECAP${RESET}`);
    console.log();
  } else {
    printSectionHeader(step.label, step.title);
  }

  // Problem block
  if (step.problem) {
    if (step.id !== "intro" && step.id !== "recap") {
      printProblem(step.problem);
    }
  }

  // Solution block
  if (step.solution) {
    printSolution(step.solution);
  }

  // Description (intro/recap content)
  if (step.description) {
    printDescription(step.description);
  }

  // Execute commands
  for (const cmd of step.commands) {
    console.log();
    runCommand(cmd);
  }

  // Commentary
  if (step.commentary) {
    printCommentary(step.commentary);
  }

  await pause();
}

// ── Main ───────────────────────────────────────────────────────────

async function main(): Promise<void> {
  const args = process.argv.slice(2);

  // --list flag
  if (args.includes("--list")) {
    const demos = discoverDemos();
    if (demos.length === 0) {
      console.log("  No demos found in demos/");
      process.exit(0);
    }
    console.log();
    console.log(`  ${bold("Available demos:")}`);
    console.log();
    for (const demo of demos) {
      console.log(`    ${green(demo.id.padEnd(20))} ${demo.title}`);
      if (demo.description) {
        console.log(`    ${"".padEnd(20)} ${dim(demo.description)}`);
      }
    }
    console.log();
    process.exit(0);
  }

  // --demo flag
  const demoFlagIndex = args.indexOf("--demo");
  let selectedId: string | undefined;

  if (demoFlagIndex !== -1) {
    selectedId = args[demoFlagIndex + 1];
    if (!selectedId) {
      console.error(`  ${RED}Error: --demo requires a demo name${RESET}`);
      process.exit(1);
    }
  }

  const demos = discoverDemos();

  if (demos.length === 0) {
    console.error(`  ${RED}Error: No demos found in demos/${RESET}`);
    process.exit(1);
  }

  // Resolve selected demo
  let selected: DemoInfo | undefined;

  if (selectedId) {
    selected = demos.find((d) => d.id === selectedId);
    if (!selected) {
      console.error(
        `  ${RED}Error: Demo '${selectedId}' not found.${RESET}`
      );
      console.error(`  Available demos: ${demos.map((d) => d.id).join(", ")}`);
      process.exit(1);
    }
  } else if (demos.length === 1) {
    selected = demos[0];
  } else {
    // Interactive picker
    console.log();
    console.log(`  ${bold("Select a demo:")}`);
    console.log();
    demos.forEach((demo, i) => {
      console.log(`    ${green(`${i + 1}.`)} ${demo.title} ${dim(`(${demo.id})`)}`);
    });
    console.log();
    const answer = await prompt(`  Enter number (1-${demos.length}): `);
    const index = parseInt(answer, 10) - 1;
    if (isNaN(index) || index < 0 || index >= demos.length) {
      console.error(`  ${RED}Invalid selection${RESET}`);
      process.exit(1);
    }
    selected = demos[index];
  }

  // Preflight
  preflight();

  // Parse and run
  const raw = readFileSync(resolve(DEMOS_DIR, selected.filename), "utf-8");
  const { meta, steps } = parseDemoMarkdown(raw);

  for (let i = 0; i < steps.length; i++) {
    await renderStep(steps[i], meta, i === 0);
  }

  // Finale
  divider();
  console.log(`  ${dim(`${meta.title} complete.`)}`);
  console.log();
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
