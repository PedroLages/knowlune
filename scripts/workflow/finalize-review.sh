#!/bin/bash
#
# Review Finalization Script
# Post-agent finalization: validate → merge → report → gate-check → frontmatter sync
#
# Usage:
#   ./finalize-review.sh --story-id=E01-S03 --base-path=PATH
#
# Sequence:
#   1. Validate agent JSON files against agent-output.schema.json
#   2. merge-agent-results.py → consolidated findings JSON (valid files only)
#   3. generate-report.py → consolidated markdown report
#   4. validate-gates.py → gate validation + verdict
#   5. Patch run-state JSON with verdict
#   6. Sync story frontmatter (reviewed: true/in-progress)
#
# Stdout contract:
#   JSON summary of finalization result — for orchestrator to parse with jq
#   All progress messages → stderr
#
# Output JSON fields:
#   verdict           - "PASS" or "BLOCKED"
#   report_path       - path to consolidated markdown report
#   summary           - finding counts by severity
#   gates_validation  - from validate-gates.py (valid, missing_gates, can_mark_reviewed)
#   frontmatter_synced - true if story reviewed field was updated
#   invalid_agents    - agents that failed JSON schema validation (logged as errors)

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
BASE_PATH=$(git rev-parse --show-toplevel 2>/dev/null || pwd)

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

if [ -z "$STORY_ID" ]; then
  log_error "--story-id is required"
  exit 1
fi

STORY_ID_UPPER=$(echo "$STORY_ID" | tr '[:lower:]' '[:upper:]')

# Paths
STATE_DIR="${BASE_PATH}/.claude/state/review-story"
AGENT_RESULTS_DIR="${STATE_DIR}/agent-results"
RUN_STATE="${STATE_DIR}/review-run-${STORY_ID_UPPER}.json"
CONSOLIDATED_FINDINGS="${STATE_DIR}/consolidated-findings-${STORY_ID_UPPER}.json"
SCHEMA="${BASE_PATH}/.claude/skills/review-story/schemas/agent-output.schema.json"
GATES_CONFIG="${BASE_PATH}/.claude/skills/review-story/config/gates.json"
TODAY=$(date +%Y-%m-%d)
STORY_ID_LOWER=$(echo "$STORY_ID_UPPER" | tr '[:upper:]' '[:lower:]')
REPORT_PATH="${BASE_PATH}/docs/reviews/consolidated-review-${TODAY}-${STORY_ID_LOWER}.md"

# ── 1. Validate agent JSON files against schema ──────────────────────────────

log_info "Validating agent JSON results..."

INVALID_AGENTS="[]"

