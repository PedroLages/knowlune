#!/usr/bin/env bash

# validate-skill-structure.sh - Validate Claude Code skill modular documentation structure
#
# Usage:
#   ./scripts/workflow/validate-skill-structure.sh [skill-name]
#   ./scripts/workflow/validate-skill-structure.sh --all
#
# Exit codes:
#   0 - All validations pass
#   1 - Validation failures found
#   2 - Script error (missing skill, invalid args)

set -euo pipefail

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Counters
ERRORS=0
WARNINGS=0
INFO=0

# Base paths
SKILLS_DIR=".claude/skills"
SHARED_DIR="${SKILLS_DIR}/_shared"

# Parse arguments
SKILL_NAME=""
VALIDATE_ALL=false

if [[ $# -eq 0 ]]; then
  echo "Usage: $0 [skill-name] or $0 --all"
  exit 2
fi

if [[ "$1" == "--all" ]]; then
  VALIDATE_ALL=true
else
  SKILL_NAME="$1"
fi

# Validation functions

validate_skill() {
  local skill="$1"
  local skill_path="${SKILLS_DIR}/${skill}"

  echo ""
  echo "${BLUE}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
  echo "${BLUE}Validating: ${skill}${NC}"
  echo "${BLUE}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"

  # Check 1: SKILL.md exists
  if [[ ! -f "${skill_path}/SKILL.md" ]]; then
    echo "${RED}❌ ERROR: SKILL.md not found${NC}"
    ((ERRORS++))
    return
  fi

  # Check 2: SKILL.md size
  local line_count
  line_count=$(wc -l < "${skill_path}/SKILL.md")

  if [[ $line_count -gt 500 ]]; then
    echo "${RED}❌ ERROR: SKILL.md is ${line_count} lines (max: 500)${NC}"
    echo "   Consider extracting content to modular docs/"
    ((ERRORS++))
  elif [[ $line_count -gt 350 ]]; then
    echo "${YELLOW}⚠️  WARNING: SKILL.md is ${line_count} lines (recommended max: 350)${NC}"
    echo "   Consider refactoring to modular docs/"
    ((WARNINGS++))
  else
    echo "${GREEN}✅ SKILL.md size: ${line_count} lines (OK)${NC}"
  fi

  # Check 3: Broken doc references
  echo ""
  echo "Checking doc references..."

  local broken_refs=0

  # Extract markdown links with .md extension
  # Pattern: [text](path/to/file.md) or **See:** [text](path.md)
  while IFS= read -r line; do
    # Extract path from markdown link
    if [[ "$line" =~ \]\(([^\)]+\.md)\) ]]; then
      local ref_path="${BASH_REMATCH[1]}"

      # Resolve relative path
      local full_path
      if [[ "$ref_path" == ../* ]]; then
        # Parent directory reference
        full_path="${SKILLS_DIR}/${ref_path#../}"
      elif [[ "$ref_path" == docs/* ]] || [[ "$ref_path" == ./* ]]; then
        # Current skill docs/ or ./ reference
        full_path="${skill_path}/${ref_path#./}"
      else
        # Absolute or other reference
        full_path="$ref_path"
      fi

      # Check if file exists
      if [[ ! -f "$full_path" ]]; then
        echo "${RED}❌ ERROR: Broken reference: ${ref_path}${NC}"
        echo "   Referenced in SKILL.md but not found at: ${full_path}"
        ((broken_refs++))
        ((ERRORS++))
      fi
    fi
  done < "${skill_path}/SKILL.md"

  if [[ $broken_refs -eq 0 ]]; then
    echo "${GREEN}✅ No broken doc references${NC}"
  else
    echo "${RED}❌ Found ${broken_refs} broken reference(s)${NC}"
  fi

  # Check 4: Modular docs structure (if docs/ exists)
  if [[ -d "${skill_path}/docs" ]]; then
    echo ""
    echo "Checking modular docs structure..."

    # Count docs and check headings
    local doc_count
    doc_count=$(find "${skill_path}/docs" -name "*.md" -type f | wc -l | tr -d ' ')

    echo "${GREEN}✅ Found ${doc_count} modular doc(s)${NC}"

    # Check each doc for H1 heading
    for doc_file in "${skill_path}"/docs/*.md; do
      # Skip if glob didn't match
      [[ -f "$doc_file" ]] || continue

      # Check for H1 heading in first 10 lines
      if ! head -10 "$doc_file" | grep -q "^# "; then
        echo "${YELLOW}⚠️  WARNING: Missing H1 heading: $(basename "$doc_file")${NC}"
        WARNINGS=$((WARNINGS + 1))
      fi
    done
  else
    echo ""
    echo "${BLUE}ℹ️  No docs/ directory (skill uses inline documentation)${NC}"
    ((INFO++))
  fi

  # Check 5: Duplicated bash blocks (warn if found)
  echo ""
  echo "Checking for duplicated bash blocks..."

  # Extract bash code blocks (simplified check)
  local bash_blocks
  bash_blocks=$(grep -c '```bash' "${skill_path}/SKILL.md" 2>/dev/null || echo 0)
  bash_blocks=$(echo "$bash_blocks" | tr -d '\n' | head -1)

  if [[ $bash_blocks -gt 3 ]]; then
    echo "${YELLOW}⚠️  WARNING: ${bash_blocks} bash code blocks in SKILL.md${NC}"
    echo "   Consider extracting complex logic to modular docs/"
    ((WARNINGS++))
  elif [[ $bash_blocks -gt 0 ]]; then
    echo "${GREEN}✅ ${bash_blocks} bash code block(s) (reasonable)${NC}"
  else
    echo "${GREEN}✅ No inline bash code blocks${NC}"
  fi
}

# Main execution

if [[ "$VALIDATE_ALL" == true ]]; then
  # Validate all skills
  echo "${BLUE}Validating all skills in ${SKILLS_DIR}${NC}"

  while IFS= read -r skill_dir; do
    skill_name=$(basename "$skill_dir")

    # Skip _shared directory
    if [[ "$skill_name" == "_shared" ]]; then
      continue
    fi

    validate_skill "$skill_name"
  done < <(find "$SKILLS_DIR" -mindepth 1 -maxdepth 1 -type d)

else
  # Validate single skill
  if [[ ! -d "${SKILLS_DIR}/${SKILL_NAME}" ]]; then
    echo "${RED}❌ ERROR: Skill not found: ${SKILL_NAME}${NC}"
    echo "   Path: ${SKILLS_DIR}/${SKILL_NAME}"
    exit 2
  fi

  validate_skill "$SKILL_NAME"
fi

# Summary
echo ""
echo "${BLUE}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
echo "${BLUE}Validation Summary${NC}"
echo "${BLUE}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"

if [[ $ERRORS -gt 0 ]]; then
  echo "${RED}❌ Errors: ${ERRORS}${NC}"
fi

if [[ $WARNINGS -gt 0 ]]; then
  echo "${YELLOW}⚠️  Warnings: ${WARNINGS}${NC}"
fi

if [[ $INFO -gt 0 ]]; then
  echo "${BLUE}ℹ️  Info: ${INFO}${NC}"
fi

if [[ $ERRORS -eq 0 ]] && [[ $WARNINGS -eq 0 ]]; then
  echo "${GREEN}✅ All validations passed!${NC}"
  exit 0
elif [[ $ERRORS -eq 0 ]]; then
  echo "${YELLOW}⚠️  Validation completed with warnings${NC}"
  exit 0
else
  echo "${RED}❌ Validation failed${NC}"
  exit 1
fi
