---
schemaVersion: 1
status: active
stage: phase-0
runMode: explicit-flag
mode: autopilot
startedAt: 2026-04-19T16:00:00Z
updatedAt: 2026-04-19T16:00:00Z
storyId: E95-S05
inputType: bare-idea
slug: e95-s05-opds-abs-server-sync
lastGreenSha: 77212ac5ee626183eeb4ae7fed112660ac273f96
branch: null
constraintsFromUser:
  - "Plan MUST resolve KI-E95-S02-L01 (ABS apiKey read-path migration across 20+ call sites). Do not defer again."
  - "Plan MUST address migration safety for existing users with locally-stored apiKeys."
  - "Plan MUST specify RLS + fieldMap + stripFields for both opds_servers and audiobookshelf_servers tables."
  - "Plan-approval gate is a HARD human checkpoint for this story (user-requested override of --autopilot auto-approve path due to risk)."
stagesCompleted: [phase-0, phase-1.1-brainstorm, phase-1.2-plan, phase-1.3-plan-approved-with-deepening]
planApproval: human-approved-after-deepen
planConfidenceAfterDeepen: 94
artifacts:
  requirementsPath: docs/brainstorms/2026-04-19-e95-s05-opds-abs-server-sync-requirements.md
  planPath: docs/plans/2026-04-19-015-feat-e95-s05-opds-abs-server-sync-plan.md
  planConfidence: 88
  planPath: null
  prUrl: null
  solutionPath: null
---

# CE Run — E95-S05 OPDS/ABS Server Connection Sync

## Phase 0 — Classify & Initialize

Input: bare idea string with explicit constraints.
Classification: `brainstorm` (no existing story file, no plan, no ideation doc).
Mode: `autopilot` (explicit flag) with override: plan-approval gate is HARD human checkpoint for this story.
Last-green SHA: `77212ac5ee626183eeb4ae7fed112660ac273f96` (current `main`).
