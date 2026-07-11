#!/bin/bash
#
# PreCompact hook: Save checkpoint before compaction
# Persists review state so nothing is lost

STATE_DIR=".claude/state/review-story"
TIMESTAMP=$(date -u +"%Y-%m-%dT%H:%M:%SZ")

for state_file in "$STATE_DIR"/review-run-*.json; do
  if [ -f "$state_file" ]; then
    status=$(jq -r '.status // empty' "$state_file" 2>/dev/null)
    if [ "$status" = "in-progress" ]; then
      # Add pre-compact event and update timestamp
      jq --arg ts "$TIMESTAMP" \
        '.events += [{event: "pre-compact", at: $ts}] | .updated_at = $ts' \
        "$state_file" > "$state_file.tmp" && \
        mv "$state_file.tmp" "$state_file"
    fi
  fi
done
