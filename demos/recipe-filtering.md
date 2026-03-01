---
title: "Recipe Filtering: Search, Category, and Tags"
id: recipe-filtering
order: 98
description: >
  Learn to filter ToneForge's 53+ recipe library using --search, --category,
  and --tags flags. Narrow results by keyword, category, or attribute tag,
  combine multiple filters with AND logic, and export filtered results as JSON
  for scripting.
---

## Intro

You are prototyping a game and ToneForge's recipe library has grown to 53
recipes across nine categories -- Ambient, Card Game, Character, Creature,
Footstep, Impact, UI, Vehicle, and Weapon. Scrolling through the full list
to find what you need is slow. You need a way to narrow results without
leaving the terminal or piping through `grep`.

The `list recipes` command now supports three filter flags:

| Flag | Match type | Example |
|---|---|---|
| `--search <text>` | Case-insensitive substring across all fields | `--search laser` |
| `--category <name>` | Exact match after normalization (case, spaces, hyphens) | `--category card-game` |
| `--tags <t1,t2>` | Exact case-insensitive AND logic (all tags must match) | `--tags positive,arcade` |

Filters combine with AND logic: a recipe must satisfy every active filter.
In this walkthrough you will learn to use each filter individually, combine
them for precision, read JSON output for scripting, and handle the case when
nothing matches.

## Act 1 -- See everything at a glance

> You want to see the full recipe library with its new four-column layout
> showing category and tags alongside name and description.

List all recipes without any filters:

```bash
toneforge list recipes
```

The table shows four columns -- Recipe, Description, Category, and Tags --
with a count footer reporting the total.

> [!commentary]
> The unfiltered listing is the same command you have always used, now
> enriched with Category and Tags columns. Every recipe in the registry
> appears, sorted by registration order. The count footer confirms the
> total: 53 recipes. When no filters are active, it reads "Showing 53
> recipes" -- a quick sanity check that nothing is missing.

## Act 2 -- Search by keyword

> You remember hearing about a "laser" sound but cannot recall the exact
> recipe name or which category it belongs to.

Search across all fields -- name, description, category, and tags:

```bash
toneforge list recipes --search laser
```

The search matched one recipe: `weapon-laser-zap`. Try a broader keyword to
find sounds involving pitch sweeps:

```bash
toneforge list recipes --search sweep
```

Now search for coin-related sounds:

```bash
toneforge list recipes --search coin
```

> [!commentary]
> The `--search` flag performs case-insensitive substring matching across
> every field: recipe name, description, category, and tag strings. Searching
> for "laser" found the weapon recipe because "laser" appears in its name and
> tags. Searching for "sweep" found recipes across multiple categories because
> the word appears in their descriptions. This is the broadest filter --
> useful when you have a vague idea of what you want but do not know the
> exact name, category, or tags.

## Act 3 -- Filter by category

> You are building a card game and only want to see card game recipes. You
> do not want to sift through weapon, impact, or UI sounds.

Filter by the Card Game category:

```bash
toneforge list recipes --category card-game
```

Category matching normalizes spaces, hyphens, and case. All three of these
produce the same result:

```bash
toneforge list recipes --category "Card Game"
```

Now check what is available for impact sounds:

```bash
toneforge list recipes --category impact
```

And UI sounds:

```bash
toneforge list recipes --category ui
```

> [!commentary]
> The `--category` flag performs an exact match after normalization:
> lowercase and spaces converted to hyphens. So "Card Game", "card-game",
> and "card game" all resolve to the same normalized value and match the
> same recipes. This is consistent with how `toneforge classify search
> --category` works. The footer shows "Found N of 53 recipes" to confirm
> how many matched versus the total library size.

## Act 4 -- Filter by tags

> You want all the rewarding, positive-feedback sounds in your card game --
> the ones tagged "positive" that should play when a player does something
> right.

Filter by a single tag:

```bash
toneforge list recipes --tags positive
```

Five recipes match. Now narrow further to sounds tagged both "positive"
and "arcade":

```bash
toneforge list recipes --tags positive,arcade
```

Tags use AND logic: every specified tag must be present on the recipe.
Try filtering for economy-related card sounds:

```bash
toneforge list recipes --tags economy
```

> [!commentary]
> The `--tags` flag uses exact, case-insensitive matching with AND logic.
> Specifying `--tags positive` matches recipes where "positive" appears as
> a complete tag -- it would not match a hypothetical tag "positive-strong"
> because the match is exact, not substring. Adding a second tag with
> `--tags positive,arcade` requires both tags to be present, narrowing the
> results. This is consistent with `toneforge library search --tags`.

