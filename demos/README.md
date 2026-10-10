# Demo Markdown Convention

This directory contains demo walkthroughs authored in Markdown. Each file
is a self-contained demo that can be consumed by the CLI runner, the web
wizard, or read directly on GitHub.

## Front Matter

Every demo file starts with a YAML front matter block:

```yaml
---
title: Human-readable demo title
id: unique-slug (used as filename without extension)
description: >
  One or two sentences summarising what the demo covers.
---
```

### Required fields

| Field         | Type   | Description                                      |
|---------------|--------|--------------------------------------------------|
| `title`       | string | Display title for the demo                       |
| `id`          | string | Unique identifier; must match the filename slug  |
| `description` | string | Brief summary shown in demo listings             |

## Heading Structure

| Heading | Purpose                                       |
|---------|-----------------------------------------------|
| `## `   | Delineates a step (e.g. `## Intro`, `## Act 1 — Title`) |

There is no `# H1` in the body; the front matter `title` serves that role.
Each `## ` heading starts a new step in the demo flow.

## Content Semantics

Within each step, the following Markdown constructs carry specific meaning:

### Blockquotes — Problem statements

Standard blockquotes (`>`) present the problem or scenario that the step
addresses:

```markdown
> You need a confirmation sound to test your button flow, but final
> audio assets are weeks away.
```

### Paragraphs — Solution narrative

Plain paragraphs following a blockquote describe the solution or
explanation:

```markdown
ToneForge generates placeholder sounds from recipes in milliseconds.
No assets needed. One command, one sound.
```

### Fenced code blocks — Executable commands

Fenced code blocks with the `bash` language tag contain commands that
demo runners should execute. Use `toneforge` as the command name in demo
files (the short alias `tf` also works -- both are identical):

````markdown
```bash
toneforge generate --recipe ui-scifi-confirm --seed 42
```
````

Multiple code blocks in a single step are executed sequentially.

### Admonitions — Post-command commentary

GitHub-style admonitions using `> [!commentary]` contain reflective text
shown after the commands in a step have been executed:

```markdown
> [!commentary]
> That placeholder was synthesized entirely from code. A sine oscillator
> shaped by a seed-derived envelope.
```

Commentary is optional. When present it appears after all code blocks in
the step.

### Ordered/unordered lists

Standard Markdown lists are used for enumerations within narrative text.
They carry no special semantic meaning to demo runners.

## File Naming

- Files are named `<id>.md` where `<id>` matches the front matter `id` field.
- Use lowercase kebab-case for IDs (e.g. `mvp-1`, `recipe-authoring`).

## Example

See [`mvp-1.md`](mvp-1.md) for a complete example following this
convention.

## Demo Index

| Demo | Description |
|------|-------------|
| [`mvp-1.md`](mvp-1.md) | ToneForge MVP -- procedural sound generation from recipes and seeds. |
| [`recipe-variety.md`](recipe-variety.md) | Recipe variety across weapons, footsteps, UI, and ambient categories. |
| [`wav-export.md`](wav-export.md) | Saving generated sounds to disk with `--output`. |
| [`batch-generation.md`](batch-generation.md) | Mass-producing sound variations with `--seed-range`. |
| [`sample-hybrid.md`](sample-hybrid.md) | Layering CC0 samples with procedural synthesis. |
| [`sound-stacking.md`](sound-stacking.md) | Composing layered sound events from multiple recipes. |
| [`audio-analysis.md`](audio-analysis.md) | Measuring generated audio with duration, peak, RMS, and spectral metrics. |
| [`classification.md`](classification.md) | Assigning semantic labels and searching by category, intensity, and texture. |
| [`exploration.md`](exploration.md) | Sweeping seeds, ranking, clustering, and promoting candidates. |
| [`library.md`](library.md) | Promoting, searching, exporting, and regenerating library entries. |
| [`sequencer.md`](sequencer.md) | Scheduling recipe triggers over time with sequence presets. |
| [`runtime.md`](runtime.md) | Audible, render-backed runtime demo driven by scripted state and context changes. |
| [`card-game-sounds.md`](card-game-sounds.md) | Finding, previewing, and selecting card game sounds. |
| [`recipe-filtering.md`](recipe-filtering.md) | Filtering recipes by search, category, and tags, with JSON output for scripting. |
| [`machine-use.md`](machine-use.md) | JSON-driven reporting batch script that discovers available sounds while filtering out already-used ones. |
| [`sound-creation.md`](sound-creation.md) | Building a sound from sine wave to recipe. |
| [`network-integrations.md`](network-integrations.md) | Two-window deterministic network sync (host/join, late join) and the CI/engine-export pipeline. |
| [Casual Game Recipe Book](../docs/recipe-book/index.md) | A guided, test-backed tour of 100 casual game recipes, from first blips to layered stings. |
