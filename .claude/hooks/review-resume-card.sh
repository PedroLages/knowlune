#!/bin/bash
#
# SessionStart hook: Review resume card
# Injects a tiny resume card when a review run is in-progress

STATE_DIR=".claude/state/review-story"

# Find in-progress review runs
for state_file in "$STATE_DIR"/review-run-*.json; do
  if [ -f "$state_file" ]; then
    status=$(jq -r '.status // empty' "$state_file" 2>/dev/null)
    if [ "$status" = "in-progress" ]; then
      story_id=$(jq -r '.story_id // empty' "$state_file" 2>/dev/null)
      gates_passed=$(jq -r '.gates_passed_list | length' "$state_file" 2>/dev/null)
      next_step=$(jq -r '.next_step // empty' "$state_file" 2>/dev/null)
      
      # Output JSON injection for SessionStart
      jq -n \
        --arg story_id "$story_id" \
        --arg gates "$gates_passed" \
        --arg next "$next_step" \
        '{type: "review-resume", story_id: $story_id, gates_passed: ($gates | tonumber), next_step: $next}'
    fi
  fi
done
