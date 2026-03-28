# Error Handling

## Overview

The coordinator must handle failures gracefully — fix what's fixable, park what's not, and continue processing remaining stories. Never let one failure block the entire epic.

## Error Scenarios

| Scenario | Detection | Coordinator Action |
|----------|-----------|-------------------|
| **Story implementation fails** | Story Agent returns error or incomplete summary | Spawn new Story Agent with context of what failed. If still fails, park story with reason |
| **Build fails during review** | Review Agent reports build failure | Review Agent attempts auto-fix. If persistent, coordinator spawns Fix Agent targeting build errors |
| **Lint/format/type-check fails** | Review Agent reports pre-check failure | Review Agent auto-fixes within its `/review-story` run. These rarely need coordinator intervention |
| **E2E tests fail** | Review Agent reports test failures | Fix Agent addresses. If tests are flaky, note in tracking table |
| **Review finds issues (any severity)** | Review Agent returns ISSUES FOUND | Normal flow: spawn Fix Agent → new Review Agent (loop) |
| **Fixes introduce new issues** | Round N+1 has more issues than Round N | Continue loop — next Fix Agent addresses new + remaining issues |
| **Issues persist after 3 rounds** | Same issues across 3+ rounds | Coordinator decides: spawn 4th round with explicit instructions, or park story |
| **Merge conflict with main** | `git merge main` reports conflicts during Step 5 | Coordinator spawns Conflict Resolution Agent, or resolves directly if simple |
| **PR merge fails** | `gh pr merge` returns error | Check for branch protection rules, required checks. Retry or use `--admin` flag |
| **Dev server won't start** | Port 5173 not responding after kill + restart | `lsof -ti:5173 | xargs kill -9`, retry. If still fails, review runs without design review (adds `design-review-skipped` gate) |
| **Sub-agent runs out of context** | Agent returns truncated or incomplete output | Spawn continuation agent with summary of what was done. For Story Agents, this means summarizing what was already implemented |
| **Post-epic command fails** | Sub-agent returns error | Retry once. If still fails, note in final report as incomplete |
| **Coordinator session interrupted** | Tracking file exists but epic incomplete | Next `/epic-orchestrator` invocation detects tracking file in Phase 0 Step 0 and resumes from last completed story |

## Parking a Story

When a story can't be completed (unfixable blockers after 3+ rounds):

1. Update the tracking table: `Status: PARKED — {reason}`
2. Leave the branch as-is (don't merge incomplete work)
3. Update TodoWrite: mark as `completed` with note
4. Continue to next story
5. Report agent includes parked stories in final report

**Do NOT** let a parked story block:
- Other stories in the epic
- Post-epic commands
- Final report

## Conflict Resolution

When `git merge main --no-edit` fails with conflicts:

```bash
# Check which files conflict
git diff --name-only --diff-filter=U

# If conflicts are in story-specific files only:
# Spawn a Conflict Resolution sub-agent
```

**Conflict Resolution Agent prompt:**
```
Resolve merge conflicts on branch {BRANCH_NAME}.

Conflicting files:
{LIST_OF_CONFLICTING_FILES}

Rules:
- Keep the story's changes (ours) for story-specific files
- Keep main's changes (theirs) for shared infrastructure
- For files both changed, merge intelligently

After resolving:
git add {resolved files}
git commit -m "merge: resolve conflicts with main ({STORY_ID})"
```

## Recovery from Coordinator Context Overflow

If the coordinator session approaches context limits:

1. The **persistent tracking file** (`docs/implementation-artifacts/epic-{N}-tracking-{DATE}.md`) is the primary recovery source — it survives context overflow with full per-story details
2. TodoWrite persists across context compressions
3. If context is compressed, re-read the plan from `docs/plans/epic-orchestrator-coordinator-playbook.md`
4. Resume from the last completed TodoWrite item
5. Re-read the tracking file to reconstruct the in-context tracking table
6. If starting a new session, Phase 0 Step 0 auto-detects the tracking file and resumes

## Proactive Context Health Check

After completing each story (Step 4: Merge), the coordinator evaluates whether to continue or suggest a session break:

**Heuristic:** If more than 5 stories have been processed in this session, or if 3+ stories each needed 2+ review rounds, output a warning:

```
⚠️ CONTEXT HEALTH: {N} stories processed, {R} total review rounds.
The tracking file is committed and up-to-date.
If context feels constrained, you can safely start a new session —
`/epic-orchestrator` will auto-resume from {NEXT_STORY_ID}.
```

This is informational only — the orchestrator continues unless the user intervenes. The tracking file commit (after each merge) ensures no data is lost.
