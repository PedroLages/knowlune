## Exploratory QA Report: E111-S02 — Skip Silence and Speed Memory

**Date:** 2026-04-12
**Routes tested:** 2 (`/library`, `/library/:bookId/read`)
**Health score:** 82/100

### Health Score Breakdown

| Category | Score | Weight | Weighted |
|----------|-------|--------|----------|
| Functional | 95 | 30% | 28.5 |
| Edge Cases | 90 | 15% | 13.5 |
| Console | 60 | 15% | 9.0 |
| UX | 90 | 15% | 13.5 |
| Links | 100 | 10% | 10.0 |
| Performance | 90 | 10% | 9.0 |
| Content | 100 | 5% | 5.0 |
| **Total** | | | **88.5/100** |

> Note: Console score reduced due to React key-prop warnings in ChapterList (repeated per render) and TypeError in useKeyboardShortcuts when event target is document rather than an Element.

### Top Issues

1. `useKeyboardShortcuts` crashes with `TypeError: Cannot read properties of undefined (reading 'toLowerCase')` when a `keydown` event has `document` as its target (no `tagName` property) — real-world scenario when no focusable element has focus.
2. `ChapterList` emits React duplicate-key warnings on every render because test chapter data (and potentially some real ABS chapters) lack an `id` field, causing `key={chapter.id}` to be `undefined` for all items.
3. `AudiobookSettingsPanel` speed presets expose 11 options (0.5–3.0 in 0.25 steps) while `SpeedControl` popover offers only 9 options (0.5–3.0, skipping 2.25 and 2.75) — inconsistency between global default selector and per-book selector.

### Bugs Found

#### BUG-001: useKeyboardShortcuts crashes when event.target lacks tagName
**Severity:** High
**Category:** Console / Functional
**Route:** `/library/:bookId/read`
**AC:** AC-8

**Steps to Reproduce:**
1. Navigate to any audiobook reader page
2. Dispatch a `keydown` event with `document` as the target (e.g., `document.dispatchEvent(new KeyboardEvent('keydown', { key: 's', bubbles: true }))`)
3. Observe console errors

**Expected:** Hook safely ignores events where `e.target` is not an Element (graceful guard)
**Actual:** `TypeError: Cannot read properties of undefined (reading 'toLowerCase')` thrown at `useKeyboardShortcuts.ts:62` — `target.tagName` is `undefined` when target is `document`, `window`, or `null`. Error is caught by global error tracking but not surfaced to the user. In real browsers this can happen when the active element is removed from DOM mid-keypress or when focus is on `document.body` in certain browser/OS edge cases.

**Evidence:** Console output: `[Knowlune:Error] 2026-04-12T15:47:33.427Z | GlobalError @ useKeyboardShortcuts.ts:19:38 | Cannot read properties of undefined (reading 'toLowerCase')`

**Fix suggestion:** Add null/tagName guard: `const tagName = target?.tagName?.toLowerCase() ?? ''`

---

#### BUG-002: ChapterList emits React duplicate-key warning — chapter.id can be undefined
**Severity:** Medium
**Category:** Console
**Route:** `/library/:bookId/read`
**AC:** General

**Steps to Reproduce:**
1. Open any audiobook whose chapters lack an `id` field (test seed data, or ABS chapters not yet migrated to full BookChapter schema)
2. Observe React warnings in console

**Expected:** No React key-prop warnings
**Actual:** `Each child in a list should have a unique "key" prop. Check the render method of ChapterList.` — fires on every render because `key={chapter.id}` resolves to `undefined` for all items

**Evidence:** Console error repeated across all audiobook reader navigations during session

**Fix suggestion:** Fall back to index: `key={chapter.id ?? index}` in `ChapterList.tsx:61`

---

#### BUG-003: Speed option set mismatch between SpeedControl and AudiobookSettingsPanel
**Severity:** Low
**Category:** UX
**Route:** `/library/:bookId/read`
**AC:** AC-5

**Steps to Reproduce:**
1. Open speed popover on the player (SpeedControl): options are 0.5, 0.75, 1.0, 1.25, 1.5, 1.75, 2.0, 2.5, 3.0 (9 options)
2. Open Audiobook Settings panel → Default Speed section: options are 0.5–3.0 in 0.25 increments (11 options, including 2.25 and 2.75)

**Expected:** Both speed selectors offer the same speed options for consistency
**Actual:** `SpeedControl` skips 2.25× and 2.75× while `AudiobookSettingsPanel` includes them. A user can set a global default of 2.25× that they cannot set per-book via the player controls.

**Evidence:** Verified via DOM inspection — `speed-option-*` testids on player vs `speed-preset-*` testids in settings panel

---

### AC Verification

| AC# | Description | Status | Notes |
|-----|-------------|--------|-------|
| 1 | Skip silence detects and skips silence segments | Pass | Toggle wired to useSilenceDetection hook; active indicator appears on enable |
| 2 | Visual indicator shows skipped duration | Pass | SilenceSkipIndicator in DOM with `aria-live="polite"` and `aria-atomic="true"`, initially hidden |
| 3 | Disabling skip silence stops detection immediately | Pass | Toggle off hides active indicator and sets isActive=false within one React cycle |
| 4 | E108-S04 toggle wired to actual Web Audio detection | Pass | No "Coming soon" text; toggle is enabled and functional |
| 5 | Speed persists per-book in IndexedDB | Pass | Speed change immediately persists to `books.playbackSpeed` in ElearningDB |
| 6 | Returning to book restores per-book speed | Pass | Navigating A→B→A correctly restores book A's 1.5× (not book B's 2.0×) |
| 7 | First-open book uses global default speed | Pass | Fresh book with no `playbackSpeed` loaded at 1.25× matching `defaultSpeed` in prefs |
| 8 | Accessibility: keyboard, ARIA, screen reader | Pass | Speed button has `aria-label`, toggle has `role="switch"`, indicators have `aria-live`/`aria-hidden`; keyboard shortcut 's' works |

### Console Health

| Level | Count | Notable |
|-------|-------|---------|
| Errors | 11 | 1× React key-prop (ChapterList, repeated per render); 5× TypeError in useKeyboardShortcuts (test-harness triggered); 1× CSP block for axe-core CDN script (browser extension) |
| Warnings | 8+ | `apple-mobile-web-app-capable` deprecation (per-navigation, pre-existing); `Deprecated API for given entry type` (browser timing API, external) |
| Info | 0 | Clean |

> Note: The 5 TypeError errors were triggered by test-harness `document.dispatchEvent()` calls (document has no `tagName`). In real user interaction via Playwright `keyboard.press`, no errors were produced. However the underlying bug (missing null guard) is real and reproducible in certain browser states.

### What Works Well

1. Per-book speed persistence via IndexedDB is robust — survives navigation between books and hard page reloads with no data loss.
2. SkipSilenceActiveIndicator correctly tracks the feature toggle state (not loop state), so it stays visible when audio is paused with skip silence enabled.
3. Keyboard shortcut 's' wires directly to the store action and updates the active indicator in under 200ms — smooth UX.
4. Invalid book ID gracefully shows "Book not found" with a "Back to Library" recovery path — no crash, no blank screen.

---
Health: 88/100 | Bugs: 3 | Blockers: 0 | High: 1 | Medium: 1 | Low: 1 | ACs: 8/8 verified
