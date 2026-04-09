#!/bin/bash
#
# Review Story State Manager
# One-shot init/resume for a review run. Replaces inline bash in SKILL.md Step 1.
#
# Usage:
#   ./review-state.sh --story-id=E01-S03 [--base-path=PATH]
#   ./review-state.sh [--base-path=PATH]   # derives ID from branch name
#
# Stdout contract:
#   JSON object with resolved story context — for orchestrator to parse with jq
#   All informational messages → stderr
#
# Output JSON fields:
#   story_id          - Resolved story ID (e.g., "E107-S04")
#   story_file        - Relative path to story markdown file
#   base_path         - Absolute base path (worktree root or repo root)
#   is_worktree       - true if running in a git worktree
#   previous_status   - reviewed field value before this run ("false"/"in-progress"/"true")
#   current_status    - reviewed field value after init ("in-progress")
#   resuming          - true if this is a resumed interrupted review
#   gates_already_passed - array of gate names already passed (for agent skip logic)
#   run_state_path    - path to .claude/state/review-story/review-run-{id}.json
#   log_dir           - path to per-story log directory

set -euo pipefail

# Colors
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m'

log_info()    { echo -e "${BLUE}ℹ${NC} $1" >&2; }
log_success() { echo -e "${GREEN}✓${NC} $1" >&2; }
log_warning() { echo -e "${YELLOW}⚠${NC} $1" >&2; }
log_error()   { echo -e "${RED}✗${NC} $1" >&2; }

# Default values
STORY_ID=""
BASE_PATH=""

for arg in "$@"; do
  case $arg in
    --story-id=*)
      STORY_ID="${arg#*=}"
      ;;
    --base-path=*)
      BASE_PATH="${arg#*=}"
      ;;
    *)
      log_error "Unknown argument: $arg"
      exit 1
      ;;
  esac
done

# ── 1. Worktree + base-path resolution ──────────────────────────────────────

CURRENT_BRANCH=$(git branch --show-current 2>/dev/null || echo "")
CURRENT_ROOT=$(git rev-parse --show-toplevel 2>/dev/null || pwd)

if [ -z "$BASE_PATH" ]; then
  # Detect worktree: find worktree whose branch matches current branch
  WORKTREE_PATH=$(git worktree list --porcelain 2>/dev/null | awk \
    '/^worktree / { path=$2 }
     /^branch /   { if ($2 == "refs/heads/'"$CURRENT_BRANCH"'") { print path; exit } }')

  if [ -n "$WORKTREE_PATH" ] && [ "$WORKTREE_PATH" != "$CURRENT_ROOT" ]; then
    BASE_PATH="$WORKTREE_PATH"
    log_warning "Worktree detected — using $WORKTREE_PATH" >&2
    IS_WORKTREE=true
  else
    BASE_PATH="$CURRENT_ROOT"
    IS_WORKTREE=false
  fi
else
  IS_WORKTREE=false
fi

# ── 2. Story ID resolution ───────────────────────────────────────────────────

if [ -z "$STORY_ID" ]; then
  if [ -z "$CURRENT_BRANCH" ]; then
    log_error "Cannot resolve story ID: no --story-id provided and not in a git branch"
    exit 1
  fi
  # Extract from branch name: feature/e107-s04-wire-about-book-dialog → E107-S04
  STORY_ID=$(echo "$CURRENT_BRANCH" | grep -oiE 'e[0-9]+-s[0-9]+' | head -1 | tr '[:lower:]' '[:upper:]' || true)
  if [ -z "$STORY_ID" ]; then
    log_error "Cannot derive story ID from branch name '$CURRENT_BRANCH'. Use --story-id=E##-S##"
    exit 1
  fi
  log_info "Derived story ID from branch: $STORY_ID"
fi

STORY_ID_LOWER=$(echo "$STORY_ID" | tr '[:upper:]' '[:lower:]')

# ── 3. Locate story file ─────────────────────────────────────────────────────

STORY_FILE=$(find "${BASE_PATH}/docs/implementation-artifacts" \
  -maxdepth 1 -name "*${STORY_ID_LOWER}*.md" 2>/dev/null | head -1 || true)

if [ -z "$STORY_FILE" ]; then
  log_error "Story file not found for $STORY_ID in ${BASE_PATH}/docs/implementation-artifacts"
  exit 1
fi

# Store as relative path (consistent with checkpoint.sh)
STORY_FILE_REL="${STORY_FILE#${BASE_PATH}/}"
log_info "Story file: $STORY_FILE_REL"

# ── 4. Load existing review state ───────────────────────────────────────────

STATE_DIR="${BASE_PATH}/.claude/state/review-story"
RUN_STATE_PATH="${STATE_DIR}/review-run-${STORY_ID}.json"

STATE_JSON=$(bash "${BASE_PATH}/scripts/workflow/checkpoint.sh" \
  restore --story-id="$STORY_ID" --base-path="$BASE_PATH" 2>/dev/null || true)

extract_yaml_value() {
  local file="$1" key="$2"
  awk -F': ' "/^${key}:/ {print \$2; exit}" "$file" \
    | tr -d '"' | sed 's/^[[:space:]]*//;s/[[:space:]]*$//'
}

if [ -n "$STATE_JSON" ]; then
  RUN_STATUS=$(echo "$STATE_JSON" | jq -r '.status // "false"')
  GATES_PASSED_JSON=$(echo "$STATE_JSON" | jq -c '.gates_passed_list // []')
  case "$RUN_STATUS" in
    "completed")          PREV_STATUS="true" ;;
    "in-progress"|"blocked") PREV_STATUS="in-progress" ;;
    *)                    PREV_STATUS="false" ;;
  esac
