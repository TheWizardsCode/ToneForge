---
title: "Sequential Execution: Reliable Multi-Command Steps"
id: sequential-execution
order: 90
description: >
  Demonstrates how multi-command steps execute sequentially with completion
  detection. Each command waits for the previous one to finish before running,
  with automatic failure detection that halts the sequence on errors.
---

## Intro

Many ToneForge workflows involve multiple commands in sequence: generate
a sound, then analyze it. Export a file, then play it back. Batch-render
variations, then classify them.

When you click **Run** on a step with multiple commands, the web demo
executes them sequentially -- each command waits for the previous one to
complete before the next one starts. This is not a fixed delay or a
timer. The system detects actual command completion through exit-code
signalling, so even slow commands finish cleanly before the next begins.

In this walkthrough you will see:

1. A single command executing normally
2. Multiple commands running in strict sequence, each waiting for the prior one
3. A multi-step pipeline where output from one command feeds the next
4. What happens when a command fails -- the sequence halts immediately

## Act 1 -- Single command baseline

> You want to hear a quick UI confirmation tone. One command, one sound.

This is the simplest case. A single command executes and the Run button
re-enables when it finishes. Watch the button change to "Running..." and
return to "Run" after the sound plays.

```bash
toneforge generate --recipe ui-scifi-confirm --seed 42
```

> [!commentary]
> The button disabled itself, changed its label to "Running...", and
> re-enabled when the command completed. Even for a single command, the
> system tracks completion -- there is no arbitrary timeout or delay.

## Act 2 -- Sequential execution: generate then analyze

> You generated a sound and immediately want to measure its properties.
> These commands must run in order -- the analysis needs the generated
> file to exist first.

Click **Run** once. Both commands execute in sequence. The generate
command finishes, then the analyze command starts. You will see the
generation output first, followed by the analysis metrics.

```bash
toneforge generate --recipe weapon-laser-zap --seed 42 --output ./output/seq-demo-zap.wav
```

```bash
toneforge analyze --input ./output/seq-demo-zap.wav
```

> [!commentary]
> Two commands, one click. The analyze command did not start until the
> WAV file was fully written by the generate command. Without sequential
> execution, the analyzer would try to read a file that does not exist
> yet or is still being written -- producing an error or corrupt results.

## Act 3 -- Three-command pipeline: generate, analyze, classify

> You want to generate a sound, extract its metrics, and then classify
> it -- a complete pipeline from synthesis to semantic labeling.

This step chains three commands. Each one depends on the previous
command's output. Watch the terminal as they execute one after another.

```bash
toneforge generate --recipe impact-crack --seed 77 --output ./output/seq-demo-crack.wav
```

```bash
toneforge analyze --input ./output/seq-demo-crack.wav --output ./output/seq-demo-crack-analysis.json
```

```bash
toneforge classify --input ./output/seq-demo-crack-analysis.json
```

> [!commentary]
> Three commands ran in strict sequence. The generate command created the
> WAV file. The analyze command read that file and wrote a JSON analysis.
> The classify command read that JSON and assigned semantic labels. If
> any of these commands had been sent simultaneously (as the old 500ms
> stagger did), the later commands would fail because their input files
> would not exist yet. Sequential execution with completion detection
> eliminates that entire class of timing bugs.

## Act 4 -- Parallel-safe: multiple variations in sequence

> You want to compare three different seeds of the same recipe. Each
> generate command must finish before the next starts, so the terminal
> output stays clean and readable.

```bash
toneforge generate --recipe ui-notification-chime --seed 10
```

```bash
toneforge generate --recipe ui-notification-chime --seed 20
```

```bash
toneforge generate --recipe ui-notification-chime --seed 30
```

> [!commentary]
> Three generate commands, three distinct chime variations. Each one
> played fully before the next began. Without sequential execution,
> these sounds would overlap in the terminal and the audio output
> would be garbled -- multiple sounds playing simultaneously with
> interleaved console output.

## Act 5 -- Failure detection: what happens when a command fails

> You try to analyze a file that does not exist. The sequence should
> halt at the failure rather than blindly continuing to the next command.

This step has three commands. The second command references a
non-existent file and will fail. The third command should never run.

```bash
toneforge generate --recipe footstep-stone --seed 55
```

```bash
toneforge analyze --input ./output/this-file-does-not-exist.wav
```

```bash
toneforge generate --recipe ui-scifi-confirm --seed 99
```

> [!commentary]
> The first command succeeded -- you heard the footstep. The second
> command failed because the file does not exist. The Run button changed
> to "Failed" and the third command never executed. This is the
> exit-code detection at work: the system reads the non-zero exit code
> from the failed command and halts the sequence immediately. You can
> see exactly which command failed without sifting through garbled output
> from commands that should not have run.

## Recap -- How sequential execution works

1. **Completion detection** -- The server signals command completion via
   exit-code messages over WebSocket. No timers, no guessing.
2. **Sequential dispatch** -- Each command waits for the previous one to
   complete before being sent to the terminal.
3. **Failure halts the sequence** -- A non-zero exit code stops execution
   immediately. The Run button shows "Failed" so you know something
   went wrong.
4. **Button state management** -- The Run button disables and shows
   "Running..." during execution, preventing accidental double-clicks
   or concurrent runs from other steps.
5. **Global run guard** -- While any step is running, all other Run
   buttons are disabled. Only one sequence runs at a time.

These behaviors apply to every demo in the dropdown. Any step with
multiple commands benefits from sequential execution automatically.
