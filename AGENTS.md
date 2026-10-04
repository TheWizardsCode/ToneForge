## Global agent guidance

Read the global agent instructions at `~/.pi/agent/AGENTS.md` — they define the core principles, the Worklog (wl) work-item workflow, and the coding disciplines that apply to every project.

## Project-specific guidance

(project-specific rules are added by the project owner here, never by copying the global file)

### Branching & releases

- Feature work targets the `dev` integration branch; `main` is the release branch and is never pushed to directly.
- Automated `dev` → `main` promotion: `/skill:ship release`.
- See [docs/dev/release-process.md](docs/dev/release-process.md) for the branch model, manual fallback, and operational notes.
