# Phase 1: Story Pipeline

## Overview

Process each story sequentially through the full lifecycle: start → implement → review (fix ALL) → finish → merge. Each step uses a **fresh sub-agent**. Stories are processed one at a time due to the port 5173 constraint (Playwright dev server).

## Why Sequential

- Design review agent and E2E tests both need a dev server on port 5173
- Playwright's `reuseExistingServer: true` silently connects to a stale dev server from another branch
- Only one story can safely use the dev server at a time

## Per-Story Flow

### Step 1: Start + Implement (Story Agent)

Spawn a **general-purpose sub-agent** with the Story Agent prompt from [agent-prompt-templates.md](agent-prompt-templates.md). **Use `run_in_background: true`** to keep intermediate tool calls out of the coordinator's context window. **Use `model: "opus"`** — planning and implementation quality is the highest-leverage investment per story.

Before dispatch, output the status banner:
```
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
STEP 1/4: Implementing {STORY_ID} (Story Agent)
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
```

The agent will:
1. Run `/start-story {STORY_ID}` (creates branch, story file, research, plan)
2. Implement the plan fully (code, components, tests)
3. Commit with descriptive messages
4. Return summary of what was built

**Coordinator after**: Output completion banner with agent's summary, update TodoWrite, note the summary in tracking table, print progress dashboard. **Update tracking file**: story status → in-progress, add key files list.

### Step 2: Review Loop

**See:** [review-loop.md](review-loop.md) for the full zero-tolerance review cycle.

Key points:
- Each review round = NEW sub-agent (fresh context)
- Fix ALL issues at every severity (BLOCKER, HIGH, MEDIUM, LOW, NITS)
- Loop until zero issues found
- Max 3 rounds before escalation

#### Adaptive Review Scope

Before dispatching the Review Agent, the coordinator checks `git diff --name-only main...HEAD` to determine file types changed:

| Files Changed | Skip | Reason |
|--------------|------|--------|
| Only `.md`, `.yaml`, `.json` (no `.tsx`, `.ts`, `.css`) | Design review, Exploratory QA, Performance benchmark | No UI to test |
| Only test files (`tests/**`) | Design review, Exploratory QA, Performance benchmark | No production UI changes |
| Only `.ts` (no `.tsx`) | Design review (keep Exploratory QA + Performance benchmark) | No visual components, but behavior may affect routes |

Pass the skip list to the Review Agent prompt:
```
SKIP THESE REVIEW AGENTS (no relevant changes):
- design-review (no .tsx/.css changes)
- exploratory-qa (no UI changes)
- performance-benchmark (lightweight review or no UI changes)
```

The Review Agent still runs ALL pre-checks (build, lint, type-check, tests) regardless — only the agent swarm is scoped.

### Step 3: Finish + PR (Finish Agent)

Spawn a **general-purpose sub-agent** with the Finish Agent prompt from [agent-prompt-templates.md](agent-prompt-templates.md). **Use `run_in_background: true`**. **Use `model: "sonnet"`** — procedural validation and PR creation.

Before dispatch, output the status banner:
```
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
STEP 3/4: Finishing {STORY_ID} (Finish Agent)
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
```

The agent will:
1. Run `/finish-story {STORY_ID}`
2. Validate all review gates passed
3. Update story file and sprint status
4. Commit, push, create PR
5. Return PR URL

**Coordinator after**: Output completion banner with PR URL, update tracking table, print progress dashboard. **Update tracking file**: PR URL, story status → review.

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

Mark story as complete in TodoWrite. **Update tracking file**: story status → done, review rounds count, total issues fixed, update Epic Summary totals.

```bash
# Commit tracking file to protect against session crashes
git add docs/implementation-artifacts/epic-{N}-tracking-*.md
git commit -m "chore: update epic tracking after {STORY_ID}"
git push
```

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

If Phase 0 detected a story with `ready-for-dev` or `in-progress` status:
- The story branch already exists
- `/start-story` will detect this and resume (idempotent)
- The Story Agent should note that it's resuming, not starting fresh
- Review and finish proceed normally

**Lifecycle context**: The orchestrator tracking file uses these BMAD lifecycle states:
- `ready-for-dev`: Story setup complete, ready for implementation
- `in-progress`: Implementation in progress (active development)
- `review`: Code review and quality gates in progress
- `done`: Story complete and merged to main
