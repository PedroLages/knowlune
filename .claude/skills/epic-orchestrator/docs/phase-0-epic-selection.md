# Phase 0: Epic Selection

## Overview

Select the target epic, extract its stories, check current status, and create the master TodoWrite that drives the entire pipeline.

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

## Step 3: Check Current Status

Read `docs/implementation-artifacts/sprint-status.yaml`:
- Check each story's current status (`backlog`, `in-progress`, `done`)
- Skip stories that are already `done` (already shipped)
- Note stories that are `in-progress` (may have partial work)

Build the filtered list: `{STORIES_TO_PROCESS}` (excluding `done`).

## Step 4: Create Master TodoWrite

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

## Step 5: Environment Prep

```bash
# Kill any running dev server (port 5173 conflicts with Playwright)
lsof -ti:5173 | xargs kill 2>/dev/null

# Ensure we're on main branch with latest code
git checkout main
git pull
```

## Step 6: Initialize Tracking Table

Start the in-context coordinator tracking table:

```
| Story | Status | PR URL | Review Rounds | Issues Fixed |
|-------|--------|--------|---------------|--------------|
```

Proceed to Phase 1 with the first story in `{STORIES_TO_PROCESS}`.
