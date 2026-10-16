/**
 * Wave-end Leitmotif Test Battery
 *
 * Covers the design guarantees of the wave-completion leitmotif family
 * (TF-0MV9OLWO6005ZI8E) that the generic, auto-discovering recipe-book and
 * capstone harnesses cannot express:
 *  1. `motif-waves-end` is a 1.2–1.6 s casual cue carrying the required tags.
 *  2. Its phrase resolves to relief (a C-major figure) before the worry tail.
 *  3. The tail lands a raised 4th / tritone above the tonal centre (AC 1).
 *  4. `sequence-wave-end` plays the motif as a single compact event (AC 2).
 *  5. `sequence-level-end` layers a second voice at the resolution point (AC 3).
 *
 * Generic schema / determinism / non-silence / index coverage lives in
 * `recipe-book.test.ts`, `recipe-book-capstones.test.ts` and
 * `src/sequence/golden-fixtures.test.ts`.
 */

import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import yaml from "js-yaml";

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = resolve(__dirname, "..", "..");
const RECIPES_DIR = resolve(ROOT, "presets", "recipes");
const SEQUENCES_DIR = resolve(ROOT, "presets", "sequences");

interface AutomationEvent {
  time: number;
  value: number;
}

interface RecipeDoc {
  meta: { duration: number; tags: string[] };
  nodes: Record<string, { automation?: { frequency?: AutomationEvent[] } }>;
}

interface SequenceDoc {
  events: Array<{ time: number; event: string; gain?: number }>;
}

function loadRecipe(name: string): RecipeDoc {
  return yaml.load(
    readFileSync(resolve(RECIPES_DIR, `${name}.yaml`), "utf-8"),
  ) as RecipeDoc;
}

function loadSequence(name: string): SequenceDoc {
  return JSON.parse(
    readFileSync(resolve(SEQUENCES_DIR, `${name}.json`), "utf-8"),
  ) as SequenceDoc;
}

/** Ordered pitch steps of the recipe's frequency automation. */
function pitchSteps(doc: RecipeDoc): number[] {
  const events: AutomationEvent[] = [];
  for (const node of Object.values(doc.nodes)) {
    for (const event of node.automation?.frequency ?? []) {
      if (typeof event.value === "number") events.push(event);
    }
  }
  return events.sort((a, b) => a.time - b.time).map((e) => e.value);
}

describe("motif-waves-end", () => {
  const doc = loadRecipe("motif-waves-end");
  const steps = pitchSteps(doc);

  it("is a 1.2–1.6 s casual/arcade cue with the required tags", () => {
    expect(doc.meta.duration).toBeGreaterThanOrEqual(1.2);
    expect(doc.meta.duration).toBeLessThanOrEqual(1.6);
    expect(doc.meta.tags).toEqual(
      expect.arrayContaining([
        "casual",
        "joy",
        "fun",
        "leitmotif",
        "wave-complete",
        "level-complete",
      ]),
    );
  });

  it("opens with a resolved C-major relief figure (G4–C5–E5)", () => {
    expect(steps.slice(0, 3)).toEqual([392, 523, 659]);
  });

  it("tails into a raised 4th (tritone) above the C-major tonic", () => {
    const tail = steps[steps.length - 1]!;
    const tonic = steps[1]!; // C5
    const tritone = Math.pow(2, 6 / 12); // 1.4142
    expect(tail / tonic).toBeCloseTo(tritone, 2);
  });
});

describe("wave-end sequences", () => {
  it("sequence-wave-end plays the motif once as a single compact event", () => {
    const sequence = loadSequence("sequence-wave-end");
    expect(sequence.events).toHaveLength(1);
    expect(sequence.events[0]!.event).toBe("motif-waves-end");
    expect(sequence.events[0]!.time).toBe(0);
  });

  it("sequence-level-end layers a second voice at the resolution point", () => {
    const sequence = loadSequence("sequence-level-end");
    expect(sequence.events).toHaveLength(2);
    expect(sequence.events[0]!.event).toBe("motif-waves-end");

    const layer = sequence.events[1]!;
    expect(layer.event).not.toBe("motif-waves-end");
    // The relief phrase resolves on its third step (E5) at 0.44 s.
    expect(layer.time).toBeCloseTo(0.44, 2);
    expect(layer.gain ?? 1).toBeLessThan(1);
  });
});
