## Exploratory QA Report: E111-S01 — Audio Clips

**Date:** 2026-04-12
**Routes tested:** 1 (`/library/:id/read`)
**Health score:** 91/100

### Health Score Breakdown

| Category | Score | Weight | Weighted |
|----------|-------|--------|----------|
| Functional | 95 | 30% | 28.5 |
| Edge Cases | 90 | 15% | 13.5 |
| Console | 100 | 15% | 15.0 |
| UX | 90 | 15% | 13.5 |
| Links | 100 | 10% | 10.0 |
| Performance | 100 | 10% | 10.0 |
| Content | 100 | 5% | 5.0 |
| **Total** | | | **95.5/100** |

> Health score revised to 91/100 after AC-7 test coverage gap penalty applied (see BUG-002).

### Top Issues

1. AC-7 drag-and-drop test only verifies drag handle visibility — not actual reorder or persistence across sessions, meaning the AC claim is unverified end-to-end by automated tests.
2. `addClip` uses optimistic UI state update before DB persistence, which contradicts the story Pre-Review Checklist ("No optimistic UI updates before persistence"), though rollback on failure is correctly implemented.
3. AC-7 reorder persistence across hard refresh has no automated test coverage at all.

### Bugs Found

#### BUG-001: Pre-Review Checklist Violation — addClip Uses Optimistic Update Before Persistence
**Severity:** Low
**Category:** Functional
**Route:** `/library/:id/read`
**AC:** AC-2

**Steps to Reproduce:**
1. Open an audiobook
2. Start a clip, end a clip
3. Observe: clip appears in clips panel immediately (optimistic)
4. (In theory) if DB write fails, rollback occurs

**Expected:** Per the story Pre-Review Checklist item "No optimistic UI updates before persistence — state updates after DB write succeeds", the clip should only appear after successful `db.audioClips.put()`.

**Actual:** `useAudioClipStore.addClip` sets state optimistically (line 60) before `await db.audioClips.put(clip)` (line 63). The rollback is implemented if DB fails, so this is a checklist compliance issue rather than a data loss bug.

**Evidence:** `/Volumes/SSD/Dev/Apps/Knowlune/src/stores/useAudioClipStore.ts` lines 59–70. Same pattern applied to `deleteClip` (line 99) and `reorderClips` (line 124). The `updateClipTitle` and `reorderClips` follow the same pattern, consistent with how `useReadingQueueStore` and `useBookmarkStore` (cited in file header) are implemented.

**Note:** This is a checklist compliance issue. The implementation does follow the engineering-patterns.md guidance for optimistic updates with rollback. Low severity.

---

#### BUG-002: AC-7 Test Coverage Gap — Drag Reorder Not Actually Exercised or Persistence Verified
**Severity:** Medium
**Category:** Functional
**Route:** `/library/:id/read`
**AC:** AC-7

**Steps to Reproduce:**
1. Create two clips
2. Open clips panel
3. Drag clip 1 below clip 2
4. Close and reopen clips panel (or hard refresh)

**Expected:** Clips appear in the new order after reopen / hard refresh. The AC states "the new order persists across sessions."

**Actual:** The ATDD test for AC-7 (`story-e111-s01.spec.ts:266`) only checks that drag handles are visible (`await expect(dragHandles.first()).toBeVisible()`). No actual drag gesture is performed, no order change is verified, and no persistence across panel close/reopen or page reload is tested. The functional reorder logic in `reorderClips` store action is exercised only in unit tests.

**Evidence:**
```
test('AC-7: Clips can be reordered via drag-and-drop', async ({ page }) => {
  // Only checks drag handle presence — no actual drag occurs
  await expect(dragHandles.first()).toBeVisible()
})
```

**Impact:** AC-7 acceptance criterion ("new order persists across sessions") is not validated by E2E automation. Manual testing confirms the UI structure is in place but the full flow (drag → verify new order → reload → verify order survived) has no automated coverage.

---

### AC Verification

| AC# | Description | Status | Notes |
|-----|-------------|--------|-------|
| 1 | Start Clip captures current time, shows visual indicator | Pass | Recording indicator (pulsing red dot) appears. Toast shown. Tested in E2E + exploratory. |
| 2 | End Clip saves to audioClips table with all required fields | Pass | IDB row confirmed via evaluate(). Required fields: bookId, chapterId, chapterIndex, startTime, endTime, createdAt all present. |
| 3 | Clips panel lists all clips in chronological order | Pass | Clips loaded via `sortBy('sortOrder')`. Panel shows chapter, timestamps, title. |
| 4 | Tapping a clip jumps to start time and plays to end time | Pass | `handlePlayClip` seeks to startTime, plays, `activeClipEnd` effect auto-pauses at endTime. |
| 5 | Editing a clip updates its title | Pass | Inline edit with Enter-to-save and Escape-to-cancel. Empty title saves as "Untitled clip". 500-char title handled gracefully. |
| 6 | Deleting a clip removes from DB and updates list immediately | Pass | Optimistic removal. Confirmation step prevents accidental delete. |
| 7 | Drag-and-drop reorder persists across sessions | Partial | Store logic and IDB write are implemented. E2E test only verifies drag handle presence — actual drag/persist flow has no E2E coverage. |
| 8 | Accessible via keyboard, ARIA labels, 44x44 touch targets | Pass | Start Clip and Clips panel buttons both have aria-labels and meet 44x44 minimum. Cancel and End Clip buttons also labeled. `role="list"` and `aria-label="Audio clips"` on list. |

### Console Health

| Level | Count | Notable |
|-------|-------|---------|
| Errors | 0 | Clean across all tested flows |
| Warnings | 0 | No React warnings, no key prop issues |
| Info | 0 | No debug logs in production code |

All clip operations (start, cancel, end, open panel, edit, delete) produced zero console errors in exploratory testing.

### Edge Cases Tested

| Scenario | Result |
|----------|--------|
| endTime = startTime (0s clip) | Error toast shown, recording continues (correct) |
| Cancel recording mid-session | State resets cleanly, Start Clip button returns |
| Empty clips panel (no clips) | Helpful "No clips yet. Tap Start Clip..." message shown |
| Double-click Start Clip | Only one recording state entered (no duplicate) |
| 500-character clip title | Accepted without crash; text truncated in UI |
| Clearing clip title to empty | Shows "Untitled clip" italic placeholder |
| Hard refresh after saving clip | Clip persists in IndexedDB across reload |
| Mobile 375px viewport | All controls visible and meet 44x44 touch targets |

### What Works Well

1. The two-phase clip recording flow (Start → animated indicator → End) is intuitive and the pulsing red indicator gives clear visual feedback that recording is active.
2. The cancel button animating in during recording is a thoughtful affordance — cancelling is easy and resets state completely without leaving orphaned data.
3. The error guard for `endTime <= startTime` fires correctly with a toast and leaves the user in recording state, allowing them to wait for more audio to pass — good recovery UX.
4. The empty state message is actionable and tells the user exactly what to do ("Tap 'Start Clip' while listening"), which is much better than a generic "Nothing here" message.

---
Health: 91/100 | Bugs: 2 | Blockers: 0 | High: 0 | Medium: 1 | Low: 1 | ACs: 7/8 fully verified (AC-7 partial)
