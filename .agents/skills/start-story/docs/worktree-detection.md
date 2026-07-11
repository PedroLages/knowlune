# Worktree Detection and Base Path Resolution

This module detects if the current branch belongs to a git worktree and resolves the correct base path for file operations. Used by all story workflow skills (start-story, review-story, finish-story).

## When to Use

Call this detection logic before reading story files to ensure you're operating on the correct workspace:

- ✅ Before reading `docs/implementation-artifacts/{story-file}.md`
- ✅ Before reading `docs/implementation-artifacts/sprint-status.yaml`
- ✅ Before running pre-checks, reviews, or other file operations
- ✅ At the beginning of any story workflow orchestration

## Detection Logic

```bash
# Get current git context
CURRENT_BRANCH=$(git branch --show-current)
CURRENT_ROOT=$(git rev-parse --show-toplevel)

# Check if current branch belongs to a worktree
WORKTREE_PATH=$(git worktree list --porcelain 2>/dev/null | awk '
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
  # Branch has a worktree, but we're in the main workspace
  BASE_PATH="$WORKTREE_PATH"

  echo "⚠️  Worktree detected" >&2
  echo "This story was started in a git worktree." >&2
  echo "📍 Worktree: $WORKTREE_PATH" >&2
  echo "📂 Current:  $CURRENT_ROOT" >&2
  echo "Using worktree path for file operations." >&2
  echo "" >&2
else
  # Either no worktree, or we're already in it
  BASE_PATH="$CURRENT_ROOT"
fi
```

## How It Works

1. **Get current context**: Identifies the current branch and git root directory
2. **Query worktree list**: Parses `git worktree list --porcelain` to find if the current branch has a worktree
3. **Determine base path**:
   - If worktree exists AND we're NOT in it → use worktree path
   - Otherwise → use current root (either no worktree, or we're already in it)
4. **User notification**: Displays worktree location if detected

## Usage in Story Workflow Skills

**All subsequent file operations must use `${BASE_PATH}/` prefix:**

```bash
# ✅ Correct - uses BASE_PATH
STORY_FILE="${BASE_PATH}/docs/implementation-artifacts/${STORY_ID}.md"
SPRINT_STATUS="${BASE_PATH}/docs/implementation-artifacts/sprint-status.yaml"

# ❌ Wrong - hardcoded paths fail in worktrees
STORY_FILE="docs/implementation-artifacts/${STORY_ID}.md"
```

## Example Scenarios

### Scenario 1: No Worktree
```bash
$ git branch --show-current
main

# Detection runs...
BASE_PATH="/Volumes/SSD/Dev/Apps/Elearningplatformwireframes"
# No worktree message shown
```

### Scenario 2: In Worktree
```bash
$ git branch --show-current
feature/e01-s03-organize-courses

$ pwd
/Volumes/SSD/Dev/Apps/Elearningplatformwireframes-worktrees/e01-s03-organize-courses

# Detection runs...
BASE_PATH="/Volumes/SSD/Dev/Apps/Elearningplatformwireframes-worktrees/e01-s03-organize-courses"
# No worktree message shown (already in it)
```

### Scenario 3: Worktree Exists, Running from Main
```bash
$ git branch --show-current
main

$ pwd
/Volumes/SSD/Dev/Apps/Elearningplatformwireframes

# Detection runs...
⚠️  Worktree detected
This story was started in a git worktree.
📍 Worktree: /Volumes/SSD/Dev/Apps/Elearningplatformwireframes-worktrees/e01-s03-organize-courses
📂 Current:  /Volumes/SSD/Dev/Apps/Elearningplatformwireframes
Using worktree path for file operations.

BASE_PATH="/Volumes/SSD/Dev/Apps/Elearningplatformwireframes-worktrees/e01-s03-organize-courses"
```

## Why This Matters

**Without worktree detection:**
- ❌ Reading story files from wrong workspace (stale or missing files)
- ❌ Running pre-checks against wrong code (main vs feature branch)
- ❌ Review agents analyze wrong files
- ❌ Confusing errors ("file not found" when it exists in worktree)

**With worktree detection:**
- ✅ Correct files read regardless of where skill is invoked
- ✅ Pre-checks run against correct code
- ✅ Reviews analyze the actual feature branch code
- ✅ Works seamlessly whether in main workspace or worktree

## Related Documentation

- **[Worktree Setup](worktree-setup.md)** — Creating and managing worktrees (step 0 of `/start-story`)
- **[Worktree Cleanup](../../finish-story/docs/worktree-cleanup.md)** — Cleaning up after PR merge
- **[Superpowers: Using Git Worktrees](../../superpowers/using-git-worktrees/SKILL.md)** — Underlying worktree creation skill
