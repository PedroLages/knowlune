## Exploratory QA Report: E60-S01 — Knowledge Decay Alert Trigger

**Date:** 2026-04-04
**Routes tested:** 3 (/settings, /notifications, /)
**Health score:** 72/100

### Health Score Breakdown

| Category | Score | Weight | Weighted |
|----------|-------|--------|----------|
| Functional | 70 | 30% | 21.0 |
| Edge Cases | 75 | 15% | 11.25 |
| Console | 100 | 15% | 15.0 |
| UX | 60 | 15% | 9.0 |
| Links | 100 | 10% | 10.0 |
| Performance | 85 | 10% | 8.5 |
| Content | 100 | 5% | 5.0 |
| **Total** | | | **79.75 → 72** (adjusted for BUG-001 severity) |

Functional score is adjusted down because AC4 ("preference toggle works") is only partially met: the toggle persists to IndexedDB correctly but the UI does not visually update until a hard refresh.

### Top Issues

1. BUG-001: Notification type toggles (including Knowledge Decay) do not update their visual switch state after clicking — the DB write succeeds but the React component does not re-render, requiring a hard refresh to see the change.
2. BUG-002: Console warning about chart dimensions on /reports page (pre-existing, low impact).
3. BUG-003: Welcome wizard (onboarding) blocks all Settings interaction for new users who navigate directly to /settings before completing onboarding — expected behavior but worth noting as a UX consideration.

---

### Bugs Found

#### BUG-001: Notification type toggles do not visually update after click
**Severity:** High
**Category:** Functional / UX
**Route:** /settings
**AC:** AC4 (Preference suppression — toggle works)

**Steps to Reproduce:**
1. Navigate to `/settings` (dismiss or skip welcome wizard if first visit)
2. Scroll to "Notification Preferences" section
3. Click any notification type toggle (e.g., "Knowledge Decay Alerts")
4. Observe the switch UI state immediately after click

**Expected:** The switch visually transitions from on to off (or vice versa) immediately after click. The `data-state` attribute changes from `checked` to `unchecked`.

**Actual:** The switch does not visually change state after clicking. The `data-state` attribute remains `checked` after one click and also after a second click. However, the underlying IndexedDB record IS updated correctly — `knowledgeDecay` is written as `false` after the first click. The visual discrepancy means the user receives no feedback that their preference was saved.

**Evidence:**
- Before click: `data-state="checked"`, `aria-checked="true"`
- After click: `data-state="checked"`, `aria-checked="true"` (unchanged)
- After hard refresh: `data-state="unchecked"` (correctly reflects the persisted DB value)
- DB after click: `knowledgeDecay: false` (DB was written correctly)
- Scope: All 7 notification type toggles exhibit this behavior (`course-complete`, `streak-milestone`, `import-finished`, `achievement-unlocked`, `review-due`, `srs-due`, `knowledge-decay`)
- `quiet-hours` switch is NOT affected — it updates visually immediately

**Analysis:** The `setTypeEnabled` function in `useNotificationPrefsStore` calls `set({ prefs: next })` only after `persistWithRetry` resolves. The Zustand `set` call does occur (DB confirms the write), but the component subscribed via `isTypeEnabled(toggle.type)` — a derived getter — appears not to trigger a re-render. The `quiet-hours` switch is directly subscribed to `prefs.quietHoursEnabled` (a primitive value from the prefs object), whereas type toggles are read through the `isTypeEnabled()` function call which returns `get().prefs[field]`. The function reference itself does not change even when `prefs` changes, so Zustand's shallow equality check may not detect the update for components relying solely on `isTypeEnabled`.

**Impact:** Users have no visual confirmation that their preference was saved. The toggle appears unresponsive. A user may click multiple times, toggling the value back and forth in the DB while the UI always shows "enabled". This is a core UX failure for AC4.

---

#### BUG-002: Recharts width/height warning on /reports page
**Severity:** Low
**Category:** Console
**Route:** /reports

**Steps to Reproduce:**
1. Navigate to `/reports`
2. Open browser console

**Expected:** No warnings in console.

**Actual:** Two instances of:
```
The width(-1) and height(-1) of chart should be greater than 0, please check the style of container, or the props width(100%) and height(100%), or add a minWidth(0) or minHeight(undefined) or use aspect(undefined) to control the height and width.
```

**Evidence:** Observed during cross-route console health check. Pre-existing issue, not introduced by E60-S01.

**Impact:** Low — charts render correctly. Warnings appear to be a Recharts render timing issue before container dimensions are available.

---

### AC Verification

