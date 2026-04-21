---
title: "E96-S04 — YouTube Chapters Sync Evaluation (Docs-Only Closeout)"
type: chore
status: active
date: 2026-04-19
origin: docs/brainstorms/2026-04-19-e96-s04-youtube-chapters-sync-evaluation-requirements.md
---

# E96-S04 — YouTube Chapters Sync Evaluation (Docs-Only Closeout)

## Overview

E96-S01 deferred the `youtubeCourseChapters` table from P3/P4 Supabase migrations pending an explicit sync/no-sync decision. This story records that decision durably so future epics do not re-litigate it. The origin requirements document has already completed the audit and landed on **defer (wont-fix)**. This plan executes the mechanical closeout: a known-issues entry with re-open triggers, a sprint-status update, and a closeout commit. **No production code changes.**

## Problem Frame

The codebase has a local-only `youtubeChapters` Dexie store (`src/db/schema.ts:131`) that has been consistently excluded from every sync tier (E92-S02, E94-S02, E96-S01). The requirements audit (see origin) confirmed:

- The table is create-once, zero-mutation (single `bulkAdd` at `src/stores/useYouTubeImportStore.ts:352`; no update/delete paths).
- Content is deterministically derivable from already-synced upstream `importedCourses` + `importedVideos` + YouTube metadata.
- No post-import chapter editor exists; no authored cross-device state.
- Matches the precedent-following exclusion pattern used by `youtubeVideoCache`, `youtubeTranscripts`, `courseEmbeddings`, etc.

Without a written-down decision, future planners will re-audit. This story closes the loop.

## Requirements Trace

- R1. Durable decision document exists (already satisfied by the origin requirements file).
- R2. `docs/known-issues.yaml` has a `wont-fix` entry (`KI-E96-S04-L01`) with a one-paragraph rationale and the three concrete re-open triggers from the origin.
- R3. `docs/implementation-artifacts/sprint-status.yaml` flips `96-4-youtube-chapters-sync-evaluation` from `backlog` → `done` with a comment pointing to the closeout PR.
- R4. Closeout commit contains docs-only changes — no edits to `src/`, no migration SQL, no tableRegistry changes.
- R5. A future maintainer can read the known-issues entry and decide in under 2 minutes whether to re-open, without re-doing the audit (see origin: `docs/brainstorms/2026-04-19-e96-s04-youtube-chapters-sync-evaluation-requirements.md`, Success Criteria).

## Scope Boundaries

- No migration SQL for `youtube_course_chapters`.
- No `tableRegistry` entry for `youtubeChapters`.
- No changes to `src/db/schema.ts`, `src/stores/useYouTubeImportStore.ts`, or any sync engine files.
- No fix for the missing cascade-delete of chapters when an `importedCourse` is deleted (pre-existing bug, logged separately per origin).
- No change to the `videoId` FK shape (raw YouTube ID string; acceptable for local-only design).

### Deferred to Separate Tasks

