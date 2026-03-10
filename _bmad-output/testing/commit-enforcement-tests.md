# Commit Requirement Enforcement Test Scenarios

## Overview

This document provides comprehensive test scenarios for validating commit requirement enforcement across all story workflow skills (`/start-story`, `/review-story`, `/finish-story`).

**Purpose**: Ensure all skills properly enforce clean working tree requirements to prevent:
- Reviews analyzing nothing (no committed changes)
- PRs missing uncommitted changes
- Mixed work across story branches
- Broken git history

---

## Test Scenarios

### Test 1: `/review-story` with uncommitted changes (ALREADY IMPLEMENTED)

**Status**: ✅ Already enforces clean tree (Step 4, line 95-99)

**Setup**:
```bash
# Start a story and make uncommitted changes
/start-story E10-S01
# ... implement changes ...
echo "test content" > test-file.txt
git status --porcelain  # Should show: ?? test-file.txt
```

**Command**:
```bash
/review-story E10-S01
```

**Expected Behavior**: 🔴 **BLOCKED**

**Error Message**:
```
❌ Uncommitted changes detected.

/review-story requires a clean working tree because reviews analyze
committed changes via `git diff main...HEAD`. Uncommitted changes
will not be reviewed.

Uncommitted files:
  ?? test-file.txt

Options:
1. Commit your changes:  git add -A && git commit -m "feat(e10-s01): ..."
2. Stash your changes:   git stash push -u -m "WIP before review"
3. Cancel and clean up manually

Do NOT proceed without committing or stashing.
```

**How to Fix**:
```bash
# Option 1: Commit changes
git add -A
git commit -m "feat(e10-s01): implement feature"
/review-story E10-S01  # Should now pass

# OR Option 2: Stash changes
git stash push -u -m "WIP before review"
/review-story E10-S01
git stash pop  # After review completes
```

**Verification**: Skill should exit early before running any quality gates.

---

### Test 2: `/finish-story` streamlined with uncommitted changes (NEW - HIGH PRIORITY FIX)

**Status**: ❌ Currently broken — reviews run but analyze nothing

**Setup**:
```bash
# Start a story WITHOUT prior review
/start-story E10-S01
# ... implement changes but DON'T commit ...
echo "test content" > src/app/pages/NewFeature.tsx
git status --porcelain  # Should show: ?? src/app/pages/NewFeature.tsx
```

**Command**:
```bash
/finish-story E10-S01
```

**Expected Behavior (CURRENT - BROKEN)**: ✅ Passes but reviews analyze nothing
- `git diff main...HEAD` returns empty (no commits on branch)
- Design review runs but finds no changes
- Code review runs but finds no changes
- PR created without any changes

**Expected Behavior (AFTER FIX)**: 🔴 **BLOCKED**

**Error Message**:
```
❌ Uncommitted changes detected.

/finish-story in streamlined mode runs reviews inline, which analyze
committed changes via `git diff main...HEAD`. Uncommitted changes will
not be reviewed.

Uncommitted files:
  ?? src/app/pages/NewFeature.tsx

Options:
1. Commit your changes:  git add -A && git commit -m "feat(e10-s01): ..."
2. Run /review-story first (after committing)
3. Cancel and commit later

Do NOT proceed without committing.
```

**How to Fix**:
```bash
# Option 1: Commit and finish
git add -A
git commit -m "feat(e10-s01): add new feature page"
/finish-story E10-S01  # Should now pass

# Option 2: Commit and review first (comprehensive mode)
git add -A
git commit -m "feat(e10-s01): add new feature page"
/review-story E10-S01
/finish-story E10-S01  # Lightweight validation only
```

**Verification**:
- `git diff main...HEAD` should show changes BEFORE running reviews
- Skill should exit early if no commits found

---

### Test 3: `/finish-story` comprehensive with uncommitted changes (NEW - WARN BUT DON'T BLOCK)

**Status**: ⚠️ Currently allows — should warn user

