# Plan: E60-S02 — Content Recommendation Notification Handler

## Context

E60-S01 (Knowledge Decay Alert Trigger) shipped on 2026-04-04, establishing the event-to-notification pattern for all Smart Notification Triggers in Epic 60. E60-S02 adds the second trigger: when a future recommendation engine (E52) identifies content matching a learner's weak areas, this handler creates a notification. This is an **event-consumer only** story — no emitter is implemented.

## Approach

Follow the E60-S01 pattern exactly across 5 files. Each task maps 1:1 to a code change with a proven template.

## Tasks

### Task 1: Add `recommendation:match` event type
**File:** `src/lib/eventBus.ts`
- Add `| { type: 'recommendation:match'; courseId: string; courseName: string; reason: string }` to the `AppEvent` union (after `knowledge:decay` at ~line 29)

### Task 2: Add notification type + preference field
**File:** `src/data/types.ts`
- Add `| 'recommendation-match'` to `NotificationType` union (after `'knowledge-decay'` at ~line 442)
- Add `recommendationMatch: boolean` to `NotificationPreferences` interface (after `knowledgeDecay` at ~line 470)

### Task 3: Add Dexie v33 migration
**File:** `src/db/schema.ts`
- Add v33 migration after v32 (~line 1190). Sets `recommendationMatch: true` on existing `notificationPreferences` rows. Same pattern as v32.
- Do NOT touch `src/db/checkpoint.ts` (checkpoint stays at v31)

### Task 4: Wire preference store
**File:** `src/stores/useNotificationPrefsStore.ts`
- Add `'recommendation-match': 'recommendationMatch'` to `TYPE_TO_FIELD` (after `'knowledge-decay'` at ~line 15)
- Add `recommendationMatch: true` to `DEFAULTS` (after `knowledgeDecay: true` at ~line 30)

### Task 5: Add handler, dedup, mapping, and registration
**File:** `src/services/NotificationService.ts`

5a. Add `'recommendation:match': 'recommendation-match'` to `EVENT_TO_NOTIF_TYPE` (~line 167)

5b. Add dedup function `hasRecommendationMatchToday(courseId: string)` (~after line 93):
```typescript
async function hasRecommendationMatchToday(courseId: string): Promise<boolean> {
  const todayStr = new Date().toLocaleDateString('sv-SE')
  const existing = await db.notifications
    .where('type')
    .equals('recommendation-match')
    .filter(
      n =>
        (n.metadata as Record<string, unknown>)?.courseId === courseId &&
        new Date(n.createdAt).toLocaleDateString('sv-SE') === todayStr
    )
    .first()
  return existing !== undefined
}
```

5c. Add `case 'recommendation:match'` to `handleEvent()` switch (~after knowledge:decay case):
```typescript
case 'recommendation:match': {
  const alreadyRecommended = await hasRecommendationMatchToday(event.courseId)
  if (alreadyRecommended) return
  await store.create({
    type: 'recommendation-match',
    title: 'Recommended for You',
    message: `${event.courseName}: ${event.reason}`,
    actionUrl: `/courses/${event.courseId}`,
    metadata: { courseId: event.courseId, courseName: event.courseName },
  })
  break
}
```

5d. Add `'recommendation:match'` to `eventTypes` array in `initNotificationService()` (~line 293)

## Key Differences from E60-S01

| Aspect | E60-S01 (knowledge-decay) | E60-S02 (recommendation-match) |
|--------|---------------------------|--------------------------------|
| Dedup key | `metadata.topic` | `metadata.courseId` |
| actionUrl | `/review` | `/courses/${courseId}` |
| Startup check | Yes (`checkKnowledgeDecayOnStartup`) | **No** — event-driven only |
| Message | Retention % included | Reason from event included |
| Metadata | `{ topic, retention }` | `{ courseId, courseName }` |

## Commit Strategy

Single commit after all 5 tasks: `feat(E60-S02): add recommendation-match notification handler`

Granular commits optional if preferred, but changes are small and cohesive.

## Verification

```bash
npx tsc --noEmit          # Type-check passes
npm run build             # Build succeeds
npm run test:unit         # Existing tests pass (new tests in E60-S05)
npm run lint              # No lint errors
```
