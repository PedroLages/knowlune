#!/bin/bash
# Mirror CI pipeline locally for debugging.
# Runs lint, E2E tests, and a 3-iteration burn-in.

set -euo pipefail

echo "=== Local CI Pipeline ==="
echo ""

# Lint
echo "--- Stage 1: Lint ---"
npm run lint || { echo "Lint failed"; exit 1; }
echo ""

# E2E Tests
echo "--- Stage 2: E2E Tests ---"
npx playwright test || { echo "E2E tests failed"; exit 1; }
echo ""

# Burn-in (reduced: 3 iterations)
echo "--- Stage 3: Burn-in (3 iterations) ---"
for i in {1..3}; do
  echo "Burn-in iteration $i/3"
  npx playwright test --project=chromium || { echo "Burn-in failed on iteration $i"; exit 1; }
done
echo ""

echo "=== Local CI pipeline passed ==="
