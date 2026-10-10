/**
 * Sequence `loopInterval` Tests
 *
 * The optional loop cadence used by the runtime transport: validation, parse,
 * and JSON preset loading.
 *
 * Work item: TF-0MUYGI3H10076YJM
 */

import { describe, it, expect, afterEach } from "vitest";
import { writeFileSync, unlinkSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import {
  parseSequencePreset,
  validateSequencePreset,
} from "./schema.js";
import { loadSequencePreset } from "./preset-loader.js";

function preset(extra: Record<string, unknown> = {}): Record<string, unknown> {
  return {
    version: "1.0",
    name: "footsteps_walk",
    events: [{ time: 0, event: "footstep", seedOffset: 0, gain: 0.7 }],
    ...extra,
  };
}

const tempFiles: string[] = [];

afterEach(() => {
  for (const f of tempFiles) {
    try { unlinkSync(f); } catch { /* ignore */ }
  }
  tempFiles.length = 0;
});

describe("validateSequencePreset — loopInterval", () => {
  it("accepts a positive loopInterval", () => {
    expect(validateSequencePreset(preset({ loopInterval: 0.6 }), "test")).toEqual([]);
  });

  it("accepts a preset without loopInterval", () => {
    expect(validateSequencePreset(preset(), "test")).toEqual([]);
  });

  it("rejects zero, negative, and non-numeric loopInterval", () => {
    for (const bad of [0, -0.5, "0.6"]) {
      const errors = validateSequencePreset(preset({ loopInterval: bad }), "test");
      expect(errors.map((e) => e.field)).toContain("loopInterval");
    }
  });
});

describe("parseSequencePreset — loopInterval", () => {
  it("preserves a valid loopInterval", () => {
    const definition = parseSequencePreset(preset({ loopInterval: 0.35 }), "test");
    expect(definition.loopInterval).toBe(0.35);
  });

  it("leaves loopInterval undefined when omitted", () => {
    const definition = parseSequencePreset(preset(), "test");
    expect(definition.loopInterval).toBeUndefined();
  });

  it("rejects an invalid loopInterval", () => {
    expect(() => parseSequencePreset(preset({ loopInterval: -1 }), "test")).toThrow(
      /loopInterval/,
    );
  });
});

describe("loadSequencePreset — loopInterval", () => {
  it("loads a file with loopInterval through the JSON loader", async () => {
    const path = join(tmpdir(), `tf-loop-${Date.now()}-${Math.random()}.json`);
    writeFileSync(path, JSON.stringify(preset({ loopInterval: 0.25 })));
    tempFiles.push(path);

    const definition = await loadSequencePreset(path);
    expect(definition.loopInterval).toBe(0.25);
    expect(definition.events).toHaveLength(1);
  });
});
