# Recovery Guide

Troubleshooting and recovery for `/finish-story` failures.

## Failure Points and Recovery

### Steps 1-2: Story Lookup

**Symptoms:**
- Story ID not found in epics
- Story file doesn't exist
- Worktree detection fails

**Recovery:**
```bash
# Verify story ID format
echo "E##-S##" | grep -E "^E[0-9]+-S[0-9]+$"

# Check story file exists
ls docs/implementation-artifacts/*-{story-slug}.md

# Check worktree status
git worktree list
git branch --show-current
```

**Fix:**
- Use correct story ID format (E01-S03, not e1-s3)
- Ensure story file was created by `/start-story`
- If in worktree, ensure BASE_PATH is correct

### Steps 3-5: Validation

**Symptoms:**
- Pre-checks fail (build, lint, type-check, tests)
- Blocker cross-check fails
- Test pattern validation fails

**Recovery:**

**Build failure:**
```bash
npm run build
# Fix TypeScript errors shown in output
# Re-run /finish-story
```

**Lint failure:**
```bash
npm run lint
# Review errors, most are auto-fixed
# Re-run /finish-story
```

**Test failure:**
```bash
npm run test:unit  # Unit tests
npm run test:e2e   # E2E tests
# Fix failing tests
# Re-run /finish-story
```

**Blocker cross-check failure:**
```
❌ Cannot ship — 2 unresolved blockers from code review

Fix the blockers listed, commit changes, then re-run /finish-story.
```

**Fix:**
1. Open the blockers' file:line references
2. Implement the required fixes
3. Commit: `git commit -am "fix: address code review blockers"`
4. Re-run: `/finish-story`

**Completed gates preserved:**
- `review_gates_passed` tracks progress
- Pre-checks re-run (fast, validates current state)
- Agent reviews are NOT re-run (reports already exist)

### Step 4a/4b: Inline Review

**Symptoms:**
- Lessons learned gate fails
- Pre-checks fail
- Agent review fails
- Burn-in fails
- Blockers found

**Recovery:**

**Lessons learned gate:**
```
❌ Lessons Learned Gate FAILED
Placeholder text found: [Document issues...]

1. Open the story file
2. Replace placeholder with actual lessons
3. Commit changes
4. Re-run /finish-story
```

**Agent review failures:**
```bash
# Check if dev server is running (for design review)
curl -s http://localhost:5173

# Start dev server if needed
npm run dev &

# Re-run /finish-story
```

**Burn-in failure:**
```
Burn-in FAILED: 3/80 tests failed

Review test anti-patterns:
1. Time dependencies (use FIXED_DATE)
2. Hard waits (use expect().toBeVisible())
3. Race conditions (use shared helpers)

Fix and re-run /finish-story
```

**Blockers found during inline review:**
```
Review BLOCKED — Fix 2 blockers:
1. [Code review — src/lib/api.ts:45]: Error swallowing in catch block
2. [Design review — Overview page]: Focus trap missing in modal

Fix these and re-run /finish-story.
Completed gates are preserved in story frontmatter.
```

**Status after failure:**
- Story stays `reviewed: in-progress`
- `review_gates_passed: [list of completed gates]`
- On re-run:
  - Pre-checks always re-run (fast)
  - Completed agent reviews are skipped
  - Only failed/missing gates run again

### Step 9: Push Fails

**Symptoms:**
- `git push` fails
- Remote not set
- Authentication fails

**Recovery:**

**No remote:**
```bash
git remote -v
# If empty:
git remote add origin <repo-url>
git push -u origin feature/e##-s##-slug
```

**Authentication failure:**
```bash
# Check SSH keys
ssh -T git@github.com

# Or use HTTPS with token
git remote set-url origin https://github.com/user/repo.git
git push
```

