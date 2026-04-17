---
title: 'chore: Git branch and stash audit'
type: refactor
status: active
date: 2026-04-16
---

# chore: Git branch and stash audit

## Overview

28 local branches and 7 stashes have accumulated. This plan establishes which to delete, which to keep, and the safe order of operations. No code changes — purely git state cleanup.

## Problem Frame

Git's `--merged` / `--no-merged` flags only check whether commits exist in `main`'s history — they cannot tell us whether an apparently "unmerged" branch was actually squash-merged (the code landed but the branch commits aren't ancestors of main). Several branches also have remote counterparts (`origin/feature/...`) that may already be merged there. Manual judgment is needed before deleting anything with commits ahead of main.

## Scope Boundaries

- Only local branches and stashes in `/Volumes/SSD/Dev/Apps/Knowlune`
- Remote branches on `origin` are **not** deleted here (separate concern)
- No code changes, no rebases, no squash operations

---

## Audit Findings

### Stashes (7 total)

| #           | Branch context                     | Files changed      | Assessment                                                                                       |
| ----------- | ---------------------------------- | ------------------ | ------------------------------------------------------------------------------------------------ |
| `stash@{0}` | `feature/library-visual-polish`    | 8 files, 204+/134− | **Inspect** — substantial WIP in library components; branch has no remote. Could be useful work. |
| `stash@{1}` | `main` — "WIP before E62-S04"      | 1 file, 1 line     | **Drop** — trivial, context is gone                                                              |
| `stash@{2}` | `main` — "WIP before E114-S01"     | 0 files (empty)    | **Drop** — empty stash                                                                           |
| `stash@{3}` | `main` — "WIP before E110-S03"     | 1 file, 1 line     | **Drop** — trivial, context is gone                                                              |
| `stash@{4}` | `chore/epic-runner-rewrite`        | 1 file, 36 lines   | **Drop** — epic-runner branch still exists locally; stash is redundant                           |
| `stash@{5}` | `chore/epic-runner-rewrite`        | 1 file, 150 lines  | **Inspect** — larger WIP on the epic-runner rewrite branch                                       |
| `stash@{6}` | `feature/e110-s02-series-grouping` | 0 files (empty)    | **Drop** — empty stash                                                                           |

---

### Local branches — merged into main (12)

Git confirms these are ancestors of `main`. Safe to delete with no data loss.

| Branch                                           | Action                                   |
| ------------------------------------------------ | ---------------------------------------- |
| `chore/epic-runner-rewrite`                      | Delete (after reviewing stash@{5} above) |
| `feature/e107-s03-fix-toc-loading-and-fallback`  | Delete                                   |
| `feature/e107-s04-wire-about-book-dialog`        | Delete                                   |
| `feature/e107-s06-fix-mini-player-interactivity` | Delete                                   |
| `feature/e108-s02-format-badges-and-delete`      | Delete                                   |
| `feature/e110-s01-smart-shelves`                 | Delete                                   |
| `feature/e110-s02-series-grouping`               | Delete                                   |
| `feature/e114-s02-continuous-scroll-mode`        | Delete                                   |
| `feature/e115-s01-custom-reading-challenges`     | Delete                                   |
| `feature/e73-s03-quiz-prompt-score-tracker`      | Delete                                   |
| `feature/e87-s05-mini-player-and-media-session`  | Delete                                   |
| `feature/settings-ui-redesign`                   | Delete                                   |

---

### Local branches — NOT merged into main (20)

These have commits ahead of `main`. Subdivided by risk level.

#### Group A — 1 commit ahead, remote exists on origin (likely squash-merged, safe to delete)

These branches are 1 commit ahead of `main` and have a remote counterpart, which is the classic signature of a squash-merge workflow: the PR was merged on origin as a squash commit that isn't an ancestor of local main, but the work landed.

Verify by checking: does `origin/main` contain the substance of the branch's single commit?

| Branch                                               | Remote on origin? | Commits ahead |
| ---------------------------------------------------- | ----------------- | ------------- |
| `feature/e107-s05-sync-reader-themes`                | ✓                 | 1             |
| `feature/e107-s07-fix-m4b-cover-preview`             | ✓                 | 1             |
| `feature/e108-s01-bulk-epub-import`                  | ✓                 | 1             |
| `feature/e108-s03-keyboard-shortcuts`                | ✓                 | 1             |
| `feature/e108-s05-genre-detection-pages-goal`        | ✓                 | 1             |
| `feature/e109-s01-vocabulary-builder`                | ✓                 | 1             |
| `feature/e111-s01-audio-clips`                       | ✓                 | 1             |
| `feature/e73-s02-eli5-mode`                          | ✓                 | 1             |
| `feature/review-story-refactor-structured-contracts` | check             | 1             |

**Verification command for each:**

```
git log --oneline main...<branch> | head -3
git log --oneline origin/main | head -20  # look for equivalent commit
```

#### Group B — multiple commits ahead, remote exists on origin (likely completed stories, safe to delete after spot-check)

These have multiple commits but all have remote counterparts. Stories E62 and E109 completed a full epic run — their work should be in `origin/main`.

| Branch                                                            | Remote | Commits ahead | Notes                   |
| ----------------------------------------------------------------- | ------ | ------------- | ----------------------- |
| `feature/e109-s02-daily-highlight-review`                         | ✓      | 4             | Story finished          |
| `feature/e109-s03-highlight-export`                               | ✓      | 3             | Story finished          |
| `feature/e109-s04-annotation-summary`                             | ✓      | 3             | Story finished          |
| `feature/e62-s01-fsrs-retention-aggregation-score-integration`    | ✓      | 11            | Epic E62 finished       |
| `feature/e62-s02-retention-gradient-treemap-decay-predictions-ui` | ✓      | 16            | Epic E62 finished       |
| `feature/e62-s03-unit-tests-fsrs-retention-scoring`               | —      | 4             | No remote — **inspect** |
| `feature/e62-s04-e2e-tests-knowledge-map-fsrs`                    | ✓      | 14            | Epic E62 finished       |

**Verification:** `git fetch origin && git log --oneline HEAD...origin/main` on each should show 0 net-new functional commits (or commits already present on origin/main).

#### Group C — no remote, multiple commits ahead (requires manual review)

These branches have unique local commits that aren't on origin. Do not delete without reading the commit log.

| Branch                                        | Remote            | Commits ahead | Risk                                                                              |
| --------------------------------------------- | ----------------- | ------------- | --------------------------------------------------------------------------------- |
| `feature/e104-s01-link-formats-dialog`        | ✓ (remote exists) | 17            | Has remote — may be an abandoned WIP story. Read commit titles.                   |
| `feature/e111-s03-sleep-timer-end-of-chapter` | check             | 2             | Small — check commit titles                                                       |
| `feature/fix-epub-reader-blank-screen`        | check             | 4             | Bug fix — may contain unreleased work                                             |
| `feature/library-visual-polish`               | **no remote**     | 4             | **High risk** — no remote, stash@{0} is from this branch. Review before deleting. |

---

## Implementation Units

- [ ] **Unit 1: Inspect the 2 flagged stashes**

  **Goal:** Decide whether stash@{0} (library-visual-polish, 8 files) and stash@{5} (epic-runner, 150 lines) contain anything worth keeping.

  **Approach:**
  - `git stash show -p stash@{0}` — read the diff; check if this work was superseded by the multi-provider metadata search feature (the library files it touches — `BookMetadataEditor.tsx`, `BookCard.tsx` etc. — were heavily reworked in the just-merged branch)
  - `git stash show -p stash@{5}` — read the epic-runner diff; check if the `chore/epic-runner-rewrite` branch (now merged) already contains this work
  - Decision: drop both if superseded; otherwise create a branch from the stash before deleting

  **Verification:** Clear decision recorded for each: "drop" or "save as branch `chore/stash-recovery-<name>`"

- [ ] **Unit 2: Drop the 5 trivial/empty stashes**

  **Goal:** Remove stash@{1}, @{2}, @{3}, @{4}, @{6} — confirmed trivial or empty.

  **Approach:** Drop in reverse index order to avoid index shifting (drop @{6} first, then @{4}, @{3}, @{2}, @{1}).

  **Verification:** `git stash list` shows only stash@{0} (and @{5} if kept pending Unit 1 decision)

- [ ] **Unit 3: Delete the 12 merged local branches**

  **Goal:** Remove all branches that `git branch --merged main` confirmed are ancestors of main.

  **Approach:** `git branch -d <branch>` for each (safe delete — git will refuse if not merged).

  **Verification:** `git branch --merged main` returns only `main`

- [ ] **Unit 4: Verify and delete Group A branches (1 commit ahead, remote exists)**

  **Goal:** Confirm these are squash-merged stories, then delete.

  **Approach:** For each branch, run `git log --oneline main...<branch>` and visually confirm the single commit matches work visible in `git log origin/main`. If confident, `git branch -D <branch>` (force-delete needed since git sees them as unmerged).

  **Verification:** All 9 branches deleted; `git log origin/main` still shows their work

- [ ] **Unit 5: Verify and delete Group B branches (multiple commits, remote exists)**

  **Goal:** Confirm E62 and E109 story branches are fully landed on origin/main, then delete.

  **Approach:**
  - `git fetch origin` to ensure local view of origin/main is current
  - For each branch: `git log --oneline <branch>...origin/main` — if all commits from the branch appear in origin/main's history (or as equivalent squashes), it's safe to delete
  - `feature/e62-s03-unit-tests-fsrs-retention-scoring` has no remote — read its commit log before deciding

  **Verification:** All Group B branches deleted or explicitly deferred with reason

- [ ] **Unit 6: Manual review of Group C branches**

  **Goal:** Make an informed keep/delete decision for the 4 high-risk branches.

  **Approach:**
  - `feature/e104-s01-link-formats-dialog` (17 commits, has remote): `git log --oneline main...<branch>` — are these commits already on origin/main via the remote branch? If origin has it, safe to delete locally.
  - `feature/e111-s03-sleep-timer-end-of-chapter` (2 commits): read commit titles — is this work in main?
  - `feature/fix-epub-reader-blank-screen` (4 commits): read commit titles — was the epub blank screen bug fixed and shipped?
  - `feature/library-visual-polish` (4 commits, **no remote**): read commit log; check if this work was superseded by the just-merged `feature/multi-provider-metadata-search`. The stash@{0} is from this branch — resolve Unit 1 first.

  **Verification:** Each branch either deleted or explicitly retained with a one-line reason

---

## Key Technical Decisions

- **`git branch -d` for merged, `-D` for unmerged**: `-d` is safe (refuses to delete if not merged). `-D` is needed for squash-merged branches where the commits aren't ancestors — use only after manual verification in Units 4–6.
- **Drop stashes in reverse index order**: `git stash drop stash@{6}` before `stash@{4}` etc. — indexes shift down as earlier entries are removed.
- **`feature/library-visual-polish` is highest risk**: no remote, non-trivial stash, 4 commits. Must be resolved before any bulk delete.

## Risks & Dependencies

| Risk                                   | Mitigation                                                  |
| -------------------------------------- | ----------------------------------------------------------- |
| Deleting a branch with unreleased work | Units 4–6 require reading commit logs before force-deleting |
| Stash index shifting during bulk drop  | Drop stashes in reverse order (highest index first)         |
| `library-visual-polish` work lost      | Resolve Unit 1 first; create recovery branch if needed      |
| `e62-s03` has no remote                | Read its commits before deleting in Unit 5                  |

## Sources & References

- Related code: `git branch --merged main`, `git branch --no-merged main`
- Stash stats: `git stash show --stat`
