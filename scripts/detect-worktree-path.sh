#!/usr/bin/env bash
#
# Worktree Path Detection Helper
#
# Detects if the current branch belongs to a git worktree and resolves the correct
# base path for reading story files and other artifacts.
#
# Usage:
#   source scripts/detect-worktree-path.sh
#   echo "Base path: $BASE_PATH"
#   echo "In worktree: $IN_WORKTREE"
#

set -euo pipefail

# Get current branch and git root
CURRENT_BRANCH=$(git branch --show-current)
CURRENT_ROOT=$(git rev-parse --show-toplevel)

# Initialize variables
BASE_PATH="$CURRENT_ROOT"
IN_WORKTREE=false
WORKTREE_PATH=""

# Check if current branch belongs to a worktree
if git worktree list --porcelain &> /dev/null; then
  # Parse git worktree list to find worktree for current branch
  # Format: worktree /path/to/worktree
  #         HEAD abcd1234...
  #         branch refs/heads/feature/e09-s01-...

  WORKTREE_INFO=$(git worktree list --porcelain | awk '
    /^worktree / { path=$2 }
    /^branch / {
      if ($2 == "refs/heads/'"$CURRENT_BRANCH"'") {
        print path
        exit
      }
    }
  ')

  if [ -n "$WORKTREE_INFO" ]; then
    WORKTREE_PATH="$WORKTREE_INFO"

    # Check if we're currently in the worktree or main workspace
    if [ "$WORKTREE_PATH" != "$CURRENT_ROOT" ]; then
      # We're in main workspace, but branch belongs to a worktree
      IN_WORKTREE=false
      BASE_PATH="$WORKTREE_PATH"

      echo "⚠️  Worktree Detection" >&2
      echo "────────────────────────────────────────────────────" >&2
      echo "This story was started in a git worktree." >&2
      echo "" >&2
      echo "📍 Worktree location: $WORKTREE_PATH" >&2
      echo "📂 Current location:  $CURRENT_ROOT" >&2
      echo "" >&2
      echo "Using worktree path for file operations." >&2
      echo "────────────────────────────────────────────────────" >&2
      echo "" >&2
    else
      # We're in the worktree itself
      IN_WORKTREE=true
      BASE_PATH="$CURRENT_ROOT"
    fi
  fi
fi

# Export variables for use by calling script
export BASE_PATH
export IN_WORKTREE
export WORKTREE_PATH
export CURRENT_ROOT

# Convenience function to resolve paths
resolve_path() {
  local relative_path="$1"
  echo "${BASE_PATH}/${relative_path}"
}

export -f resolve_path
