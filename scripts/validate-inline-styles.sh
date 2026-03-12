#!/bin/bash
# Validation script: Inline Style Detection
# Detects style={} usage in staged files (prefer Tailwind)
# Optimized for fast pre-commit execution (<1s target)

YELLOW='\033[1;33m'
GREEN='\033[0;32m'
NC='\033[0m'

STAGED_FILES=$(git diff --cached --name-only --diff-filter=ACM | grep "^src/" | grep "\.tsx$" || true)

if [ -z "$STAGED_FILES" ]; then
  echo -e "${GREEN}✅ No staged TSX files to validate${NC}"
  exit 0
fi

INLINE_STYLES=""
while IFS= read -r file; do
  if [[ "$file" == *"/ui/"* ]] || [[ "$file" == *"/prototypes/"* ]] || [[ "$file" == *"/examples/"* ]] || [[ "$file" == *"PdfViewer"* ]]; then
    continue
  fi

  if [ -f "$file" ]; then
    FILE_STYLES=$(grep "style=\{" "$file" || true)
    if [ -n "$FILE_STYLES" ]; then
      INLINE_STYLES="${INLINE_STYLES}${file}:${FILE_STYLES}\n"
    fi
  fi
done <<< "$STAGED_FILES"

if [ -n "$INLINE_STYLES" ]; then
  echo -e "${YELLOW}⚠️  Inline styles detected in staged files (prefer Tailwind):${NC}"
  echo ""
  echo -e "$INLINE_STYLES"
  echo ""
  echo -e "${YELLOW}Exceptions: ui/, prototypes/, PdfViewer${NC}"
  echo ""
fi

echo -e "${GREEN}✅ Inline style check complete${NC}"
exit 0