**Branch already exists on remote:**
```bash
# Force push if you're sure (dangerous!)
git push --force-with-lease origin feature/e##-s##-slug

# Or delete remote branch and re-push
git push origin :feature/e##-s##-slug
git push -u origin feature/e##-s##-slug
```

### Step 10: PR Creation Fails

**Symptoms:**
- `gh pr create` fails
- Not authenticated
- PR already exists

**Recovery:**

**Not authenticated:**
```bash
gh auth status
gh auth login
```

**PR already exists:**
```bash
gh pr list --head feature/e##-s##-slug
# Use the existing PR URL
```

**Missing pr description:**
```bash
# Create PR manually with template
gh pr create --title "feat(E##-S##): [Title]" --body-file pr-template.md
```

### Step 12: PR Not Merged

**Symptoms:**
- User selects "No" when asked if PR is merged
- PR still in review

**Recovery:**

**Keep worktree active:**
```
👍 Keeping worktree active.

You can:
• Make additional changes and commit them
• Run /finish-story again after PR is merged
• Or manually cleanup: worktree-cleanup {story-key-lower}
```

**After PR is merged:**
```bash
# Re-run /finish-story
/finish-story

# Or manually cleanup
worktree-cleanup {story-key-lower}
git checkout main
git pull
```

### Step 13b: Worktree Cleanup Fails

**Symptoms:**
- `worktree-cleanup` command not found
- Worktree has uncommitted changes
- Branch can't be deleted

**Recovery:**

**Script not found:**
```bash
# Manual cleanup
git worktree list  # Find the path
git worktree remove /path/to/worktree/{story-key}
git branch -D feature/{story-key}
```

**Uncommitted changes:**
```bash
cd /path/to/worktree/{story-key}
git status
git add . && git commit -m "final changes"
# Or stash: git stash
cd -
worktree-cleanup {story-key}
```

**Branch won't delete:**
```bash
# Force delete if merged
git branch -D feature/{story-key}

# Or delete remote first
git push origin :feature/{story-key}
git branch -d feature/{story-key}
```

## Common Mistakes

### Running Without Implementation

**Symptom:** No changes to commit, empty git diff

**Fix:**
```
⚠️  /finish-story is for completed stories.

You need to:
1. Implement the story first
2. Make commits as you work
3. Then run /finish-story
```

### Ignoring Blockers

**Symptom:** Re-running `/finish-story` without fixing blockers

**Fix:**
```
Blockers from previous run:
- [file:line]: Issue

You must fix these. Blockers will not go away on their own.
```

### Auto-Merging PR

**Symptom:** User tries to skip PR review

**Reminder:**
```
⚠️  /finish-story creates a PR for human review.

Do NOT auto-merge. The PR should be:
1. Reviewed by team members
2. Checked by CI/CD
3. Manually approved and merged
```

## State Recovery

If `/finish-story` is interrupted (crash, Ctrl+C, etc.):

**Check story state:**
```bash
grep -A 5 "^---" docs/implementation-artifacts/{story-key}.md
```

**Possible states:**
- `reviewed: false` → Re-run from beginning (streamlined mode)
- `reviewed: in-progress` → Re-run, completed gates are preserved
- `reviewed: true` → Re-run from step 6 (comprehensive mode)

**Resume safely:**
```bash
# Story state is preserved in frontmatter
# Just re-run the command
/finish-story E##-S##
```

## Getting Help

If recovery fails:

1. **Check story frontmatter** for current state
2. **Review review reports** in `docs/reviews/`
3. **Check git status** and recent commits
4. **Read error messages** carefully — they include fix instructions
5. **Ask for help** with specific error output and story ID

## Prevention

Avoid failures by:

1. ✅ Run `/review-story` first for complex stories
2. ✅ Fix all blockers before attempting to ship
3. ✅ Keep working tree clean (commit frequently)
4. ✅ Ensure dev server runs for UI changes
5. ✅ Document lessons learned before review
6. ✅ Test locally before running `/finish-story`
