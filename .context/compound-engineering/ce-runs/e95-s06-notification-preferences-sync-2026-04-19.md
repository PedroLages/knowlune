---
schemaVersion: 1
status: complete
stage: done
runMode: explicit-flag
mode: autopilot
startedAt: 2026-04-19T20:00:00Z
updatedAt: 2026-04-19T23:59:00Z
storyId: E95-S06
inputType: bare-idea
slug: e95-s06-notification-preferences-sync
lastGreenSha: 9a8abc38451362703261500f316b018142af242f
branch: feature/e95-s06-notification-preferences-sync
stagesCompleted: [phase-0, phase-1.1-brainstorm, phase-1.2-plan, phase-1.3-plan-approved, phase-2-work, phase-3-review, phase-4-pr]
planApproval: auto-approved-by-critic-and-user
artifacts:
  requirementsPath: docs/brainstorms/2026-04-19-e95-s06-notification-preferences-sync-requirements.md
  planPath: docs/plans/2026-04-19-016-feat-e95-s06-notification-preferences-sync-plan.md
  planConfidence: 91
  prUrl: https://github.com/PedroLages/knowlune/pull/375
---

# CE Run — E95-S06 Notification Preferences Sync

## Phase 0 — Classify & Initialize

Input: bare idea string.
Classification: `brainstorm` (no existing story file or plan).
Mode: `autopilot` with `--headless OFF` (plan gate is hard — user will review).
Last-green SHA: `9a8abc38` (main after E95-S05 PR #374 merge).

## Epic E95 Closeout

### Stories Shipped

| Story | Title | PR |
| --- | --- | --- |
| E95-S01 | Full Settings Sync (user_settings JSONB merge) | #369 |
| E95-S02 | API Keys & Credentials via Supabase Vault | #370 |
| E95-S03 | (inferred from PR sequence) | #371 |
| E95-S04 | Server-Side Streak Calculation | #372 |
| E95-S05 | OPDS/ABS Server Connection Sync + KI-E95-S02-L01 closure | #374 |
| E95-S06 | Notification Preferences Sync | #375 |

All 6 stories shipped 2026-04-19. PRs #369–#375.

### Known Issues Triage

| ID | Summary | Decision | Reason |
| --- | --- | --- | --- |
| KI-E95-S04-L01 | pages-goal users see (0,0,null) streak post-upgrade | schedule-future | Real bug, no data loss (Dexie intact), affects minority cohort, backfill needed |
| KI-E95-S04-L02 | post-sync-commit streak rehydration cold-boot only | schedule-future | Consistent with all other P3 LWW stores, no user-visible incorrect data |
| KI-E95-S05-L01 | BookContentService OPDS auth.password direct read | schedule-future | Grep gate blocks regression; legacy rows still work; fix requires catalogId→Vault at download time |

### Patterns Extracted

Three new patterns added to `docs/engineering-patterns.md`:

1. **Vault Broker Pattern for Credential Storage in Sync Tables** — vault-first write ordering, async resolver/hook per credential kind, one-shot backwards-compat migration via `db.kv` flag, grep gate for regression prevention.
2. **Singleton PK Translation via `fieldMap`** — `id: 'singleton'` → Supabase `user_id` via `fieldMap: { id: 'user_id' }` + `upsertConflictColumns: 'user_id'`, rules for Dexie schema declaration and avoiding `moddatetime` triggers on LWW tables.
3. **LWW Hydration with `isAllDefaults` Guard** — inclusive `>=` timestamp comparison + `isAllDefaults` check to handle first-install race where local defaults row may race with the remote row timestamp.
