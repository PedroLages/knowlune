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
#
# Note: BSD grep (macOS) does not match multi-byte Unicode chars in [...] char classes —
# use literal chars directly. Also avoid echo "$big_var" | grep -q with set -o pipefail:
# grep -q exits early on first match (SIGPIPE to echo, exit 141), pipefail reports failure.
# Use a temp file for grep operations on large variables.

set -uo pipefail

tmpfile=$(mktemp)
trap 'rm -f "$tmpfile"' EXIT

# Collect input, strip ANSI codes, remove ✓ passing-indicator lines
cat \
  | sed $'s/\x1b\\[[0-9;]*[mGKHF]//g' \
  | grep -vE '^\s*✓' \
  > "$tmpfile" || true

# Detect failures by grepping the file (not a pipe) to avoid SIGPIPE/pipefail issues
if grep -qiE 'failed|FAIL' "$tmpfile"; then
  cat "$tmpfile"
else
  grep -E '(Test Files|Tests[[:space:]]|passed|Duration|Coverage|Branches|Functions|Statements|Lines|%[[:space:]]|Stmts)' "$tmpfile" | tail -20 || true
  echo ""
  echo "[All tests passed — full output suppressed to reduce context]"
fi
