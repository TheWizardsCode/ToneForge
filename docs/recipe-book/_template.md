---
title: "{{ title }}"
id: "{{ id }}"
order: {{ order }}
description: "{{ description }}"
---

# {{ title }}

**Tier {{ tier }}** · {{ family }} · Tags: {{ tags }}

## Sound design

{{ sound_design }}

## ToneForge CLI

<!-- CLI_BLOCK_START — regenerate with: tsx scripts/recipe-book/generate-cli-blocks.ts {{ id }} -->
{{ cli_blocks }}
<!-- CLI_BLOCK_END -->

## Parameters

{{ parameters }}

## See also

- [Recipe Book Index](./index.md)
- [ToneGraph Schema](../../tonegraph.md)
