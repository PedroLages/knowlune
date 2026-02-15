#!/bin/bash
# Run only E2E tests related to changed source files.
# Compares against HEAD~1 by default; pass a ref as $1 to override.

set -euo pipefail

BASE_REF="${1:-HEAD~1}"
CHANGED_FILES=$(git diff --name-only "$BASE_REF")

if [ -z "$CHANGED_FILES" ]; then
  echo "No changed files detected — skipping tests."
  exit 0
fi

# Check if any source files changed
if echo "$CHANGED_FILES" | grep -qE '^src/.*\.(ts|tsx)$'; then
  echo "Source changes detected. Running full E2E suite..."
  npx playwright test
else
  echo "No source file changes — skipping E2E tests."
  exit 0
fi
