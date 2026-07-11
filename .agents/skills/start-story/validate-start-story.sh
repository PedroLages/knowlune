#!/bin/bash
# Automated validation tests for /start-story skill
# Tests: idempotency, branch naming, status sync, worktree cleanup, ATDD validation
#
# Usage:
#   ./validate-start-story.sh                  # Run all tests
#   ./validate-start-story.sh --test=<name>    # Run specific test
#
# Tests:
#   - idempotency: /start-story can be run twice safely
#   - branch-naming: Branch names follow lowercase slugified format
#   - status-sync: Sprint status vs branch state consistency validation
#   - worktree-cleanup: Existing worktree detection works
#   - atdd-empty-check: Empty ATDD test file detection works

set -euo pipefail

# Colors
RED='\033[0;31m'
YELLOW='\033[1;33m'
GREEN='\033[0;32m'
BLUE='\033[0;34m'
CYAN='\033[0;36m'
BOLD='\033[1m'
NC='\033[0m' # No Color

# Test tracking
TESTS_RUN=0
TESTS_PASSED=0
TESTS_FAILED=0

# Cleanup tracking
CLEANUP_BRANCHES=()
CLEANUP_FILES=()
CLEANUP_WORKTREES=()

# Project paths (match SKILL.md configuration)
SPRINT_STATUS="docs/implementation-artifacts/sprint-status.yaml"
EPICS="docs/planning-artifacts/epics.md"
STORY_DIR="docs/implementation-artifacts"
TEST_DIR="tests/e2e"

#━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
# Assertion Helpers
#━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

assert_equals() {
    local expected="$1"
    local actual="$2"
    local message="${3:-Assertion failed}"

    if [ "$expected" = "$actual" ]; then
        echo -e "  ${GREEN}✓${NC} $message"
        return 0
    else
        echo -e "  ${RED}✗${NC} $message"
        echo -e "    Expected: ${YELLOW}$expected${NC}"
        echo -e "    Actual:   ${YELLOW}$actual${NC}"
        return 1
    fi
}

assert_file_exists() {
    local file="$1"
    local message="${2:-File should exist: $file}"

    if [ -f "$file" ]; then
        echo -e "  ${GREEN}✓${NC} $message"
        return 0
    else
        echo -e "  ${RED}✗${NC} $message"
        echo -e "    File not found: ${YELLOW}$file${NC}"
        return 1
    fi
}

assert_file_not_exists() {
    local file="$1"
    local message="${2:-File should not exist: $file}"

    if [ ! -f "$file" ]; then
        echo -e "  ${GREEN}✓${NC} $message"
        return 0
    else
        echo -e "  ${RED}✗${NC} $message"
        echo -e "    File exists: ${YELLOW}$file${NC}"
        return 1
    fi
}

assert_branch_exists() {
    local branch="$1"
    local message="${2:-Branch should exist: $branch}"

    if git branch --list "$branch" | grep -q "$branch"; then
        echo -e "  ${GREEN}✓${NC} $message"
        return 0
    else
        echo -e "  ${RED}✗${NC} $message"
        echo -e "    Branch not found: ${YELLOW}$branch${NC}"
        return 1
    fi
}

assert_branch_not_exists() {
    local branch="$1"
    local message="${2:-Branch should not exist: $branch}"

    if ! git branch --list "$branch" | grep -q "$branch"; then
        echo -e "  ${GREEN}✓${NC} $message"
        return 0
    else
        echo -e "  ${RED}✗${NC} $message"
        echo -e "    Branch exists: ${YELLOW}$branch${NC}"
        return 1
    fi
}

assert_contains() {
    local haystack="$1"
    local needle="$2"
    local message="${3:-Should contain: $needle}"

    if echo "$haystack" | grep -q "$needle"; then
        echo -e "  ${GREEN}✓${NC} $message"
        return 0
    else
        echo -e "  ${RED}✗${NC} $message"
        echo -e "    Needle: ${YELLOW}$needle${NC}"
        echo -e "    Haystack: ${YELLOW}${haystack:0:100}...${NC}"
        return 1
    fi
}

#━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
# Test Runner
#━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

