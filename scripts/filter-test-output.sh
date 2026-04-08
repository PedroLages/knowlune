#!/usr/bin/env bash
# filter-test-output.sh
# Strips passing test lines from Vitest and Playwright list-reporter output.
#
# Usage: pipe test command output through this script:
#   npm run test:unit 2>&1 | bash scripts/filter-test-output.sh
#   npx playwright test ... --project=chromium 2>&1 | bash scripts/filter-test-output.sh
#
# When all tests pass: shows only summary + coverage lines (~10 lines)
# When failures exist: removes ✓ passing-indicator lines, preserves failures + error details

set -uo pipefail

raw=$(cat)

# Strip ANSI color/control codes so pattern matching works regardless of TTY detection
clean=$(echo "$raw" | sed $'s/\x1b\\[[0-9;]*[mGKHF]//g')

# Step 1: Always remove ✓ passing-indicator lines first
# Matches lines like: "✓ src/..." and "  ✓  1 [chromium] › ..."
filtered=$(echo "$clean" | grep -vE $'^\s*[✓✔] ' || true)

# Step 2: Check remaining output for failure indicators
if echo "$filtered" | grep -qiE 'failed|FAIL'; then
  # Has failures — show everything that's left (✓ lines already removed)
  echo "$filtered"
else
  # All passed — show only summary and coverage lines
  echo "$filtered" | grep -E '(Test Files|Tests[[:space:]]|passed|Duration|Coverage|Branches|Functions|Statements|Lines|%[[:space:]]|Stmts)' | tail -20 || true
  echo ""
  echo "[All tests passed — full output suppressed to reduce context]"
fi
