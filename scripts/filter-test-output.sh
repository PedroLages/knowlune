#!/usr/bin/env bash
# filter-test-output.sh
# Strips passing test lines from Vitest and Playwright list-reporter output.
#
# Usage: pipe test command output through this script:
#   npm run test:unit -- --run 2>&1 | bash scripts/filter-test-output.sh
#   npx playwright test ... --project=chromium 2>&1 | bash scripts/filter-test-output.sh
#
# When all tests pass: shows only summary + coverage lines (~10 lines)
# When failures exist: removes ✓ passing-indicator lines, preserves failures + error details

set -uo pipefail

input=$(cat)

# Detect failures: ✗ (Vitest), × (alt), or "failed" count in summary line
if echo "$input" | grep -qE $'^\s*[✗×✘]| failed '; then
  # Has failures — remove only the ✓ passing-indicator lines, keep everything else
  echo "$input" | grep -vE $'^\s*[✓✔] ' || true
else
  # All passed — show only summary and coverage lines
  echo "$input" | grep -E '(Test Files|Tests[[:space:]]|passed|Duration|Coverage|Branches|Functions|Statements|Lines|%[[:space:]]|Stmts)' | tail -20 || true
  echo ""
  echo "[All tests passed — full output suppressed to reduce context]"
fi