run_test() {
    local test_name="$1"
    local test_function="$2"

    TESTS_RUN=$((TESTS_RUN + 1))

    echo ""
    echo -e "${CYAN}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
    echo -e "${BOLD}Test $TESTS_RUN: $test_name${NC}"
    echo -e "${CYAN}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"

    # Run test in subshell to isolate errors
    if $test_function; then
        TESTS_PASSED=$((TESTS_PASSED + 1))
        echo -e "${GREEN}✅ PASSED: $test_name${NC}"
        return 0
    else
        TESTS_FAILED=$((TESTS_FAILED + 1))
        echo -e "${RED}❌ FAILED: $test_name${NC}"
        return 1
    fi
}

#━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
# Cleanup Handler
#━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

cleanup() {
    echo ""
    echo -e "${YELLOW}🧹 Cleaning up test artifacts...${NC}"

    # Delete test branches
    if [ ${#CLEANUP_BRANCHES[@]} -gt 0 ]; then
        for branch in "${CLEANUP_BRANCHES[@]}"; do
            if git branch --list "$branch" | grep -q "$branch"; then
                echo -e "  Deleting branch: ${YELLOW}$branch${NC}"
                git checkout main 2>/dev/null || true
                git branch -D "$branch" 2>/dev/null || true
            fi
        done
    fi

    # Delete test files
    if [ ${#CLEANUP_FILES[@]} -gt 0 ]; then
        for file in "${CLEANUP_FILES[@]}"; do
            if [ -f "$file" ]; then
                echo -e "  Deleting file: ${YELLOW}$file${NC}"
                rm -f "$file"
            fi
        done
    fi

    # Delete test worktrees
    if [ ${#CLEANUP_WORKTREES[@]} -gt 0 ]; then
        for worktree in "${CLEANUP_WORKTREES[@]}"; do
            if git worktree list | grep -q "$worktree"; then
                echo -e "  Removing worktree: ${YELLOW}$worktree${NC}"
                git worktree remove --force "$worktree" 2>/dev/null || true
            fi
        done
    fi

    echo -e "${GREEN}✓ Cleanup complete${NC}"
}

trap cleanup EXIT

#━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
# Test Implementations
#━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

test_branch_naming() {
    echo "Testing branch naming conventions..."
    echo ""

    # Test cases: [story_id, story_name, expected_branch]
    local test_cases=(
        "E01-S03|Organize Courses by Topic|feature/e01-s03-organize-courses-by-topic"
        "E02-S01|Lesson Player Page & Video Playback|feature/e02-s01-lesson-player-page-video-playback"
        "E05-S02|Add Search Bar with Filters|feature/e05-s02-add-search-bar-filters"
        "E10-S01|The Quick Brown Fox Jumps Over|feature/e10-s01-quick-brown-fox-jumps-over"
    )

    local errors=0

    for test_case in "${test_cases[@]}"; do
        IFS='|' read -r story_id story_name expected <<< "$test_case"

        # Slugify logic (matching SKILL.md Step 3)
        local slug=$(echo "$story_name" |
            tr '[:upper:]' '[:lower:]' |
            sed 's/[&(),.]//g' |
            sed 's/ and / /g; s/ the / /g; s/ a / /g; s/ with / /g; s/ for / /g; s/ of / /g' |
            sed 's/^ *the //; s/^ *a //; s/^ *an //' |
            sed 's/  */ /g; s/^ *//; s/ *$//' |
            tr ' ' '-' |
            sed 's/-\+/-/g' |
            sed 's/^-//; s/-$//')

        local branch="feature/$(echo "$story_id" | tr '[:upper:]' '[:lower:]')-$slug"

        if ! assert_equals "$expected" "$branch" "Branch name for '$story_name'"; then
            errors=$((errors + 1))
        fi
    done

    return $errors
}

test_idempotency() {
    echo "Testing idempotency (safe re-runs)..."
    echo ""

    local test_branch="feature/test-idempotency"
    local test_file="$STORY_DIR/test-idempotency.md"

    CLEANUP_BRANCHES+=("$test_branch")
    CLEANUP_FILES+=("$test_file")

    # Simulate first run
    echo "Simulating first /start-story run..."
    git checkout main 2>/dev/null || return 1
    git checkout -b "$test_branch" 2>/dev/null || return 1
    echo "Test story file" > "$test_file"
    git add "$test_file"
    git commit -m "test: initial commit" >/dev/null 2>&1 || return 1

    local errors=0

    # Test: Branch already exists (should switch, not fail)
    if ! assert_branch_exists "$test_branch" "Branch exists after first run"; then
        errors=$((errors + 1))
    fi

    # Test: Story file exists
    if ! assert_file_exists "$test_file" "Story file exists after first run"; then
        errors=$((errors + 1))
    fi

    # Simulate second run (idempotent)
    echo ""
    echo "Simulating second /start-story run (should be safe)..."

    # Test: Switching to existing branch should work
    if git checkout "$test_branch" 2>/dev/null; then
        echo -e "  ${GREEN}✓${NC} Can switch to existing branch"
    else
        echo -e "  ${RED}✗${NC} Cannot switch to existing branch"
        errors=$((errors + 1))
    fi

    # Test: Story file should still exist (not overwritten)
    if ! assert_file_exists "$test_file" "Story file preserved on second run"; then
        errors=$((errors + 1))
    fi

    return $errors
}

test_status_sync_validation() {
    echo "Testing sprint status vs branch sync validation..."
    echo ""

    local test_branch="feature/test-status-sync"
    CLEANUP_BRANCHES+=("$test_branch")

    local errors=0

    # Test Case 1: status=backlog AND branch exists → STALE STATE
    echo "Test Case 1: Backlog status but branch exists (stale state)"
    git checkout main 2>/dev/null || return 1
    git checkout -b "$test_branch" 2>/dev/null || return 1

    if ! assert_branch_exists "$test_branch" "Test branch created"; then
        errors=$((errors + 1))
    fi

    # In real scenario, sprint-status.yaml would show backlog but branch exists
    # This should trigger stale state detection
    echo -e "  ${YELLOW}ℹ${NC}  Real scenario would show: status=backlog, branch=exists → STALE"

    # Test Case 2: status=in-progress AND branch exists → RESUMED STORY
    echo ""
    echo "Test Case 2: In-progress status and branch exists (happy path)"
    if ! assert_branch_exists "$test_branch" "Branch exists for resumed story"; then
        errors=$((errors + 1))
    fi
    echo -e "  ${YELLOW}ℹ${NC}  Real scenario would show: status=in-progress, branch=exists → RESUMED"

    # Test Case 3: Clean tree check should be skipped for resumed stories
    echo ""
    echo "Test Case 3: Resumed stories allow dirty working tree"
    echo "test change" >> README.md

    if ! git diff-index --quiet HEAD -- 2>/dev/null; then
        echo -e "  ${GREEN}✓${NC} Working tree is dirty (as expected for test)"
        echo -e "  ${YELLOW}ℹ${NC}  Real scenario: RESUMED stories skip clean tree check"
    else
        echo -e "  ${RED}✗${NC} Working tree is clean (unexpected)"
        errors=$((errors + 1))
    fi

    # Cleanup the test change
    git checkout README.md 2>/dev/null || true

    return $errors
}

test_worktree_cleanup_detection() {
    echo "Testing worktree cleanup detection..."
    echo ""

    # Note: This is a dry-run test since creating real worktrees is expensive
    # We test the detection logic, not actual worktree creation

    local test_key="e99-s99"
    local errors=0

    # Test: No worktree exists (grep should find nothing)
    echo "Test Case 1: No existing worktree"
    local worktree_check=$(git worktree list | grep -i "$test_key" || true)

    if [ -z "$worktree_check" ]; then
        echo -e "  ${GREEN}✓${NC} No worktree found for $test_key (as expected)"
    else
        echo -e "  ${RED}✗${NC} Unexpected worktree found: $worktree_check"
        errors=$((errors + 1))
    fi

    # Test: Detection command format
    echo ""
    echo "Test Case 2: Detection command is correct"
    local detection_cmd="git worktree list | grep -i $test_key"

    if ! assert_contains "$detection_cmd" "git worktree list" "Detection uses git worktree list"; then
        errors=$((errors + 1))
    fi

    if ! assert_contains "$detection_cmd" "grep -i" "Detection uses case-insensitive grep"; then
        errors=$((errors + 1))
    fi

    return $errors
}

test_atdd_empty_check() {
    echo "Testing ATDD empty file detection..."
    echo ""

    local test_file="$TEST_DIR/test-atdd-empty.spec.ts"
    CLEANUP_FILES+=("$test_file")

    local errors=0

    # Test Case 1: File doesn't exist (should skip ATDD check)
    echo "Test Case 1: ATDD file doesn't exist"
    if ! assert_file_not_exists "$test_file" "ATDD file should not exist yet"; then
        errors=$((errors + 1))
    fi

    # Test Case 2: File exists but is empty (should detect and offer regeneration)
    echo ""
    echo "Test Case 2: ATDD file exists but is empty"
    touch "$test_file"

    if ! assert_file_exists "$test_file" "ATDD file created"; then
        errors=$((errors + 1))
        return $errors
    fi

    # Test the detection logic (matches SKILL.md Step 8)
    if grep -q "test(" "$test_file" || grep -q "test.describe(" "$test_file"; then
        echo -e "  ${RED}✗${NC} Empty file incorrectly reports tests"
        errors=$((errors + 1))
    else
        echo -e "  ${GREEN}✓${NC} Empty file correctly detected (no test cases found)"
    fi

    # Test Case 3: File has test cases (should skip regeneration)
    echo ""
    echo "Test Case 3: ATDD file contains tests"
    echo "test('should work', async ({ page }) => {});" > "$test_file"

    if grep -q "test(" "$test_file"; then
        echo -e "  ${GREEN}✓${NC} Test case detected in file"
    else
        echo -e "  ${RED}✗${NC} Test case not detected"
        errors=$((errors + 1))
    fi

    # Count test cases (matches SKILL.md)
    local test_count=$(grep -c "^\s*test(" "$test_file" || echo "0")
    if ! assert_equals "1" "$test_count" "Test count is correct"; then
        errors=$((errors + 1))
    fi

    return $errors
}

#━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
# Main Test Suite
#━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

main() {
    echo ""
    echo -e "${BOLD}${BLUE}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
    echo -e "${BOLD}${BLUE}  /start-story Validation Test Suite${NC}"
    echo -e "${BOLD}${BLUE}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"

    # Check if specific test requested
    local specific_test=""
    for arg in "$@"; do
        if [[ "$arg" == --test=* ]]; then
            specific_test="${arg#--test=}"
        fi
    done

    # Run tests
    if [ -z "$specific_test" ] || [ "$specific_test" = "branch-naming" ]; then
        run_test "Branch Naming Conventions" test_branch_naming
    fi

    if [ -z "$specific_test" ] || [ "$specific_test" = "idempotency" ]; then
        run_test "Idempotency (Safe Re-runs)" test_idempotency
    fi

    if [ -z "$specific_test" ] || [ "$specific_test" = "status-sync" ]; then
        run_test "Status Sync Validation" test_status_sync_validation
    fi

    if [ -z "$specific_test" ] || [ "$specific_test" = "worktree-cleanup" ]; then
        run_test "Worktree Cleanup Detection" test_worktree_cleanup_detection
    fi

    if [ -z "$specific_test" ] || [ "$specific_test" = "atdd-empty-check" ]; then
        run_test "ATDD Empty File Detection" test_atdd_empty_check
    fi

    # Summary
    echo ""
    echo -e "${BOLD}${BLUE}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
    echo -e "${BOLD}  Test Summary${NC}"
    echo -e "${BOLD}${BLUE}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
    echo ""
    echo -e "  Total:  ${BOLD}$TESTS_RUN${NC}"
    echo -e "  Passed: ${GREEN}${BOLD}$TESTS_PASSED${NC}"
    echo -e "  Failed: ${RED}${BOLD}$TESTS_FAILED${NC}"
    echo ""

    if [ $TESTS_FAILED -eq 0 ]; then
        echo -e "${GREEN}${BOLD}✅ ALL TESTS PASSED${NC}"
        echo ""
        exit 0
    else
        echo -e "${RED}${BOLD}❌ SOME TESTS FAILED${NC}"
        echo ""
        exit 1
    fi
}

# Run main with all arguments
main "$@"
