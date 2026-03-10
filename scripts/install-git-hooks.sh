#!/bin/bash
# Install git hooks for LevelUp project
# Prevents ESLint/TypeScript/format errors from reaching CI

# Colors
GREEN='\033[0;32m'
BLUE='\033[0;34m'
YELLOW='\033[1;33m'
NC='\033[0m'

echo -e "${BLUE}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
echo -e "${BLUE}  Installing LevelUp Git Hooks${NC}"
echo -e "${BLUE}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
echo ""

# Create hooks directory if it doesn't exist
if [ ! -d ".git/hooks" ]; then
    echo -e "${YELLOW}⚠️  .git/hooks directory not found. Are you in the project root?${NC}"
    exit 1
fi

HOOKS_INSTALLED=0

# Install pre-commit hook
if [ -f "scripts/git-hooks/pre-commit" ]; then
    cp scripts/git-hooks/pre-commit .git/hooks/pre-commit
    chmod +x .git/hooks/pre-commit
    echo -e "${GREEN}✅ Installed pre-commit hook (TypeScript + ESLint + Prettier)${NC}"
    HOOKS_INSTALLED=$((HOOKS_INSTALLED + 1))
else
    echo -e "${YELLOW}⚠️  pre-commit hook not found in scripts/git-hooks/${NC}"
fi

# Install pre-push hook
if [ -f ".git/hooks/pre-push" ]; then
    echo -e "${GREEN}✅ pre-push hook already installed (clean working tree check)${NC}"
    HOOKS_INSTALLED=$((HOOKS_INSTALLED + 1))
else
    if [ -f "scripts/git-hooks/pre-push" ]; then
        cp scripts/git-hooks/pre-push .git/hooks/pre-push
        chmod +x .git/hooks/pre-push
        echo -e "${GREEN}✅ Installed pre-push hook (clean working tree check)${NC}"
        HOOKS_INSTALLED=$((HOOKS_INSTALLED + 1))
    fi
fi

# Install pre-review hook
if [ -f "scripts/git-hooks/pre-review" ]; then
    cp scripts/git-hooks/pre-review .git/hooks/pre-review
    chmod +x .git/hooks/pre-review
    echo -e "${GREEN}✅ Installed pre-review hook (for /review-story workflow)${NC}"
    HOOKS_INSTALLED=$((HOOKS_INSTALLED + 1))
else
    echo -e "${YELLOW}⚠️  pre-review hook not found in scripts/git-hooks/${NC}"
fi

echo ""
echo -e "${BLUE}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
echo -e "${GREEN}✨ Installed ${HOOKS_INSTALLED} git hooks successfully!${NC}"
echo -e "${BLUE}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
echo ""
echo -e "${YELLOW}What these hooks do:${NC}"
echo "  • pre-commit:  Runs ESLint, TypeScript, Prettier before every commit"
echo "  • pre-push:    Blocks push if working tree has uncommitted changes"
echo "  • pre-review:  Blocks /review-story if working tree is dirty"
echo ""
echo -e "${YELLOW}To bypass hooks (not recommended):${NC}"
echo "  git commit --no-verify"
echo "  git push --no-verify"
echo ""
