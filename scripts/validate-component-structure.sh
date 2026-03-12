#!/bin/bash
# Validation script: Component Directory Structure
# Enforces component placement conventions on staged files only
# Optimized for fast pre-commit execution (<1s target)

RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m'

FAILED=0

STAGED_FILES=$(git diff --cached --name-only --diff-filter=ACM | grep "^src/app/" | grep "\.tsx$" || true)

if [ -z "$STAGED_FILES" ]; then
  echo -e "${GREEN}✅ No staged component files to validate${NC}"
  exit 0
fi

PAGE_COMPONENTS=""
while IFS= read -r file; do
  filename=$(basename "$file")
  if [[ "$filename" == *"Page.tsx" ]] || [[ "$filename" == *"Route.tsx" ]]; then
    if [[ "$file" != src/app/pages/* ]]; then
      PAGE_COMPONENTS="${PAGE_COMPONENTS}${file}\n"
    fi
  fi
done <<< "$STAGED_FILES"

if [ -n "$PAGE_COMPONENTS" ]; then
  echo -e "${RED}❌ Page components found outside src/app/pages/${NC}"
  echo ""
  echo -e "$PAGE_COMPONENTS"
  echo ""
  echo -e "${YELLOW}Fix: Move to src/app/pages/${NC}"
  echo ""
  FAILED=1
fi

NON_PASCAL=""
while IFS= read -r file; do
  filename=$(basename "$file")
  if [[ "$filename" != "index.tsx" ]] && [[ "$filename" != __* ]]; then
    first_char="${filename:0:1}"
    if [[ ! "$first_char" =~ [A-Z] ]]; then
      NON_PASCAL="${NON_PASCAL}${filename}\n"
    fi
  fi
done <<< "$STAGED_FILES"

if [ -n "$NON_PASCAL" ]; then
  echo -e "${YELLOW}⚠️  Non-PascalCase component files in staged changes:${NC}"
  echo ""
  echo -e "$NON_PASCAL"
  echo ""
  echo -e "${YELLOW}Recommendation: Rename to PascalCase${NC}"
  echo ""
fi

if [ $FAILED -eq 1 ]; then
  exit 1
fi

echo -e "${GREEN}✅ Staged component structure is valid${NC}"
exit 0
