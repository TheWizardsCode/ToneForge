Perfect—this is exactly the right moment to **turn the question cloud into an actionable research map**. Below is a **module‑by‑module mapping** of the earlier questions, framed as **research prompts per subsystem**. This lets you:

- assign investigation ownership
- identify architectural risk hotspots
- sequence design work intelligently
- avoid cross‑module ambiguity

I’ve deliberately **over‑mapped** some questions where they expose coupling risks.

---

## 🧠 ToneForge Core (Generation)

**Primary Research Questions**
- What is the irreducible unit of sound generation in ToneForge?
- Where does determinism absolutely matter, and where can variation exist safely?
- How do you represent silence, noise, and texture as first‑class outputs?
- How do you ensure generated sound remains inspectable and reproducible years later?
- What assumptions about synthesis or sampling are baked in unintentionally?

**Risk Signals**
- Over‑coupling with Stack or Sequencer
- Hidden randomness leaking into downstream systems

---

## 🧩 ToneForge Stack (Event Composition)

**Primary Research Questions**
- What distinguishes a “sound event” from a “sound asset”?
- How deep can stacking go before it becomes unreasonably complex?
- How do you debug a stack that sounds wrong but is technically valid?
- How do you represent negative space or absence within a stack?
- How do stacks degrade gracefully under performance pressure?

**Risk Signals**
- Stack becoming a mini‑DAW
- Stack logic leaking into Sequencer or Mixer

---

## ⏱️ ToneForge Sequencer (Temporal Behavior)

**Primary Research Questions**
- What is the smallest meaningful unit of time ToneForge reasons about?
- How does Sequencer differ philosophically from a timeline?
- How do you model anticipation, hesitation, or irregular rhythm?
- How do you detect repetition fatigue automatically?
- How do you debug bugs that only appear after long runtimes?

**Risk Signals**
- Sequencer becoming stateful in unintended ways
- Temporal logic bleeding into Runtime or Mixer

---

## 🔁 ToneForge State (Behavioral Mode)

**Primary Research Questions**
- What is the practical difference between state and context?
- How many states are too many?
- How do you prevent state explosion?
- How do you visualize state transitions clearly?
- When should state transitions be suppressed or delayed?

**Risk Signals**
- State becoming a dumping ground for logic
- Implicit transitions causing non‑determinism

---

## 🌍 ToneForge Context (Situational Truth)

**Primary Research Questions**
- What context dimensions are universal vs project‑specific?
- How do you handle missing or conflicting context?
- When should context override state—and when should it not?
- How do you prevent context from becoming a giant switch statement?
- How do you test context‑driven behavior automatically?

**Risk Signals**
- Context becoming implicit or magical
- Context logic duplicated across modules

---

## 🎨 ToneForge Visualizer (Audio‑Driven VFX)

**Primary Research Questions**
- What does perceptual alignment between sound and visuals actually mean?
- How do you scale visuals from icon‑level to full‑screen without losing intent?
- How do you prevent visuals from lying about sound intensity?
- How do you degrade visuals gracefully on low‑power platforms?
- How do you test visual correctness without human eyes?

**Risk Signals**
- Visualizer becoming a general VFX tool
- Visual logic diverging from audio behavior

---

## 🎚️ ToneForge Mixer (Behavior‑Aware Arbitration)

**Primary Research Questions**
- What does “too much” mean in a procedural system?
- How do you arbitrate between competing behaviors under load?
- When should the mixer suppress behavior entirely?
- How do you prevent priority systems from becoming brittle?
- How do you expose mixing decisions without overwhelming users?

**Risk Signals**
- Mixer becoming reactive instead of intentional
- Hidden automation undermining trust

---

## 📳 ToneForge Haptics (Tactile Feedback)

**Primary Research Questions**
- When should haptics reinforce sound vs replace it?
- How do you prevent haptics from becoming noise?
- How do you scale feedback across wildly different devices?
- How do you avoid sensory fatigue over long sessions?
- How do you synchronize haptics with audio under latency?