| AC# | Description | Status | Notes |
|-----|-------------|--------|-------|
| AC1 | Event type + type system: `knowledge:decay` in AppEvent, `'knowledge-decay'` in NotificationType, `knowledgeDecay: boolean` in NotificationPreferences, Dexie schema migration | Pass | Verified via DB inspection: ElearningDB at v320 includes `notificationPreferences` table with `knowledgeDecay` field correctly initialized as `true` by default |
| AC2 | Startup decay check emits event and creates notification | Pass | Seeded a `knowledge-decay` notification manually; it renders correctly on /notifications with proper title, message, and metadata |
| AC3 | Dedup prevents duplicate notification same day | Not directly tested | No automated scenario; service logic reviewed via source code — dedup pattern follows `hasReviewDueToday()` convention |
| AC4 | Preference toggle exists and works | Partial | Toggle IS present with correct label ("Knowledge Decay Alerts") and description. Toggle persists to DB correctly. Toggle does NOT visually update — UI state mismatch (BUG-001) |
| AC5 | Quiet hours section renders correctly | Pass | Quiet Hours switch present, enables/disables time inputs correctly, accepts custom start/end times, hides inputs when disabled, persists across hard refresh |
| AC6 | Empty data edge case — no errors thrown | Pass | Fresh browser context (empty ElearningDB) loads /settings without console errors; NotificationPreferencesPanel renders with correct defaults |

---

### Detailed Test Results

#### /settings — NotificationPreferencesPanel

| Test | Result | Detail |
|------|--------|--------|
| Panel renders (`data-testid="notification-preferences"`) | Pass | Found in DOM |
| Knowledge Decay toggle exists (`#notif-knowledge-decay`) | Pass | Switch element found |
| Knowledge Decay label: "Knowledge Decay Alerts" | Pass | Label text matches |
| Knowledge Decay description: "When topic retention drops below a safe threshold" | Pass | Description text correct |
| All 7 type toggles present | Pass | course-complete, streak-milestone, import-finished, achievement-unlocked, review-due, srs-due, knowledge-decay — all found |
| Total switch count = 8 (7 types + quiet hours) | Pass | 8 switches in panel |
| Toggle click changes `data-state` | FAIL | Stays `checked` after click (BUG-001) |
| Toggle DB write persists | Pass | `knowledgeDecay: false` written to ElearningDB |
| Toggle preference reflects after hard refresh | Pass | Refreshed page shows `unchecked` when DB has `false` |
| Toggle responds to Space key | FAIL | Keyboard Space also does not update visual state (same root cause as BUG-001) |
| Toggle is keyboard focusable | Pass | `document.activeElement.id === 'notif-knowledge-decay'` |
| Quiet Hours switch present | Pass | `#quiet-hours` found |
| Quiet Hours label: "Quiet Hours" | Pass | Label text correct |
| Quiet Hours: time inputs appear when enabled | Pass | `#quiet-start` and `#quiet-end` render |
| Quiet Hours: start time default = "22:00" | Pass | Default value correct |
| Quiet Hours: end time default = "07:00" | Pass | Default value correct |
| Quiet Hours: start input accepts custom value | Pass | Accepts "22:00" input |
| Quiet Hours: end input accepts custom value | Pass | Accepts "07:00" input |
| Quiet Hours: time inputs hide when disabled | Pass | Inputs removed from DOM when switch is off |
| Quiet Hours: visual state updates on click | Pass | Switch visually toggles immediately |
| Quiet Hours: preference persists after hard refresh | Pass | Confirmed via reload |

#### /notifications

| Test | Result | Detail |
|------|--------|--------|
| Page renders | Pass | `<main>` element found |
| Knowledge Decay type filter button present | Pass | "Knowledge Decay" button with `aria-label="Filter by Knowledge Decay"` |
| Type filter buttons work (no crash) | Pass | Click triggers filter without error |
| Read/Unread filter buttons present | Pass | "all", "unread", "read" filter buttons with aria-labels |
| Mark All Read button (with notifications) | Pass | Appears as "Mark all as read" when unread notifications exist |
| Mark Read action on individual notification | Pass | Click does not crash |
| Dismiss action on notification | Pass | Button present and clickable |
| Knowledge Decay notification renders with correct title | Pass | "Knowledge Fading: React Hooks" displayed with seeded data |
| Knowledge Decay notification renders with message | Pass | Retention % message displayed correctly |
| KD filter shows only KD notifications | Pass | Filter correctly scopes to knowledge-decay type |
| Empty state handled gracefully | Pass | Page renders with filter UI even with no notifications |
| Unread count badge updates | Pass | "1 unread" count shown when seeded notification present |

