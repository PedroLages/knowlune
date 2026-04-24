#!/usr/bin/env bash
# sweep_quarantine.sh — delete aged-out quarantine date folders on titan.
#
# Intended to run remotely via SSH on titan. Reads env:
#   QUARANTINE_ROOT      — directory holding <date>/ subfolders
#   QUARANTINE_TTL_DAYS  — mtime threshold in days (default 7)
#   JOB_MANIFEST_DIR     — where to write sweep.log
#
# Flags:
#   --dry-run   print what would be deleted; touch nothing
#   --local     run directly (no SSH); useful for tests
#
# Exits 0 on success. Permission errors are logged and skipped (non-fatal).

set -uo pipefail

# Load config only if QUARANTINE_ROOT not already set. Preserves test override
# pattern (tests set env vars directly and do not need load_config.sh). Mirrors
# the guard used in publish_to_library.sh:37-40.
if [[ -z "${QUARANTINE_ROOT:-}" ]]; then
  SCRIPT_DIR_SQ="$(cd "$(dirname "$0")" && pwd)"
  # shellcheck disable=SC1091
  [[ -f "$SCRIPT_DIR_SQ/load_config.sh" ]] && source "$SCRIPT_DIR_SQ/load_config.sh"
fi

DRY_RUN=0
LOCAL=0

while [[ $# -gt 0 ]]; do
  case "$1" in
    --dry-run) DRY_RUN=1; shift ;;
    --local)   LOCAL=1;   shift ;;
    --help|-h)
      sed -n '1,15p' "$0" | sed 's/^# \{0,1\}//'
      exit 0
      ;;
    *)
      printf 'unknown flag: %s\n' "$1" >&2
      exit 2
      ;;
  esac
done

run_sweep() {
  local qroot="${QUARANTINE_ROOT:-}"
  local ttl="${QUARANTINE_TTL_DAYS:-7}"
  local mdir="${JOB_MANIFEST_DIR:-}"
  local dry="$DRY_RUN"

  if [[ -z "$qroot" ]]; then
    printf 'QUARANTINE_ROOT not set\n' >&2
    return 2
  fi

  # Enforce a floor: never use +0 (would match everything).
  if ! [[ "$ttl" =~ ^[0-9]+$ ]] || [[ "$ttl" -lt 1 ]]; then
    printf 'QUARANTINE_TTL_DAYS must be a positive integer (got: %s)\n' "$ttl" >&2
    return 2
  fi

  if [[ ! -d "$qroot" ]]; then
    # Nothing to do.
    return 0
  fi

  local log_file=""
  if [[ -n "$mdir" ]]; then
    mkdir -p "$mdir" 2>/dev/null || true
    log_file="$mdir/sweep.log"
  fi

  local ts
  ts="$(date -u +%Y-%m-%dT%H:%M:%SZ)"

  # Candidate date folders: top-level dirs with mtime older than TTL.
  local candidates
  candidates=$(find "$qroot" -mindepth 1 -maxdepth 1 -type d -mtime "+$ttl" 2>/dev/null || true)

  if [[ -z "$candidates" ]]; then
    return 0
  fi

  while IFS= read -r dir; do
    [[ -z "$dir" ]] && continue
    if [[ "$dry" == "1" ]]; then
      printf 'would-delete: %s\n' "$dir"
      continue
    fi
    if rm -rf -- "$dir" 2>/tmp/audiobook-m4b-sweep-err.$$; then
      if [[ -n "$log_file" ]]; then
        printf '%s deleted %s\n' "$ts" "$dir" >> "$log_file" 2>/dev/null || true
      fi
    else
      local err
      err="$(cat /tmp/audiobook-m4b-sweep-err.$$ 2>/dev/null || true)"
      if [[ -n "$log_file" ]]; then
        printf '%s error %s: %s\n' "$ts" "$dir" "$err" >> "$log_file" 2>/dev/null || true
      fi
      printf '⚠  sweep: failed to delete %s: %s\n' "$dir" "$err" >&2
    fi
    rm -f /tmp/audiobook-m4b-sweep-err.$$
  done <<< "$candidates"

  # Log rotation: keep only entries from the last 90 days.
  if [[ -n "$log_file" && -f "$log_file" && "$dry" != "1" ]]; then
    local cutoff
    cutoff="$(python3 -c 'import datetime as dt; print((dt.datetime.utcnow()-dt.timedelta(days=90)).strftime("%Y-%m-%dT%H:%M:%SZ"))' 2>/dev/null || echo "")"
    if [[ -n "$cutoff" ]]; then
      local tmp="$log_file.tmp.$$"
      awk -v c="$cutoff" '$1 >= c' "$log_file" > "$tmp" 2>/dev/null && mv "$tmp" "$log_file" 2>/dev/null || rm -f "$tmp"
    fi
  fi

  return 0
}

if [[ "$LOCAL" == "1" ]]; then
  run_sweep
  exit $?
fi

# Remote execution path.
if [[ -z "${SSH_HOST:-}" ]]; then
  # If SSH_HOST is absent but required env is present, assume we're already on titan.
  run_sweep
  exit $?
fi

# Serialize the function to the remote host.
ssh -o BatchMode=yes -o ConnectTimeout=10 "$SSH_HOST" \
  "QUARANTINE_ROOT='${QUARANTINE_ROOT:-}' \
   QUARANTINE_TTL_DAYS='${QUARANTINE_TTL_DAYS:-7}' \
   JOB_MANIFEST_DIR='${JOB_MANIFEST_DIR:-}' \
   DRY_RUN='$DRY_RUN' bash -s" <<'REMOTE'
set -uo pipefail
qroot="${QUARANTINE_ROOT:-}"
ttl="${QUARANTINE_TTL_DAYS:-7}"
mdir="${JOB_MANIFEST_DIR:-}"
dry="${DRY_RUN:-0}"

if [ -z "$qroot" ]; then
  echo "QUARANTINE_ROOT not set on remote" >&2
  exit 2
fi
case "$ttl" in
  ''|*[!0-9]*) echo "QUARANTINE_TTL_DAYS invalid: $ttl" >&2; exit 2 ;;
esac
[ "$ttl" -ge 1 ] || { echo "QUARANTINE_TTL_DAYS must be >= 1" >&2; exit 2; }

[ -d "$qroot" ] || exit 0

log_file=""
if [ -n "$mdir" ]; then
  mkdir -p "$mdir" 2>/dev/null || true
  log_file="$mdir/sweep.log"
fi
ts="$(date -u +%Y-%m-%dT%H:%M:%SZ)"

find "$qroot" -mindepth 1 -maxdepth 1 -type d -mtime "+$ttl" 2>/dev/null | while read -r dir; do
  [ -z "$dir" ] && continue
  if [ "$dry" = "1" ]; then
    echo "would-delete: $dir"
    continue
  fi
  if rm -rf -- "$dir" 2>/tmp/audiobook-m4b-sweep-err.$$; then
    [ -n "$log_file" ] && printf '%s deleted %s\n' "$ts" "$dir" >> "$log_file" 2>/dev/null || true
  else
    err="$(cat /tmp/audiobook-m4b-sweep-err.$$ 2>/dev/null || true)"
    [ -n "$log_file" ] && printf '%s error %s: %s\n' "$ts" "$dir" "$err" >> "$log_file" 2>/dev/null || true
    echo "sweep: failed to delete $dir: $err" >&2
  fi
  rm -f /tmp/audiobook-m4b-sweep-err.$$
done
exit 0
REMOTE