**Risk Signals**
- Device‑specific logic leaking upward
- Haptics overwhelming accessibility goals

---

## 🎨 ToneForge Palette (Style System)

**Primary Research Questions**
- How do you encode style without hard‑coding aesthetics?
- How do palettes prevent sameness without encouraging chaos?
- How do you support multiple styles coexisting in one project?
- How do you detect aesthetic drift?
- How do palettes interact with accessibility constraints?

**Risk Signals**
- Palette becoming cosmetic instead of structural
- Style logic duplicated in Visualizer or Mixer

---

## 🧠 ToneForge Intelligence (Reasoning Layer)

**Primary Research Questions**
- What is the smallest useful unit of recommendation?
- How do you explain *why* a suggestion exists?
- How do you prevent intelligence from feeling intrusive?
- How do you ground suggestions in historical evidence?
- How do you detect when intelligence should stay silent?

**Risk Signals**
- Intelligence bypassing human intent
- Opaque reasoning eroding trust

---

## 🧠 ToneForge Memory (Long‑Term Recall)

**Primary Research Questions**
- What is worth remembering vs noise?
- How do you prevent memory from encoding bad habits?
- How do you forget intentionally?
- How do you surface long‑term patterns without overwhelming users?
- How do you scope memory safely across projects and teams?

**Risk Signals**
- Memory becoming telemetry soup
- Memory influencing behavior implicitly

---

## 🎯 ToneForge Intent (Human Direction)

**Primary Research Questions**
- What is the smallest useful unit of intent?
- How do you prevent intent from becoming vague wish‑casting?
- How do you resolve conflicting intents?
- How do you trace intent → suggestion → outcome?
- How do you support intent in CI or automation contexts?

**Risk Signals**
- Intent bypassing validation
- Intent becoming natural‑language ambiguity

---

## 🧱 ToneForge Compiler (Shipping & Optimization)

**Primary Research Questions**
- When should something stay procedural forever?
- What are the hidden costs of baking too early?
- How do you reason about performance budgets holistically?
- How do you ensure builds are reproducible years later?
- How do you communicate compiler decisions transparently?

**Risk Signals**
- Compiler making irreversible creative decisions
- Platform logic leaking into authoring

---

## ✅ ToneForge Validator (Safety & QA)

**Primary Research Questions**
- What does “correct” mean in a creative system?
- Which failures should block shipping vs warn?
- How do you validate behavior, not just assets?
- How do you prevent validation rules from calcifying creativity?
- How do you version validation rules safely?

**Risk Signals**
- Validator becoming punitive
- Validation logic diverging from runtime reality

---

## 🌐 ToneForge Network (Synchronization)

**Primary Research Questions**
- What does “synchronized” mean perceptually?
- How much divergence is acceptable before users notice?
- How do you handle late joins gracefully?
- How do you debug desync that only affects sound?
- How do you reconcile local context with shared state?

**Risk Signals**
- Network logic leaking into design logic
- Over‑synchronization killing variation

---

## 🛒 ToneForge Marketplace (Ecosystem)

**Primary Research Questions**
- What makes a procedural asset reusable across projects?
- How do you prevent marketplace bloat?
- How do you encode trust and quality signals?
- How do you handle dependency hell gracefully?
- How do you sunset assets responsibly?

**Risk Signals**
- Marketplace becoming a sample store
- Versioning chaos undermining determinism

---

## 🧭 Cross‑Module “Red Flag” Questions

These should be revisited **every time a module changes**:

- Where is logic duplicated across modules?
- Where is behavior implicit instead of explicit?
- Where could a new contributor misunderstand intent?
- Where does determinism quietly erode?
- Where would debugging be hardest six months from now?

---

### Suggested Next Step
If you want, I can:
- turn this into a **prioritized research backlog**
- map **module dependencies and risk order**
- or identify **which 10 questions unlock the most architectural clarity first**

This is the point where ToneForge stops being “ambitious” and starts being **inevitable**.
