#!/bin/bash
#
# PostCompact hook: Log compact event
# Helps debug if review state was lost during compaction

STATE_DIR=".claude/state/review-story"
TIMESTAMP=$(date -u +"%Y-%m-%dT%H:%M:%SZ")

for state_file in "$STATE_DIR"/review-run-*.json; do
  if [ -f "$state_file" ]; then
    status=$(jq -r '.status // empty' "$state_file" 2>/dev/null)
    if [ "$status" = "in-progress" ]; then
      # Append compact event
      jq --arg ts "$TIMESTAMP" \
        '.events += [{event: "compacted", at: $ts}]' \
        "$state_file" > "$state_file.tmp" && \
        mv "$state_file.tmp" "$state_file"
    fi
  fi
done
