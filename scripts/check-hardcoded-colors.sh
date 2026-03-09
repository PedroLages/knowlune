#!/bin/bash

# Check for hardcoded colors before commit
# This script can be used in pre-commit hooks or CI/CD

echo "🔍 Checking for hardcoded colors..."

# Get staged files (or all files if not in git hook context)
if git rev-parse --is-inside-work-tree > /dev/null 2>&1; then
  STAGED_FILES=$(git diff --cached --name-only --diff-filter=ACM | grep -E '\.(tsx?|jsx?)$' || true)
else
  STAGED_FILES=$(find src -name "*.tsx" -o -name "*.ts" -o -name "*.jsx" -o -name "*.js")
fi

if [ -z "$STAGED_FILES" ]; then
  echo "✅ No TypeScript/JavaScript files to check"
  exit 0
fi

# Run lint on files
HARDCODED_ERRORS=$(npx eslint $STAGED_FILES --rule 'design-tokens/no-hardcoded-colors: error' 2>&1 | grep "design-tokens/no-hardcoded-colors" || true)

if [ -n "$HARDCODED_ERRORS" ]; then
  echo ""
  echo "❌ HARDCODED COLORS DETECTED"
  echo "$HARDCODED_ERRORS"
  echo ""
  echo "Fix using design tokens:"
  echo "  Blue → bg-brand, text-brand, bg-brand-soft"
  echo "  Red → bg-destructive, text-destructive"
  echo "  Green → bg-success, text-success"
  echo "  Gray → bg-muted, text-muted-foreground"
  echo "  Amber/Orange → text-warning, text-gold"
  echo ""
  echo "See: docs/implementation-artifacts/design-token-cheat-sheet.md"
  exit 1
fi

echo "✅ No hardcoded colors detected"
exit 0