**Setup**:
```bash
# Start, implement, commit, and review
/start-story E10-S01
echo "feature" > src/app/pages/Feature.tsx
git add -A
git commit -m "feat(e10-s01): add feature"
/review-story E10-S01  # PASS

# Now make MORE changes but DON'T commit
echo "debug logging" > src/lib/debug.ts
git status --porcelain  # Should show: ?? src/lib/debug.ts
```

**Command**:
```bash
/finish-story E10-S01
```

**Expected Behavior (AFTER FIX)**: ⚠️ **WARN BUT ALLOW**

**Warning Message**:
```
⚠️  Uncommitted changes detected.

These changes were not included in the review. If intentional
(e.g., debug logging, temporary files), you can proceed. Otherwise,
commit them and re-run /review-story.

Uncommitted files:
  ?? src/lib/debug.ts

Options:
  [Proceed anyway] — Ship without uncommitted changes
  [Cancel]         — Go back and commit/review
```

**How to Fix (if unintended)**:
```bash
# Option 1: Commit and re-review
git add -A
git commit -m "chore: add debug logging"
/review-story E10-S01
/finish-story E10-S01

# Option 2: Stash and proceed
git stash push -u -m "Debug logging (not for PR)"
/finish-story E10-S01
git stash pop  # After PR created

# Option 3: Proceed anyway (if intentional)
# Select "Proceed anyway" in prompt
```

**Verification**:
- Skill should use `AskUserQuestion` to confirm
- User must explicitly choose to proceed
- PR should NOT include uncommitted files

---

### Test 4: `/start-story` new story with uncommitted changes (NEW - MEDIUM PRIORITY FIX)

**Status**: ⚠️ Currently warns but allows — should block

**Setup**:
```bash
# Create uncommitted changes on main branch
git checkout main
echo "unfinished work" > src/app/pages/OldWork.tsx
git status --porcelain  # Should show: ?? src/app/pages/OldWork.tsx
```

**Command**:
```bash
/start-story E10-S02
```

**Expected Behavior (CURRENT)**: ⚠️ Warning shown but continues
- Branch created
- Story file created
- Uncommitted changes carried over to new branch

**Expected Behavior (AFTER FIX)**: 🔴 **BLOCKED**

**Error Message**:
```
❌ Uncommitted changes detected.

Starting a new story requires a clean working tree to:
- Ensure proper branch switching
- Avoid mixing old and new work
- Enable clean git history

Uncommitted files:
  ?? src/app/pages/OldWork.tsx

Options:
1. Commit changes:  git add -A && git commit -m "feat: complete old work"
2. Stash changes:   git stash push -u -m "WIP before E10-S02"
3. Cancel and clean up manually

Cannot proceed with dirty working tree.
```

**How to Fix**:
```bash
# Option 1: Commit existing work
git add -A
git commit -m "feat: complete old work"
/start-story E10-S02  # Should now pass

# Option 2: Stash existing work
git stash push -u -m "WIP before E10-S02"
/start-story E10-S02
# Later: git stash pop (on original branch)

# Option 3: Discard changes (if safe)
git reset --hard HEAD
/start-story E10-S02
```

**Verification**:
- Skill should exit BEFORE creating branch
- Skill should NOT create story file
- Working tree should remain unchanged

---

### Test 5: `/start-story` resumed story with uncommitted changes (NEW - EXCEPTION)

**Status**: 🟢 Should allow — user is resuming in-progress work

**Setup**:
```bash
# Start a story and make uncommitted changes
/start-story E10-S01
echo "work in progress" > src/app/pages/Feature.tsx
git status --porcelain  # Should show: ?? src/app/pages/Feature.tsx

# Switch to another branch
git checkout main

# Resume original story
git checkout feature/e10-s01-feature
```

**Command**:
```bash
/start-story E10-S01  # Resume existing story
```

**Expected Behavior**: ✅ **ALLOWED**

