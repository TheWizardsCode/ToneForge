---
title: "Run Button: Sequential Execution & Completion Detection"
id: sequential-execution
order: 90
description: >
  Explore the Run button's sequential execution engine. Watch completion
  detection, button state transitions, failure halting, and the global
  run guard in action -- features that make multi-command steps reliable.
---

## Intro

Every other demo in this dropdown uses the Run button without explaining
how it works. This demo puts the Run button itself under the spotlight.

When a step has multiple commands, the Run button does not fire them all
at once or use a fixed timer. It executes them one at a time, waits for
each to finish, checks the exit code, and stops if anything fails. The
button's label and state change throughout to show you exactly what is
happening.

Here is what to watch for as you step through:

1. **Button label transitions** -- "Run" to "Running..." to "Run" (or "Failed")
2. **Completion detection** -- each command finishes before the next starts
3. **Exit-code awareness** -- a non-zero exit code halts the sequence
4. **Global run guard** -- all Run buttons disable while any step is running

## Act 1 -- Button state: Running and Done

> You click Run and want to know whether the command is still executing
> or has finished.

Watch the Run button below. When you click it, the label changes from
"Run" to **"Running..."** and the button disables. When the command
finishes, it re-enables and the label returns to "Run".

This is completion detection at work. The server wraps each command with
an OSC 133;D escape sequence that carries the exit code back over the
WebSocket. The client receives a structured `commandDone` message and
knows the command is finished -- no polling, no timers, no guessing.

```bash
toneforge generate --recipe ui-scifi-confirm --seed 42
```

> [!commentary]
> The button went through three states: enabled ("Run"), disabled
> ("Running..."), and enabled again ("Run"). That state transition
> is driven by the `executeCommand()` Promise resolving with the
> exit code -- not by a timeout or delay. Even a command that takes
> 10 seconds would hold "Running..." until it actually finishes.

## Act 2 -- Sequential execution: ordered dependencies

> You need to generate a file and then analyze it. The analysis
> cannot start until the file exists. Order matters.

This step has two commands. Click Run once. The generate command runs
first and writes a WAV file. Only after it completes does the analyze
command start and read that file.

Watch the terminal output: you will see the generation output appear
first, then a pause, then the analysis metrics. The button stays on
"Running..." the entire time -- it does not flicker between commands.

```bash
toneforge generate --recipe weapon-laser-zap --seed 42 --output ./output/seq-demo-zap.wav
```

```bash
toneforge analyze --input ./output/seq-demo-zap.wav
```

> [!commentary]
> Under the hood, the wizard uses an async for-of loop. It calls
> `terminal.executeCommand(cmd)` for each command and awaits the
> Promise before moving to the next. The Promise resolves when the
> server sends `{ type: "commandDone", exitCode: 0 }` over the
> WebSocket. If the generate command had been slow, the analyze
> command would have waited -- there is no fixed delay between them.

## Act 3 -- Three-command pipeline

> You want to generate a sound, measure its properties, and classify
> it -- a full pipeline where each step feeds the next.

Three commands, one click. Each waits for the previous to finish.
The button stays on "Running..." from the moment you click until
the last command completes.

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
> The generate command created the WAV. The analyze command read it
> and wrote JSON. The classify command read the JSON and assigned
> labels. All three ran sequentially because `executeCommand()` awaits
> each one's `commandDone` message before dispatching the next. Without
> this, the analyze command would try to open a file that does not
> exist yet.

## Act 4 -- Failure detection: the sequence halts

> A command in the middle of a sequence fails. What happens to the
> remaining commands?

This step has three commands. The second one tries to analyze a file
that does not exist -- it will exit with a non-zero code. Watch what
happens:

1. The first command succeeds -- you hear the sound
2. The second command fails -- the terminal shows an error
3. The **third command never runs** -- the sequence halts
4. The button changes to **"Failed"** instead of returning to "Run"

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
> The exit code from the failed analyze command was non-zero. The
> wizard's async loop checks `result.exitCode !== 0` after each
> command. When it detects failure, it breaks out of the loop and
> sets the button to "Failed" with a red error state. The third
> generate command was never sent to the terminal. You can re-run
> this step to see the failure again -- the "Failed" label resets
> to "Running..." on the next click.

## Act 5 -- Global run guard: one sequence at a time

> You are on a step with a slow command running. Can you switch to
> another step and click its Run button too?

No. The global run guard prevents it. While any step's commands are
executing, every Run button in the wizard disables -- not just the
one you clicked. This prevents race conditions where two command
sequences interleave in the same terminal.

Try it: click Run below, then quickly navigate to another step (use
the tabs above). You will see that step's Run button is disabled and
grayed out until this step's commands finish.

```bash
toneforge generate --recipe ambient-wind-gust --seed 42
```

```bash
toneforge generate --recipe rumble-body --seed 42
```

```bash
toneforge generate --recipe debris-tail --seed 42
```

> [!commentary]
> The wizard tracks a global `isRunning` flag and a Set of all Run
> buttons across all rendered steps. When execution starts, every
> button in the Set is disabled. When it ends (success or failure),
> they all re-enable. This means you can never have two sequences
> running simultaneously -- the terminal stays clean and commands
> never interleave.

## Recap

| Feature | What you saw | How it works |
| --- | --- | --- |
| **Completion detection** | Button waits for command to finish | Server emits OSC 133;D with exit code; client receives `commandDone` JSON |
| **Button states** | "Run" / "Running..." / "Failed" | `executeCommand()` returns a Promise that resolves with `{ exitCode }` |
| **Sequential dispatch** | Commands run one at a time | Async for-of loop awaits each `executeCommand()` |
| **Failure halting** | Sequence stops on error, skips remaining | Loop breaks on `exitCode !== 0`, button shows "Failed" |
| **Global run guard** | All Run buttons disable during execution | `isRunning` flag + `allRunButtons` Set disable/enable all buttons |

These features apply to every demo in the dropdown. Any step with
multiple commands benefits from sequential execution automatically.
