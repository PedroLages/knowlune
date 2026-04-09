#!/bin/bash
#
# Review Story Checkpoint
# Save and restore review run state between sessions
#
# Usage:
#   ./checkpoint.sh save --story-id=E01-S03 --story-file=PATH [--base-path=PATH]
#   ./checkpoint.sh restore --story-id=E01-S03 [--base-path=PATH]
#
# Exit codes:
#   0 - Success
#   1 - Error (missing args, file not found)
#
# Output:
#   JSON state object to stdout
#   Human-readable progress to stderr

set -euo pipefail

# Colors for stderr output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Default values
STORY_ID=""
STORY_FILE=""
BASE_PATH=$(git rev-parse --show-toplevel 2>/dev/null || pwd)
COMMAND=""

# Helper functions
log_info() {
  echo -e "${BLUE}ℹ${NC} $1" >&2
}

log_success() {
  echo -e "${GREEN}✓${NC} $1" >&2
}

log_error() {
  echo -e "${RED}✗${NC} $1" >&2
}

# Get current timestamp in ISO 8601 format (UTC)
get_timestamp() {
  date -u +"%Y-%m-%dT%H:%M:%SZ"
}

# Parse arguments
for arg in "$@"; do
  case $arg in
    --story-id=*)
      STORY_ID="${arg#*=}"
      ;;
    --story-file=*)
      STORY_FILE="${arg#*=}"
      ;;
    --base-path=*)
      BASE_PATH="${arg#*=}"
      ;;
    save|restore)
      COMMAND="$arg"
      ;;
    *)
      echo "Unknown argument: $arg" >&2
      exit 1
      ;;
  esac
done

# Validate required arguments
if [ -z "$COMMAND" ]; then
  log_error "Missing command. Usage: $0 [save|restore] --story-id=E01-S03 ..."
  exit 1
fi

if [ -z "$STORY_ID" ]; then
  log_error "Missing --story-id"
  exit 1
fi

# State directory paths
STATE_DIR="${BASE_PATH}/.claude/state/review-story"
STATE_FILE="${STATE_DIR}/review-run-${STORY_ID}.json"
AGENT_RESULTS_DIR="${STATE_DIR}/agent-results"

# Normalize story ID for file paths (lowercase)
STORY_ID_LOWER=$(echo "$STORY_ID" | tr '[:upper:]' '[:lower:]')

# Extract frontmatter value from YAML
extract_yaml_value() {
  local file="$1"
  local key="$2"
  awk -F': ' "/^${key}:/ {print \$2; exit}" "$file" | tr -d '\"\r' | sed 's/^[[:space:]]*//;s/[[:space:]]*$//'
}

# Parse YAML array to JSON array (e.g., "[build, lint]" -> ["build", "lint"])
parse_yaml_array() {
  local value="$1"
  if [ -z "$value" ] || [ "$value" = "[]" ]; then
    echo "[]"
  else
    # Remove brackets, split by comma, wrap each item in quotes, format as JSON array
    echo "$value" | sed 's/^\[//;s/\]$//' | tr ',' '\n' | sed 's/^[[:space:]]*//;s/[[:space:]]*$//' | grep -v '^$' | sed 's/.*/"&"/' | tr '\n' ',' | sed 's/,$//; s/^/[/;s/$/]/'
  fi
}

