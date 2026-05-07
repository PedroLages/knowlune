---
schemaVersion: 1
slug: fix-learning-path-card-progress-ring-and-cover-rls
status: active
runMode: autopilot
stage: phase-3.1
prUrl: "https://github.com/PedroLages/knowlune/pull/537"
merged: true
demoReel: skipped-minor-fixes
reviewRounds: 1
reviewBlockers: 0
reviewHigh: 0
reviewMedium: 1
reviewMediumFixed: "focus-restoration-trigger-ref"
reviewLow: 3
precheckTscWarning: "1 error fixed (pathCoverUpload.ts:132), 6 pre-existing errors on main (test files — ImportedCourseCard, useCourseImportStore)"
planApproval: auto-approved-by-critic
workBranch: feature/ce-2026-05-07-fix-learning-path-card-progress-ring-and-cover-rls
workCommits:
  - d7b1c0c64d1797982b03dcd69a76591a8d805141
  - c32bf122971f5bf219485e0733deed4de2c42e21
  - e87bfe792ecf468e720504e00d877f8710d26ba8
workModifiedFiles:
  - src/app/components/figma/PathProgressRing.tsx
  - src/app/components/learning-path/PathCoverDialog.tsx
  - src/app/pages/LearningPaths.tsx
  - src/lib/__tests__/pathCoverUpload.test.ts
  - src/lib/pathCoverUpload.ts
  - supabase/migrations/20260507000001_learning_path_cover_storage_policies.sql
  - supabase/migrations/rollback/20260507000001_learning_path_cover_storage_policies_rollback.sql
planCriticScore: 87
planCriticVerdict: approve
planCriticBlockers: 0
updatedAt: 2026-05-07T00:00:00Z
startedAt: 2026-05-07T00:00:00Z
updatedAt: 2026-05-07T00:00:00Z
lastGreenSha: acd05bcc63cde4984672ba370c658210b086bf9f
inputType: plan-path
input: docs/plans/2026-05-07-012-fix-learning-path-card-progress-ring-and-cover-rls-plan.md
artifacts:
  plan: docs/plans/2026-05-07-012-fix-learning-path-card-progress-ring-and-cover-rls-plan.md
stagesCompleted: []
supportingSkills:
  episodicMemory:
    topMatch: "PR #530 (c2fde858) already applied size='md' progress ring; current plan 012 picks up remaining transform-based positioning, ARIA, upsert removal, and standalone storage migration"
    relatedCount: 7
errors: []
abortedStories: []
---

# CE Run — fix-learning-path-card-progress-ring-and-cover-rls

