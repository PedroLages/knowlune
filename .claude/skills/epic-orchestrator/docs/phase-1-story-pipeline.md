# Phase 1: Story Pipeline

## Overview

Process each story sequentially through the full lifecycle: start → implement → review (fix ALL) → finish → merge. Each step uses a **fresh sub-agent**. Stories are processed one at a time due to the port 5173 constraint (Playwright dev server).

## Why Sequential

- Design review agent and E2E tests both need a dev server on port 5173
- Playwright's `reuseExistingServer: true` silently connects to a stale dev server from another branch
- Only one story can safely use the dev server at a time

## Per-Story Flow

### Step 1: Start + Implement (Story Agent)

Spawn a **general-purpose sub-agent** with the Story Agent prompt from [agent-prompt-templates.md](agent-prompt-templates.md).

The agent will:
1. Run `/start-story {STORY_ID}` (creates branch, story file, research, plan)
2. Implement the plan fully (code, components, tests)
3. Commit with descriptive messages
4. Return summary of what was built

**Coordinator after**: Update TodoWrite, note the summary in tracking table.

### Step 2: Review Loop

**See:** [review-loop.md](review-loop.md) for the full zero-tolerance review cycle.

Key points:
- Each review round = NEW sub-agent (fresh context)
- Fix ALL issues at every severity (BLOCKER, HIGH, MEDIUM, LOW, NITS)
- Loop until zero issues found
- Max 3 rounds before escalation

### Step 3: Finish + PR (Finish Agent)

Spawn a **general-purpose sub-agent** with the Finish Agent prompt from [agent-prompt-templates.md](agent-prompt-templates.md).

The agent will:
1. Run `/finish-story {STORY_ID}`
2. Validate all review gates passed
3. Update story file and sprint status
4. Commit, push, create PR
5. Return PR URL

### Step 4: Merge + Sync (Coordinator Directly)

The coordinator handles this directly — no sub-agent needed:

```bash
# Merge PR immediately (no CI wait)
gh pr merge {PR_URL} --squash --delete-branch

# Sync local main
git checkout main && git pull
```

Update the tracking table:
```
| {STORY_ID} | done | {PR_URL} | {ROUNDS} | {ISSUES_FIXED} |
```

Mark story as complete in TodoWrite.

### Step 5: Prepare Next Story (Coordinator Directly)

```bash
# Kill dev server (will be restarted by next review)
lsof -ti:5173 | xargs kill 2>/dev/null
```

Proceed to next story. If the next story's branch already exists (unlikely for new epic), merge main into it first:

```bash
git checkout {NEXT_BRANCH}
git merge main --no-edit
```

## Conflict Management

Since we merge each PR before starting the next story:

- **Before review**: After checking out the story branch, merge `main` if it changed. Resolve conflicts before running `/review-story`.
- **Between stories**: `git checkout main && git pull` ensures main is up to date before the next `/start-story` creates a new branch from it.
- **Risk mitigation**: Sequential processing means only one story's changes land on main at a time — conflicts are rare and localized.

## When a Story is Already In-Progress

If Phase 0 detected a story with `in-progress` status:
- The story branch already exists
- `/start-story` will detect this and resume (idempotent)
- The Story Agent should note that it's resuming, not starting fresh
- Review and finish proceed normally
