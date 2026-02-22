# ToneForge Demo Roadmap

> An incremental sequence of demos introducing every ToneForge architectural layer, progressing from the current MVP to the full platform vision.

## How to Read This Document

Each demo builds on the previous one. The "Prerequisite Demos" field makes dependencies explicit. The "New Modules" field lists what gets implemented for each demo. The "What the User Sees" section describes the concrete experience -- what commands are run, what output appears, what sounds are heard.

The demos follow ToneForge's natural architectural dependency order:

```
Core → Stack → Analyze → Classify → Explore → Library
  ↓                                               ↓
Sequencer → Runtime → State → Context → Mixer → Intelligence
  ↓                                               ↓
Visualizer → Haptics → Palette → Compiler → Validator
  ↓                                               ↓
Network → Integrations → Marketplace → Intent → Memory
```

---

## Demo 0: MVP -- Procedural Sound Generation (COMPLETE)

> Already implemented. Available as `npm run demo` (CLI) and the web demo at `web/`. Demo content lives in `demos/mvp-1.md`.

**Modules:** Core (partial -- single recipe, seeded RNG, offline renderer)

**What the User Sees:**

1. Generate a sci-fi UI confirm sound: `toneforge generate --recipe ui-scifi-confirm --seed 42`
2. Hear distinct variations across different seeds (100, 9999, 7)
3. Verify determinism: same seed produces byte-identical output
4. Run Vitest determinism tests from within the web demo's embedded terminal

**CLI Commands:** `toneforge generate --recipe <name> --seed <n>`

**Key Proof Points:**
- Procedural synthesis produces real, usable sounds
- Seed-based variation creates audibly distinct outputs
- Determinism is byte-level verifiable

**Reference PRDs:** `CORE_PRD.md`

---

## Demo 1: Recipe Variety -- Multiple Sound Types

**Prerequisite Demos:** 0

**New Modules:** Core (expanded recipe registry)

**Goal:** Prove that the recipe architecture generalizes beyond a single sound type. Add 3-4 new recipes spanning different game audio categories.

**New Recipes:**
- `weapon-laser-zap` -- Short, punchy laser/blaster sound (FM synthesis + noise burst)
- `footstep-stone` -- Procedural footstep on hard surface (filtered noise + transient shaping)
- `ui-notification-chime` -- Musical notification tone (harmonic series + gentle envelope)
- `ambient-wind-gust` -- Environmental wind burst (filtered noise + LFO modulation)

**What the User Sees:**

```bash
# Generate sounds from different categories
toneforge generate --recipe weapon-laser-zap --seed 42
toneforge generate --recipe footstep-stone --seed 42
toneforge generate --recipe ui-notification-chime --seed 42
toneforge generate --recipe ambient-wind-gust --seed 42

# Same recipe, different seeds -- hear variation within a category
toneforge generate --recipe weapon-laser-zap --seed 1
toneforge generate --recipe weapon-laser-zap --seed 500
toneforge generate --recipe weapon-laser-zap --seed 9999

# List all available recipes
toneforge list recipes
```

**New CLI Commands:** `toneforge list recipes`

**Key Proof Points:**
- Recipe pattern scales to any sound category
- Each recipe produces meaningfully distinct seed variations
- Registry pattern supports discovery (`list recipes`)

**Acceptance Criteria:**
1. At least 4 recipes registered (including the original `ui-scifi-confirm`)
2. Each recipe produces audibly distinct output across 5+ seeds
3. All recipes pass determinism tests (10x byte-identical)
4. `toneforge list recipes` outputs all registered recipe names

**Reference PRDs:** `CORE_PRD.md` (Section 6.3 -- recipe sketches for footsteps, magic spells, sci-fi UI, creature vocalizations)

---

## Demo 2: WAV Export & Sample-Hybrid Recipes

**Prerequisite Demos:** 1

**New Modules:** Core (WAV export to disk, sample loading, hybrid recipes)

**Goal:** Add the ability to save generated sounds as WAV files and introduce sample-hybrid recipes that combine procedural synthesis with audio samples as composable ingredients.

**What the User Sees:**

```bash
# Export a generated sound to a WAV file
toneforge generate --recipe ui-scifi-confirm --seed 42 --output ./my-sound.wav

# Generate a sample-hybrid recipe (procedural synthesis + sample layer)
toneforge generate --recipe footstep-gravel --seed 42 --output ./footstep.wav
# Uses a gravel texture sample layered with procedural transient shaping

# Batch generate multiple seeds to a directory
toneforge generate --recipe weapon-laser-zap --seed-range 1:10 --output ./lasers/

# Play without saving (existing behavior)
toneforge generate --recipe ui-scifi-confirm --seed 42
```

**New CLI Commands:**
- `--output <path>` flag on `generate`
- `--seed-range <start>:<end>` flag for batch generation

**Key Proof Points:**
- Generated sounds are portable WAV files usable in any audio tool
- Samples are ingredients, not replacements -- procedural synthesis still drives variation
- Batch generation enables rapid prototyping workflows

