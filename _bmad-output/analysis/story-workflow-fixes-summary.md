# Story Workflow Fixes Summary

## Issues Identified

### Issue 1: Worktree Path Resolution
**Problem**: `/review-story` and `/finish-story` can't find story files when run from main workspace after story was started in a worktree.

**Root Cause**: Skills look for `docs/implementation-artifacts/` relative to CWD, but files exist in worktree directory.

**Impact**: HIGH — Skills fail completely, blocking story completion.

---

### Issue 2: Commit Requirement Enforcement
**Problem**: `/finish-story` in streamlined mode doesn't enforce committed changes, causing reviews to analyze nothing.

**Root Cause**: No pre-commit gate before running inline reviews.

**Impact**: CRITICAL — Reviews pass but don't actually review code.

---

## Solutions

### Solution 1: Worktree Detection

**Add to both `/review-story` and `/finish-story` (before reading story file):**

```markdown
1.5. **Detect worktree and resolve base path**:

```bash
# Get current branch and check if it belongs to a worktree
CURRENT_BRANCH=$(git branch --show-current)
CURRENT_ROOT=$(git rev-parse --show-toplevel)

# Find worktree path for current branch
WORKTREE_PATH=$(git worktree list --porcelain | awk '
  /^worktree / { path=$2 }
  /^branch / {
    if ($2 == "refs/heads/'"$CURRENT_BRANCH"'") {
      print path
      exit
    }
  }
')

# Determine base path for file operations
if [ -n "$WORKTREE_PATH" ] && [ "$WORKTREE_PATH" != "$CURRENT_ROOT" ]; then
  # Branch has worktree, but we're in main workspace — use worktree path
  BASE_PATH="$WORKTREE_PATH"
  echo "⚠️  Detected worktree: $WORKTREE_PATH"
  echo "Using worktree path for file operations."
else
  # Either no worktree, or we're already in it — use current root
  BASE_PATH="$CURRENT_ROOT"
fi
```

**Then update all file paths to use `$BASE_PATH`:**
- Story file: `$BASE_PATH/docs/implementation-artifacts/{key}.md`
- Test specs: `$BASE_PATH/tests/e2e/story-{id}.spec.ts`
- Review reports: `$BASE_PATH/docs/reviews/...`
```

**Files to modify:**
- `.claude/skills/review-story/SKILL.md` — Insert Step 1.5 after Step 1
- `.claude/skills/finish-story/SKILL.md` — Insert Step 1.5 after Step 1

**Helper script created:**
- `scripts/detect-worktree-path.sh` — Reusable detection logic

---

### Solution 2: Commit Requirement Enforcement

#### 2A: `/finish-story` — Block on uncommitted changes (streamlined mode)

**Add after Step 3 (before running reviews):**

```markdown
3a. **Pre-finish commit gate**:

Check review status:
- If `reviewed: false` (streamlined mode — reviews run inline):

  ```bash
  git status --porcelain
  ```

  If uncommitted changes found, STOP:
  ```
  ❌ Uncommitted changes detected.

  /finish-story in streamlined mode runs reviews inline, which analyze
  committed changes via `git diff`. Uncommitted changes will NOT be reviewed.

  Commit your changes first:
    git add -A && git commit -m "feat(E##-S##): ..."

  Then re-run /finish-story.
  ```

- If `reviewed: in-progress` or `reviewed: true` (comprehensive mode):
  Reviews already done or resuming. Skip this check (validation handles it).
```

#### 2B: `/start-story` — Block on uncommitted changes

**Upgrade Step 4 from warning to blocker:**

```markdown
4. **Enforce clean working tree** (unless resuming):

Check if this is a resumed start:
- Read sprint-status.yaml and check story status
- If status is already `in-progress` AND branch exists: **ALLOW** dirty tree (user is continuing work)
- Otherwise (new story): **REQUIRE** clean tree

```bash
git status --porcelain
```

If uncommitted changes found AND this is a NEW story:
```
❌ Uncommitted changes detected.

Starting a new story requires a clean working tree.

Options:
1. Commit:  git add -A && git commit -m "..."
2. Stash:   git stash push -u -m "WIP before E##-S##"

Cannot proceed with dirty working tree.
```
STOP.
```

---

## Implementation Plan

### Phase 1: Critical Fixes (Do Now)
1. ✅ **Create diagnostic documents** (DONE)
   - `_bmad-output/analysis/worktree-path-resolution-issue.md`
   - `_bmad-output/analysis/commit-requirement-enforcement.md`
   - `_bmad-output/analysis/story-workflow-fixes-summary.md`

2. **Fix `/finish-story` commit gate** (CRITICAL)
   - Add Step 3a (pre-finish commit gate)
   - Blocks streamlined mode if uncommitted changes
   - Prevents "reviews that review nothing"

3. **Fix worktree detection in `/review-story`**
   - Add Step 1.5 (detect worktree)
   - Update all file path references to use `$BASE_PATH`

4. **Fix worktree detection in `/finish-story`**
   - Add Step 1.5 (detect worktree)
   - Update all file path references to use `$BASE_PATH`

### Phase 2: Preventive Fixes (Do Soon)
5. **Upgrade `/start-story` enforcement**
   - Change Step 4 from warning to blocker (unless resuming)
   - Enforces clean history from the start

### Phase 3: Documentation (Do Later)
6. **Update CLAUDE.md**
   - Add "Git Working Tree Requirements" section
   - Document when commits are required
   - Reference git hooks

7. **Create git hooks** (optional)
   - `scripts/git-hooks/pre-review`
   - `scripts/git-hooks/pre-finish`
   - User installs manually

---

## Testing Checklist

After implementing fixes:

```bash
# Test 1: Worktree detection — main workspace
cd /main/workspace
git checkout feature/e09-s01-*  # Branch in worktree
/review-story E09-S01
# Expected: Detects worktree, uses worktree path ✅

# Test 2: Worktree detection — in worktree
cd /worktree/path
/review-story E09-S01
# Expected: Detects we're in worktree, uses current path ✅

# Test 3: Worktree detection — no worktree
git checkout feature/some-other-story  # No worktree
/review-story E##-S##
# Expected: Uses current path ✅

# Test 4: Commit gate — /finish-story streamlined
# Don't commit implementation
/finish-story E10-S01
# Expected: BLOCKED with commit requirement message ✅

# Test 5: Commit gate — /start-story new story
echo "test" > test.txt
/start-story E10-S02
# Expected: BLOCKED with clean tree requirement ✅

# Test 6: Commit gate — /start-story resume
echo "test" > test.txt
/start-story E10-S01  # Story already in-progress
# Expected: ALLOWED (resuming work) ✅
```

---

## Risk Assessment

| Fix | Risk Level | Complexity | Impact if Skipped |
|-----|-----------|------------|------------------|
| `/finish-story` commit gate | 🟢 Low | Simple | 🔴 HIGH — Reviews don't work |
| Worktree detection `/review-story` | 🟡 Medium | Moderate | 🔴 HIGH — Skill fails completely |
| Worktree detection `/finish-story` | 🟡 Medium | Moderate | 🔴 HIGH — Skill fails completely |
| `/start-story` enforcement | 🟢 Low | Simple | 🟡 MEDIUM — Dirty history |

**Recommendation**: Implement all Phase 1 fixes before next story.

---

## Files to Modify

1. `.claude/skills/review-story/SKILL.md`
   - Insert Step 1.5 (worktree detection)
   - Update file paths to use `$BASE_PATH`

2. `.claude/skills/finish-story/SKILL.md`
   - Insert Step 1.5 (worktree detection)
   - Insert Step 3a (commit gate)
   - Update file paths to use `$BASE_PATH`

3. `.claude/skills/start-story/SKILL.md`
   - Upgrade Step 4 (enforce clean tree for new stories)

4. `CLAUDE.md` (optional)
   - Add "Git Working Tree Requirements" section

---

## Questions?

- **Q: Will this break existing workflows?**
  - A: No. Detection is additive — if no worktree, behavior is unchanged.

- **Q: What if I WANT to review uncommitted changes?**
  - A: Commit them first. Reviews analyze committed snapshots, not working tree.

- **Q: Can I bypass the commit gate?**
  - A: Not recommended. Reviews won't work correctly without commits.

- **Q: What about merge conflicts?**
  - A: Commit gate checks `git status --porcelain` which includes conflicts. Resolve first.
