---
slug: fix-learning-paths-card-behavior-and-cover
runDate: 2026-05-06
status: active
stage: phase-2.1.5
artifacts:
  commitShas:
    - d1131eaf885bd767214e269a74138a83c14c629d
  modifiedFiles:
    - src/app/pages/LearningPaths.tsx
    - src/app/components/learning-path/EditPathDialog.tsx
    - src/app/components/figma/PathCardHeader.tsx
    - src/lib/pathCoverUpload.ts
    - supabase/storage-setup.sql
    - src/app/pages/__tests__/LearningPaths.test.tsx
    - src/app/components/learning-path/__tests__/EditPathDialog.test.tsx
runMode: autopilot
planApproval: auto-approved-by-critic
planCriticScore: 93
planCriticVerdict: approve
inputType: plan-approval
inputPath: docs/plans/2026-05-06-003-fix-learning-paths-card-behavior-and-cover-plan.md
lastGreenSha: d9ccd37de513b6df22457a826e995646260e6de9
schemaVersion: 1
startedAt: 2026-05-06T13:55:00Z
updatedAt: 2026-05-06T13:55:00Z
artifacts:
  plan: docs/plans/2026-05-06-003-fix-learning-paths-card-behavior-and-cover-plan.md
stagesCompleted: []
supportingSkills: {}
---

## Phase 0 — Classification

Classifier result: `stage: plan-approval` (deterministic — input matches `docs/plans/*-plan.md`).
Skipped brainstorm + plan generation. Proceeding to plan-approval gate.

## Phase 0.3b — Mode Select

User chose Autopilot. Plan-approval gate auto-approves if critic ≥85 with 0 blockers. R3 gate remains hard.
