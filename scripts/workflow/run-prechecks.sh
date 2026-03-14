#!/bin/bash
#
# LevelUp Pre-Check Pipeline
# Unified pre-check script for /review-story and /finish-story workflows
#
# Usage:
#   ./run-prechecks.sh [--mode=MODE] [--story-id=ID] [--base-path=PATH]
#
# Modes:
#   full         - Full pre-checks (default): build, lint, type-check, format, tests, validation
#   lightweight  - Lightweight validation: build, lint, type-check, format, tests only
#
# Options:
#   --story-id=E##-S##    Story ID (e.g., E01-S03) for E2E test filtering
#   --base-path=PATH      Base path for worktree support (defaults to git root)
#   --skip-commit-check   Skip the pre-review commit gate (for lightweight mode)
#
# Exit codes:
#   0 - All checks passed
#   1 - Pre-check failed (build, lint, type-check, format, or tests)
#   2 - Test pattern validation failed (HIGH/MEDIUM anti-patterns)
#
# Output:
#   JSON object with gate results written to stdout
#   Human-readable progress written to stderr

set -euo pipefail

# Colors for stderr output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Default values
MODE="full"
STORY_ID=""
BASE_PATH=$(git rev-parse --show-toplevel)
SKIP_COMMIT_CHECK=false

# Parse arguments
for arg in "$@"; do
  case $arg in
    --mode=*)
      MODE="${arg#*=}"
      ;;
    --story-id=*)
      STORY_ID="${arg#*=}"
      ;;
    --base-path=*)
      BASE_PATH="${arg#*=}"
      ;;
    --skip-commit-check)
      SKIP_COMMIT_CHECK=true
      ;;
    *)
      echo "Unknown argument: $arg" >&2
      exit 1
      ;;
  esac
done

# Normalize story ID for file paths (E01-S03 -> e01-s03)
STORY_ID_LOWER=""
if [ -n "$STORY_ID" ]; then
  STORY_ID_LOWER=$(echo "$STORY_ID" | tr '[:upper:]' '[:lower:]')
fi

# Initialize results object
declare -A GATES
GATES[build]="pending"
GATES[lint]="pending"
GATES[type-check]="pending"
GATES[format-check]="pending"
GATES[unit-tests]="pending"
GATES[e2e-tests]="pending"
HAS_UI_CHANGES=false
LINT_AUTO_FIXED=0
FORMAT_AUTO_FIXED=0
TEST_PATTERN_FINDINGS=""

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

# Output JSON results
output_results() {
  local exit_code=$1

  # Build JSON object
  cat <<EOF
{
  "success": $([ "$exit_code" -eq 0 ] && echo "true" || echo "false"),
  "mode": "$MODE",
  "gates": {
    "build": "${GATES[build]}",
    "lint": "${GATES[lint]}",
    "type-check": "${GATES[type-check]}",
    "format-check": "${GATES[format-check]}",
    "unit-tests": "${GATES[unit-tests]}",
    "e2e-tests": "${GATES[e2e-tests]}"
  },
  "ui_changes": $HAS_UI_CHANGES,
  "auto_fixes": {
    "lint": $LINT_AUTO_FIXED,
    "format": $FORMAT_AUTO_FIXED
  },
  "test_pattern_findings": "$TEST_PATTERN_FINDINGS"
}
EOF
}

# Pre-review commit gate
if [ "$SKIP_COMMIT_CHECK" = false ]; then
  log_section "Pre-Review Commit Gate"

  if [ -n "$(git status --porcelain)" ]; then
    log_error "Uncommitted changes detected"
    echo "" >&2
    echo "Commit all changes before review — code review runs against the committed snapshot, not the working tree." >&2
    echo "Run: git add -A && git commit -m '...'" >&2
    output_results 1
    exit 1
  fi

  log_success "Working tree is clean"
fi

# UI change detection
log_section "UI Change Detection"

if git diff --name-only main...HEAD | grep -qE 'src/app/(pages|components)/.*\.tsx'; then
  HAS_UI_CHANGES=true
  log_info "UI changes detected — design review will be dispatched"
else
  HAS_UI_CHANGES=false
  log_info "No UI changes — design review will be skipped"
fi

# Build
log_section "Build Check"

if npm run build >&2 2>&1; then
  GATES[build]="passed"
  log_success "Build passed"
else
  GATES[build]="failed"
  log_error "Build failed"
  output_results 1
  exit 1
fi

# Lint
log_section "Lint Check"

if npm run lint >&2 2>&1; then
  GATES[lint]="passed"
  log_success "Lint passed"
else
  # Check if lint script exists
  if ! npm run | grep -q "lint"; then
    GATES[lint]="lint-skipped"
    log_warning "Lint skipped — no lint script found"
  else
    log_warning "Lint errors found — attempting auto-fix"

    # Auto-fix
    if npx eslint . --fix >&2 2>&1; then
      LINT_AUTO_FIXED=1
      log_info "Auto-fixed ESLint issues"

      # Re-run to verify
      if npm run lint >&2 2>&1; then
        GATES[lint]="passed"
        log_success "Lint passed after auto-fix"
      else
        GATES[lint]="failed"
        log_error "Lint still has errors after auto-fix — manual fixes required"
        output_results 1
        exit 1
      fi
    else
      GATES[lint]="failed"
      log_error "Lint auto-fix failed"
      output_results 1
      exit 1
    fi
  fi
