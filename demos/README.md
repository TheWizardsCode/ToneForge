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
demo runners should execute:

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
