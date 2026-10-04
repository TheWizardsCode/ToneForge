# Release Process

ToneForge uses a two-branch integration model so that feature work is reviewed
and validated on `dev` before it is promoted to the release branch `main`.

## Branch model

| Branch | Role | Rules |
|--------|------|-------|
| `main` | Release branch. Always reflects the latest released state. | Never push directly — changes land only via a `dev` → `main` release PR. |
| `dev` | Integration branch. All completed feature work is pushed here. | Feature branches (below) are pushed into `dev`; `dev` is not protected. |
| `wl-<work-item-id>-<slug>` | Short-lived feature branch, one per work item. | Created and pushed by the implement workflow; never merged directly to `main`. |

## Feature work (work item → `dev`)

1. `/skill:implement <work-item-id>` claims the item, creates a git worktree from
   `dev`, and works on a `wl-<work-item-id>-<slug>` branch.
2. Build, run the tests, then commit (build → test → commit order).
3. Push the feature branch into `dev`:

   ```bash
   git push origin HEAD:refs/heads/dev
   ```

   The ship skill helper `pushToDev()` (`~/…/skills/ship/scripts/ship.js`) does
   the same. Pushing the feature branch into `dev` is pre-authorised by the
   implement workflow; pushing to `main`/`master`/`HEAD` is not.

4. The work item moves to `in_review` and stays there until the next release.

## Releases (`dev` → `main`)

Run the canonical automated release:

```bash
node $(skill_path ship)/scripts/run-release.js
```

It performs the gating checks (unmerged branches, audit readiness, critical
items, worklog refs, producer review, final validation), creates a
`release/dev-to-main-<timestamp>` branch from `origin/main`, merges `origin/dev`
into it, bumps `package.json`, generates `CHANGELOG.md`, opens a PR to `main`,
merges it, tags `v<semver>`, and closes the shipped work items. `CHANGELOG.md` is
owned by the release pipeline — do not hand-edit it.

## Manual fallback

Use only when the automated script is unavailable or the operator explicitly
requests a manual promotion:

```bash
git fetch origin
git checkout -b release/dev-to-main-$(date -u +%Y%m%d%H%M%S) origin/main
git merge --no-ff origin/dev
git push origin HEAD
# open a PR to main, wait for checks, then merge
```

After a successful promotion, sync `dev` back to `main`:

```bash
git checkout dev && git merge origin/main && git push origin dev
```

## Operational notes

- **Worklog pre-push sync:** the `pre-push` hook runs `wl sync`. If it fails on
  an author-identity gate, the documented bypass is
  `WORKLOG_SKIP_PRE_PUSH=1 git push …`; run `wl sync` later from the main
  checkout.
- **Clean tree:** the release wrapper refuses to run with a dirty working tree.
  Keep generated files (e.g. `package-lock.json`) committed so the checkout is
  clean before releasing.
