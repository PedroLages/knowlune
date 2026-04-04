## Exploratory QA Report: E60-S02 — Content Recommendation Notification Handler

**Date:** 2026-04-04
**Routes tested:** 3 (`/settings`, `/notifications`, `/`)
**Health score:** 72/100

---

### Health Score Breakdown

| Category | Score | Weight | Weighted |
|----------|-------|--------|----------|
| Functional | 60 | 30% | 18.0 |
| Edge Cases | 80 | 15% | 12.0 |
| Console | 80 | 15% | 12.0 |
| UX | 80 | 15% | 12.0 |
| Links | 100 | 10% | 10.0 |
| Performance | 100 | 10% | 10.0 |
| Content | 80 | 5% | 4.0 |
| **Total** | | | **78.0/100** |

> Note: Functional score reduced due to BUG-001 (AC4 preference toggle missing from UI). All other categories are clean.

---

### Top Issues

1. **BUG-001 (High)**: The `recommendation-match` preference toggle is entirely absent from the Notification Preferences panel in Settings — users cannot enable or disable this notification type through the UI, making AC4 functionally untestable without developer tooling.
2. **BUG-002 (Low)**: A `console.debug` log fires on every app startup from `NotificationService.initNotificationService()` — debug-level logging should not appear in production builds.
3. No other functional regressions or broken behaviors found.

---

### Bugs Found

#### BUG-001: Missing "Recommendation Match" Preference Toggle in Settings
**Severity:** High
**Category:** Functional
**Route:** `/settings` (Notification Preferences section)
**AC:** AC4 — Preference suppression

**Steps to Reproduce:**
1. Navigate to `/settings`
2. Scroll to the "Notification Preferences" card
3. Review the list of per-type notification toggles

**Expected:** A toggle labeled something like "Content Recommendations" or "Recommendation Match" should appear, allowing the user to suppress `recommendation-match` notifications. AC4 states: "Given a user has disabled `recommendation-match` notifications in preferences, When a `recommendation:match` event fires, Then no notification is created."

**Actual:** The toggle does not exist. The `NOTIFICATION_TOGGLES` array in `src/app/components/settings/NotificationPreferencesPanel.tsx` ends at `knowledge-decay` (7 entries). The `recommendation-match` type was added to `TYPE_TO_FIELD` in `useNotificationPrefsStore.ts` and `DEFAULTS` includes `recommendationMatch: true`, but no corresponding UI entry was added to the panel.

**Evidence:**
```
// src/app/components/settings/NotificationPreferencesPanel.tsx
// NOTIFICATION_TOGGLES array (lines 27–70): 7 entries, all types EXCEPT recommendation-match
const NOTIFICATION_TOGGLES: ToggleDefinition[] = [
  { type: 'course-complete', ... },
  { type: 'streak-milestone', ... },
  { type: 'import-finished', ... },
  { type: 'achievement-unlocked', ... },
  { type: 'review-due', ... },
  { type: 'srs-due', ... },
  { type: 'knowledge-decay', ... },
  // ← recommendation-match is NOT here
]
```

**Impact:** The store-level preference suppression (AC4) is correctly implemented in `useNotificationPrefsStore.ts` and `NotificationService.ts`. However, users have no way to toggle this preference through the UI. The `recommendationMatch` field in the store defaults to `true` and can only be changed programmatically (e.g., via browser DevTools). This means AC4 is implemented at the service layer but untestable and unusable at the UI layer.

---

#### BUG-002: Debug Log Emitted on Every App Startup
**Severity:** Low
**Category:** Console
**Route:** All routes (fires on app mount)
**AC:** General

**Steps to Reproduce:**
1. Open browser DevTools console
2. Navigate to http://localhost:5173 (or hard refresh any page)
3. Observe console output

**Expected:** No `console.debug` output in a production-ready build. Debug logs should be stripped or guarded behind a `process.env.NODE_ENV === 'development'` check.

**Actual:** The following message appears on every startup:
```
[NotificationService] Initialized with 8 event subscriptions
```
Source: `src/services/NotificationService.ts` line 337.

**Note:** This is a pre-existing issue from E60-S01 (the log existed before this story added the 8th subscription). It is included here for completeness.

---

### AC Verification