else
  PREV_STATUS=$(extract_yaml_value "$STORY_FILE" "reviewed" || echo "false")
  GATES_PASSED_JSON="[]"
fi

GATES_PASSED_COUNT=$(echo "$GATES_PASSED_JSON" | jq 'length')

# ── 5. Determine action + set resuming flag ──────────────────────────────────

RESUMING=false

case "$PREV_STATUS" in
  "in-progress")
    if [ "$GATES_PASSED_COUNT" -gt 0 ]; then
      RESUMING=true
      GATES_LIST=$(echo "$GATES_PASSED_JSON" | jq -r '.[]' | tr '\n' ',' | sed 's/,$//')
      log_info "Resuming interrupted review. Previously passed gates: $GATES_LIST"
    fi
    # Do NOT sync sprint-status on resume — already set
    ;;
  "true")
    log_info "Story already reviewed. Re-running full review — resetting state."
    GATES_PASSED_JSON="[]"
    GATES_PASSED_COUNT=0
    # Sprint-status is already 'review' or 'done'; leave it alone (Amendment 3)
    ;;
  *)
    # Fresh review
    RESUMING=false
    ;;
esac

# ── 6. Update story frontmatter ──────────────────────────────────────────────

TODAY=$(date +%Y-%m-%d)

update_frontmatter_field() {
  local file="$1" key="$2" value="$3"
  if grep -q "^${key}:" "$file"; then
    # macOS-compatible sed in-place
    sed -i '' "s|^${key}:.*|${key}: ${value}|" "$file"
  else
    # Insert before closing --- of frontmatter
    sed -i '' "/^---$/{
      /^---$/!d
    }" "$file" 2>/dev/null || true
    # Append before second ---
    python3 -c "
import sys, re
content = open('$file').read()
m = re.match(r'^(---\n.*?\n)(---\n)', content, re.DOTALL)
if m:
    new_content = m.group(1) + '${key}: ${value}\n' + m.group(2) + content[m.end():]
    open('$file', 'w').write(new_content)
" 2>/dev/null || true
  fi
}

update_frontmatter_field "$STORY_FILE" "reviewed" "in-progress"
update_frontmatter_field "$STORY_FILE" "review_started" "$TODAY"
update_frontmatter_field "$STORY_FILE" "review_gates_passed" "[]"

log_success "Story frontmatter updated: reviewed=in-progress"

# ── 7. Sync sprint-status.yaml (fresh review only) ───────────────────────────

SPRINT_STATUS_FILE="${BASE_PATH}/docs/implementation-artifacts/sprint-status.yaml"

if [ "$PREV_STATUS" = "false" ] && [ -f "$SPRINT_STATUS_FILE" ]; then
  # Derive sprint-status key from story file basename
  # e107-s04-wire-about-book-dialog.md → 107-4-wire-about-book-dialog
  FILE_BASE=$(basename "$STORY_FILE" .md)
  if echo "$FILE_BASE" | grep -qE '^e[0-9]+-s[0-9]+-'; then
    EPIC_NUM=$(echo "$FILE_BASE" | sed 's/^e\([0-9]*\)-.*/\1/')
    STORY_NUM=$(echo "$FILE_BASE" | sed 's/^e[0-9]*-s0*\([0-9]*\)-.*/\1/')
    STORY_NAME=$(echo "$FILE_BASE" | sed 's/^e[0-9]*-s[0-9]*-//')
    SPRINT_KEY="${EPIC_NUM}-${STORY_NUM}-${STORY_NAME}"
  else
    SPRINT_KEY="$FILE_BASE"
  fi

  if grep -q "^  ${SPRINT_KEY}:" "$SPRINT_STATUS_FILE"; then
    sed -i '' "s|^  ${SPRINT_KEY}:.*|  ${SPRINT_KEY}: review|" "$SPRINT_STATUS_FILE"
    log_success "Sprint status updated: ${SPRINT_KEY} → review"
  else
    log_warning "Sprint status key '${SPRINT_KEY}' not found — skipping sync"
  fi
fi

# ── 8. Create log directory ──────────────────────────────────────────────────

LOG_DIR="${STATE_DIR}/logs/${STORY_ID}"
mkdir -p "$LOG_DIR"

# ── 9. Save state via checkpoint.sh ─────────────────────────────────────────

bash "${BASE_PATH}/scripts/workflow/checkpoint.sh" \
  save \
  --story-id="$STORY_ID" \
  --story-file="$STORY_FILE_REL" \
  --base-path="$BASE_PATH" \
  >/dev/null

log_success "Review state initialized for $STORY_ID"

# ── 10. Output JSON result ───────────────────────────────────────────────────

cat <<EOF
{
  "story_id": "$STORY_ID",
  "story_file": "$STORY_FILE_REL",
  "base_path": "$BASE_PATH",
  "is_worktree": $IS_WORKTREE,
  "previous_status": "$PREV_STATUS",
  "current_status": "in-progress",
  "resuming": $RESUMING,
  "gates_already_passed": $GATES_PASSED_JSON,
  "run_state_path": "${RUN_STATE_PATH#${BASE_PATH}/}",
  "log_dir": "${LOG_DIR#${BASE_PATH}/}"
}
EOF
