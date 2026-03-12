#!/bin/bash
# Validation script: Import Path Consistency  
# Enforces @/ alias usage in staged src/ files only
# Optimized for fast pre-commit execution (<1s target)

RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m'

STAGED_FILES=$(git diff --cached --name-only --diff-filter=ACM | grep "^src/" | grep -E "\.(ts|tsx)$" | grep -v "\.test\." || true)

if [ -z "$STAGED_FILES" ]; then
  echo -e "${GREEN}✅ No staged src/ files to validate${NC}"
  exit 0
fi

VIOLATIONS=""
while IFS= read -r file; do
  if [ -f "$file" ]; then
    FILE_VIOLATIONS=$(grep "from ['\"]\.\./" "$file" || true)
    if [ -n "$FILE_VIOLATIONS" ]; then
      VIOLATIONS="${VIOLATIONS}${file}:${FILE_VIOLATIONS}\n"
    fi
  fi
done <<< "$STAGED_FILES"

if [ -n "$VIOLATIONS" ]; then
  echo -e "${RED}❌ Relative import paths found in staged files${NC}"
  echo ""
  echo -e "$VIOLATIONS"
  echo ""
  echo -e "${YELLOW}Fix: Use @/ alias instead of relative paths${NC}"
  echo "  import X from '../components/Y' → import X from '@/app/components/Y'"
  echo ""
  exit 1
fi

echo -e "${GREEN}✅ All staged imports use @/ alias${NC}"
exit 0
