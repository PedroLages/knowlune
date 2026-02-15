#!/bin/bash
# Standalone burn-in loop for flaky test detection.
# Usage: ./scripts/burn-in.sh [iterations]
# Default: 10 iterations, chromium only.

set -euo pipefail

ITERATIONS="${1:-10}"

echo "=== Burn-in: $ITERATIONS iterations ==="
echo ""

for i in $(seq 1 "$ITERATIONS"); do
  echo "--- Iteration $i/$ITERATIONS ---"
  npx playwright test --project=chromium || {
    echo ""
    echo "FAILED on iteration $i/$ITERATIONS"
    echo "Check test-results/ and playwright-report/ for details."
    exit 1
  }
done

echo ""
echo "=== All $ITERATIONS iterations passed — no flaky tests detected ==="
