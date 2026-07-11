# Git Worktree Setup (Step 0)

This module handles optional git worktree creation for story isolation.

## Check for Existing Worktree

Extract story key from `$ARGUMENTS` (e.g., `E01-S04` → `e01-s04`)

Run: `git worktree list | grep -i {story-key-lower}`

## If Worktree Already Exists

Present options to user via AskUserQuestion:

```
⚠️ A worktree already exists for this story.

Found: {worktree-path}
Branch: {branch-name}

What would you like to do?

1. Resume in existing worktree (Recommended)
   - Change to worktree directory
   - Continue with existing branch and files
   - Safe: preserves all uncommitted work

2. Delete and recreate worktree
   - Remove existing worktree completely
   - Create fresh worktree with new branch
   - ⚠️ Warning: Any uncommitted changes will be lost

3. Skip worktree (use main workspace)
   - Work in current directory
   - Existing worktree remains untouched
   - Can clean up manually later
```

### Option 1 Selected (Resume in Existing Worktree)

- Change working directory to the existing worktree path
- Inform user: "Resumed in existing worktree at {path}"
- Proceed to Step 1 (branch and files already exist)

### Option 2 Selected (Delete and Recreate)

Run worktree cleanup:

```bash
# First, ensure we're not in the worktree directory
cd /Volumes/SSD/Dev/Apps/Elearningplatformwireframes

# Remove worktree (forces removal even if dirty)
git worktree remove --force {worktree-path}

# Delete branch if it exists
git branch -D {branch-name}
```

- Inform user: "Existing worktree removed. Creating fresh worktree..."
- Proceed to worktree creation (see "If no existing worktree" below)

### Option 3 Selected (Skip Worktree)

- Inform user: "Continuing in main workspace. Existing worktree at {path} is still available."
- Add reminder to completion output: "Cleanup existing worktree with: `worktree-cleanup {story-key-lower}`"
- Proceed to Step 1

## If No Existing Worktree Found

Ask the user via AskUserQuestion:

```
Would you like to create a git worktree for this story?

✅ Recommended for:
- Multi-day stories
- Features requiring testing in parallel
- When you want to keep main workspace stable

❌ Skip for:
- Quick hotfixes (1-2 hours)
- Simple documentation updates
- Experiments or spike work
```

### If User Selects YES

- Extract story key from `$ARGUMENTS` (e.g., `E01-S04`)
- Extract story name from epic lookup (slugified, lowercase)
- Invoke the superpowers worktree skill:
  ```
  Skill tool: skill="superpowers:using-git-worktrees", args="E##-S## story-title"
  ```
- The superpowers skill will:
  - Create worktree with proper isolation
  - Set up branch: `feature/${STORY_KEY_LOWER}-${STORY_SLUG}`
  - Provide directory path and cleanup instructions
- After skill completes, change working directory to the worktree path (provided in skill output)
- **Important**: All subsequent steps (1-14) will execute in the worktree directory

### If User Selects NO

- Continue in main workspace (current directory)
- Proceed to Step 1