# SAVE command
if [ "$COMMAND" = "save" ]; then
  if [ -z "$STORY_FILE" ]; then
    log_error "Missing --story-file for save command"
    exit 1
  fi

  # Ensure story file exists
  if [ ! -f "${BASE_PATH}/${STORY_FILE}" ]; then
    log_error "Story file not found: ${BASE_PATH}/${STORY_FILE}"
    exit 1
  fi

  # Create state directories
  mkdir -p "$AGENT_RESULTS_DIR"

  # Read frontmatter values
  REVIEWED=$(extract_yaml_value "${BASE_PATH}/${STORY_FILE}" "reviewed" || echo "false")
  REVIEW_STARTED=$(extract_yaml_value "${BASE_PATH}/${STORY_FILE}" "review_started" || echo "")
  REVIEW_GATES_PASSED=$(extract_yaml_value "${BASE_PATH}/${STORY_FILE}" "review_gates_passed" || echo "")
  BURN_IN_VALIDATED=$(extract_yaml_value "${BASE_PATH}/${STORY_FILE}" "burn_in_validated" || echo "false")

  # Parse gates_passed as JSON array
  GATES_PASSED_JSON=$(parse_yaml_array "$REVIEW_GATES_PASSED")

  # Build JSON state
  TIMESTAMP=$(get_timestamp)

  # If state file exists, preserve gates object and events
  if [ -f "$STATE_FILE" ]; then
    # Preserve existing gates and events if present
    EXISTING_GATES=$(jq -c '.gates // {}' "$STATE_FILE" 2>/dev/null || echo '{}')
    EXISTING_EVENTS=$(jq -c '.events // []' "$STATE_FILE" 2>/dev/null || echo '[]')
  else
    EXISTING_GATES='{}'
    EXISTING_EVENTS='[]'
  fi

  cat > "$STATE_FILE" <<EOF
{
  "schema_version": 1,
  "producer": "review-story",
  "created_at": "$TIMESTAMP",
  "updated_at": "$TIMESTAMP",
  "story_id": "$STORY_ID",
  "story_file": "$STORY_FILE",
  "status": "$([ "$REVIEWED" = "true" ] && echo "completed" || echo "$REVIEWED")",
  "gates": $EXISTING_GATES,
  "gates_passed_list": $GATES_PASSED_JSON,
  "precheck_results": null,
  "bundle_path": "${STATE_DIR}/review-bundle-${STORY_ID}.json",
  "agent_results_dir": "$AGENT_RESULTS_DIR",
  "next_step": null,
  "verdict": null,
  "has_ui_changes": null,
  "review_type": "full",
  "events": $EXISTING_EVENTS
}
EOF

  log_success "Review state saved to $STATE_FILE"
  cat "$STATE_FILE"

# RESTORE command
elif [ "$COMMAND" = "restore" ]; then
  # Try to read state file
  if [ -f "$STATE_FILE" ]; then
    cat "$STATE_FILE"
    log_success "Review state restored from $STATE_FILE"
  else
    # Fallback: parse from story frontmatter
    # Find story file by globbing if not provided
    if [ -z "$STORY_FILE" ]; then
      STORY_FILE=$(find "${BASE_PATH}/docs/implementation-artifacts" -name "*${STORY_ID_LOWER}*.md" 2>/dev/null | head -1 || true)
    fi

    if [ -z "$STORY_FILE" ]; then
      log_error "No state file found and could not locate story file for $STORY_ID"
      exit 1
    fi

    # Read frontmatter values
    REVIEWED=$(extract_yaml_value "${BASE_PATH}/${STORY_FILE}" "reviewed" || echo "false")
    REVIEW_STARTED=$(extract_yaml_value "${BASE_PATH}/${STORY_FILE}" "review_started" || echo "")
    REVIEW_GATES_PASSED=$(extract_yaml_value "${BASE_PATH}/${STORY_FILE}" "review_gates_passed" || echo "")

    # Parse gates_passed as JSON array
    GATES_PASSED_JSON=$(parse_yaml_array "$REVIEW_GATES_PASSED")

    # Build minimal state from frontmatter
    TIMESTAMP=$(get_timestamp)

    cat <<EOF
{
  "schema_version": 1,
  "producer": "review-story",
  "created_at": "$TIMESTAMP",
  "updated_at": "$TIMESTAMP",
  "story_id": "$STORY_ID",
  "story_file": "$STORY_FILE",
  "status": "$REVIEWED",
  "gates": {},
  "gates_passed_list": $GATES_PASSED_JSON,
  "precheck_results": null,
  "bundle_path": null,
  "agent_results_dir": "$AGENT_RESULTS_DIR",
  "next_step": null,
  "verdict": null,
  "has_ui_changes": null,
  "review_type": "full",
  "events": []
}
EOF

    log_info "Review state restored from story frontmatter (fallback)"
  fi
fi