**Info Message**:
```
ℹ️  Resuming in-progress story E10-S01.

Uncommitted changes detected:
  ?? src/app/pages/Feature.tsx

This is normal when resuming work. Proceeding with story setup.
```

**Verification**:
- Story file status: `in-progress`
- Branch already exists: `feature/e10-s01-*`
- Working tree: Uncommitted changes remain
- Planning mode: User continues where they left off

**Detection Logic**:
```bash
# Check if resuming existing story
BRANCH_EXISTS=$(git rev-parse --verify feature/e10-s01-* 2>/dev/null)
STORY_STATUS=$(grep "status:" docs/implementation-artifacts/story-e10-s01.md | awk '{print $2}')

if [[ -n "$BRANCH_EXISTS" ]] && [[ "$STORY_STATUS" == "in-progress" ]]; then
  # Exception: Allow uncommitted changes (resuming work)
  echo "ℹ️  Resuming in-progress story..."
else
  # New story: Require clean tree
  if [[ -n "$(git status --porcelain)" ]]; then
    echo "❌ Uncommitted changes detected..."
    exit 1
  fi
fi
```

---

### Test 6: `/review-story` after committing changes (BASELINE - SHOULD PASS)

**Status**: ✅ Already works correctly

**Setup**:
```bash
# Start, implement, and commit
/start-story E10-S01
echo "feature" > src/app/pages/Feature.tsx
git add -A
git commit -m "feat(e10-s01): add feature page"
git status --porcelain  # Should show: (empty)
```

**Command**:
```bash
/review-story E10-S01
```

**Expected Behavior**: ✅ **PASS** — All quality gates run

**Success Output**:
```
✅ Pre-review commit gate passed — working tree clean

Running quality gates:
  1. Build validation... ✅
  2. Lint check... ✅
  3. E2E tests... ✅
  4. Design review... ✅
  5. Code review... ✅

All reviews passed. Story E10-S01 ready for /finish-story.
```

**Verification**:
- All quality gates execute
- `git diff main...HEAD` shows committed changes
- Reviews analyze actual implementation
- Review reports saved to `docs/reviews/`

---

### Test 7: `/finish-story` streamlined after committing changes (BASELINE - SHOULD PASS)

**Status**: ✅ Should work correctly after Test 2 fix

**Setup**:
```bash
# Start, implement, and commit
/start-story E10-S01
echo "feature" > src/app/pages/Feature.tsx
git add -A
git commit -m "feat(e10-s01): add feature page"
git status --porcelain  # Should show: (empty)
```

**Command**:
```bash
/finish-story E10-S01  # Streamlined mode (no prior review)
```

**Expected Behavior**: ✅ **PASS** — Inline reviews run successfully

**Success Output**:
```
✅ Pre-finish commit gate passed — working tree clean

Running inline reviews (streamlined mode):
  1. Design review... ✅
  2. Code review... ✅

Creating pull request...
  Branch: feature/e10-s01-add-feature-page
  Base: main
  Changes: 1 file (+50 lines)

Pull request created: https://github.com/user/repo/pull/123

Story E10-S01 complete. 🎉
```

**Verification**:
- Reviews analyze committed changes
- PR includes all committed files
- Story status updated to `completed`
- Branch pushed to remote

---

## Git Status Checks

### What `git status --porcelain` Detects

The `git status --porcelain` command outputs machine-readable git status. Each line shows:

```
XY PATH
```

Where `X` = staged status, `Y` = unstaged status.

**Common Status Codes**:

| Code | Meaning | Example |
|------|---------|---------|
| `??` | Untracked file | `?? new-file.txt` |
| `M ` | Modified, staged | `M  src/app.tsx` |
| ` M` | Modified, unstaged | ` M src/app.tsx` |
| `A ` | Added, staged | `A  new-feature.tsx` |
| `D ` | Deleted, staged | `D  old-file.tsx` |
| `R ` | Renamed, staged | `R  old.tsx -> new.tsx` |
| `UU` | Merge conflict | `UU conflicted.tsx` |

**Detection Logic**:

```bash
# Check for ANY uncommitted changes
if [ -n "$(git status --porcelain)" ]; then
  echo "❌ Uncommitted changes detected"
  exit 1
fi

# Check for specific types
STATUS=$(git status --porcelain)

# Untracked files only
if echo "$STATUS" | grep -q "^??"; then
  echo "⚠️  Untracked files found"
fi

# Staged changes
if echo "$STATUS" | grep -q "^[MADR]"; then
  echo "⚠️  Staged changes found"
fi

# Unstaged changes
if echo "$STATUS" | grep -q "^ [MD]"; then
  echo "⚠️  Unstaged changes found"
fi

# Merge conflicts
if echo "$STATUS" | grep -q "^UU"; then
  echo "❌ Merge conflicts detected"
  exit 1
fi
```

**Why It Matters**:

- **Untracked files** (`??`) — Not included in `git diff main...HEAD`
- **Unstaged changes** (` M`) — Not included in commits
- **Merge conflicts** (`UU`) — Must be resolved before committing
- **Clean tree** — Empty output means everything committed

---

## Manual Testing Checklist

### Pre-Test Setup

- [ ] Clone repo in clean directory
- [ ] Checkout `main` branch
- [ ] Ensure no uncommitted changes: `git status --porcelain` → empty
- [ ] Verify skills installed: `/start-story`, `/review-story`, `/finish-story`

### Test Execution

#### Test 1: `/review-story` with dirty tree (EXISTING)
- [ ] Start story: `/start-story E10-S01`
- [ ] Create untracked file: `touch test-file.txt`
- [ ] Verify dirty: `git status --porcelain` shows `??`
- [ ] Run review: `/review-story E10-S01`
- [ ] Expect: 🔴 Blocked with error message
- [ ] Commit: `git add -A && git commit -m "test"`
- [ ] Re-run: `/review-story E10-S01`
- [ ] Expect: ✅ Reviews execute

#### Test 2: `/finish-story` streamlined dirty (FIX REQUIRED)
- [ ] Start story: `/start-story E10-S02`
- [ ] Create file: `echo "code" > src/test.tsx`
- [ ] Verify dirty: `git status --porcelain` shows `??`
- [ ] Run finish: `/finish-story E10-S02`
- [ ] Current: ✅ Passes (BROKEN - reviews analyze nothing)
- [ ] After fix: 🔴 Blocked with error message
- [ ] Commit: `git add -A && git commit -m "feat: test"`
- [ ] Re-run: `/finish-story E10-S02`
- [ ] Expect: ✅ Reviews execute, PR created

#### Test 3: `/finish-story` comprehensive dirty (WARN)
- [ ] Start story: `/start-story E10-S03`
- [ ] Implement + commit: `echo "feat" > src/feat.tsx && git add -A && git commit -m "feat"`
- [ ] Review: `/review-story E10-S03` → ✅ Pass
- [ ] Create new file: `echo "debug" > src/debug.ts`
- [ ] Verify dirty: `git status --porcelain` shows `??`
- [ ] Run finish: `/finish-story E10-S03`
- [ ] Expect: ⚠️ Warning shown
- [ ] Expect: Prompt to proceed or cancel
- [ ] Test both: Cancel → Commit → Finish
- [ ] Verify: PR does NOT include `debug.ts`

#### Test 4: `/start-story` new with dirty tree (FIX REQUIRED)
- [ ] Checkout main: `git checkout main`
- [ ] Create untracked: `touch old-work.txt`
- [ ] Verify dirty: `git status --porcelain` shows `??`
- [ ] Run start: `/start-story E10-S04`
- [ ] Current: ⚠️ Warning but continues
- [ ] After fix: 🔴 Blocked with error message
- [ ] Clean: `git reset --hard HEAD`
- [ ] Re-run: `/start-story E10-S04`
- [ ] Expect: ✅ Branch created, story file created