**Acceptance Criteria:**
1. `--output` flag writes a valid 44.1 kHz 16-bit PCM WAV file
2. At least one hybrid recipe uses a sample file layered with synthesis
3. `--seed-range` generates one WAV per seed into the target directory
4. Hybrid recipes still pass determinism tests
5. WAV files open correctly in Audacity / any standard audio editor

**Reference PRDs:** `CORE_PRD.md` (Section 8 -- WAV export, Section 6.3 -- sample-hybrid footsteps)

---

## Demo 3: Sound Stacking -- Layered Events

**Prerequisite Demos:** 2

**New Modules:** Stack

**Goal:** Demonstrate multi-layer sound composition. A single "sound event" (like an explosion or a door slam) is composed of multiple synchronized layers with independent timing, gain, and pan.

**What the User Sees:**

```bash
# Render a pre-defined stack (explosion = transient + body + tail)
toneforge stack render --preset presets/explosion_heavy.json --seed 42 --output ./explosion.wav

# Preview the stack structure
toneforge stack inspect --preset presets/explosion_heavy.json
# Output:
#   Stack: explosion_heavy (3 layers)
#   [0] transient_crack   offset: 0ms    gain: 0.9  pan: 0.0
#   [1] body_rumble        offset: 5ms    gain: 0.7  pan: 0.0
#   [2] debris_tail        offset: 50ms   gain: 0.5  pan: 0.0
#   Duration: 1.2s

# Vary the entire stack with a different seed
toneforge stack render --preset presets/explosion_heavy.json --seed 100 --output ./explosion_v2.wav

# Create a stack from individual recipes on the command line
toneforge stack render \
  --layer "weapon-laser-zap:0ms:0.8" \
  --layer "ui-scifi-confirm:50ms:0.3" \
  --seed 42 --output ./layered.wav
```

**New CLI Commands:**
- `toneforge stack render --preset <file> [--layer <spec>] --seed <n> --output <path>`
- `toneforge stack inspect --preset <file>`

**Key Proof Points:**
- Complex sound events are composed from simple, reusable recipes
- Stack presets are JSON -- human-readable, version-controllable, shareable
- Seed variation applies to all layers coherently
- Timing precision is sample-accurate

**Acceptance Criteria:**
1. At least 2 stack presets exist (e.g., explosion, door_slam)
2. `stack render` produces a valid WAV combining all layers
3. `stack inspect` displays layer structure (recipe, offset, gain, pan)
4. Stack rendering is deterministic (same seed = byte-identical output)
5. Inline `--layer` syntax works for ad-hoc stacking

**Reference PRDs:** `STACK_PRD.md`, `LAYERING_PRD.md`

---

## Demo 4: Audio Analysis -- Measuring What You Made

**Prerequisite Demos:** 2

**New Modules:** Analyze

**Goal:** Introduce structured, machine-readable audio analysis. Given a rendered sound (or directory of sounds), extract numeric descriptors: envelope shape, spectral characteristics, loudness, transient count, quality flags.

**What the User Sees:**

```bash
# Generate a batch of sounds
toneforge generate --recipe weapon-laser-zap --seed-range 1:20 --output ./renders/

# Analyze the entire batch
toneforge analyze --input ./renders/ --output ./analysis/
# Output:
#   Analyzed 20 files
#   weapon-laser-zap_seed-001.wav: duration=0.15s peak=0.87 rms=0.34 attack=2ms ...
#   weapon-laser-zap_seed-002.wav: duration=0.18s peak=0.91 rms=0.38 attack=1ms ...
#   ...
#   Quality flags: 0 clipping, 0 silence, 20 valid

# Analyze a single file with full detail
toneforge analyze --input ./renders/weapon-laser-zap_seed-001.wav --format json
# Output: structured JSON with all metrics
```

**New CLI Commands:**
- `toneforge analyze --input <path> --output <dir> [--format json|table]`

**Key Proof Points:**
- Every generated sound has measurable, comparable properties
- Analysis catches quality issues automatically (clipping, silence, missing transients)
- Structured output feeds downstream modules (Classify, Explore, Intelligence)

**Acceptance Criteria:**
1. Analysis extracts at minimum: duration, peak, RMS, crest factor, attack time, spectral centroid
2. Quality flags detect clipping (peak > 1.0) and silence (RMS < threshold)
3. Batch analysis produces one JSON file per input
4. Table format outputs a human-readable summary
5. Analysis results are deterministic for the same input file

**Reference PRDs:** `ANALYZE_PRD.md`

---

## Demo 5: Classification -- Semantic Labels for Sounds

**Prerequisite Demos:** 4

**New Modules:** Classify

**Goal:** Add semantic labeling to analyzed sounds. Given analysis data, assign meaningful categories, materials, intensity levels, texture descriptors, and use-case tags.

**What the User Sees:**

