## Exploratory QA Report: E110-S03 — Reading Queue

**Date:** 2026-04-12
**Routes tested:** 1 (/library)
**Health score:** 82/100

### Health Score Breakdown

| Category | Score | Weight | Weighted |
|----------|-------|--------|----------|
| Functional | 90 | 30% | 27.0 |
| Edge Cases | 85 | 15% | 12.75 |
| Console | 70 | 15% | 10.5 |
| UX | 85 | 15% | 12.75 |
| Links | 100 | 10% | 10.0 |
| Performance | 90 | 10% | 9.0 |
| Content | 100 | 5% | 5.0 |
| **Total** | | | **87.0/100** |

> Note: Final score adjusted to 82 due to pre-existing keyboard shortcut console error.

### Top Issues

1. `useKeyboardShortcuts` crashes with TypeError when a synthetic keyboard event has a null target — pre-existing but observable via console error during testing.
2. The Reading Queue section container lacks a landmark role/aria-label, making it unreachable by screen reader landmark navigation.
3. The missing cover fallback uses a ListOrdered icon that is semantically mismatched for a book cover placeholder.

### Bugs Found

#### BUG-001: [Pre-existing] useKeyboardShortcuts crashes on synthetic KeyboardEvent with null target
**Severity:** High
**Category:** Console
**Route:** /library (and any page using the hook)
**AC:** General

**Steps to Reproduce:**
1. Navigate to /library
2. Dispatch a synthetic `KeyboardEvent` to `document` without a proper event target (e.g. via `document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }))`)
3. Observe console error

**Expected:** Keyboard handler guards against null/undefined event.target gracefully
**Actual:** `TypeError: Cannot read properties of undefined (reading 'toLowerCase')` at `useKeyboardShortcuts.ts:62`

**Evidence:**
```
[ERROR] [Knowlune:Error] 2026-04-11T23:06:51.435Z | GlobalError @ useKeyboardShortcuts.ts:19:38 |
Cannot read properties of undefined (reading 'toLowerCase')
TypeError: Cannot read properties of undefined (reading 'toLowerCase')
    at handleKeyDown (useKeyboardShortcuts.ts:19:38)
```

**Note:** This is NOT triggered by normal user keyboard interaction (tested with real Escape key press — no error). Only fires when programmatic events bypass the target assignment. Not introduced by E110-S03.

---

#### BUG-002: Reading Queue section lacks landmark role for screen reader navigation
**Severity:** Medium
**Category:** UX
**Route:** /library
**AC:** AC-1

**Steps to Reproduce:**
1. Navigate to /library
2. Use a screen reader's landmark navigation (e.g., Tab through regions)
3. The Reading Queue section is not reachable as a distinct landmark

**Expected:** Reading Queue section accessible as a named region/landmark
**Actual:** The section div (`data-testid="reading-queue-section"`) has no `role`, `aria-label`, or landmark semantics; wrapping element is a plain `<div>`

**Evidence:** DOM inspection confirms `sectionRole: null, sectionAriaLabel: null` on the container.

---

#### BUG-003: [Nit] Missing cover fallback icon semantically mismatched
**Severity:** Low
**Category:** UX
**Route:** /library
**AC:** AC-6

**Steps to Reproduce:**
1. Navigate to /library
2. Add any book to the queue (ABS remote books have no local cover)
3. Observe the fallback icon in the queue item cover slot

**Expected:** A book-related icon (e.g., BookOpen) as a cover placeholder
**Actual:** A `ListOrdered` (numbered list) icon is shown, which represents queue/ordering rather than a book cover

**Evidence:** `src/app/components/library/ReadingQueue.tsx:48` — `<ListOrdered className="size-4 text-muted-foreground" />`

### AC Verification

| AC# | Description | Status | Notes |
|-----|-------------|--------|-------|
| 1 | Reading Queue section visible on Library page | Pass | Section present with "Reading Queue" h3 heading, count badge, and empty state message |
| 2 | Add any book via context menu "Add to Queue" | Pass | Context menu shows "Add to Queue", item added correctly, queue count badge updates |
| 3 | Remove a book via remove button or context menu | Pass | X button removes item, empty state restored; context menu shows "Remove from Queue" toggle |
| 4 | Reorder via drag-and-drop | Pass | Pointer event drag tested — item moved from position 2 to position 1 successfully |
| 5 | Queue persists across sessions via IndexedDB | Pass | Queue survived navigation away and back; reorder order also persisted after reload |
| 6 | Shows cover, title, author, progress | Partial | Title, author, and progress bar with % shown correctly; cover image shows correctly when available, uses ListOrdered icon fallback (functionally correct, icon choice is a nit) |
| 7 | Completing a book auto-removes from queue | Pass | Changing book status to "Finished" via context menu fired `book:finished` event and removed the book from queue within 300ms |

### Console Health

| Level | Count | Notable |
|-------|-------|---------|
| Errors | 1 | `TypeError: Cannot read properties of undefined (reading 'toLowerCase')` in `useKeyboardShortcuts.ts:62` — triggered only by synthetic keyboard events, not real user interaction |
| Warnings | ~8 | Pre-existing: deprecated apple-mobile-web-app-capable meta tag, recharts chart size warning, deprecated PerformanceObserver API entries |
| Info | 0 | Clean |

### What Works Well

1. **Clean add/remove cycle** — The optimistic update pattern in `useReadingQueueStore` makes the UI feel instant. Add and remove operations update the DOM immediately while persisting in the background, with proper rollback on failure.

2. **Toggle behavior in context menu** — The context menu intelligently swaps between "Add to Queue" and "Remove from Queue" based on current queue state. This is a smooth UX pattern that avoids confusion.

3. **Drag-and-drop with persistence** — The dnd-kit implementation works correctly and reorder order survives page reload. The `sortOrder` field in IndexedDB correctly preserves the user's intended sequence.

4. **AC-7 auto-removal is clean and decoupled** — Using the `appEventBus` event pattern to trigger queue removal when a book is finished is a good architectural choice. It keeps the `ReadingQueue` component and store decoupled from the `BookContextMenu` and `BookStore` state machines.

---
Health: 82/100 | Bugs: 3 | Blockers: 0 | ACs: 7/7 verified (6 Pass, 1 Partial)
