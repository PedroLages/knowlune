# Exploratory QA: E103-S02 — Format Switching UI

**Date:** 2026-04-06
**Branch:** feature/e103-s02-format-switching-ui
**Tester:** Claude Code (exploratory-qa agent)
**Note:** BookReader route requires seeded IndexedDB data (epub + audiobook books + chapterMappings). Live browser session could not seed data for interactive testing. Assessment based on code analysis and E2E test results.

## Scope

Changed components:
- `AudiobookRenderer.tsx` — "Switch to Reading" button (conditional)
- `ReaderHeader.tsx` — "Switch to Listening" button (conditional)
- `BookReader.tsx` — wires `useFormatSwitch` hook, passes props
- `useFormatSwitch.ts` — core logic: Dexie query, chapter index resolution, navigation

## Functional Testing Assessment

### Button Visibility (AC1, AC3, AC5)

- **With mapping**: Buttons render via `{onSwitchToReading && ...}` / `{onSwitchToListening && ...}` — prop is defined only when `hasMapping === true` in `BookReader`
- **Without mapping**: Props remain `undefined`, buttons not rendered — confirmed by code path
- **Layout**: Conditional rendering (not `visibility: hidden`) — no layout shift confirmed at code level

### Navigation Flow (AC2, AC4)

- **Switch to Reading**: `savePosition()` called → `onSwitchToReading(currentChapterIndex)` → `switchToFormat()` navigates to `/library/{id}/read?startChapter={n}`
- **Switch to Listening**: `saveEpubPositionNow()` called → `switchToFormat(epubChapterIndex)` → same navigation
- **Double-tap guard**: `switchingRef.current` prevents duplicate navigation — ref is not reset (component unmounts on navigation, guard is automatically cleared)
- **`?startChapter` clearing**: `BookReader` reads param on mount and calls `navigate(pathname, { replace: true })` after applying it

### Error Paths

- **No linked book in store**: `useFormatSwitch` returns `linkedBook: null`; `BookReader` checks `hasMapping && linkedBook` before passing props — buttons not shown
- **Chapter index out of range**: `Math.max(0, targetIndex)` clamps lower bound; array access on `mapping.mappings[currentChapterIndex]` returns `undefined` → `?? 0` fallback for upper bound
- **`useLiveQuery` undefined state**: Hook returns `undefined` during initial load; `hasMapping = !!mapping` → `false` → buttons not shown during loading

### Console Errors

No new `console.error` or `console.warn` calls introduced. Error paths use early returns, not throws.

## Findings

### Blockers
None.

### High
None.

### Medium
None.

### Low

**L1: No loading state between "Switch" click and navigation**

When the user taps "Switch to Reading/Listening", there is no visual feedback (spinner, disabled state) between click and navigation. Navigation is typically fast (React Router client-side), but on slower devices there may be a brief unresponsive period. The `switchingRef` guard prevents double-navigation but does not disable the button visually.

- **Impact**: Low — navigation is synchronous and fast in practice
- **Suggestion**: Consider `disabled={switchingRef.current}` or a brief loading state (future polish)

## Verdict

**PASS** — No blocking or high-severity functional issues. Core format switching flow is correct: position saved, chapter index resolved, navigation fires once, URL param cleared. Low finding (no loading state) is advisory.
