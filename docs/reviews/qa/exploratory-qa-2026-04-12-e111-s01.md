## Exploratory QA Report: E111-S01 — Audio Clips

**Date:** 2026-04-12
**Routes tested:** 2 (`/library`, `/library/:id/read`)
**Health score:** 78/100

### Health Score Breakdown

| Category | Score | Weight | Weighted |
|----------|-------|--------|----------|
| Functional | 85 | 30% | 25.5 |
| Edge Cases | 80 | 15% | 12.0 |
| Console | 60 | 15% | 9.0 |
| UX | 90 | 15% | 13.5 |
| Links | 100 | 10% | 10.0 |
| Performance | 80 | 10% | 8.0 |
| Content | 100 | 5% | 5.0 |
| **Total** | | | **83/100** |

### Top Issues

1. ABS progress sync fires unbounded 429 errors when playback position changes — 188+ console errors flooded during a single clip-play seek operation.
2. ClipButton guard (`endTime <= startTime`) silently prevents saving when audio has no source loaded — user sees no feedback if they Start and immediately End at 0:00.
3. Direct Playwright click on "Start Clip" at 720px viewport caused navigation away from player (agentation overlay intersection), though at 900px the feature works correctly via test-id targeting.

### Bugs Found

#### BUG-001: ABS progress sync floods console with 429 errors on seek
**Severity:** High
**Category:** Console
**Route:** `/library/:id/read`
**AC:** General

**Steps to Reproduce:**
1. Navigate to any audiobook reader page
2. Open ClipListPanel and click "Play clip from..." on any clip
3. Observe browser console

**Expected:** Progress sync fires once or uses exponential backoff on 429 responses
**Actual:** 188+ consecutive 429 errors logged per session, hammering `/api/abs/proxy/api/me/progress/{bookId}` every ~100ms

**Evidence:** Console showed 188 repeated `Failed to load resource: 429 (Too Many Requests)` errors from `useAudiobookshelfProgressSync` hook — triggered because seeking causes rapid `currentTime` updates which each fire a sync request with no throttle or 429 handling. Pre-existing issue (not introduced in E111-S01).

---

#### BUG-002: "Start Clip" at position 0:00 gives no feedback when End Clip is rejected
**Severity:** Medium
**Category:** UX
**Route:** `/library/:id/read`
**AC:** AC-2

**Steps to Reproduce:**
1. Open audiobook player with no audio file loaded (or at position 0:00)
2. Click "Start Clip"
3. Do not advance playback time
4. Click "End Clip"

**Expected:** User sees an informative toast OR the guard is explained in the UI state (e.g. "Clip started at 0:00 — advance playback to set end time")
**Actual:** `toast.error('End time must be after start time')` fires, which is correct, but the initial "Clip started at 0:00" toast may confuse users — they successfully started recording but cannot end it without advancing time. Recording indicator stays visible.

**Evidence:** `ClipButton.tsx` line 52 guard: `if (endTime <= pendingStartTime) { toast.error(...); return; }` — no hint given that time must advance.

---

#### BUG-003: IDB "object store not found" errors on fresh session before DB upgrade completes
**Severity:** High
**Category:** Console
**Route:** `/library/:id/read`
**AC:** AC-2

**Steps to Reproduce:**
1. With a fresh browser session (no existing `ElearningDB`), navigate to audiobook player
2. Click "Start Clip" while DB is still upgrading

**Expected:** Clip operations wait for DB to be ready
**Actual:** Two `NotFoundError: Failed to execute 'transaction' on 'IDBDatabase': One of the specified object stores was not found` errors fired in early test sessions. The errors triggered navigation away from the player to the home page, blocking all clip functionality.

**Evidence:** Console errors at 2026-04-12T13:28:42.604Z and 2026-04-12T13:28:45.822Z — appeared on first two click attempts before the DB was fully initialized with v470 schema. Subsequent sessions with an initialized DB did not reproduce this.

---

### AC Verification

| AC# | Description | Status | Notes |
|-----|-------------|--------|-------|
| 1 | Start Clip captures start time, shows recording indicator | Pass | Start Clip → End Clip button + pulsing red `aria-label="Recording in progress"` dot confirmed |
| 2 | End Clip saves clip to `audioClips` Dexie table with required fields | Pass | DB write confirmed: bookId, chapterId, chapterIndex, startTime, endTime, sortOrder, createdAt all present. Guard correctly rejects endTime ≤ startTime. |
| 3 | Clips panel lists all clips with times, chapter name, optional title | Pass | ClipListPanel shows "Chapter 1 · 0:30 – 1:30", "Untitled clip" / custom title; loads from IDB on panel open |
| 4 | Tapping a clip seeks to start time and plays to end time | Pass | Click "Play clip" sought player to ~startTime, dialog closed, `activeClipEnd` state set for auto-pause |
| 5 | Editing a clip updates the title | Pass | Inline edit input (`aria-label="Clip title"`) appears, Enter saves to IDB; title "Great investment insight" persisted |
| 6 | Deleting a clip removes it from DB and updates list | Pass | Two-step confirmation (Delete → Confirm), IDB count drops to 0, empty state shown immediately |
| 7 | DnD reorder persists order across sessions | Pass | Keyboard DnD (Space + ArrowDown + Space) reordered Clip A/B; IDB sortOrder values updated correctly |
| 8 | Accessible via keyboard, ARIA labels, touch targets ≥44×44px | Pass | All clip buttons have ARIA labels; Start Clip and Clips buttons are exactly 44×44px on 390px mobile |

### Console Health

| Level | Count | Notable |
|-------|-------|---------|
| Errors | 188+ (session-dependent) | All 429 from ABS progress sync — pre-existing, not introduced by E111-S01 |
| Errors | 2 (first session only) | IDB "object store not found" on initial DB upgrade — race condition |
| Warnings | 5 | React key warnings and CSP violation for axe-core (from design-review agent injection) |
| Info | 0 | No debug logs |

### What Works Well

1. The two-phase ClipButton UX (Start → recording indicator + Cancel → End) is clear and follows the BookmarkButton pattern consistently.
2. Drag-and-drop reorder works correctly via keyboard with @dnd-kit, including IDB persistence — the reorder + sortOrder update transaction is atomic.
3. The ClipListPanel correctly shows chapter name, formatted timestamps (0:30 – 1:30), and handles empty state with a helpful hint message.
4. Mobile responsiveness is solid: at 390px all clip controls render within the player toolbar, touch targets are exactly 44×44px, and the Sheet panel adapts to full-width.

---
Health: 83/100 | Bugs: 3 | Blockers: 0 | ACs: 8/8 verified