if [ -d "$AGENT_RESULTS_DIR" ]; then
  INVALID_AGENTS_LIST=""

  for json_file in "${AGENT_RESULTS_DIR}"/*.json; do
    [ -f "$json_file" ] || continue
    gate_name=$(basename "$json_file" .json)

    # Validate against schema using python3
    VALIDATION_RESULT=$(python3 -c "
import json, sys

try:
    with open('$json_file') as f:
        data = json.load(f)
except json.JSONDecodeError as e:
    print(json.dumps({'valid': False, 'error': f'JSON parse error: {e}'}))
    sys.exit(0)

with open('$SCHEMA') as f:
    schema = json.load(f)

# Required top-level fields from schema
required = schema.get('required', [])
missing = [k for k in required if k not in data]

# Validate status enum
valid_statuses = schema.get('properties', {}).get('status', {}).get('enum', [])
status_ok = not valid_statuses or data.get('status') in valid_statuses

# Validate counts object
counts = data.get('counts', {})
counts_required = schema.get('properties', {}).get('counts', {}).get('required', [])
missing_counts = [k for k in counts_required if k not in counts]

errors = []
if missing:
    errors.append(f'missing required fields: {missing}')
if not status_ok:
    errors.append(f'invalid status: {data.get(\"status\")}')
if missing_counts:
    errors.append(f'counts missing: {missing_counts}')

if errors:
    print(json.dumps({'valid': False, 'error': '; '.join(errors)}))
else:
    print(json.dumps({'valid': True, 'error': None}))
" 2>/dev/null || echo '{"valid": false, "error": "validation script failed"}')

    IS_VALID=$(echo "$VALIDATION_RESULT" | python3 -c "import sys,json; print(str(json.load(sys.stdin)['valid']).lower())" 2>/dev/null || echo "false")

    if [ "$IS_VALID" = "false" ]; then
      ERROR_MSG=$(echo "$VALIDATION_RESULT" | python3 -c "import sys,json; print(json.load(sys.stdin).get('error','unknown'))" 2>/dev/null || echo "unknown error")
      log_error "Agent JSON invalid: ${gate_name} — ${ERROR_MSG}"
      if [ -n "$INVALID_AGENTS_LIST" ]; then
        INVALID_AGENTS_LIST="${INVALID_AGENTS_LIST},\"${gate_name}\""
      else
        INVALID_AGENTS_LIST="\"${gate_name}\""
      fi
    else
      log_success "Agent JSON valid: ${gate_name}"
    fi
  done

  if [ -n "$INVALID_AGENTS_LIST" ]; then
    INVALID_AGENTS="[${INVALID_AGENTS_LIST}]"
  fi
fi

# ── 2. Merge agent results (valid files only) ────────────────────────────────

log_info "Merging agent results..."

python3 "${BASE_PATH}/scripts/workflow/merge-agent-results.py" \
  --agent-results-dir="$AGENT_RESULTS_DIR" \
  --output="$CONSOLIDATED_FINDINGS" \
  >&2

log_success "Findings merged: $CONSOLIDATED_FINDINGS"

# ── 3. Generate consolidated markdown report ─────────────────────────────────

log_info "Generating consolidated report..."

mkdir -p "$(dirname "$REPORT_PATH")"

python3 "${BASE_PATH}/scripts/workflow/generate-report.py" \
  --findings="$CONSOLIDATED_FINDINGS" \
  --run-state="$RUN_STATE" \
  --gates-config="$GATES_CONFIG" \
  --output="$REPORT_PATH" \
  >&2

log_success "Report written: $REPORT_PATH"

# ── 4. Validate gates ────────────────────────────────────────────────────────

log_info "Validating gates..."

VALIDATION=$(python3 "${BASE_PATH}/scripts/workflow/validate-gates.py" \
  --gates-config="$GATES_CONFIG" \
  --run-state="$RUN_STATE")

GATES_VALID=$(echo "$VALIDATION" | python3 -c "import sys,json; print(str(json.load(sys.stdin)['valid']).lower())" 2>/dev/null || echo "false")
CAN_MARK=$(echo "$VALIDATION" | python3 -c "import sys,json; print(str(json.load(sys.stdin)['can_mark_reviewed']).lower())" 2>/dev/null || echo "false")

log_info "Gates valid: $GATES_VALID | Can mark reviewed: $CAN_MARK"

# ── 5. Determine verdict ─────────────────────────────────────────────────────

BLOCKER_COUNT=$(python3 -c "
import json, sys
try:
    with open('$CONSOLIDATED_FINDINGS') as f:
        data = json.load(f)
    findings = data.get('findings', [])
    blockers = sum(1 for f in findings if f.get('severity') in ('BLOCKER', 'CRITICAL'))
    print(blockers)
except Exception:
    print(0)
" 2>/dev/null || echo "0")

if [ "$BLOCKER_COUNT" -gt 0 ]; then
  VERDICT="BLOCKED"
else
  VERDICT="PASS"
fi

log_info "Verdict: $VERDICT (blockers: $BLOCKER_COUNT)"

# ── 6. Patch run-state JSON with verdict ─────────────────────────────────────

if [ -f "$RUN_STATE" ]; then
  TMP_STATE=$(mktemp)
  python3 -c "
import json
with open('$RUN_STATE') as f:
    state = json.load(f)
state['verdict'] = '$VERDICT'
state['status'] = 'completed' if '$VERDICT' == 'PASS' else 'blocked'
with open('$TMP_STATE', 'w') as f:
    json.dump(state, f, indent=2)
" 2>/dev/null && mv "$TMP_STATE" "$RUN_STATE" || rm -f "$TMP_STATE"
  log_success "Run state updated with verdict"
fi

# ── 7. Sync story frontmatter ─────────────────────────────────────────────────

FRONTMATTER_SYNCED=false

# Find story file
STORY_FILE=$(find "${BASE_PATH}/docs/implementation-artifacts" \
  -maxdepth 1 -name "*${STORY_ID_LOWER}*.md" 2>/dev/null | head -1 || true)

if [ -n "$STORY_FILE" ]; then
  if [ "$CAN_MARK" = "true" ] && [ "$VERDICT" = "PASS" ]; then
    # Full pass: mark reviewed: true
    sed -i '' "s|^reviewed:.*|reviewed: true|" "$STORY_FILE"
    log_success "Story marked reviewed: true"
    FRONTMATTER_SYNCED=true
  else
    # Blocked or gates missing: keep in-progress
    sed -i '' "s|^reviewed:.*|reviewed: in-progress|" "$STORY_FILE"
    log_info "Story kept reviewed: in-progress (verdict=$VERDICT, can_mark=$CAN_MARK)"
    FRONTMATTER_SYNCED=true
  fi

  # Update review_gates_passed in frontmatter from run state
  if [ -f "$RUN_STATE" ]; then
    GATES_LIST=$(python3 -c "
import json
with open('$RUN_STATE') as f:
    state = json.load(f)
passed = state.get('gates_passed_list', [])
print('[' + ', '.join(passed) + ']')
" 2>/dev/null || echo "[]")
    sed -i '' "s|^review_gates_passed:.*|review_gates_passed: ${GATES_LIST}|" "$STORY_FILE"
  fi
fi

# ── 8. Extract summary counts ─────────────────────────────────────────────────

SUMMARY=$(python3 -c "
import json, sys
try:
    with open('$CONSOLIDATED_FINDINGS') as f:
        data = json.load(f)
    findings = data.get('findings', [])
    blockers = sum(1 for f in findings if f.get('severity') in ('BLOCKER', 'CRITICAL'))
    high = sum(1 for f in findings if f.get('severity') == 'HIGH')
    medium = sum(1 for f in findings if f.get('severity') == 'MEDIUM')
    nits = sum(1 for f in findings if f.get('severity') in ('LOW', 'NIT'))
    total = len(findings)
    print(json.dumps({'total': total, 'blockers': blockers, 'high': high, 'medium': medium, 'nits': nits}))
except Exception:
    print(json.dumps({'total': 0, 'blockers': 0, 'high': 0, 'medium': 0, 'nits': 0}))
" 2>/dev/null || echo '{"total":0,"blockers":0,"high":0,"medium":0,"nits":0}')

# ── 9. Output finalization JSON ───────────────────────────────────────────────

cat <<EOF
{
  "verdict": "$VERDICT",
  "report_path": "${REPORT_PATH#${BASE_PATH}/}",
  "summary": $SUMMARY,
  "gates_validation": $VALIDATION,
  "frontmatter_synced": $FRONTMATTER_SYNCED,
  "invalid_agents": $INVALID_AGENTS
}
EOF