```bash
# Classify a previously analyzed batch
toneforge classify --analysis ./analysis/ --output ./classification/
# Output:
#   Classified 20 files
#   weapon-laser-zap_seed-001: category=weapon material=energy intensity=high texture=sharp tags=[sci-fi, ranged, laser]
#   weapon-laser-zap_seed-002: category=weapon material=energy intensity=medium texture=buzzy tags=[sci-fi, ranged]
#   ...

# Classify a single sound end-to-end (analyze + classify)
toneforge classify --input ./renders/weapon-laser-zap_seed-001.wav --format json

# Search by classification
toneforge classify search --category weapon --intensity high --texture sharp
```

**New CLI Commands:**
- `toneforge classify --analysis <dir> --output <dir>`
- `toneforge classify --input <path>` (end-to-end: analyze then classify)
- `toneforge classify search --category <c> [--intensity <i>] [--texture <t>]`

**Key Proof Points:**
- Sounds gain semantic meaning beyond filenames
- Classification enables search-by-description workflows
- Labels are structured and queryable, not freeform

**Acceptance Criteria:**
1. Classification assigns at minimum: category, intensity, texture, tags
2. Rule-based pre-classifier produces reasonable labels for known recipe types
3. Search returns matching entries from classification data
4. Classification output is deterministic for the same analysis input

**Reference PRDs:** `CLASSIFY_PRD.md`

---

## Demo 6: Exploration -- Finding the Best Sounds

**Prerequisite Demos:** 4, 5

**New Modules:** Explore

**Goal:** Demonstrate systematic discovery across large seed/parameter spaces. Generate thousands of variations, rank them by analysis metrics, cluster them by similarity, and surface the most interesting or useful sounds.

**What the User Sees:**

```bash
# Sweep 10,000 seeds, keep the top 50 by transient density
toneforge explore --recipe weapon-laser-zap \
  --seed-range 0:10000 --keep-top 50 \
  --rank-by transient-density \
  --output ./exploration/

# Output:
#   Explored 10,000 seeds in 45s
#   Top 50 by transient-density:
#   #1  seed=4821  transient-density=12.3  intensity=high
#   #2  seed=7234  transient-density=11.8  intensity=high
#   ...
#   Cluster summary: 5 clusters identified
#     Cluster A (12 sounds): sharp, high-pitched
#     Cluster B (15 sounds): buzzy, mid-range
#     ...

# Mutate a known-good sound to find nearby variations
toneforge explore mutate --seed 4821 --recipe weapon-laser-zap \
  --jitter 0.1 --count 20 --output ./mutations/

# Listen to the top result
toneforge generate --recipe weapon-laser-zap --seed 4821

# Promote a discovery to the library (see Demo 7)
toneforge explore promote --seed 4821 --recipe weapon-laser-zap
```

**New CLI Commands:**
- `toneforge explore --recipe <r> --seed-range <s:e> --keep-top <n> --rank-by <metric>`
- `toneforge explore mutate --seed <n> --recipe <r> --jitter <f> --count <n>`
- `toneforge explore promote --seed <n> --recipe <r>`

**Key Proof Points:**
- Brute-force search finds sounds a human would never stumble upon
- Ranking by analysis metrics surfaces objectively best results
- Mutation enables fine-grained refinement around a known-good seed
- Clustering reveals the natural taxonomy of a recipe's output space

**Acceptance Criteria:**
1. Seed sweep of 10,000+ completes in under 2 minutes
2. Ranking uses at least 3 selectable metrics (transient-density, spectral-centroid, RMS)
3. Clustering groups results into 3-8 clusters
4. Mutation produces variations perceptibly similar to but distinct from the source
5. `promote` marks a result for library import

**Reference PRDs:** `EXPLORE_PRD.md`

---

## Demo 7: Library -- Structured Asset Storage

**Prerequisite Demos:** 6

**New Modules:** Library

**Goal:** Introduce persistent, indexed storage for curated sounds. The library stores audio files, presets, analysis, and classification data in a unified, queryable structure with deterministic regeneration support.

**What the User Sees:**

```bash
# Import exploration results into the library
toneforge library import --from ./exploration/ --category weapon

# List library contents
toneforge library list --category weapon
# Output:
#   weapon/laser-zap/seed-4821  intensity=high  texture=sharp  tags=[sci-fi, ranged]
#   weapon/laser-zap/seed-7234  intensity=high  texture=buzzy  tags=[sci-fi, ranged]
#   ...
#   48 entries in category 'weapon'

# Search by attributes
toneforge library search --intensity high --texture sharp
toneforge library search --tags "sci-fi,ranged"

# Find similar sounds
toneforge library similar --id weapon/laser-zap/seed-4821 --limit 5

# Export library entries to WAV
toneforge library export --category weapon --format wav --output ./export/

# Regenerate a sound from its stored preset (deterministic)
toneforge library regenerate --id weapon/laser-zap/seed-4821
# Output: Regenerated from preset: recipe=weapon-laser-zap seed=4821 -- byte-identical
```

**New CLI Commands:**
- `toneforge library import --from <dir> --category <c>`
- `toneforge library list [--category <c>]`
- `toneforge library search [--intensity <i>] [--texture <t>] [--tags <t>]`
- `toneforge library similar --id <id> --limit <n>`
- `toneforge library export --category <c> --format wav --output <dir>`
- `toneforge library regenerate --id <id>`

