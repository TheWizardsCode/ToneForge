import { COLORS, ansiWidth, stripAnsi, isStdoutTty } from "../output.js";

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

export default { truncateTags };
