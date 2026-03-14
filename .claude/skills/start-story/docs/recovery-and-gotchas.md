# Recovery and Common Mistakes

## Common Mistakes

- **Not branching from main**: Always `git checkout main && git pull` first.
- **Story already in-progress**: Check sprint-status.yaml first.
- **Wrong branch format**: `feature/e##-s##-slug` — all lowercase.
- **Uncommitted changes**: Commit or stash before switching.

## Recovery

All steps are idempotent — re-running `/start-story` after an interruption safely resumes:

- **Steps 1-2 fail** (lookup/status): Nothing changed. Fix and re-run.
- **Step 4 fail** (uncommitted changes): Commit or stash, re-run.
- **Step 5** (branch): If branch exists, switches to it instead of failing.
- **Step 6** (story file): If file exists, keeps it instead of overwriting.
- **Step 7** (sprint status): If already in-progress, skips update.
- **Step 8** (ATDD tests): If test file exists, skips suggestion.
- **Step 11** (plan link): If `## Implementation Plan` section exists, skips.
- **Step 13** (initial commit): If commit exists, skips.

## General Cleanup

If you need to completely reset and start over:

- **Main workspace**: `git checkout main && git branch -D feature/e##-s##-slug`
- **Worktree**: `worktree-cleanup {story-key-lower}` (removes worktree and deletes branch)