**Key Proof Points:**
- Generated sounds become persistent, searchable assets
- Presets enable deterministic regeneration -- no need to store audio files if seeds are stored
- The library bridges generation and delivery -- sounds go from exploration to production pipeline

**Acceptance Criteria:**
1. Library stores metadata, analysis, classification, and preset alongside audio
2. Search returns relevant results across multiple attribute dimensions
3. Similarity search finds perceptually related sounds
4. Regeneration from stored presets produces byte-identical output
5. Export produces valid WAV files organized by category

**Reference PRDs:** `LIBRARY_PRD.md`

---

## Demo 8: Sequencer -- Temporal Behavior Patterns

**Prerequisite Demos:** 3, 7

**New Modules:** Sequencer

**Goal:** Move from single sound events to temporal patterns. The Sequencer schedules when events occur over time -- footstep cadences, weapon fire bursts, ambient soundscapes. This is the "when" axis of ToneForge's What/When/Why model.

**What the User Sees:**

```bash
# Generate a footstep walking sequence (fixed cadence pattern)
toneforge sequence generate --preset presets/sequences/footsteps_walk.json \
  --duration 5s --seed 42 --output ./walk_sequence.wav
# Hear: regular footstep pattern with per-step seed variation

# Generate with a different pattern (running -- faster cadence)
toneforge sequence generate --preset presets/sequences/footsteps_run.json \
  --duration 5s --seed 42 --output ./run_sequence.wav

# Simulate a sequence (print event timeline without rendering)
toneforge sequence simulate --preset presets/sequences/footsteps_walk.json --duration 5s
# Output:
#   t=0.000s  footstep-stone  seed=42   intensity=0.7
#   t=0.600s  footstep-stone  seed=43   intensity=0.8
#   t=1.200s  footstep-stone  seed=44   intensity=0.7
#   ...

# Generate a weapon burst sequence (probabilistic timing)
toneforge sequence generate --preset presets/sequences/weapon_burst.json \
  --duration 3s --seed 42 --output ./burst.wav

# Inspect a sequence definition
toneforge sequence inspect --preset presets/sequences/footsteps_walk.json
```

**New CLI Commands:**
- `toneforge sequence generate --preset <file> --duration <t> --seed <n> --output <path>`
- `toneforge sequence simulate --preset <file> --duration <t>`
- `toneforge sequence inspect --preset <file>`

**Key Proof Points:**
- Sound behavior extends beyond single events to patterns over time
- Per-event seed variation prevents repetition in looping patterns
- Sequence definitions are JSON presets -- deterministic, shareable, version-controllable
- The simulation command enables debugging without rendering audio

**Acceptance Criteria:**
1. At least 3 sequence presets exist (footsteps_walk, footsteps_run, weapon_burst)
2. Sequences produce correctly timed events with per-event variation
3. `simulate` outputs an accurate event timeline
4. Sequence rendering is deterministic
5. Duration flag controls total output length

**Reference PRDs:** `SEQUENCER_PRD.md`

---

## Demo 9: Runtime & State -- Real-Time Behavioral Sound

**Prerequisite Demos:** 8

**New Modules:** Runtime, State, Context

**Goal:** Demonstrate real-time playback with state-driven behavior changes. A character transitions from walking to running to sprinting, and the sound behavior (cadence, intensity, recipe selection) changes in response. Environmental context (surface material) modifies the sound.

**What the User Sees:**

A live interactive session (web demo or REPL):

```
> runtime.start()

> context.set({ surface: "stone" })
> state.set("movement", "walk")
  [Playing: footsteps_walk on stone, cadence=0.6s, intensity=0.7]

> state.set("movement", "run")
  [Transition: walk -> run]
  [Playing: footsteps_run on stone, cadence=0.35s, intensity=0.9]

> context.set({ surface: "gravel" })
  [Context changed: surface stone -> gravel]
  [Playing: footsteps_run on gravel, cadence=0.35s, intensity=0.9]

> state.set("movement", "walk")
  [Transition: run -> walk]
  [Playing: footsteps_walk on gravel, cadence=0.6s, intensity=0.7]

> state.inspect()
  movement: walk (was: run, changed 2.1s ago)
  surface: gravel
  active sequences: footsteps_walk
  active stacks: footstep_gravel

> runtime.stop()
```

**New CLI Commands:**
- `toneforge runtime start` (interactive mode)
- State and context manipulation via REPL or API

**Key Proof Points:**
- Sound is behavior, not a static file -- it responds to game state in real time
- State transitions are declarative, inspectable, and deterministic
- Context (environment) and State (character) are orthogonal inputs
- The same recipes and sequences power both offline and real-time use cases

**Acceptance Criteria:**
1. Runtime plays sequences in real time with audible output
2. State changes trigger sequence transitions (walk -> run -> sprint)
3. Context changes modify recipe selection (stone -> gravel footstep recipe)
4. State inspection shows current values, history, and active sequences
5. All transitions are logged and deterministically reproducible given the same event sequence

