---
schemaVersion: 1
slug: e95-s05-opds-abs-server-sync
storyId: E95-S05
status: active
stage: phase-0
runMode: explicit-flag
autopilot: true
headless: false
startedAt: 2026-04-19T15:45:35Z
updatedAt: 2026-04-19T15:45:35Z
lastGreenSha: 77212ac5ee626183eeb4ae7fed112660ac273f96
inputType: bare-idea
input: "E95-S05 OPDS and ABS server connection sync — sync user's configured OPDS feed URLs and AudiobookShelf server connections (including apiKey via vault broker) to Supabase so they hydrate on new devices. Resolve KI-E95-S02-L01 (ABS apiKey read-path migration across 20+ call sites)."
classification:
  stage: brainstorm
  rationale: "No story file exists at docs/implementation-artifacts/stories/E95-S05*.md; input is a rich idea string with context — brainstorm path generates requirements doc."
  confidence: high
stagesCompleted: []
artifacts:
  requirementsPath: null
  planPath: null
  reviewRunIds: []
  prUrl: null
  solutionPath: null
supportingSkills:
  episodicMemory: null
  techdebtDedup: null
constraintsFromUser:
  - "Plan MUST address ABS apiKey read-path migration (20+ call sites) — no defer."
  - "Plan MUST address migration safety for existing users with locally-stored apiKeys."
  - "Plan MUST address RLS + fieldMap + stripFields for opds_servers and audiobookshelf_servers."
  - "Branch: feature/e95-s05-opds-abs-server-connection-sync"
  - "Plan gate HARD pause for human review (do not auto-approve even if critic scores >=85)."
abortedStories: []
---

# CE Orchestrator Run — E95-S05 OPDS and ABS Server Connection Sync

## Phase 0 — Init

- Last-green SHA: `77212ac5ee626183eeb4ae7fed112660ac273f96`
- Branch at start: `main` (clean)
- Mode: autopilot (explicit flag), interactive plan gate
- Classifier: `brainstorm` (no existing story file; user directs brainstorm-first path)
- User overrides noted: plan gate is **hard human pause** regardless of critic score (per prompt: "risky story — touches many call sites").