- Missing cascade-delete on `importedCourses` → `youtubeChapters`: origin explicitly carves this out to a separate known-issues entry. This plan does not create that entry (the origin says "log separately"; interpret as a distinct follow-up outside this story's deliverables). If the reviewer prefers to batch it, it can be appended as `KI-E96-S04-L02` during implementation without changing the overall shape of this plan.

## Context & Research

### Relevant Code and Patterns

- Known-issues format precedent: `docs/known-issues.yaml:1099` onwards — recent entries (`KI-E93-S02-L01`, `KI-E95-S04-L01`, `KI-E95-S05-L01`, `KI-E96-S02-L01`) show the current field conventions in use (not the earlier compact `KI-NNN` style near the top of the file). Use the verbose style: `id`, `storyId` or `story`, `summary` or `description`, `severity`, `status`, `addedAt`, `epic`, `triageDecision`, `triageReason`, `notes`/`follow_up`.
- Sprint-status update precedent: `docs/implementation-artifacts/sprint-status.yaml:1190` — pattern is `N-M-slug: done  # PR #<num>`.
- Exclusion-comment precedent (local context only, no edit needed): `src/db/schema.ts:1425` already lists `youtubeChapters` among local-only stores — this comment remains accurate and does not need to change.

### Institutional Learnings

- `feedback_sprint_status_drift.md` (user memory): Re-check `sprint-status.yaml` after every merged PR — it drifted twice in E92 mega-run. This plan explicitly calls out the sprint-status edit as a named unit to avoid drift.
- Known-issues closeouts are a standard E93/E95 retrospective pattern (see recent commits `74f7e764`, `01725cb4`). Follow the same shape.

### External References

None needed. This is a pure docs-only decision capture.

## Key Technical Decisions

- **Defer (wont-fix), not schedule-future.** Origin's recommendation is explicit. `wont-fix` with re-open triggers is stronger than `schedule-future` because it signals there is no planned work — only re-evaluation triggers.
- **Known-issues ID:** `KI-E96-S04-L01`. Matches the recent `KI-E<epic>-S<story>-L<num>` scheme used since E93.
- **No code changes in this PR.** The origin is explicit: "No production code changes in the E96-S04 PR (it is a docs-only closeout)." A reviewer who disagrees with the deferral can request the fallback (implement-now) in a follow-up story; the shape is mechanical and unblocked.
- **`notes` field wording:** Include the three re-open triggers verbatim from the origin so maintainers do not have to open a second document to evaluate re-opening.

## Open Questions

### Resolved During Planning

- **Should the cascade-delete bug be logged in this plan?** Origin says "log separately." Keep it out of this plan's mandatory deliverables; mention it as an optional `KI-E96-S04-L02` append during implementation if the reviewer wants to batch.
- **Which YAML dialect to follow for the new entry?** Use the recent verbose style (matches `KI-E96-S02-L01` at line 1150), not the compact early style.

### Deferred to Implementation

- **Exact `addedAt` / PR reference** in the known-issues entry and sprint-status comment — fill in at commit time once the branch/PR exists.

## Implementation Units

- [ ] **Unit 1: Add `KI-E96-S04-L01` entry to `docs/known-issues.yaml`**

**Goal:** Create a durable, triage-ready wont-fix entry pointing back to the origin requirements doc with concrete re-open triggers.

**Requirements:** R2, R5

**Dependencies:** None

**Files:**
- Modify: `docs/known-issues.yaml`

**Approach:**
- Append a new entry after `KI-E95-S05-L01` (the current tail), following the verbose field style used by the other recent entries (`KI-E96-S02-L01`, `KI-E95-S04-L01`).
- Required fields: `id: KI-E96-S04-L01`, `storyId: E96-S04`, `summary` (one line), `severity: low`, `status: wont-fix`, `addedAt: "2026-04-19"`, `epic: E96`, `triageDecision: wont-fix`, `triageReason` (one paragraph summarising why — derivable, zero-mutation, no authored state), `notes` (the three re-open triggers, one per bullet line, verbatim from origin).
- Reference the origin doc path: `docs/brainstorms/2026-04-19-e96-s04-youtube-chapters-sync-evaluation-requirements.md`.

**Patterns to follow:**
- `docs/known-issues.yaml:1150` (`KI-E96-S02-L01`) — same sibling-story shape, also `wont-fix`-adjacent decision capture.

**Test scenarios:**
- Test expectation: none — docs-only YAML edit. Validation happens via (a) a `yaml.safeLoad` in CI if one exists, otherwise (b) visual review during code review.

**Verification:**
- `docs/known-issues.yaml` parses as valid YAML (no tab/indent errors).
- Searching `KI-E96-S04-L01` in the file returns exactly one hit and the entry sits in the correct ordered position (end of current list).
- Entry contains a path reference to the origin doc and the three re-open triggers.

- [ ] **Unit 2: Mark `96-4-youtube-chapters-sync-evaluation` as done in sprint-status**

**Goal:** Flip sprint-status to reflect the story is complete, preventing drift between the known-issues register and the sprint tracker.

**Requirements:** R3

**Dependencies:** Unit 1 must land in the same commit (or before) so the sprint-status "done" marker is not pointing at vapor.

**Files:**
- Modify: `docs/implementation-artifacts/sprint-status.yaml`

**Approach:**
- Line 1200: change `96-4-youtube-chapters-sync-evaluation: backlog` to `96-4-youtube-chapters-sync-evaluation: done  # PR #<num> — docs-only closeout, see KI-E96-S04-L01`.
- PR number is filled in at commit time after the PR is opened (or left as `done  # docs-only closeout, see KI-E96-S04-L01` if the commit lands before the PR is numbered — either is fine; E95-S05 shows the PR-number style).

**Patterns to follow:**
- `docs/implementation-artifacts/sprint-status.yaml:1190` (`95-6-notification-preferences-sync: done  # PR #375`).

**Test scenarios:**
- Test expectation: none — YAML scalar change.

**Verification:**
- YAML still parses.
- The line reads `done` (not `backlog`) and carries a comment pointing to either the PR or the known-issues entry.

- [ ] **Unit 3: Closeout commit on the E96-S04 branch**

**Goal:** Package Units 1 and 2 into a single atomic docs-only commit, open the PR, and force-merge per project convention.

**Requirements:** R4

**Dependencies:** Units 1 and 2.

**Files:**
- No new files. Commit contains only the two YAML edits above.

**Approach:**
- Branch: `feature/e96-s04-youtube-chapters-sync-evaluation` (kebab-case, matches story-workflow convention).
- Commit message: `chore(E96-S04): defer youtubeChapters sync — docs-only closeout (KI-E96-S04-L01)` with body summarising the decision and linking to the origin.
- PR body: surface the origin doc, the known-issues entry, and the three re-open triggers so a reviewer can approve without opening three files.
- Per `feedback_pr_merge_strategy.md` (user memory): force-merge the PR immediately after creation, no CI wait — this is docs-only and will not touch any build or test path.

**Patterns to follow:**
- Recent E93 closeout commits (`74f7e764`, `01725cb4`).

**Test scenarios:**
- Test expectation: none — no code, no tests, no build changes.

**Verification:**
- `git diff main...HEAD` shows exactly two files changed: `docs/known-issues.yaml` and `docs/implementation-artifacts/sprint-status.yaml`.
- PR opens cleanly; no lint/build/test jobs fail (none should even run for docs-only paths, but if they do they pass trivially).
- After merge, `sprint-status.yaml` reflects `96-4-...: done` on `main` and `KI-E96-S04-L01` is queryable via grep.

## System-Wide Impact

- **Interaction graph:** None. No runtime code path is touched.
- **Error propagation:** N/A.
- **State lifecycle risks:** None — `youtubeChapters` Dexie store behaviour is unchanged. Users continue to have chapters regenerated per-device on import, which is the existing behaviour.
- **API surface parity:** None. `tableRegistry` is intentionally not edited.
- **Integration coverage:** None required.
- **Unchanged invariants:**
  - `src/db/schema.ts:1425` continues to list `youtubeChapters` as local-only — this plan reinforces the invariant rather than changing it.
  - Sync engine (`syncableWrite`, `tableRegistry`) has no new table.
  - `YouTubeImportDialog.tsx` / `YouTubeChapterEditor.tsx` flows are untouched.

## Risks & Dependencies

| Risk | Mitigation |
|------|------------|
| Reviewer disagrees with the "defer" recommendation and asks for implement-now. | Origin explicitly documents the fallback path (mechanical migration SQL + tableRegistry entry; same shape as other P3/P4 tables in E96-S01). Fallback can be produced in a follow-up story without re-brainstorming. |
| Sprint-status drift (observed twice in E92 mega-run per user memory). | Unit 2 is a named, mandatory unit in this plan — cannot be skipped. Verification step checks the line explicitly. |
| Future maintainer re-litigates the decision because the known-issues entry is under-specified. | Unit 1's approach requires the three verbatim re-open triggers from the origin in the `notes` field. This is the primary defence against re-litigation. |
| YAML syntax error in `docs/known-issues.yaml` (common risk on large YAML files). | Verify with a YAML parser locally before commit; keep indentation identical to the preceding entry. |

## Documentation / Operational Notes

- No runbook, monitoring, or rollout changes.
- No user-facing behaviour change.
- No migration. No feature flag.
- Origin doc already serves as the long-form decision record; this plan only ensures the decision is machine-discoverable (`known-issues.yaml`) and schedule-aware (`sprint-status.yaml`).

## Sources & References

- **Origin document:** `docs/brainstorms/2026-04-19-e96-s04-youtube-chapters-sync-evaluation-requirements.md`
- Parent brainstorm (deferral source): `docs/brainstorms/2026-04-19-e96-s01-p3-p4-supabase-migrations-requirements.md`
- Type definition: `src/data/types.ts:1170`
- Dexie schema (exclusion comment): `src/db/schema.ts:131`, `src/db/schema.ts:1425`
- Sole write site: `src/stores/useYouTubeImportStore.ts:352`
- Read sites: `src/ai/tutor/transcriptContext.ts:103`, `src/ai/quizChunker.ts:77`
- Known-issues format precedent: `docs/known-issues.yaml:1150` (`KI-E96-S02-L01`)
- Sprint-status `done` precedent: `docs/implementation-artifacts/sprint-status.yaml:1190` (`95-6-notification-preferences-sync: done  # PR #375`)
- Related recent closeout commits: `74f7e764`, `01725cb4` (E93 retrospective + closeout pattern)
