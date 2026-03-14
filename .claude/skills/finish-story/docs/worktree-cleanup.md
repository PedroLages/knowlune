# Worktree Cleanup

Post-PR cleanup for stories started in git worktrees.

## When to Clean Up

Clean up the worktree after:
- ✅ PR is merged to main
- ✅ All changes are in the main branch
- ✅ No more work needed on the story branch

**Do NOT clean up if:**
- ❌ PR is still open (additional changes may be needed)
- ❌ Waiting for review feedback
- ❌ Want to keep the worktree for reference

## Detection

Check if running in a worktree:

```bash
CURRENT_ROOT=$(git rev-parse --show-toplevel)

# Worktree paths contain "-worktrees/"
if [[ "$CURRENT_ROOT" == *"-worktrees/"* ]]; then
  echo "Running in worktree"
else
  echo "Running in main workspace"
fi
```

## Cleanup Steps

### If in Worktree (Automatic)

```bash
# 1. Extract story key
STORY_KEY=$(basename $(pwd))  # e.g., "e01-s03-organize-courses-by-topic"

# 2. Save current worktree path
WORKTREE_PATH=$(pwd)

# 3. Switch to main workspace
PROJECT_NAME=$(git remote get-url origin | sed 's/.*\///' | sed 's/.git$//')
MAIN_WORKSPACE=$(dirname "$(git rev-parse --show-toplevel)" | sed 's/-worktrees$//')
cd "$MAIN_WORKSPACE"

# 4. Clean up worktree (uses project worktree-cleanup script)
worktree-cleanup "${STORY_KEY}"

# 5. Checkout main and pull
git checkout main
git pull
```

**Output:**
```
✅ Worktree cleanup complete!
📂 You're now in main workspace
🌿 On branch: main

Cleaned up:
- Removed worktree: ${WORKTREE_PATH}
- Deleted branch: feature/${STORY_KEY}
```

### If NOT in Worktree (Manual Option)

If the story was started in a worktree but `/finish-story` is run from the main workspace:

```bash
# Just switch to main and pull
git checkout main
git pull
```

**Inform user:**
```
ℹ️  This story has a worktree but you're in the main workspace.

After the PR is merged, clean up the worktree manually:
  worktree-cleanup {story-key-lower}

Or let the worktree cleanup happen automatically by running /finish-story from within the worktree.
```

## Manual Cleanup (Fallback)

If the `worktree-cleanup` script is unavailable or fails:

```bash
# 1. List worktrees to find the path
git worktree list

# 2. Remove the worktree
git worktree remove /path/to/worktree/{story-key}

# 3. Delete the branch
git branch -D feature/{story-key}
```

## Recovery

**If cleanup fails:**

1. **Worktree still has uncommitted changes:**
   ```bash
   cd /path/to/worktree/{story-key}
   git status
   # Commit or stash changes, then retry cleanup
   ```

2. **Branch can't be deleted (upstream exists):**
   ```bash
   # Force delete if you're sure the branch is merged
   git branch -D feature/{story-key}
   ```

3. **Worktree directory locked:**
   ```bash
   # Force remove
   git worktree remove --force /path/to/worktree/{story-key}
   ```

4. **Worktree cleanup script not found:**
   ```
   ⚠️  worktree-cleanup script not found.

   Manual cleanup required:
     git worktree remove /path/to/worktree/{story-key}
     git branch -D feature/{story-key}
   ```

## Best Practices

1. **Clean up promptly** - Don't let old worktrees accumulate
2. **Verify PR is merged** - Check GitHub/git log before cleanup
3. **Commit first** - Ensure all work is committed before cleanup
4. **Keep main workspace clean** - Only active worktrees should exist

## Alternatives

If you prefer to keep the worktree:

1. Select "No" when asked if PR is merged
2. Continue making changes in the worktree
3. Run `/finish-story` again after the PR is merged
4. Or manually clean up later with `worktree-cleanup {story-key}`