#### Test 5: `/start-story` resume with dirty tree (EXCEPTION)
- [ ] Start story: `/start-story E10-S05`
- [ ] Create file: `echo "wip" > src/wip.tsx`
- [ ] Verify dirty: `git status --porcelain` shows `??`
- [ ] Switch branch: `git checkout main`
- [ ] Resume: `git checkout feature/e10-s05-*`
- [ ] Run start: `/start-story E10-S05`
- [ ] Expect: ✅ Allowed with info message
- [ ] Verify: Uncommitted changes preserved

#### Test 6: `/review-story` clean tree (BASELINE)
- [ ] Start story: `/start-story E10-S06`
- [ ] Implement + commit: `echo "feat" > src/feat.tsx && git add -A && git commit -m "feat"`
- [ ] Verify clean: `git status --porcelain` → empty
- [ ] Run review: `/review-story E10-S06`
- [ ] Expect: ✅ All quality gates execute
- [ ] Verify: Review reports generated

#### Test 7: `/finish-story` streamlined clean (BASELINE)
- [ ] Start story: `/start-story E10-S07`
- [ ] Implement + commit: `echo "feat" > src/feat.tsx && git add -A && git commit -m "feat"`
- [ ] Verify clean: `git status --porcelain` → empty
- [ ] Run finish: `/finish-story E10-S07` (no prior review)
- [ ] Expect: ✅ Inline reviews execute
- [ ] Expect: PR created with all changes
- [ ] Verify: Story marked `completed`

### Post-Test Cleanup

- [ ] Delete test branches: `git branch -D feature/e10-s*`
- [ ] Delete story files: `rm docs/implementation-artifacts/story-e10-s*.md`
- [ ] Return to main: `git checkout main`
- [ ] Verify clean: `git status --porcelain` → empty

---

## Implementation Notes

### Priority Order

1. **HIGH**: Fix Test 2 (`/finish-story` streamlined)
   - Currently broken — reviews analyze nothing
   - Blocks PR creation workflow

2. **MEDIUM**: Fix Test 4 (`/start-story` new story)
   - Currently warns but allows dirty tree
   - Causes mixed work across branches

3. **LOW**: Implement Test 3 warning (`/finish-story` comprehensive)
   - Nice-to-have safeguard
   - User already reviewed, so less critical

### Test 5 Exception Logic

```bash
# In /start-story Step 4
CURRENT_BRANCH=$(git branch --show-current)
STORY_FILE="docs/implementation-artifacts/story-${STORY_ID}.md"

# Check if resuming existing story
if [[ -f "$STORY_FILE" ]]; then
  STORY_STATUS=$(grep "^status:" "$STORY_FILE" | awk '{print $2}')
  EXPECTED_BRANCH=$(grep "^branch:" "$STORY_FILE" | awk '{print $2}')

  if [[ "$STORY_STATUS" == "in-progress" ]] && [[ "$CURRENT_BRANCH" == "$EXPECTED_BRANCH" ]]; then
    # Exception: Resuming work, allow dirty tree
    echo "ℹ️  Resuming in-progress story $STORY_ID"
    SKIP_CLEAN_CHECK=true
  fi
fi

# Only enforce clean tree for NEW stories
if [[ "$SKIP_CLEAN_CHECK" != "true" ]]; then
  if [ -n "$(git status --porcelain)" ]; then
    echo "❌ Uncommitted changes detected..."
    exit 1
  fi
fi
```

---

## Success Criteria

All 7 tests must pass with expected behavior:

- ✅ Test 1: Existing enforcement works
- ✅ Test 2: Streamlined mode blocks on dirty tree
- ✅ Test 3: Comprehensive mode warns on dirty tree
- ✅ Test 4: New story blocks on dirty tree
- ✅ Test 5: Resume story allows dirty tree
- ✅ Test 6: Clean tree passes review
- ✅ Test 7: Clean tree passes streamlined finish

**Definition of "Pass"**:
- Correct blocking/warning behavior
- Appropriate error messages shown
- User given actionable fix options
- Git history remains clean
- Reviews analyze all intended changes
