#!/bin/bash
# Pre-review check wrapper script
# Run this before /review-story to ensure working tree is clean
#
# Usage:
#   ./scripts/pre-review-check.sh
#   npm run pre-review  (if added to package.json)

set -e

# Run the pre-review hook
.git/hooks/pre-review

# If hook passes, provide next steps
echo "Next step: Run /review-story in Claude Code"
echo ""
