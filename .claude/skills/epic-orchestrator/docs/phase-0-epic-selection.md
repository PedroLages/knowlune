# Phase 0: Epic Selection

## Overview

Select the target epic, extract its stories, check current status, and create the master TodoWrite that drives the entire pipeline.

## Step 0: Check for Resume

Before starting fresh, check if an in-progress tracking file exists:

```bash
ls docs/implementation-artifacts/epic-*-tracking-*.md
```

**If found:**
1. Read the tracking file to determine epic number and current state
2. Identify stories already marked `done` — skip them
3. Identify the first non-done story — resume from there
4. Reconstruct the in-context tracking table from the file
5. Output resume banner:
   ```
   ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
   RESUMING Epic {N}: {NAME}
   Completed: {X}/{Y} stories — Resuming from {STORY_ID}
   ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
   ```
6. Skip to Phase 1 with the remaining stories list

**If no tracking file found** → proceed with Step 1 (fresh start).

## Step 1: Determine Epic

**If argument provided** (e.g., `/epic-orchestrator 20`):
- Use the number directly as `{EPIC_NUMBER}`

**If no argument — auto-detect what needs work**:

Read `docs/implementation-artifacts/sprint-status.yaml` and analyze the project state:

1. **Check for in-progress epics** — any epic with `in-progress` status that still has stories not `done`. These take priority since work is already underway.

2. **Check for partially completed epics** — epics where some stories are `done` but others remain in `backlog`. These should be finished before starting new epics.

3. **Identify the next backlog epic** — the lowest-numbered epic with `backlog` status, following the natural epic sequence.

4. **Cross-reference with `docs/planning-artifacts/epics.md`** — verify the epic has defined stories and acceptance criteria.

**Present findings to user via AskUserQuestion:**

```
Based on sprint status, here's what needs work:

Option 1: Epic {N} — {NAME} (in-progress, {X}/{Y} stories done)
Option 2: Epic {M} — {NAME} (backlog, next in sequence)
Option 3: [Other — user specifies]
```

Include context: how many stories remain, any dependencies noted in epics.md, and a recommendation (prefer finishing in-progress epics over starting new ones).

## Step 2: Extract Story List

Read `docs/planning-artifacts/epics.md` and find the section for Epic `{EPIC_NUMBER}`.

Extract:
- **Epic name** (e.g., "Advanced Reporting & Analytics")
- **Story list** with IDs and names (e.g., E20-S01, E20-S02, ...)
- **Story count** for TodoWrite sizing

Store as `{EPIC_NAME}`, `{STORY_LIST}` (array of `{STORY_ID}: {STORY_NAME}` pairs).

## Step 3: Load Known Issues Register

Read `docs/known-issues.yaml` and extract all entries where `status: open`.

Build a compact summary called `{KNOWN_ISSUES_SUMMARY}` with one line per open issue:
```
KI-NNN: [type] summary (file)
```

Example:
```
KI-016: [test] ImportWizardDialog.test.tsx — 28 unit tests failing (src/app/components/figma/__tests__/ImportWizardDialog.test.tsx)
KI-026: [lint] 3 ESLint parsing errors in scripts/get-smoke-specs*.js (scripts/get-smoke-specs.js)
KI-029: [test] Unit test coverage 63.67% below 70% threshold (vitest.config.ts)
```

Store:
- `{KNOWN_ISSUES_SUMMARY}` — passed to Review Agent prompts to prevent re-flagging
- `{NEXT_KI_NUMBER}` — last entry's ID + 1 (for assigning IDs to new findings in Phase 2)
- `{KNOWN_ISSUES_COUNT}` — count of open issues for status banner

**If `docs/known-issues.yaml` does not exist**, skip this step and set `{KNOWN_ISSUES_SUMMARY}` to empty, `{KNOWN_ISSUES_COUNT}` to 0.

## Step 4: Check Current Status

Read `docs/implementation-artifacts/sprint-status.yaml`:
- Check each story's current status (`backlog`, `in-progress`, `done`)
- Skip stories that are already `done` (already shipped)
- Note stories that are `in-progress` (may have partial work)

Build the filtered list: `{STORIES_TO_PROCESS}` (excluding `done`).

## Step 5: Create Master TodoWrite

Create TodoWrite with all phases and stories:

```
Phase 0:
[x] Select epic (Epic {N}: {EPIC_NAME})
[x] Extract story list ({COUNT} stories)

Phase 1 — Story Pipeline:
[ ] {STORY_ID}: Start + Implement
[ ] {STORY_ID}: Review Loop
[ ] {STORY_ID}: Finish + PR + Merge
... (repeat for each story)

Phase 2 — Post-Epic:
[ ] Sprint status check
[ ] Mark epic done
[ ] Testarch trace
[ ] Testarch NFR
[ ] Adversarial review
[ ] Retrospective

Phase 3:
[ ] Final report
```

## Step 6: Environment Prep

```bash
# Kill any running dev server (port 5173 conflicts with Playwright)
lsof -ti:5173 | xargs kill 2>/dev/null

# Ensure we're on main branch with latest code
git checkout main
git pull
```

## Step 7: Initialize Tracking Table

Start the in-context coordinator tracking table:

```
| Story | Status | PR URL | Review Rounds | Issues Fixed |
|-------|--------|--------|---------------|--------------|
```

## Step 8: Create Persistent Tracking File

Write the initial tracking file to `docs/implementation-artifacts/epic-{EPIC_NUMBER}-tracking-{DATE}.md`:

```markdown
# Epic {EPIC_NUMBER}: {EPIC_NAME} — Execution Tracker

Generated: {DATE}
Last Updated: {DATE}

## Progress Summary

| Story | Status | PR URL | Review Rounds | Issues Fixed |
|-------|--------|--------|---------------|--------------|
| {STORY_ID} | queued | — | — | — |
(one row per story)

## Story Details

### {STORY_ID}: {Story Name}
**Status:** queued
#### Errors
_(none yet)_
#### Review Findings
_(none yet)_
#### Fixes Applied
_(none yet)_
#### Notes
_(none yet)_

---
(repeat per story)

## Post-Epic Validation

| Command | Status | Result | Notes |
|---------|--------|--------|-------|
| Sprint Status | pending | — | — |
| Mark Epic Done | pending | — | — |
| Testarch Trace | pending | — | — |
| Testarch NFR | pending | — | — |
| Adversarial Review | pending | — | — |
| Retrospective | pending | — | — |

## Non-Issues (False Positives)
_(none yet)_

## Known Issues Cross-Reference

### Matched (already in register)
_(none yet)_

### New (to be added to register in Phase 2)
_(none yet)_

## Epic Summary
- Started: {DATE}
- Completed: --
- Total Stories: {STORY_COUNT}
- Total Review Rounds: --
- Total Issues Fixed: --
```

Proceed to Phase 1 with the first story in `{STORIES_TO_PROCESS}`.