| AC# | Description | Status | Notes |
|-----|-------------|--------|-------|
| 1 | `recommendation:match` event type added to `AppEvent` union | Pass | Verified in `src/lib/eventBus.ts` line 30. TypeScript union includes `{ type: 'recommendation:match'; courseId: string; courseName: string; reason: string }`. |
| 1 | `NotificationType` union includes `'recommendation-match'` | Pass | Verified in `src/data/types.ts` line 443. |
| 1 | `NotificationPreferences` interface includes `recommendationMatch: boolean` | Pass | Verified in `src/data/types.ts` line 469. |
| 1 | `TYPE_TO_FIELD` map includes the new mapping | Pass | Verified in `src/stores/useNotificationPrefsStore.ts` line 16: `'recommendation-match': 'recommendationMatch'`. |
| 2 | Event handler creates notification with correct title, message, actionUrl | Pass | Verified in `src/services/NotificationService.ts` lines 293–304. Title is "Recommended for You", message is `${event.courseName}: ${event.reason}`, actionUrl is `/courses/${event.courseId}`. |
| 3 | Dedup prevents duplicate notification same day for same courseId | Pass | Verified: `hasRecommendationMatchToday(courseId)` function at lines 95–107, called before `store.create()` in the `recommendation:match` case. Filters on `metadata.courseId` and `toLocaleDateString('sv-SE')` date. Pattern matches the E60-S01 approach exactly. |
| 4 | Preference suppression: disabled preference prevents notification creation | Partial | Store-level logic is correct (`isTypeEnabled` check in `handleEvent` at lines 192–193). **However, no UI toggle exists** in `NotificationPreferencesPanel.tsx` — users cannot disable this preference through the application. See BUG-001. |

---

### Console Health

| Level | Count | Notable |
|-------|-------|---------|
| Errors | 0 | No console errors from this story's code |
| Warnings | 0 | No new warnings introduced |
| Info/Debug | 1 | `[NotificationService] Initialized with 8 event subscriptions` — pre-existing debug log, fires on every startup |

---

### Notifications Page (`/notifications`) Verification

The `Notifications.tsx` page correctly handles the new type:

- `NOTIFICATION_TYPE_LABELS` includes `'recommendation-match': 'Recommended'` (line 28) — the filter button will be labeled "Recommended".
- `ALL_TYPES` includes `'recommendation-match'` (line 39) — the type filter button renders.
- `notificationIcons` in `src/lib/notifications.ts` maps `'recommendation-match'` to `Sparkles` (line 23) — icon renders without falling back to `DEFAULT_ICON`.
- `notificationIconColors` maps `'recommendation-match'` to `'text-brand'` (line 34) — consistent with other brand-colored notification types.
- The `NotificationCenter` header popover (used across all routes) uses `DEFAULT_ICON` as a fallback, so a `recommendation-match` notification would render safely even if `notificationIcons` lookup failed (it won't — the mapping exists).

No regressions detected on the Notifications page.

---

### Overview Page (`/`) Verification

The Overview page does not import or reference `NotificationType`, `NotificationPreferences`, or any notification store directly. No regressions possible from this story's changes.

The `NotificationCenter` component (rendered in the global header on all pages including Overview) correctly handles `recommendation-match` via the shared `notificationIcons` lookup, which includes the new type.

---

### DB Schema Verification

- Dexie v33 migration correctly adds `recommendationMatch: true` to existing `notificationPreferences` rows (lines 1190–1205 of `src/db/schema.ts`).
- The story correctly sequences after E60-S01 (v32 for `knowledgeDecay`).
- `CHECKPOINT_VERSION` remains at 31 — new installs get v31 checkpoint, then run v32 + v33 upgrade callbacks. This is the correct pattern.

---

### Build and Test Health

- `npm run build`: Passes — no TypeScript errors, no compilation failures.
- `npm run test:unit`: 3688/3688 tests pass across 223 test files.
- Coverage threshold warning (65.72% lines vs 70% threshold) is a pre-existing issue unrelated to this story.

---

### What Works Well

1. **Pattern consistency**: The `hasRecommendationMatchToday(courseId)` dedup function is structurally identical to `hasKnowledgeDecayToday(topic)` from E60-S01, making the codebase easy to extend with future notification types.
2. **Notifications page extensibility confirmed**: Adding `recommendation-match` to `Notifications.tsx` required only 2 lines (label map entry + `ALL_TYPES` entry), validating the extensible design of the notification system.
3. **Type safety end-to-end**: The `NotificationType` union, `NotificationPreferences` interface, `TYPE_TO_FIELD` map, and `EVENT_TO_NOTIF_TYPE` map are all updated in sync — no type escape hatches or `as unknown` casts introduced.
4. **Error handling discipline maintained**: The `recommendation:match` handler in `initNotificationService()` follows the established `.catch(error => console.error(...))` pattern with a `// silent-catch-ok` justification comment.

---

Health: 78/100 | Bugs: 2 | Blockers: 0 | High: 1 | ACs: 3.5/4 verified (AC4 partial — service layer correct, UI toggle missing)