**Reference PRDs:** `RUNTIME_PRD.md`, `STATE_PRD.md`, `CONTEXT_PRD.md`

---

## Demo 10: Mixer -- Intelligent Audio Balancing

**Prerequisite Demos:** 9

**New Modules:** Mixer

**Goal:** Demonstrate behavior-aware mixing under load. Multiple concurrent sound sources (footsteps + combat + UI + ambient) are dynamically balanced based on game state, preventing audio chaos.

**What the User Sees:**

Interactive session continuing from Demo 9:

```
> # Multiple active sound sources
> state.set("movement", "walk")
> sequence.start("ambient_wind")
> sequence.start("combat_distant")

> mixer.inspect()
  Mix Groups:
    footsteps    [-6dB]  priority=medium  voices=1/4
    ambience     [-12dB] priority=low     voices=1/2
    combat       [-8dB]  priority=high    voices=1/4
    ui           [muted] priority=medium  voices=0/2

> # Trigger UI sound -- footsteps duck briefly
> runtime.play("ui-scifi-confirm", { seed: 42 })
  [Mixer: ducking footsteps -3dB for UI event]

> # Enter combat state -- ambient ducks, combat priority increases
> state.set("situation", "combat_active")
  [Mixer: state-driven rule applied]
  [Mixer: ambience ducked -6dB, combat boosted +3dB]

> mixer.inspect()
  Mix Groups:
    footsteps    [-6dB]  priority=medium  voices=1/4
    ambience     [-18dB] priority=low     voices=1/2   [ducked: combat_active]
    combat       [-5dB]  priority=high    voices=2/4   [boosted: combat_active]
    ui           [muted] priority=medium  voices=0/2
```

**Key Proof Points:**
- Audio never becomes a wall of noise -- the mixer prevents overload
- Ducking and priority rules are declarative, not hard-coded
- State changes automatically adjust the mix (combat mode ducks ambient)
- Voice limiting prevents resource exhaustion

**Acceptance Criteria:**
1. Mix groups with configurable gain, priority, and voice limits
2. State-driven ducking/boosting rules applied automatically
3. UI events trigger brief footstep ducking
4. Voice limiting prevents exceeding max concurrent sources
5. `mixer.inspect()` displays current state of all groups

**Reference PRDs:** `MIXER_PRD.md`

---

## Demo 11: Intelligence -- Assisted Decision-Making

**Prerequisite Demos:** 7, 10

**New Modules:** Intelligence

**Goal:** Demonstrate the reasoning layer that synthesizes analysis, classification, and library data to provide actionable recommendations. Intelligence is assistive -- it suggests, the human decides.

**What the User Sees:**

```bash
# Ask Intelligence to find gaps in the library
toneforge intelligence audit --library ./library
# Output:
#   Library Audit Report
#   Coverage: 48 entries across 3 categories
#   Gaps:
#     - No "low intensity" weapon sounds (all entries are medium/high)
#     - Footstep category has only 1 surface material (stone)
#     - No UI sounds beyond confirm (missing: cancel, hover, error)
#   Redundancy:
#     - 12 weapon-laser-zap entries cluster into only 2 perceptual groups
#     - Recommend pruning to 6 representative entries
#   Suggestion: Run `toneforge explore --recipe weapon-laser-zap --rank-by rms --filter "rms<0.3"`
#               to find low-intensity variants

# Ask for recommendations by use case
toneforge intelligence recommend --use-case "sci-fi menu navigation" --max-results 5
# Output:
#   Recommendations for "sci-fi menu navigation":
#   1. ui-scifi-confirm seed=42 (confidence: 0.92) -- bright, short, clean
#   2. ui-notification-chime seed=17 (confidence: 0.78) -- gentle, musical
#   ...

# Ask Intelligence to suggest exploration targets
toneforge intelligence suggest-exploration --recipe footstep-stone
# Output:
#   Exploration suggestions for footstep-stone:
#   - Expand seed range: current coverage is seeds 1-50, try 1000-5000
#   - Add surface variants: gravel, wood, metal (requires new recipes)
#   - Current entries cluster tightly -- increase parameter jitter for more variety
```

**New CLI Commands:**
- `toneforge intelligence audit --library <dir>`
- `toneforge intelligence recommend --use-case <desc> --max-results <n>`
- `toneforge intelligence suggest-exploration --recipe <r>`

**Key Proof Points:**
- Intelligence synthesizes data humans would take hours to review manually
- Recommendations are explainable (confidence scores, reasoning)
- Intelligence never modifies assets -- it only suggests
- Gap analysis drives library completeness

**Acceptance Criteria:**
1. Audit identifies coverage gaps, redundancy, and quality issues
2. Recommendations include confidence scores and explanations
3. Exploration suggestions reference specific recipes and seed ranges
4. No Intelligence action modifies library data without human approval
5. All suggestions reference actionable CLI commands

**Reference PRDs:** `INTELLIGENCE_PRD.md`

---

## Demo 12: Compiler & Validator -- Production-Ready Assets

**Prerequisite Demos:** 7, 11

