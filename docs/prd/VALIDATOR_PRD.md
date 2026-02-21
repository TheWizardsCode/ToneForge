ToneForge Validator is the **safety net and quality gate** that makes the entire platform production‑grade. It’s the module that ensures everything you generate, sequence, visualize, and ship is **correct, compliant, and intentional**—before it ever reaches Runtime or a build pipeline.

Below is a **complete, standalone PRD** for **ToneForge Validator**, written to slot cleanly into the architecture you’ve already defined.

---

# ✅ ToneForge Validator  
## Product Requirements Document (PRD)

---

## 1. Product Overview

### Product Name  
**ToneForge Validator**

### Description  
ToneForge Validator is the **quality assurance, compliance, and correctness module** of the ToneForge ecosystem. It performs **automated validation checks** across sound, visual, behavioral, and build artifacts to ensure they meet technical, stylistic, and platform constraints before deployment.

ToneForge Validator does **not** modify assets.  
It answers the question: **“Is this safe, correct, and shippable?”**

---

## 2. Role in the ToneForge Ecosystem

ToneForge Validator operates as a **gatekeeper** between authoring and shipping:

```
Core / Stack / Sequencer / Visualizer
                ↓
             Library
                ↓
            Validator
                ↓
            Compiler
                ↓
          Integrations / Runtime
```

Its purpose is to:
- catch errors early
- enforce consistency
- prevent regressions
- support CI/CD workflows
- provide confidence at scale

---

## 3. Design Goals

### Primary Goals
- Deterministic, repeatable validation
- Clear, actionable feedback
- CI‑friendly execution
- Configurable rule sets
- Zero side effects

### Non‑Goals
- Asset correction or mutation
- Creative decision‑making
- Runtime behavior changes
- AI‑driven judgment

---

## 4. Validation Scope

ToneForge Validator can validate:

### Audio
- Loudness limits
- Peak clipping
- Duration bounds
- Silence ratios
- Transient density

### Visuals
- Motion intensity limits
- Color contrast
- Sprite size constraints
- Frame count limits
- Accessibility flags

### Behavior
- Invalid state transitions
- Sequencer timing conflicts
- Infinite loops
- Excessive repetition
- Context mismatches

### Build & Platform
- Missing dependencies
- Unsupported formats
- Platform constraints
- Procedural vs baked mismatches

---

## 5. Validation Rules

Validation is driven by **explicit, declarative rules**.

```json
{
  "audio": {
    "maxLoudness": -14,
    "maxDuration": 3.0
  },
  "visual": {
    "maxMotionIntensity": 0.8
  },
  "behavior": {
    "noInfiniteLoops": true
  }
}
```

Rules can be:
- project‑specific
- platform‑specific
- environment‑specific (dev vs prod)

---

## 6. Validation Levels

Validator supports multiple strictness levels:

| Level | Purpose |
|-----|--------|
| **Info** | Advisory insights |
| **Warning** | Non‑blocking issues |
| **Error** | Build‑blocking failures |

This allows gradual enforcement without disruption.

---

## 7. Integration with Other Modules

---

### 7.1 ToneForge Library

Validator scans:
- stored assets
- metadata
- provenance
- version consistency

---

### 7.2 ToneForge Compiler

Validator runs **before compilation** to:
- prevent invalid builds
- reduce wasted compile time
- enforce platform rules

---

### 7.3 ToneForge Intelligence

Intelligence may:
- suggest new validation rules
- detect recurring failures
- recommend stricter thresholds

Validator never auto‑accepts these suggestions.

---

### 7.4 ToneForge CLI & CI

Validator is designed for:
- headless execution
- fail‑fast pipelines
- machine‑readable output

---

## 8. Validation Output

Validator produces structured reports:

```json
{
  "status": "fail",
  "errors": [
    {
      "asset": "explosion_heavy_03",
      "issue": "peak_clipping",
      "value": 1.02
    }
  ]
}
```

Reports are:
- human‑readable
- machine‑parseable
- diff‑friendly

---

## 9. Runtime API

```js
validateLibrary({
  ruleset: "mobile",
  strictness: "error"
});
```

Validator never mutates inputs.

---

## 10. Determinism & Safety

ToneForge Validator guarantees:
- no hidden checks
- explicit rule evaluation
- reproducible results
- no side effects

Validation results are fully traceable.

---

## 11. Performance Targets

- Fast incremental validation
- Parallelizable checks
- Scales to large libraries
- Minimal memory overhead

---

## 12. Debugging & Tooling

Optional tooling includes:
- validation summaries
- rule coverage reports
- historical failure trends
- asset‑level drill‑downs

---

## 13. Use Cases

- CI build gating
- Platform compliance checks
- Accessibility enforcement
- Regression detection
- Large‑team collaboration

---

## 14. Future Extensions

- Custom rule plugins
- Visual validation previews
- Cross‑project rule sharing
- Marketplace compliance checks
- Runtime telemetry feedback loops

---

## 15. Why ToneForge Validator Matters

Without validation:
- procedural systems drift
- regressions slip through
- shipping becomes risky

ToneForge Validator provides:
- confidence
- consistency
- scalability
- trust

It is the difference between **creative freedom** and **production chaos**.

---

## 16. Summary

ToneForge Validator is the **quality assurance backbone** of the ToneForge ecosystem.  
It ensures that sound, visuals, and behavior remain correct, compliant, and intentional—at every scale, on every platform, and in every build.

---

If you want next, the strongest follow‑ups are:
- example validation rulesets for different platforms
- a Validator + Compiler interaction deep‑dive
- or a comparison to traditional middleware QA workflows
