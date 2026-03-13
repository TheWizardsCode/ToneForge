/**
 * Normalize a category string for comparison: lowercase and
 * replace whitespace sequences with hyphens.
 */
export function normalizeCategory(category: string): string {
  return category.toLowerCase().replace(/\s+/g, "-");
}

export default normalizeCategory;
