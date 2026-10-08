import { COLORS, ansiWidth, stripAnsi, isStdoutTty } from "../output.js";
import type { TableColumn } from "../output.js";
import { createRng } from "../core/rng.js";
import type { ParamDescriptor, RecipeRegistration } from "../core/recipe.js";

/**
 * Return the parameter values actually used to render `seed`.
 *
 * File-backed recipes expose `getRenderParams` because their `getParams`
 * surfaces suggested defaults for interactive UIs, which differ from the
 * seed-derived values the render path applies. Built-in recipes derive both
 * from the same RNG sequence, so `getParams` is a faithful fallback.
 */
export function seedParams(
  registration: RecipeRegistration,
  seed: number,
): Record<string, number> {
  if (registration.getRenderParams) {
    return registration.getRenderParams(seed);
  }
  return registration.getParams(createRng(seed));
}

/**
 * Render a parameter value to a compact, meaningful string.
 *
 * Values use up to four significant figures so small values (for example an
 * attack of 0.0011s) stay meaningful instead of rounding to 0.00.
 */
export function formatParamValue(value: number): string {
  return Number.isInteger(value)
    ? value.toString()
    : Number(value.toPrecision(4)).toString();
}

/** An aligned parameter table for a recipe at a given seed. */
export interface ParamsTable {
  columns: TableColumn[];
  rows: string[][];
}

/**
 * Build aligned `Parameter | Value | Unit` rows for a recipe's parameters.
 *
 * Both the human-readable `generate` output and the newer command module
 * share this builder, so the columns line up regardless of entry point. Each
 * column is sized to its widest cell to avoid wrapping or ragged edges.
 */
export function buildParamsTable(
  registration: RecipeRegistration,
  seed: number,
): ParamsTable {
  const params = seedParams(registration, seed);
  const rows = registration.params.map((p: ParamDescriptor) => [
    p.name,
    formatParamValue(params[p.name]),
    p.unit,
  ]);

  const nameWidth = Math.max("Parameter".length, ...rows.map((r) => r[0].length));
  const valueWidth = Math.max("Value".length, ...rows.map((r) => r[1].length));
  const unitWidth = Math.max("Unit".length, ...rows.map((r) => r[2].length));

  return {
    columns: [
      { header: "Parameter", width: nameWidth },
      { header: "Value", width: valueWidth },
      { header: "Unit", width: unitWidth },
    ],
    rows,
  };
}

/**
 * Truncate a list of tags to fit within `maxWidth` visible characters.
 * Joins tags with ", " and appends ellipsis if truncated.
 * Returns em-dash if the tag list is empty.
 */
export function truncateTags(
  tags: string[],
  maxWidth: number,
  matchedTags: string[] = [],
  tty: boolean = false,
): string {
  if (tags.length === 0) return "\u2014";

  // Partition into matched (front) and unmatched (back), preserving order
  let ordered: string[];
  if (matchedTags.length > 0) {
    const matchedSet = new Set(matchedTags.map((t) => t.toLowerCase()));
    const matched = tags.filter((t) => matchedSet.has(t.toLowerCase()));
    const unmatched = tags.filter((t) => !matchedSet.has(t.toLowerCase()));
    ordered = [...matched, ...unmatched];
  } else {
    ordered = tags;
  }

  const matchedSet = new Set(matchedTags.map((t) => t.toLowerCase()));
  const styled = ordered.map((tag) => {
    if (tty && matchedSet.has(tag.toLowerCase())) {
      return COLORS.bold + COLORS.yellow + tag + COLORS.reset;
    }
    return tag;
  });

  const joined = styled.join(", ");
  if (ansiWidth(joined) <= maxWidth) return joined;

  // Truncate to maxWidth visible characters, leaving room for ellipsis
  const budget = maxWidth - 1; // 1 for the ellipsis character
  let visible = 0;
  let result = "";
  let i = 0;

  while (i < joined.length && visible < budget) {
    if (joined[i] === "\x1b") {
      const seqEnd = joined.indexOf("m", i);
      if (seqEnd !== -1) {
        result += joined.slice(i, seqEnd + 1);
        i = seqEnd + 1;
        continue;
      }
    }
    result += joined[i];
    visible++;
    i++;
  }

  // Try to break at last comma-space to avoid cutting mid-tag
  const plainResult = stripAnsi(result);
  const lastSep = plainResult.lastIndexOf(", ");
  if (lastSep > 0) {
    let vis = 0;
    let cutIdx = 0;
    for (let j = 0; j < result.length; j++) {
      if (result[j] === "\x1b") {
        const seqEnd = result.indexOf("m", j);
        if (seqEnd !== -1) {
          j = seqEnd;
          continue;
        }
      }
      if (vis === lastSep) {
        cutIdx = j;
        break;
      }
      vis++;
    }
    result = result.slice(0, cutIdx);
  }

  if (tty && result.includes(COLORS.bold)) {
    const lastBold = result.lastIndexOf(COLORS.bold);
    const lastReset = result.lastIndexOf(COLORS.reset);
    if (lastBold > lastReset) {
      result += COLORS.reset;
    }
  }

  return result + "\u2026";
}

export default { truncateTags, seedParams, formatParamValue, buildParamsTable };