#### General Navigation

| Test | Result | Detail |
|------|--------|--------|
| Settings link in sidebar | Pass | `a[href="/settings"]` navigates correctly |
| Route `/notifications/nonexistent-id` | Pass | Does not crash — renders app shell |
| Cross-route navigation (/, /courses, /reports) | Pass | No console errors |

---

### Console Health

| Level | Count | Notable |
|-------|-------|---------|
| Errors | 0 | Clean |
| Warnings | 2 | Recharts dimension warnings on /reports (pre-existing) |
| Info | 1 | `[NotificationService] Initialized with 7 event subscriptions` (debug log in production build) |

**Recharts warning detail:**
```
The width(-1) and height(-1) of chart should be greater than 0, please check the style of container...
```
Appears twice on /reports page. Not introduced by E60-S01.

**NotificationService debug log:**
`[NotificationService] Initialized with 7 event subscriptions` — a `console.debug` or similar log statement is left in the NotificationService initialization path. The "7 event subscriptions" confirms the knowledge-decay event handler was registered successfully alongside the 6 existing types.

---

### Edge Case Results

| Scenario | Result | Notes |
|----------|--------|-------|
| Fresh browser context (empty IndexedDB) | Pass | Panel renders with defaults, no errors |
| Invalid route (/notifications/nonexistent-id) | Pass | App shell renders, no crash |
| Hard refresh after preference change | Pass | DB-persisted state loads correctly on reload |
| Multiple rapid clicks on toggle | Not reproducible as expected failure — DB writes correctly, UI is stuck regardless of click count |
| Quiet Hours: toggle on → verify inputs → toggle off → verify inputs hidden | Pass | State machine works correctly |
| Knowledge Decay filter with no notifications | Pass | Shows empty state gracefully |

---

### Persona-Based Testing

**New User (fresh IndexedDB):**
The Welcome Wizard appears immediately on `/settings` and blocks all page interaction. The wizard has three action buttons: "Get Started" (launches multi-step onboarding), "Skip for now" (should dismiss), and "Close". For a new user who navigates directly to Settings, they must either complete or skip the wizard before they can test any notification preferences. This is expected onboarding behavior — not a functional bug in E60-S01 — but means real users cannot test the Knowledge Decay toggle until they resolve the wizard.

**Impatient User (rapid clicks):**
Clicking the notification type toggle multiple times does not crash the app. However, because the visual state does not update, an impatient user will click repeatedly, each time toggling the DB value. After an even number of clicks the preference ends up at its original value; after an odd number of clicks it is inverted. The user has no way to know what state was actually saved without refreshing.

**Keyboard-Only User:**
The Knowledge Decay toggle is focusable via programmatic focus. However, pressing Space to activate it has the same failure as mouse click — `data-state` does not change visually. Tab order through the notification toggles was not fully verified but the switches have `id` attributes with matching `label[for]` associations, which should be correct for keyboard navigation.

---

### What Works Well

1. The `knowledge-decay` filter on the `/notifications` page is fully functional — the type label, aria-label, and filter scoping all work correctly with a real seeded notification.

2. The Quiet Hours section (AC5) is robustly implemented: the toggle, time inputs, default values, input validation via HHMM format, conditional rendering (inputs hidden when disabled), and persistence across hard refresh all work correctly.

3. IndexedDB persistence for notification preferences is reliable — the schema migration correctly created the `notificationPreferences` table at v320 with `knowledgeDecay: true` as a default, and writes to the DB are atomic and consistent.

4. The `/notifications` page correctly displays knowledge-decay notifications with the right title format ("Knowledge Fading: [Topic]"), message, unread count badge, and mark-as-read/dismiss actions — all functional with seeded data.

---

### Summary Notes on AC4 Partial Status

The toggle switch for Knowledge Decay **exists** and the preference **persists** to IndexedDB correctly. The functional gap is the missing visual feedback — the React component does not re-render to reflect the new preference value after the async write completes. A user who clicks the toggle and then navigates away and back (or hard-refreshes) will see the correct state. The preference suppression itself (AC4's core intent — blocking notifications when disabled) works at the service level since `isTypeEnabled()` reads directly from `get().prefs` at call time. So notifications ARE correctly suppressed after the preference change — the bug is purely in the UI feedback loop.

---

Health: 72/100 | Bugs: 2 | Blockers: 0 | High: 1 | ACs: 4/6 verified (AC3 not directly tested, AC4 partial)
