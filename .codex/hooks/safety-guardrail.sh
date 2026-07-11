#!/bin/bash
#
# Safety Guardrail Hook — Warns before destructive commands
# Adapted from GStack's /careful hook for Knowlune project
#
# PreToolUse hook for Bash tool. Receives JSON on stdin:
#   { "tool_name": "Bash", "tool_input": { "command": "..." } }
#
# Returns:
#   {}                                          → allow (no action)
#   {"decision":"ask","reason":"..."}           → warn user (overridable)
#

# Extract command from JSON input (two-tier: Python3 preferred, grep fallback)
INPUT=$(cat)

COMMAND=$(echo "$INPUT" | python3 -c "
import sys, json
try:
    data = json.load(sys.stdin)
    print(data.get('tool_input', {}).get('command', ''))
except:
    print('')
" 2>/dev/null)

# Fallback: grep-based extraction if Python3 failed or returned empty
if [ -z "$COMMAND" ]; then
  COMMAND=$(echo "$INPUT" | grep -o '"command"[[:space:]]*:[[:space:]]*"[^"]*"' | head -1 | sed 's/.*"command"[[:space:]]*:[[:space:]]*"//;s/"$//')
fi

# Allow if we couldn't parse the command
if [ -z "$COMMAND" ]; then
  echo '{}'
  exit 0
fi

# --- Safe exceptions: build artifact cleanup ---
SAFE_DIRS=(
  "node_modules"
  ".next"
  "dist"
  "__pycache__"
  ".cache"
  "build"
  ".turbo"
  "coverage"
  "playwright-report"
  "test-results"
  ".vite"
  "tmp"
)

for safe_dir in "${SAFE_DIRS[@]}"; do
  if echo "$COMMAND" | grep -qF "rm -rf $safe_dir" || \
     echo "$COMMAND" | grep -qF "rm -rf ./$safe_dir" || \
     echo "$COMMAND" | grep -qF "rm -rf \"$safe_dir\""; then
    echo '{}'
    exit 0
  fi
done

# --- Destructive patterns to warn about ---
declare -A PATTERNS
PATTERNS["rm -rf"]="Recursive force delete — may cause irreversible data loss"
PATTERNS["rm -r "]="Recursive delete — may cause irreversible data loss"
PATTERNS["rm --recursive"]="Recursive delete — may cause irreversible data loss"
PATTERNS["DROP TABLE"]="SQL DROP TABLE — permanently destroys table and data"
PATTERNS["DROP DATABASE"]="SQL DROP DATABASE — permanently destroys entire database"
PATTERNS["TRUNCATE"]="SQL TRUNCATE — permanently removes all rows"
PATTERNS["git push --force"]="Force push — may overwrite remote history and lose others' work"
PATTERNS["git push -f"]="Force push — may overwrite remote history and lose others' work"
PATTERNS["git reset --hard"]="Hard reset — discards all uncommitted changes permanently"
PATTERNS["git checkout ."]="Checkout dot — discards all unstaged changes"
PATTERNS["git restore ."]="Restore dot — discards all unstaged changes"
PATTERNS["git clean -f"]="Clean force — permanently deletes untracked files"
PATTERNS["git clean -fd"]="Clean force — permanently deletes untracked files and directories"
PATTERNS["kubectl delete"]="Kubernetes delete — removes cluster resources"
PATTERNS["docker rm -f"]="Docker force remove — kills and removes running containers"
PATTERNS["docker system prune"]="Docker prune — removes all unused data (images, containers, volumes)"

for pattern in "${!PATTERNS[@]}"; do
  if echo "$COMMAND" | grep -qiF "$pattern"; then
    REASON="${PATTERNS[$pattern]}"
    # Escape quotes for JSON
    REASON_ESCAPED=$(echo "$REASON" | sed 's/"/\\"/g')
    PATTERN_ESCAPED=$(echo "$pattern" | sed 's/"/\\"/g')
    echo "{\"decision\":\"ask\",\"reason\":\"[safety-guardrail] ${PATTERN_ESCAPED}: ${REASON_ESCAPED}\"}"
    exit 0
  fi
done

# No destructive pattern detected — allow
echo '{}'
exit 0
