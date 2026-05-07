#!/usr/bin/env bash
# ce-review / tooling: print BASE:<sha> = merge-base(HEAD, origin default branch)
set -euo pipefail

DEFAULT_REF="$(git symbolic-ref refs/remotes/origin/HEAD 2>/dev/null | sed 's@^refs/remotes/origin/@@' || true)"
if [[ -z "$DEFAULT_REF" ]]; then
  if git rev-parse --verify origin/main >/dev/null 2>&1; then
    DEFAULT_REF=main
  elif git rev-parse --verify origin/master >/dev/null 2>&1; then
    DEFAULT_REF=master
  else
    echo "ERROR: Cannot determine default branch (set origin/HEAD, or ensure origin/main or origin/master exists)." >&2
    exit 1
  fi
fi

REMOTE="origin/${DEFAULT_REF}"
if ! git rev-parse --verify "${REMOTE}" >/dev/null 2>&1; then
  echo "ERROR: ${REMOTE} not found. Run: git fetch origin" >&2
  exit 1
fi

BASE="$(git merge-base HEAD "${REMOTE}")"
echo "BASE:${BASE}"
