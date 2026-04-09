#!/bin/bash
#
# Review Bundle Generator
# Creates a summary-first JSON artifact for review agents
#
# Usage:
#   ./make-review-bundle.sh --story-id=E01-S03 --base-path=PATH --output=PATH
#
# Output:
#   JSON bundle written to --output path (or stdout if --output=-)
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
BASE_PATH=""
OUTPUT=""
STATE_DIR=".claude/state/review-story"

# Parse arguments
for arg in "$@"; do
  case $arg in
    --story-id=*)
      STORY_ID="${arg#*=}"
      ;;
    --base-path=*)
      BASE_PATH="${arg#*=}"
      ;;
    --output=*)
      OUTPUT="${arg#*=}"
      ;;
    *)
      echo "Unknown argument: $arg" >&2
      exit 1
      ;;
  esac
done

# Validate required args
if [ -z "$STORY_ID" ]; then
  echo "Error: --story-id is required" >&2
  exit 1
fi

# Resolve base path
if [ -z "$BASE_PATH" ]; then
  BASE_PATH=$(git rev-parse --show-toplevel)
fi
cd "$BASE_PATH"

# Normalize story ID for file lookups (E01-S03 -> e01-s03)
STORY_ID_LOWER=$(echo "$STORY_ID" | tr '[:upper:]' '[:lower:]')

# Set default output path
if [ -z "$OUTPUT" ]; then
  OUTPUT="${STATE_DIR}/review-bundle-${STORY_ID}.json"
fi

# Helper functions
log_info() {
  echo -e "${BLUE}ℹ${NC} $1" >&2
}

log_success() {
  echo -e "${GREEN}✓${NC} $1" >&2
}

log_warning() {
  echo -e "${YELLOW}⚠${NC} $1" >&2
}

log_error() {
  echo -e "${RED}✗${NC} $1" >&2
}

log_section() {
  echo -e "\n${BLUE}━━━ $1 ━━━${NC}" >&2
}

# ── Step 1: Resolve story file ──
log_section "Resolving Story File"

STORY_FILE=""
# Search in docs/implementation-artifacts/ and its subdirectories
STORY_GLOB=$(find docs/implementation-artifacts -iname "*${STORY_ID_LOWER}*.md" 2>/dev/null | head -1 || true)

if [ -n "$STORY_GLOB" ]; then
  STORY_FILE="$STORY_GLOB"
  log_success "Found story file: ${STORY_FILE}"
else
  log_warning "No story file found matching *${STORY_ID_LOWER}*"
fi

# ── Step 2: Get changed files ──
log_section "Analyzing Changes"

CHANGED_FILES=$(git diff --name-only main...HEAD 2>/dev/null || git diff --name-only origin/main...HEAD 2>/dev/null || echo "")
CHANGED_COUNT=$(echo "$CHANGED_FILES" | grep -c . || true)
log_info "Changed files: ${CHANGED_COUNT}"

# ── Step 3: Get diff stat ──
DIFF_STAT=$(git diff --stat main...HEAD 2>/dev/null | tail -1 || git diff --stat origin/main...HEAD 2>/dev/null | tail -1 || echo "0 files changed, 0 insertions(+), 0 deletions(-)")
log_info "Diff stat: ${DIFF_STAT}"

# ── Step 4: Calculate total lines changed ──
TOTAL_LINES_CHANGED=0
# Parse insertions and deletions from diff stat line
INSERTIONS=$(echo "$DIFF_STAT" | grep -oE '[0-9]+ insertion' | grep -oE '[0-9]+' || echo "0")
DELETIONS=$(echo "$DIFF_STAT" | grep -oE '[0-9]+ deletion' | grep -oE '[0-9]+' || echo "0")
TOTAL_LINES_CHANGED=$((INSERTIONS + DELETIONS))
log_info "Total lines changed: ${TOTAL_LINES_CHANGED} (${INSERTIONS}+, ${DELETIONS}-)"

# ── Step 5: Detect UI changes ──
HAS_UI_CHANGES=false
if echo "$CHANGED_FILES" | grep -qE 'src/app/(pages|components)/.*\.tsx'; then
  HAS_UI_CHANGES=true
  log_info "UI changes detected"
else
  log_info "No UI changes detected"
fi

# ── Step 6: Extract acceptance criteria from story file ──
log_section "Extracting Acceptance Criteria"