**New Modules:** Compiler, Validator

**Goal:** Transform curated library content into platform-specific, production-ready artifacts. The Validator ensures quality standards before compilation. The Compiler decides what stays procedural vs. what gets baked to WAV, and packages everything for target platforms.

**What the User Sees:**

```bash
# Validate library before compilation
toneforge validate --library ./library --ruleset mobile --strictness warning
# Output:
#   Validation Report (ruleset: mobile, strictness: warning)
#   Checked: 48 entries
#   Passed: 45
#   Warnings: 3
#     weapon/laser-zap/seed-1234: peak=0.97 (warning: close to clipping threshold 0.95)
#     weapon/laser-zap/seed-5678: duration=2.1s (warning: exceeds mobile budget 1.5s)
#     footstep/stone/seed-42: silence_ratio=0.45 (warning: high silence ratio)
#   Errors: 0
#   Result: PASS (with warnings)

# Compile for web platform
toneforge compile --library ./library --category weapon --target web \
  --rules presets/compile/web_defaults.json --output ./dist/web/
# Output:
#   Compile Report (target: web)
#   Decisions:
#     weapon/laser-zap/seed-4821: BAKE (short duration, low CPU budget)
#     weapon/laser-zap/seed-7234: BAKE
#     ...
#   Output: 24 WAV files + manifest.json
#   Total size: 1.2 MB
#   Build hash: a1b2c3d4...

# Compile for mobile with aggressive baking
toneforge compile --library ./library --target mobile \
  --rules presets/compile/mobile_aggressive.json --output ./dist/mobile/

# Dry-run compilation (no output files, just report)
toneforge compile --library ./library --target web --dry-run
```

**New CLI Commands:**
- `toneforge validate --library <dir> --ruleset <name> --strictness <level>`
- `toneforge compile --library <dir> --category <c> --target <platform> --rules <file> --output <dir>`
- `toneforge compile --dry-run`

**Key Proof Points:**
- Quality gates catch issues before they reach production
- Compilation decisions (procedural vs. baked) are per-asset and rule-driven
- Build manifests enable deterministic, reproducible builds
- Target-specific packaging optimizes for platform constraints

**Acceptance Criteria:**
1. Validator checks: peak clipping, duration bounds, silence ratio
2. Validator produces structured JSON report with pass/warning/error counts
3. Compiler produces WAV files + manifest.json for target platform
4. Dry-run shows decisions without writing files
5. Build hashes enable deterministic build verification

**Reference PRDs:** `COMPILER_PRD.md`, `VALIDATOR_PRD.md`

---

## Demo 13: Visualizer & Haptics -- Cross-Modal Output

**Prerequisite Demos:** 9, 10

**New Modules:** Visualizer, Haptics, Palette

**Goal:** Extend ToneForge beyond audio. The Visualizer generates deterministic, audio-synchronized visual effects. Haptics produces tactile feedback patterns. Palettes coordinate the aesthetic across all outputs.

**What the User Sees:**

Web demo with a visual canvas:

```
> palette.set("sci_fi_neon")
  [Palette: sci_fi_neon loaded -- blue/cyan tones, sharp motion, high contrast]

> runtime.play("weapon-laser-zap", { seed: 42, visual: true, haptic: true })
  [Audio: laser zap plays]
  [Visual: cyan directional streak, 150ms, intensity matches audio peak]
  [Haptic: sharp pulse, 50ms, intensity=0.8]

> runtime.play("ui-scifi-confirm", { seed: 42, visual: true })
  [Audio: UI confirm plays]
  [Visual: radial pulse, blue glow, 200ms]

> palette.set("organic_forest")
  [Palette: organic_forest loaded -- green/brown tones, soft motion, low contrast]

> runtime.play("footstep-stone", { seed: 42, visual: true, haptic: true })
  [Audio: footstep plays]
  [Visual: subtle ground ripple, earth tones, 100ms]
  [Haptic: soft thump, 30ms, intensity=0.4]

# Export visual effects as sprite sheets
> toneforge visualize export --recipe weapon-laser-zap --seed 42 \
    --format spritesheet --frames 8 --output ./vfx/
```

**New CLI Commands:**
- `toneforge visualize export --recipe <r> --seed <n> --format <f> --output <dir>`
- Palette and haptic configuration via REPL or preset files

**Key Proof Points:**
- Same seed produces the same visual -- deterministic VFX generation
- Audio, visual, and haptic outputs are perceptually aligned
- Palettes provide coherent aesthetic control across all modalities
- Visual assets can be pre-rendered for use in engines without runtime overhead

**Acceptance Criteria:**
1. Visualizer produces animated effects synchronized to audio events
2. Haptic patterns match audio intensity and timing
3. Palette changes visually and perceptually alter all outputs
4. Sprite sheet export produces usable game assets
5. All outputs are deterministic for the same seed and palette

**Reference PRDs:** `VISUALIZE_PRD.md`, `HAPTICS_PRD.md`, `PALLETE_PRD.md`

---

## Demo 14: Intent & Memory -- Human-Centered Guidance

