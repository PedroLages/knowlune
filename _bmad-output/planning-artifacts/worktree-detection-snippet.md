# Worktree Detection Snippet

This snippet should be inserted as **Step 1.5** in both `/review-story` and `/finish-story`, immediately after Step 1 (story ID parsing) and before Step 2 (reading story file).

## Step 1.5: Detect worktree and resolve base path

Before reading story files, detect if the current branch belongs to a git worktree and resolve the correct base path for file operations.

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

**Update all file path references in subsequent steps to use `$BASE_PATH`:**

Before:
```bash
STORY_FILE="docs/implementation-artifacts/${STORY_KEY}.md"
TEST_FILE="tests/e2e/story-${STORY_ID}.spec.ts"
REPORT_FILE="docs/reviews/design/design-review-${DATE}-${STORY_ID}.md"
```

After:
```bash
STORY_FILE="${BASE_PATH}/docs/implementation-artifacts/${STORY_KEY}.md"
TEST_FILE="${BASE_PATH}/tests/e2e/story-${STORY_ID}.spec.ts"
REPORT_FILE="${BASE_PATH}/docs/reviews/design/design-review-${DATE}-${STORY_ID}.md"
```

**Why this works:**
- `git worktree list --porcelain` outputs machine-readable format with branch refs
- AWK script extracts the worktree path for the current branch
- If path exists and differs from current root → we're in main workspace, use worktree path
- If path equals current root → we're already in the worktree, use current path
- If no path found → no worktree, use current path

**Edge cases handled:**
1. ✅ Story started without worktree → `WORKTREE_PATH` is empty → uses `$CURRENT_ROOT`
2. ✅ Story started with worktree, running from worktree → `WORKTREE_PATH == CURRENT_ROOT` → uses `$CURRENT_ROOT`
3. ✅ Story started with worktree, running from main workspace → `WORKTREE_PATH != CURRENT_ROOT` → uses `$WORKTREE_PATH`
4. ✅ Multiple worktrees → AWK filters by current branch → finds correct worktree

**Note**: Skills should document this step's behavior in their "Recovery" section to explain why file paths work even when running from the wrong directory.