ACCEPTANCE_CRITERIA_JSON="[]"
if [ -n "$STORY_FILE" ] && [ -f "$STORY_FILE" ]; then
  # Extract the Acceptance Criteria section (between "## Acceptance Criteria" and next "##")
  # Then pull out bullet items: lines starting with "- " or numbered "**AC-N**:" items
  ACCEPTANCE_CRITERIA_JSON=$(python3 -c "
import re, sys

with open(sys.argv[1], 'r') as f:
    content = f.read()

# Find the Acceptance Criteria section
match = re.search(
    r'^## Acceptance Criteria\s*\n(.*?)(?=^##\s|\Z)',
    content,
    re.MULTILINE | re.DOTALL,
)
if not match:
    print('[]')
    sys.exit(0)

section = match.group(1)
items = []

# Pattern 1: '- **AC-N**: ...' numbered bullet items
ac_items = re.findall(r'- \*\*AC-\d+\*\*:\s*(.+)', section)
items.extend(ac_items)

# Pattern 2: '**Given** ...' blocks (one per Given line, condensed)
if not ac_items:
    given_blocks = re.findall(r'\*\*Given\*\*\s*(.+?)(?=\n\*\*When\*\*|\n$)', section, re.DOTALL)
    for g in given_blocks:
        items.append(g.strip())

# Pattern 3: Generic '- [ ]' or '- [x]' task bullets (fallback)
if not items:
    bullets = re.findall(r'^- \[[ x]\]\s*(.+)', section, re.MULTILINE)
    items.extend(bullets)

# Clean up items: strip whitespace, limit length
cleaned = []
for item in items:
    item = item.strip()
    if len(item) > 200:
        item = item[:197] + '...'
    cleaned.append(item)

import json
print(json.dumps(cleaned))
" "$STORY_FILE" 2>/dev/null || echo "[]")

  AC_COUNT=$(echo "$ACCEPTANCE_CRITERIA_JSON" | python3 -c "import sys,json; print(len(json.load(sys.stdin)))" 2>/dev/null || echo "0")
  log_success "Extracted ${AC_COUNT} acceptance criteria"
else
  log_warning "No story file to extract criteria from"
fi

# ── Step 7: Map changed files to affected routes ──
log_section "Mapping Affected Routes"

# Route mapping: page file -> route path
declare -A ROUTE_MAP
ROUTE_MAP["pages/Overview.tsx"]="/"
ROUTE_MAP["pages/MyClass.tsx"]="/my-class"
ROUTE_MAP["pages/Courses.tsx"]="/courses"
ROUTE_MAP["pages/CourseOverview.tsx"]="/courses/:courseId"
ROUTE_MAP["pages/UnifiedLessonPlayer.tsx"]="/courses/:courseId/lessons/:lessonId"
ROUTE_MAP["pages/Library.tsx"]="/library"
ROUTE_MAP["pages/Notes.tsx"]="/notes"
ROUTE_MAP["pages/Authors.tsx"]="/authors"
ROUTE_MAP["pages/Reports.tsx"]="/reports"
ROUTE_MAP["pages/Settings.tsx"]="/settings"

AFFECTED_ROUTES="[]"
for file in $CHANGED_FILES; do
  for page in "${!ROUTE_MAP[@]}"; do
    if [[ "$file" == *"$page"* ]]; then
      # Append route to JSON array
      AFFECTED_ROUTES=$(echo "$AFFECTED_ROUTES" | python3 -c "
import sys, json
routes = json.load(sys.stdin)
route = sys.argv[1]
if route not in routes:
    routes.append(route)
print(json.dumps(routes))
" "${ROUTE_MAP[$page]}" 2>/dev/null || echo "$AFFECTED_ROUTES")
    fi
  done
done

ROUTE_COUNT=$(echo "$AFFECTED_ROUTES" | python3 -c "import sys,json; print(len(json.load(sys.stdin)))" 2>/dev/null || echo "0")
log_info "Affected routes: ${ROUTE_COUNT}"

# ── Step 8: Determine review scope ──
HAS_TEST_CHANGES=false
if echo "$CHANGED_FILES" | grep -qE 'tests/.*\.spec\.ts'; then
  HAS_TEST_CHANGES=true
fi

REVIEW_SCOPE="full"
if [ "$TOTAL_LINES_CHANGED" -lt 50 ] && [ "$HAS_UI_CHANGES" = false ] && [ "$HAS_TEST_CHANGES" = false ]; then
  REVIEW_SCOPE="lightweight"
fi
log_info "Review scope: ${REVIEW_SCOPE}"

# ── Step 9: Build and write JSON bundle ──
log_section "Building Bundle"

TIMESTAMP=$(date -u +"%Y-%m-%dT%H:%M:%SZ")

# Ensure state directory exists
if [ "$OUTPUT" != "-" ]; then
  mkdir -p "$(dirname "$OUTPUT")"
fi

# Build changed files JSON array
CHANGED_FILES_JSON=$(echo "$CHANGED_FILES" | python3 -c "
import sys, json
files = [line.strip() for line in sys.stdin if line.strip()]
print(json.dumps(files))
" 2>/dev/null || echo "[]")

# Build the bundle JSON
BUNDLE=$(python3 -c "
import json, sys

data = {
    'schema_version': 1,
    'producer': 'review-story',
    'created_at': sys.argv[1],
    'story_id': sys.argv[2],
    'story_file': sys.argv[3] if sys.argv[3] else None,
    'changed_files': json.loads(sys.argv[4]),
    'diff_stat': sys.argv[5],
    'has_ui_changes': sys.argv[6] == 'true',
    'total_lines_changed': int(sys.argv[7]),
    'acceptance_criteria': json.loads(sys.argv[8]),
    'affected_routes': json.loads(sys.argv[9]),
    'precheck_summary': None,
    'artifact_paths': {
        'bundle_path': sys.argv[10],
        'agent_results_dir': '.claude/state/review-story/agent-results/',
        'perf_baseline': 'docs/reviews/performance/baseline.json'
    },
    'review_scope': sys.argv[11]
}

print(json.dumps(data, indent=2))
" "$TIMESTAMP" "$STORY_ID" "${STORY_FILE:-}" "$CHANGED_FILES_JSON" "$DIFF_STAT" "$HAS_UI_CHANGES" "$TOTAL_LINES_CHANGED" "$ACCEPTANCE_CRITERIA_JSON" "$AFFECTED_ROUTES" "$OUTPUT" "$REVIEW_SCOPE")

# Write output
if [ "$OUTPUT" = "-" ]; then
  echo "$BUNDLE"
else
  echo "$BUNDLE" > "$OUTPUT"
  log_success "Bundle written to ${OUTPUT}"
fi

# Summary
log_section "Bundle Summary"
log_info "Story: ${STORY_ID}"
log_info "Files changed: ${CHANGED_COUNT}"
log_info "Lines changed: ${TOTAL_LINES_CHANGED}"
log_info "UI changes: ${HAS_UI_CHANGES}"
log_info "Review scope: ${REVIEW_SCOPE}"
log_success "Bundle generation complete"
