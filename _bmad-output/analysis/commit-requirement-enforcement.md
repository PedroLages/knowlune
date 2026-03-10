# Commit Requirement Enforcement in Story Skills

## Current State

### `/review-story`
✅ **Already enforces** clean working tree (Step 4, line 95-99)
```markdown
**Pre-review commit gate:** Before running any checks, verify working tree is clean
```

### `/finish-story`
❌ **Does NOT enforce** clean working tree
- Streamlined mode (no prior review) runs reviews inline
- Reviews need committed changes for `git diff` to work
- BUT: No pre-check for uncommitted changes

### `/start-story`
❌ **Only warns** about uncommitted changes (Step 4)
```markdown
**Check working tree**: `git status`. Warn if uncommitted changes. Suggest commit or stash.
```
Does NOT block — user can proceed with dirty tree

## Problem Scenarios

### Scenario 1: Dirty tree at review time
```bash
/start-story E10-S01        # Warning shown but not blocked
# ... implement changes but don't commit ...
/review-story E10-S01       # BLOCKED by pre-review gate ✅
```
**Result**: User must go back and commit. This is correct behavior.

### Scenario 2: Dirty tree at finish time (streamlined)
```bash
/start-story E10-S01        # Warning shown but not blocked
# ... implement changes but don't commit ...
/finish-story E10-S01       # Runs reviews inline...
                            # git diff main...HEAD finds nothing (no commits)
                            # Reviews run but analyze nothing ❌
```
**Result**: Reviews pass but didn't actually review anything. BAD!

### Scenario 3: Dirty tree at finish time (comprehensive)
```bash
/start-story E10-S01
# ... implement and commit ...
/review-story E10-S01       # PASS ✅
# ... make more changes but don't commit ...
/finish-story E10-S01       # Validation runs on working tree
                            # Tests might fail due to uncommitted changes
                            # PR created without latest changes ❌
```
**Result**: PR doesn't include all changes. BAD!

## Recommended Fixes

### Fix 1: `/finish-story` — Add pre-commit gate

Add after Step 3 (before running inline reviews in streamlined mode):

```markdown
3a. **Pre-finish commit gate** (if NOT already reviewed):

If `reviewed: false` (streamlined mode — reviews will run inline):

```bash
git status --porcelain
```

If there are uncommitted changes, STOP and warn:
```
❌ Uncommitted changes detected.

/finish-story in streamlined mode runs reviews inline, which analyze
committed changes via `git diff main...HEAD`. Uncommitted changes will
not be reviewed.

Options:
1. Commit your changes:  git add -A && git commit -m "feat: ..."
2. Run /review-story first (after committing)
3. Cancel and commit later

Do NOT proceed without committing.
```

If `reviewed: true` (comprehensive mode — reviews already done):
- Check for uncommitted changes
- If found, WARN but don't block:
  ```
  ⚠️  Uncommitted changes detected.

  These changes were not included in the review. If intentional
  (e.g., debug logging), you can proceed. Otherwise, commit them
  and re-run /review-story.
  ```
- Ask user via AskUserQuestion: Proceed anyway / Cancel
```

### Fix 2: `/start-story` — Enforce clean tree

Upgrade Step 4 from warning to blocker:

```markdown
4. **Enforce clean working tree**:

```bash
git status --porcelain
```

If uncommitted changes found:
```
❌ Uncommitted changes detected.

Starting a new story requires a clean working tree to:
- Ensure proper branch switching
- Avoid mixing old and new work
- Enable clean git history

Options:
1. Commit changes:  git add -A && git commit -m "..."
2. Stash changes:   git stash push -u -m "WIP before E##-S##"
3. Cancel and clean up manually

Cannot proceed with dirty working tree.
```
STOP — do NOT create branch or story file.
```

**Exception**: If user is resuming a story (branch and story file already exist, status `in-progress`), allow uncommitted changes (they're working on this story).

### Fix 3: Git hook enforcement (optional)

Create `.git/hooks/pre-review-story` and `.git/hooks/pre-finish-story`:

```bash
#!/usr/bin/env bash
# .git/hooks/pre-review-story

if [ -n "$(git status --porcelain)" ]; then
  echo "❌ Pre-review hook: Uncommitted changes detected"
  echo "Commit all changes before running /review-story"
  exit 1
fi
```

Users install: `cp scripts/git-hooks/pre-review-story .git/hooks/`

## Implementation Priority

1. **High Priority**: Fix `/finish-story` streamlined mode (Fix 1)
   - Currently broken — reviews run but analyze nothing
   - Must block on uncommitted changes

2. **Medium Priority**: Upgrade `/start-story` enforcement (Fix 2)
   - Currently warns but allows dirty tree
   - Should block to enforce clean history

3. **Low Priority**: Git hooks (Fix 3)
   - Optional safeguard
   - Requires manual installation

## Testing

```bash
# Test 1: /review-story with dirty tree
touch test-file.txt
/review-story E10-S01
# Expected: BLOCKED ✅

# Test 2: /finish-story streamlined with dirty tree
touch test-file.txt
/finish-story E10-S01
# Expected: BLOCKED (after fix) ✅

# Test 3: /start-story with dirty tree
touch test-file.txt
/start-story E10-S02
# Expected: BLOCKED (after fix) ✅

# Test 4: /start-story resume with dirty tree (working on same story)
touch test-file.txt
/start-story E10-S01  # Story already in-progress
# Expected: ALLOWED ✅
```
