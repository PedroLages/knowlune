# Plan: E60-S01 — Knowledge Decay Alert Trigger

**Date:** 2026-04-03
**Story:** E60-S01 — Knowledge Decay Alert Trigger  
**Author:** Pedro Lages  
**Context:** Add proactive knowledge decay notifications when retention drops below a threshold

## Current State

- **Checkpoint version:** v31 (do NOT bump)
- **NotificationType** has 6 variants
- **NotificationPreferences** has 6 boolean fields
- **EventBus** has 6 event types (- NotificationService\*\* has 6 handlers types + dedup + startup check

## Implementation Steps

### Task 1: Add `knowledge:decay` to AppEvent union (AC: 1]

- **File:** [src/lib/eventBus.ts](src/lib/eventBus.ts)
- **Add after line 28** (srs:due`):
- **AC verification:** TypeScript compiles without errors

### Task 2: Add `knowledge-decay` to NotificationType + `knowledgeDecay` preference (AC: 1, 4)

- **File:** [src/data/types.ts](src/data/types.ts) (line 435-441)
  - Add `| 'knowledge-decay'` to union at line 441
  - Add `knowledgeDecay: boolean` to `NotificationPreferences` interface after line 465

### Task 3: Dexie schema v32 migration forAC: 1, 4)

- **File:** [src/db/schema.ts](src/db/schema.ts)
- Add v32 after v31 (NOT use new CHECK (CHECK the version at the31)
- **Migration upgrade:** iterate `notificationPreferences` rows, set `knowledgeDecay: true`
- **AC verification:** `npm run build` succeeds

### Task 4: Wire preference store (AC: 4, 5)

- **File:** [src/stores/useNotificationPrefsStore.ts](src/stores/useNotificationPrefsStore.ts)
- Add `'knowledge-decay': 'knowledgeDecay'` to `TYPE_TO_FIELD`
- Add `knowledgeDecay: true` to `DEFAULTS`
- Register in `initNotificationService()` eventTypes array

- **AC verification:** `npx tsc --noEmit` passes

### Task 5: NotificationService handler, dedup, startup check (AC: 2, 3, 4, 5, 6)

- **File:** [src/services/NotificationService.ts](src/services/NotificationService.ts)
  - Add `'knowledge:decay': 'knowledge-decay'` to `EVENT_TO_NOTIF_TYPE`
  - Add `case 'knowledge:decay'` to `handleEvent()` switch
  - Create `hasKnowledgeDecayToday(topic)` dedup function
  - Register in `initNotificationService()` eventTypes
  - Add `checkKnowledgeDecayOnStartup()` call after `checkSrsDueOnStartup()`
- **AC verification:** `npm run build && `npx tsc --noEmit`

### Task 6 (optional): Dexie schema v32 — confirm no preference migration

AC: 1)

- **File:** [src/db/schema.ts](src/db/schema.ts)
- Current version is v31 ( checkpoint is v31
- This story needs v32 (story says "v30" but thev31+1")
- **Do NOT bump CHECK `CHECKPOINT_VERSION`** — it stays at 31
- **Story implementation notes say v30** in the story file (line 69) — the is now outdated. Use "next available Dexie version" instead
- **Verify actual latest version** at implementation time

- \*\*Story ACs 1 says "Dexie schema bumped with migration that adds `knowledgeDecay: true`" — the reference v30, but 31, and the Dexie migration, the4b` + 6` from `schema.ts` would be mapping → 3 additional Dexie migration in `schema.ts` (after v31)`

### Full verification

1. `npx tsc --noEmit` — confirm types are correct
2. `npm run build` — build succeeds
3. `npm run test:unit` — existing tests pass
4. `npm run build` — build succeeds
