# Sprint Status vs Branch Sync Validation (Step 2)

This module validates consistency between sprint-status.yaml and git branch state, catching stale state after manual changes or interruptions.

## Validation Logic

Check if branch exists: `git branch --list feature/e##-s##-slug`

Read status from `${PATHS.sprintStatus}`

## If status=backlog AND branch exists → STALE STATE

Present options via AskUserQuestion:

```
⚠️ Inconsistent state detected

Sprint Status: backlog (never started)
Git State:     Branch exists (feature/e##-s##-slug)

Possible causes:
- Story was started but sprint-status.yaml wasn't updated
- Branch is leftover from abandoned work
- Sprint status was manually reset to backlog

What would you like to do?

1. Update status to in-progress (Recommended)
   - Assumes work was started, sprint-status.yaml is stale
   - Updates status in sprint-status.yaml
   - Continues as resumed story (allows dirty tree)

2. Delete branch and start fresh
   - Assumes branch is abandoned work
   - Deletes branch: git branch -D feature/e##-s##-slug
   - Continues as new story (requires clean tree)

3. Continue as-is (Advanced)
   - Keeps both sprint-status.yaml and branch as-is
   - Useful for manual troubleshooting
```

## If status=in-progress AND branch missing → STALE STATE

Present options via AskUserQuestion:

```
⚠️ Inconsistent state detected

Sprint Status: in-progress (work started)
Git State:     No branch found

Possible causes:
- Branch was deleted but sprint-status.yaml wasn't updated
- Branch was renamed or merged
- Working in a different worktree

What would you like to do?

1. Reset status to backlog (Recommended)
   - Assumes branch was deleted, status is stale
   - Updates sprint-status.yaml to backlog
   - Continues as new story (creates fresh branch)

2. Continue as-is (Advanced)
   - Creates new branch but keeps status as in-progress
   - Useful if you deleted branch to start over
```

## If status=in-progress AND branch exists → RESUMED STORY

- This is the happy path for resuming work
- Inform the user and continue to step 3 resumption check

## If status ≠ backlog AND status ≠ in-progress

- Warn user of unexpected status (e.g., `done`, `blocked`, `ready-for-dev`)
- Suggest manual review of sprint-status.yaml
- Proceed with caution (allow workflow to continue)

## TodoWrite Checkpoint

Mark "Look up story and validate sprint status" → `completed`.