fi

# Type check
log_section "Type Check"

if npx tsc --noEmit >&2 2>&1; then
  GATES[type-check]="passed"
  log_success "Type check passed"
else
  log_warning "Type errors found — checking branch-changed files"

  # Get branch-changed files
  CHANGED_FILES=$(git diff --name-only main...HEAD | grep -E '\.(ts|tsx)$' || true)

  if [ -z "$CHANGED_FILES" ]; then
    # No TS files changed, but type errors exist (pre-existing)
    GATES[type-check]="passed"
    log_warning "Type errors in unchanged files (pre-existing) — continuing"
  else
    # Auto-fix attempt would go here (simplified for now)
    # Re-run type check
    if npx tsc --noEmit >&2 2>&1; then
      GATES[type-check]="passed"
      log_success "Type check passed"
    else
      GATES[type-check]="failed"
      log_error "Type errors in branch-changed files — fix required"
      output_results 1
      exit 1
    fi
  fi
fi

# Format check
log_section "Format Check"

if npx prettier --check "src/**/*.{ts,tsx,js,jsx,css,md}" "tests/**/*.{ts,tsx}" >&2 2>&1; then
  GATES[format-check]="passed"
  log_success "Format check passed"
else
  log_warning "Formatting issues found — auto-fixing"

  # Auto-fix
  if npx prettier --write "src/**/*.{ts,tsx,js,jsx,css,md}" "tests/**/*.{ts,tsx}" >&2 2>&1; then
    FORMAT_AUTO_FIXED=1
    log_info "Auto-formatted files with Prettier"

    # Re-run to verify
    if npx prettier --check "src/**/*.{ts,tsx,js,jsx,css,md}" "tests/**/*.{ts,tsx}" >&2 2>&1; then
      GATES[format-check]="passed"
      log_success "Format check passed after auto-fix"
    else
      GATES[format-check]="failed"
      log_error "Format check still failing after auto-fix"
      output_results 1
      exit 1
    fi
  else
    GATES[format-check]="failed"
    log_error "Prettier auto-fix failed"
    output_results 1
    exit 1
  fi
fi

# Unit tests
log_section "Unit Tests"

if npm run | grep -q "test:unit"; then
  if npm run test:unit -- --run >&2 2>&1; then
    GATES[unit-tests]="passed"
    log_success "Unit tests passed"
  else
    GATES[unit-tests]="failed"
    log_error "Unit tests failed"
    output_results 1
    exit 1
  fi
else
  GATES[unit-tests]="unit-tests-skipped"
  log_warning "Unit tests skipped — no test:unit script found"
fi

# E2E tests
log_section "E2E Tests"

# Build smoke spec list
SMOKE_SPECS=(
  "${BASE_PATH}/tests/e2e/navigation.spec.ts"
  "${BASE_PATH}/tests/e2e/overview.spec.ts"
  "${BASE_PATH}/tests/e2e/courses.spec.ts"
)

# Add story spec if provided
STORY_SPEC=""
if [ -n "$STORY_ID_LOWER" ]; then
  STORY_SPEC="${BASE_PATH}/tests/e2e/story-${STORY_ID_LOWER}.spec.ts"
  if [ -f "$STORY_SPEC" ]; then
    SMOKE_SPECS+=("$STORY_SPEC")
  else
    log_info "No story spec found for $STORY_ID"
  fi
fi

# Run E2E tests
if npx playwright test "${SMOKE_SPECS[@]}" --project=chromium >&2 2>&1; then
  GATES[e2e-tests]="passed"
  log_success "E2E tests passed"
else
  GATES[e2e-tests]="failed"
  log_error "E2E tests failed"
  output_results 1
  exit 1
fi

# Test pattern validation (full mode only)
if [ "$MODE" = "full" ] && [ -f "$STORY_SPEC" ]; then
  log_section "Test Pattern Validation"

  if node scripts/validate-test-patterns.js "$STORY_SPEC" >&2 2>&1; then
    log_success "No test anti-patterns detected"
    TEST_PATTERN_FINDINGS="clean"
  else
    VALIDATION_EXIT_CODE=$?

    if [ $VALIDATION_EXIT_CODE -eq 1 ]; then
      # HIGH/MEDIUM anti-patterns detected
      log_error "Test anti-patterns detected (HIGH/MEDIUM severity)"
      TEST_PATTERN_FINDINGS="high-medium-detected"
      output_results 2
      exit 2
    else
      # LOW severity only
      log_warning "Test anti-patterns detected (LOW severity)"
      TEST_PATTERN_FINDINGS="low-severity-detected"
    fi
  fi
fi

# Success
log_section "Pre-Checks Complete"
log_success "All pre-checks passed"

if [ $LINT_AUTO_FIXED -eq 1 ]; then
  log_info "Auto-fixed ESLint issues"
fi

if [ $FORMAT_AUTO_FIXED -eq 1 ]; then
  log_info "Auto-formatted files with Prettier"
fi

output_results 0
exit 0
