#!/usr/bin/env bash
#
# E95-S05 grep gate — fails CI if any production code still reads
# `server.apiKey` or `catalog.auth.password` directly rather than routing
# through the vault-backed resolvers in `src/lib/credentials/`.
#
# Exits non-zero on violation, zero on clean scan. Prints each offending
# line so the CI log pinpoints the regression.
set -euo pipefail

# Scan production code only — tests and docs can reference the forbidden
# patterns in comments / mock payloads.
PATTERNS=(
  'server\??\.apiKey'
  'catalog\.auth\?\.password'
  'catalog\.auth\.password'
)

# Files that legitimately mention the pattern inside a comment (the
# resolver docstrings describe what sites must migrate to).
ALLOWLIST=(
  'src/lib/credentials/absApiKeyResolver.ts'
  'src/lib/credentials/opdsPasswordResolver.ts'
)

exit_code=0
for pattern in "${PATTERNS[@]}"; do
  # -P: PCRE. ':!*.test.ts' / ':!*.spec.ts': exclude test sources.
  # Using git-grep so the scan respects .gitignore and is reproducible.
  matches=$(git grep -nP "$pattern" -- 'src/' ':!*.test.ts' ':!*.spec.ts' ':!src/**/__tests__/**' || true)
  if [[ -n "$matches" ]]; then
    # Filter out allowlisted paths.
    while IFS= read -r line; do
      allowed=false
      for prefix in "${ALLOWLIST[@]}"; do
        if [[ "$line" == "$prefix:"* ]]; then
          allowed=true
          break
        fi
      done
      if [[ "$allowed" == false ]]; then
        echo "[grep-gate] forbidden pattern '$pattern' at: $line"
        exit_code=1
      fi
    done <<< "$matches"
  fi
done

if [[ $exit_code -ne 0 ]]; then
  echo
  echo "[grep-gate] E95-S05 invariant violated: credentials must be read through"
  echo "  src/lib/credentials/absApiKeyResolver.ts (getAbsApiKey / useAbsApiKey)"
  echo "  src/lib/credentials/opdsPasswordResolver.ts (getOpdsPassword / useOpdsPassword)"
  exit $exit_code
fi

echo "[grep-gate] clean — no direct credential reads detected."