**Prerequisite Demos:** 11

**New Modules:** Intent, Memory

**Goal:** Demonstrate structured human goal representation and long-term experiential recall. Intent translates high-level directives ("make combat punchier") into actionable Intelligence queries. Memory tracks how assets are used, evaluated, and evolved over time.

**What the User Sees:**

```bash
# Submit a structured intent
toneforge intent submit --goal "reduce repetition in footstep sounds" \
  --scope footsteps
# Output:
#   Intent submitted: reduce_repetition (scope: footsteps)
#   Intelligence analysis:
#     - Current footstep library has 12 entries from 2 clusters
#     - Recommendation: expand seed range and add 2 surface materials
#     - Suggested command: toneforge explore --recipe footstep-stone --seed-range 5000:15000 --keep-top 30
#   [Awaiting approval]

> approve
  [Running exploration...]

# Query memory for historical context
toneforge memory query --scope "weapon sounds" --time-range "last 30 days"
# Output:
#   Memory Report: weapon sounds (last 30 days)
#   - 24 weapon sounds generated, 6 promoted to library
#   - Most-used seed: 4821 (played 47 times in demos)
#   - Rejected intents: "make all weapons louder" (reason: would clip)
#   - Quality trend: average peak 0.82 -> 0.88 (improving)
#   - Recurring issue: spectral similarity between seeds 4821 and 7234

# Memory informs intelligence recommendations
toneforge intelligence recommend --use-case "combat variety pack" --use-memory
# Output includes: "Based on 30 days of usage, seed 4821 is overrepresented.
#   Consider substituting seed 3901 (similar profile, different cluster)."
```

**New CLI Commands:**
- `toneforge intent submit --goal <desc> --scope <scope>`
- `toneforge memory query --scope <desc> --time-range <range>`
- `--use-memory` flag on intelligence commands

**Key Proof Points:**
- High-level goals translate into concrete, executable actions
- Memory prevents repeating mistakes and surfaces patterns humans miss
- Intent -> Intelligence pipeline maintains human approval at every step
- Historical data improves recommendation quality over time

**Acceptance Criteria:**
1. Intent submission produces an Intelligence analysis with actionable suggestions
2. No action executes without human approval
3. Memory records generation, promotion, and rejection events
4. Memory queries return time-scoped, scope-filtered reports
5. Intelligence recommendations improve when memory data is available

**Reference PRDs:** `INTENT_PRD.md`, `MEMORY_PRD.md`

---

## Demo 15: Network & Integrations -- Distributed & Embedded

**Prerequisite Demos:** 9, 12

**New Modules:** Network, Integrations

**Goal:** Demonstrate ToneForge operating across multiple clients in sync and embedded within external tools. Network replicates behavioral events (not audio streams) for deterministic multi-client playback. Integrations show ToneForge driving sound in a CI pipeline and exporting to game engine formats.

**What the User Sees:**

**Network (two browser windows side by side):**
```
# Window A (Host):
> network.host({ port: 7890 })
> state.set("movement", "walk")
  [Local: footsteps playing]
  [Network: broadcast state change to 1 peer]

# Window B (Client):
> network.join("localhost:7890")
  [Connected to host]
  [Received: state.movement = walk]
  [Local: footsteps playing -- deterministically identical to host]

# Window A:
> state.set("movement", "run")
  [Local: transition walk -> run]
  [Network: broadcast]

# Window B:
  [Received: state.movement = run]
  [Local: transition walk -> run -- synchronized]
```

**Integrations (CI pipeline):**
```bash
# In a CI/CD pipeline (e.g., GitHub Actions)
toneforge generate --library ui --seed-range 1:100 --output ./build/audio/
toneforge validate --library ./build/audio/ --ruleset ci --strictness error
toneforge compile --library ./build/audio/ --target web --output ./dist/audio/

# Export for Unity (metadata mapping)
toneforge sync --target unity --library ./library --output ./unity-project/Assets/Audio/
```

**Key Proof Points:**
- Network sync uses behavioral events (~50 bytes each), not audio streams (~1 MB/s)
- Determinism guarantees identical playback on all clients from the same events
- CI integration enables automated sound generation, validation, and packaging
- Engine adapters map ToneForge categories to platform-specific audio groups

**Acceptance Criteria:**
1. Two clients play the same sound sequence from shared behavioral events
2. Network bandwidth is under 1 KB/s for typical gameplay
3. CI pipeline validates, compiles, and exports without manual intervention
4. Unity/web export produces platform-appropriate file structure
5. Late-join clients receive state snapshot and sync correctly

**Reference PRDs:** `NETWORK_PRD.md`, `INTEGRATIONS_PRD.md`

---

## Demo 16: Marketplace -- Asset Exchange

**Prerequisite Demos:** 12, 15

**New Modules:** Marketplace

**Goal:** Demonstrate publishing and consuming ToneForge assets through a marketplace. Assets are procedural systems (recipes, stacks, sequences, palettes), not static audio files -- buyers get infinite variation from a single purchase.

**What the User Sees:**

