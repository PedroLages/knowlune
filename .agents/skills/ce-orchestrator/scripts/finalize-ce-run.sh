#!/usr/bin/env bash
# finalize-ce-run.sh — close out a ce-orchestrator tracking file and optionally emit JSON for headless mode.
#
# Usage:
#   finalize-ce-run.sh <tracking-path> [--json]
#
# Exit codes:
#   0  — tracking file closed successfully (status: done)
#   1  — tracking file not found / unreadable
#   2  — tracking file has malformed frontmatter
#   3  — tracking file already in terminal state (no-op)

set -euo pipefail

tracking_path="${1:-}"
emit_json=false
if [[ "${2:-}" == "--json" ]]; then
  emit_json=true
fi

if [[ -z "$tracking_path" ]]; then
  echo "Usage: finalize-ce-run.sh <tracking-path> [--json]" >&2
  exit 1
fi

if [[ ! -f "$tracking_path" ]]; then
  echo "Tracking file not found: $tracking_path" >&2
  exit 1
fi

# --- Extract frontmatter as a YAML block between the first two --- lines ---
frontmatter=$(awk '/^---$/{n++; next} n==1' "$tracking_path")
if [[ -z "$frontmatter" ]]; then
  echo "Tracking file has no frontmatter: $tracking_path" >&2
  exit 2
fi

get_field() {
  local field="$1"
  echo "$frontmatter" | awk -v f="$field" '
    $0 ~ "^"f":" { sub("^"f":[ \t]*", ""); gsub(/^["\x27]|["\x27]$/, ""); print; exit }
  '
}

status=$(get_field "status")
slug=$(get_field "slug")
run_id=$(get_field "runId")
started_at=$(get_field "startedAt")
pr_url=$(get_field "prUrl" || echo "")

# Terminal states that should no-op
case "$status" in
  done|aborted|reverted|pr-created-escalated)
    echo "Tracking file already terminal (status: $status). No action." >&2
    exit 3
    ;;
esac

# Compute duration (best-effort; macOS `date -j` vs GNU `date -d`)
duration_seconds=0
if [[ -n "$started_at" ]]; then
  if date --version >/dev/null 2>&1; then
    # GNU date
    started_epoch=$(date -d "$started_at" +%s 2>/dev/null || echo 0)
  else
    # BSD/macOS date
    started_epoch=$(date -j -f "%Y-%m-%dT%H:%M:%SZ" "$started_at" +%s 2>/dev/null || echo 0)
  fi
  now_epoch=$(date +%s)
  if [[ $started_epoch -gt 0 ]]; then
    duration_seconds=$((now_epoch - started_epoch))
  fi
fi

# Decide new terminal status based on what's recorded
new_status="done"
if [[ -z "$pr_url" ]]; then
  # No PR URL means the pipeline didn't reach Phase 2.5 successfully
  new_status="halted-at-finalize"
fi

# Update frontmatter: set status, updatedAt
now_iso=$(date -u +"%Y-%m-%dT%H:%M:%SZ")
tmp_file=$(mktemp)
awk -v new_status="$new_status" -v now_iso="$now_iso" '
  BEGIN { in_fm=0; fm_count=0 }
  /^---$/ { fm_count++; if (fm_count<=2) { print; in_fm = (fm_count==1); next } }
  in_fm && /^status:/ { print "status: " new_status; next }
  in_fm && /^updatedAt:/ { print "updatedAt: " now_iso; next }
  { print }
' "$tracking_path" > "$tmp_file"
mv "$tmp_file" "$tracking_path"

# Append a summary section (idempotent — skip if already present)
if ! grep -q "^## Finalized " "$tracking_path"; then
  {
    echo ""
    echo "## Finalized $now_iso"
    echo ""
    echo "- Final status: \`$new_status\`"
    echo "- Duration: ${duration_seconds}s"
    [[ -n "$pr_url" ]] && echo "- PR: $pr_url"
  } >> "$tracking_path"
fi

# Emit JSON for headless mode
if $emit_json; then
  # Re-read frontmatter for fields we need in JSON
  brainstorm=$(get_field "  brainstorm" || echo "null")
  plan=$(get_field "  plan" || echo "null")
  demo_url=$(get_field "  demoUrl" || echo "null")
  solution_path=$(get_field "  solutionPath" || echo "null")
  review_run_id=$(get_field "  reviewRunId" || echo "null")
  last_green_sha=$(get_field "  lastGreenSha" || echo "null")

  # Wrap non-null strings in quotes
  quote_or_null() {
    if [[ "$1" == "null" || -z "$1" ]]; then echo "null"; else echo "\"$1\""; fi
  }

  cat <<EOF
{"status":"$new_status","slug":"$slug","runId":"$run_id","artifacts":{"brainstorm":$(quote_or_null "$brainstorm"),"plan":$(quote_or_null "$plan"),"reviewRunId":$(quote_or_null "$review_run_id"),"demoUrl":$(quote_or_null "$demo_url"),"prUrl":$(quote_or_null "$pr_url"),"solutionPath":$(quote_or_null "$solution_path")},"review":{"lastGreenSha":$(quote_or_null "$last_green_sha")},"tracking":"$tracking_path","durationSeconds":$duration_seconds,"exitCode":0}
EOF
fi

exit 0