## Act 5 -- Combine filters for precision

> You are looking for card game sounds related to coins. You want to
> combine category and keyword filtering to find exactly the right recipes.

Combine `--category` and `--search`:

```bash
toneforge list recipes --category card-game --search coin
```

Three coin recipes in the card game category. Now combine all three filters
to find positive arcade card game sounds:

```bash
toneforge list recipes --category card-game --tags positive,arcade
```

Combine search with tags to find bright combo sounds:

```bash
toneforge list recipes --search combo --tags arcade
```

> [!commentary]
> Multiple filters combine with AND logic: a recipe must satisfy every
> active filter to appear in the results. `--category card-game --search
> coin` requires the recipe to be in the Card Game category AND contain
> "coin" as a substring in any field. This is the precision tool: when
> you know the category and have a keyword or tag in mind, combining
> filters cuts straight to the recipes you need.

## Act 6 -- Handle zero results

> You search for something that does not exist to see what happens.

Search for a keyword that matches nothing:

```bash
toneforge list recipes --search xylophone
```

The output shows "Found 0 of 53 recipes matching the filter" with no table.
No error, no noise -- just a clear count telling you nothing matched.

Try an overly specific filter combination:

```bash
toneforge list recipes --category weapon --tags economy
```

> [!commentary]
> Zero results are not an error. The footer always appears, reporting
> "Found 0 of N recipes matching the filter" so you know the filter ran
> successfully against the full library. No table is rendered -- the
> output is clean and unambiguous. This is important for scripting: a
> zero-result filter is a valid outcome, not a failure.

## Act 7 -- JSON output for scripting

> You want to pipe filtered results into a build script that generates
> WAV files for every matching recipe. JSON output lets you parse the
> results programmatically.

Get the full library as JSON:

```bash
toneforge list recipes --json
```

Filter and get JSON with metadata about which filters were applied:

```bash
toneforge list recipes --search coin --json
```

Combine filters with JSON output:

```bash
toneforge list recipes --category card-game --tags positive,arcade --json
```

> [!commentary]
> Adding `--json` to any filtered or unfiltered listing produces structured
> JSON with four fields: `command`, `resource`, `recipes` (array of objects
> with name, description, category, and tags), and `total` (the total
> recipe count before filtering). When filters are active, a `filters`
> object is included showing which flags were applied. This makes it
> straightforward to integrate recipe discovery into build scripts, CI
> pipelines, or batch generation workflows.

## Act 8 -- From filter to sound

> You used filtering to find the three coin recipes. Now you want to hear
> them and export them to disk.

Filter to find the coin recipes, then preview each one:

```bash
toneforge list recipes --category card-game --search coin
```

```bash
toneforge generate --recipe card-coin-collect --seed 42
```

```bash
toneforge generate --recipe card-coin-collect-hybrid --seed 42
```

```bash
toneforge generate --recipe card-coin-spend --seed 42
```

Export them to disk:

```bash
toneforge generate --recipe card-coin-collect --seed 42 --output ./filtered-export/card-coin-collect.wav
toneforge generate --recipe card-coin-collect-hybrid --seed 42 --output ./filtered-export/card-coin-collect-hybrid.wav
toneforge generate --recipe card-coin-spend --seed 42 --output ./filtered-export/card-coin-spend.wav
```

> [!commentary]
> Filtering is a discovery tool -- it helps you find the right recipes.
> Once found, the workflow is the same as always: `generate` to preview,
> `generate --output` to export. The filter flags do not change how
> generation works. They narrow the list so you know what to generate.
> For larger batches, pipe the `--json` output into a script that loops
> over the recipe names and generates each one automatically.

## Recap -- What you just learned

1. **Full listing** -- `list recipes` now shows four columns (Recipe, Description, Category, Tags) with a count footer
2. **Keyword search** -- `--search <text>` matches case-insensitive substrings across name, description, category, and tags
3. **Category filter** -- `--category <name>` matches exactly after normalization (case, spaces, hyphens are equivalent)
4. **Tag filter** -- `--tags <t1,t2>` matches exact tags with AND logic (all specified tags must be present)
5. **Combined filters** -- multiple flags combine with AND logic for precise results
6. **Zero results** -- a clean footer message with no table, no error
7. **JSON output** -- `--json` produces structured output with recipe data, total count, and applied filters for scripting
8. **Filter-then-generate** -- use filtering to discover recipes, then generate and export as usual