```bash
# Browse marketplace listings
toneforge marketplace search --category "sci-fi weapons"
# Output:
#   Marketplace Results: "sci-fi weapons"
#   1. industrial_lasers@2.1.0 by @sound_labs
#      3 recipes, 2 stacks, 1 sequence, 1 palette
#      Rating: 4.8/5 (142 reviews)
#      License: Commercial, royalty-free
#
#   2. retro_blasters@1.0.3 by @pixel_audio
#      5 recipes, 4 stacks, 2 sequences
#      Rating: 4.2/5 (38 reviews)
#      License: CC-BY-SA

# Install a package
toneforge marketplace install industrial_lasers@2.1.0
# Output:
#   Downloading industrial_lasers@2.1.0...
#   Validating package integrity... PASS
#   Installing: 3 recipes, 2 stacks, 1 sequence, 1 palette
#   Registered recipes: il-heavy-cannon, il-rapid-pulse, il-charge-beam
#   Done. Run `toneforge list recipes` to see new entries.

# Use the installed recipes
toneforge generate --recipe il-heavy-cannon --seed 42
toneforge stack render --preset industrial_lasers/cannon_blast.json --seed 42 --output ./cannon.wav

# Publish your own package
toneforge marketplace publish --package ./my-recipes/ --name "organic_footsteps" --version 1.0.0
# Output:
#   Validating package... PASS (3 recipes, 5 presets, all deterministic)
#   Publishing organic_footsteps@1.0.0...
#   Published. URL: https://marketplace.toneforge.dev/organic_footsteps
```

**New CLI Commands:**
- `toneforge marketplace search --category <c>`
- `toneforge marketplace install <package>@<version>`
- `toneforge marketplace publish --package <dir> --name <n> --version <v>`

**Key Proof Points:**
- Marketplace assets are procedural systems, not static files -- infinite variation from a single package
- Validator gates publishing -- no broken or invalid assets reach the marketplace
- Semantic versioning ensures compatibility
- Installed recipes integrate seamlessly with the local registry

**Acceptance Criteria:**
1. Search returns relevant packages with metadata (recipes, stacks, ratings, license)
2. Install adds recipes to the local registry and they work immediately
3. Publish validates the package before uploading
4. Installed packages maintain determinism (same seed = same output)
5. Version conflicts are detected and reported

**Reference PRDs:** `MARKETPLACE_PRD.md`

---

## Demo Dependency Graph

```
Demo 0 (MVP)
  ├── Demo 1 (Recipe Variety)
  │     └── Demo 2 (WAV Export & Hybrids)
  │           ├── Demo 3 (Stacking)
  │           │     └── Demo 8 (Sequencer) ──┐
  │           └── Demo 4 (Analyze)           │
  │                 ├── Demo 5 (Classify)    │
  │                 │     └── Demo 6 (Explore)
  │                 │           └── Demo 7 (Library)
  │                 │                 ├── Demo 8 (Sequencer)
  │                 │                 │     └── Demo 9 (Runtime+State+Context)
  │                 │                 │           ├── Demo 10 (Mixer)
  │                 │                 │           ├── Demo 13 (Visualizer+Haptics+Palette)
  │                 │                 │           └── Demo 15 (Network+Integrations)
  │                 │                 ├── Demo 11 (Intelligence)
  │                 │                 │     ├── Demo 12 (Compiler+Validator)
  │                 │                 │     │     └── Demo 15 ──┐
  │                 │                 │     │           └── Demo 16 (Marketplace)
  │                 │                 │     └── Demo 14 (Intent+Memory)
  │                 │                 └── Demo 12
```

## Implementation Priority

| Phase | Demos | Focus | Estimated Effort |
|-------|-------|-------|-----------------|
| **Foundation** | 0, 1, 2 | Core recipe system, WAV export, sample-hybrids | 0 done, 1-2 small |
| **Composition** | 3, 4, 5 | Stacking, analysis, classification | Medium each |
| **Discovery** | 6, 7 | Exploration at scale, persistent library | Medium-large each |
| **Behavior** | 8, 9, 10 | Sequencing, real-time runtime, mixing | Large each |
| **Intelligence** | 11, 14 | Reasoning layer, intent, memory | Medium-large each |
| **Production** | 12, 13 | Compilation, validation, cross-modal output | Medium each |
| **Distribution** | 15, 16 | Networking, integrations, marketplace | Large each |

---

## Notes

- Each demo is designed to be self-contained -- it should be runnable and compelling on its own, not just a stepping stone.
- Demo scripts should follow the narrative style established by `demos/mvp-1.md` -- problem statement, then live solution. See `demos/README.md` for the markdown demo convention.
- Web demo versions should be considered for each demo where interactive visualization adds value (especially Demos 9, 10, 13, 15).
- The `MASS_GENERATION_PRD.md` capabilities are distributed across Demos 2 (batch generation), 6 (exploration at scale), and 7 (library management) rather than being a standalone demo.
- The `LAYERING_PRD.md` capabilities are subsumed by Demo 3 (Stacking), which represents the evolved version of the layering concept.
