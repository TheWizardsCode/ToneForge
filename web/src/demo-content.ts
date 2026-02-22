// Demo content adapted from scripts/demo/mvp_1.sh
// Each step maps to a section of the CLI demo walkthrough.

export interface DemoStep {
  id: string;
  label: string;
  title: string;
  problem?: string;
  solution?: string;
  description: string;
  /** CLI commands to execute when "Run" is clicked */
  commands: string[];
  /** Extra commentary shown after commands run */
  commentary?: string;
}

const CLI = "node dist/cli.js";

export const DEMO_STEPS: DemoStep[] = [
  {
    id: "intro",
    label: "Intro",
    title: "ToneForge MVP Demo",
    description: [
      "Every game, app, and interactive experience needs sound effects.",
      "But final audio assets are one of the last things delivered.",
      "",
      "During development, teams either:",
      "",
      "1. Build features in silence and bolt sounds on later",
      "2. Scrub through generic libraries for 'close enough' temps",
      "3. Wait for the sound designer before they can test anything",
      "",
      "The result: integration surprises, wasted iteration cycles,",
      "and features that were never tested with audio feedback.",
      "",
      "What if you could generate placeholder sounds from code?",
      "Instantly. Varied. Reproducible. Right from day one.",
      "",
      "That is ToneForge \u2014 placeholder audio at the speed of development.",
      "Build and test with sound now. Drop in final assets when they're ready.",
    ].join("\n"),
    commands: [],
  },
  {
    id: "act-1",
    label: "1/4",
    title: "Unblock your build on day one",
    problem:
      "You're building a sci-fi game UI. You need a confirmation sound to test your button flow, but final audio assets are weeks away. Development stalls \u2014 or proceeds in silence.",
    solution:
      "ToneForge generates placeholder sounds from recipes in milliseconds. No assets needed. One command, one sound.",
    description: "",
    commands: [`${CLI} generate --recipe ui-scifi-confirm --seed 42`],
    commentary:
      "That placeholder was synthesized entirely from code. A sine oscillator shaped by a seed-derived envelope. No files to find, no licenses to check, no designer to wait for.",
  },
  {
    id: "act-2",
    label: "2/4",
    title: "Explore the design space before your sound designer does",
    problem:
      "Your prototype has five different confirm actions and each needs to feel distinct. Searching asset libraries for five 'close enough' temps is slow and none of them quite fit.",
    solution:
      "Change the seed, change the sound. Same recipe, different number, instant variation. Try three candidates in seconds:",
    description: "",
    commands: [
      `${CLI} generate --recipe ui-scifi-confirm --seed 100`,
      `${CLI} generate --recipe ui-scifi-confirm --seed 9999`,
      `${CLI} generate --recipe ui-scifi-confirm --seed 7`,
    ],
    commentary:
      "Three distinct placeholders. Same recipe. Three different integers. Pick your favourites and hand the seeds to your sound designer as a brief: 'this is the feel we prototyped with.'",
  },
  {
    id: "act-3",
    label: "3/4",
    title: "Reproducible placeholders across your team",
    problem:
      "A colleague asks 'what was that sound you used in the prototype?' You need to reproduce it exactly \u2014 not hunt through a downloads folder or re-scrub an asset library.",
    solution:
      "ToneForge is deterministic. Same recipe + same seed = identical audio, byte for byte. Share a seed, share a sound:",
    description: "",
    commands: [`${CLI} generate --recipe ui-scifi-confirm --seed 42`],
    commentary:
      "That is the exact same sound you heard in Act 1. Not similar. Identical. Any team member with the seed gets the same placeholder \u2014 no file sharing needed.",
  },
  {
    id: "act-4",
    label: "4/4",
    title: "Determinism you can verify in CI",
    problem:
      "Placeholder or not, if your integration tests depend on audio output, you need a guarantee that the output never drifts between runs. 'Probably the same' is not enough.",
    solution:
      "ToneForge's test suite renders the same seed 10 times and compares every sample byte-for-byte. Let's run it:",
    description: "",
    commands: ["npx vitest run src/core/renderer.test.ts"],
    commentary:
      "11 tests pass, including the 10-render determinism check. Every one of those renders produced the exact same buffer.",
  },
  {
    id: "recap",
    label: "Recap",
    title: "What you just saw",
    description: [
      "1. Placeholder audio generated instantly \u2014 no waiting for assets",
      "2. Rapid variation \u2014 explore the design space with seed changes",
      "3. Reproducible across your team \u2014 share a seed, share a sound",
      "4. CI-verifiable determinism \u2014 proven by automated tests",
      "",
      "This is one recipe. One sound type. The beginning.",
      "",
      "Generate placeholders now. Prototype with real audio feedback.",
      "Hand your favourite seeds to the sound designer as a brief.",
      "Drop in final assets when they're ready.",
    ].join("\n"),
    commands: [],
  },
];
