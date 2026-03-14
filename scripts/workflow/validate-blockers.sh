#!/usr/bin/env bash

# validate-blockers.sh - Check if code review blockers are still present
#
# Usage:
#   ./scripts/workflow/validate-blockers.sh \
#     --report=path/to/code-review-report.md \
#     --base-path=/path/to/project
#
# Exit codes:
#   0 - No blockers or all blockers resolved
#   1 - Unresolved blockers found
#   2 - Script error (missing report, invalid format)

set -euo pipefail

# Parse arguments
REPORT=""
BASE_PATH="."

while [[ $# -gt 0 ]]; do
  case $1 in
    --report=*)
      REPORT="${1#*=}"
      shift
      ;;
    --base-path=*)
      BASE_PATH="${1#*=}"
      shift
      ;;
    *)
      echo "Unknown option: $1" >&2
      exit 2
      ;;
  esac
done

# Validate inputs
if [[ -z "$REPORT" ]]; then
  echo "❌ Error: --report is required" >&2
  exit 2
fi

# Expand glob pattern to find the latest report
REPORT_PATTERN="$REPORT"
REPORT_FILE=$(ls -t ${REPORT_PATTERN} 2>/dev/null | head -1)

if [[ ! -f "$REPORT_FILE" ]]; then
  echo "❌ Error: Code review report not found: $REPORT_PATTERN" >&2
  exit 2
fi

# Extract blockers section from report
BLOCKERS_SECTION=$(sed -n '/^#### Blockers/,/^####/p' "$REPORT_FILE" | grep -v '^####')

# If blockers section is empty or contains only "None", exit success
if [[ -z "$BLOCKERS_SECTION" ]] || echo "$BLOCKERS_SECTION" | grep -qi "^None"; then
  echo "✅ No blockers found in code review report"
  exit 0
fi

# Parse blockers and check if they're still present
UNRESOLVED_BLOCKERS=()
RESOLVED_BLOCKERS=()

while IFS= read -r line; do
  # Skip empty lines and section headers
  [[ -z "$line" ]] && continue
  [[ "$line" =~ ^# ]] && continue

  # Extract file:line pattern from blocker line
  # Format: "- [file.ts:123]: Description"
  if [[ "$line" =~ \[([^:]+):([0-9]+)\] ]]; then
    FILE="${BASH_REMATCH[1]}"
    LINE="${BASH_REMATCH[2]}"
    DESCRIPTION=$(echo "$line" | sed 's/^[^:]*:[^:]*]: *//')

    # Check if file exists at HEAD
    if ! git cat-file -e HEAD:"$FILE" 2>/dev/null; then
      # File was deleted - consider blocker resolved
      RESOLVED_BLOCKERS+=("$FILE:$LINE - File deleted")
      continue
    fi

    # Get the line from current HEAD
    CURRENT_LINE=$(git show HEAD:"$FILE" 2>/dev/null | sed -n "${LINE}p" || echo "")

    # Simple heuristic: if the line is empty or significantly different,
    # consider it potentially resolved
    if [[ -z "$CURRENT_LINE" ]] || [[ ${#CURRENT_LINE} -lt 10 ]]; then
      # Line is empty or very short - likely changed
      RESOLVED_BLOCKERS+=("$FILE:$LINE - Line changed")
    else
      # Line still exists - mark as potentially unresolved
      # (Manual review recommended)
      UNRESOLVED_BLOCKERS+=("$FILE:$LINE: $DESCRIPTION")
    fi
  fi
done <<< "$BLOCKERS_SECTION"

# Report results
if [[ ${#UNRESOLVED_BLOCKERS[@]} -eq 0 ]]; then
  if [[ ${#RESOLVED_BLOCKERS[@]} -gt 0 ]]; then
    echo "ℹ️  Code review had ${#RESOLVED_BLOCKERS[@]} blocker(s); code has changed since review."
    echo "Proceeding with validation."
  else
    echo "✅ No blockers found"
  fi
  exit 0
else
  echo "❌ Cannot ship — ${#UNRESOLVED_BLOCKERS[@]} unresolved blocker(s) from code review:"
  echo ""
  for i in "${!UNRESOLVED_BLOCKERS[@]}"; do
    echo "$((i + 1)). ${UNRESOLVED_BLOCKERS[$i]}"
  done
  echo ""
  echo "Fix these and re-run /finish-story."
  exit 1
fi
