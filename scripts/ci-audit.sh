#!/usr/bin/env bash
# ci-audit.sh — npm audit gate for CI (KI-063)
#
# Runs npm audit in JSON mode, filters advisories against .nsprc (the
# project's advisory suppression registry), and exits non-zero if any
# non-suppressed advisory is found.
#
# .nsprc format:
#   { "GHSA-xxxx-xxxx-xxxx": { "active": true, "notes": "why suppressed" }, ... }
#
# This script is called from .github/workflows/ci.yml. It reads .nsprc
# from the repo root.

set -euo pipefail

NSPRC="./.nsprc"
AUDIT_FILE=$(mktemp /tmp/npm-audit.XXXXXX.json)
trap 'rm -f "$AUDIT_FILE"' EXIT

if ! npm audit --json > "$AUDIT_FILE" 2>/dev/null; then
  echo "npm audit returned non-zero — some advisories found"
fi

# Count advisories by severity
HIGH_COUNT=$(node -e "
  const data = require('$AUDIT_FILE');
  const advisories = data.advisories || {};
  const suppressed = $([ -f "$NSPRC" ] && cat "$NSPRC" || echo '{}');
  let count = 0;
  for (const [id, adv] of Object.entries(advisories)) {
    if (suppressed[id] && suppressed[id].active) continue;
    if ((adv.severity || '').toLowerCase() === 'high') count++;
  }
  console.log(count);
")

MODERATE_COUNT=$(node -e "
  const data = require('$AUDIT_FILE');
  const advisories = data.advisories || {};
  const suppressed = $([ -f "$NSPRC" ] && cat "$NSPRC" || echo '{}');
  let count = 0;
  for (const [id, adv] of Object.entries(advisories)) {
    if (suppressed[id] && suppressed[id].active) continue;
    if ((adv.severity || '').toLowerCase() === 'moderate') count++;
  }
  console.log(count);
")

echo "=== npm audit results (excluding .nsprc-suppressed) ==="
echo "  HIGH:     $HIGH_COUNT"
echo "  MODERATE: $MODERATE_COUNT"
echo ""

if [ "$HIGH_COUNT" -gt 0 ]; then
  echo "❌ npm audit FAILED: $HIGH_COUNT unsuppressed HIGH-severity advisories"
  echo ""
  echo "To suppress a HIGH advisory, add it to .nsprc with a justification:"
  echo '  { "GHSA-xxxx-xxxx-xxxx": { "active": true, "notes": "why this is accepted risk" } }'
  exit 1
fi

echo "✅ npm audit PASSED (no unsuppressed HIGH advisories)"
