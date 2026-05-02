## Code Review: feat — Merge Lesson Toolbar into Header

### What Works Well

1. **Zustand store architecture is well-designed**. `useLessonChromeStore` cleanly separates concerns: theater state (with localStorage persistence), reading mode delegation, notes state, and reset. The module-level `readingModeToggleFn` avoids putting function references in serialized Zustand state — a deliberate choice that prevents stale-closure bugs.

2. **`useCourseRoute` hook is thorough**. Parses path segments instead of regex (avoiding the fragile `isLessonPlayerRoute` regex), handles 8 edge cases in tests (empty path, root path, malformed URLs, deep nesting, rapid transitions), and correctly excludes quiz/results sub-routes from `isLessonRoute`. The 16 tests include a regression check against the exact regex it replaces.

3. **Tests are well-structured with reset beforeEach**. Store tests use `vi.resetModules()` to get fresh Zustand instances per test, avoiding cross-test state contamination. Component tests use state-factory mocks that reset between tests. No shared mutable state across test cases.

4. **Theater mode integration works correctly**. `useTheaterMode` is now a thin wrapper around the store, maintaining backward compatibility for `UnifiedLessonPlayer`. The `data-theater-mode` DOM attribute is set by both the store (on toggle) and the player's effect (on mount/unmount), ensuring theater mode survives.

5. **IntersectionObserver removal is clean**. The sentinel div, `isToolbarStuck` state, and observer setup (12 lines of useEffect) were deleted entirely from `UnifiedLessonPlayer`. No dead code left behind.

---

### Findings

#### Blockers

- **[src/hooks/useReadingMode.ts:1-96] (confidence: 95) [Correctness] [Silent Failure]**: Reading mode toggle in the Layout header is a dead button. `useReadingMode` never calls `registerReadingModeToggle()` or `syncReadingMode()` on the store, so:
  - `useLessonChromeStore.toggleReadingMode()` is a permanent no-op (the module-level `readingModeToggleFn` is always `null`)
  - `useLessonChromeStore.isReadingMode` is stuck at `false` forever
  - Clicking the reading mode button in `LessonHeaderTools` (or the kebab menu, or the mobile BottomNav drawer) does nothing — no toggle, no error, no feedback

  **Why this matters for learners**: The reading mode toggle is the most prominent lesson tool in the new header. Learners clicking it will assume reading mode is broken or that the feature was removed.

  **Fix** (~30 min): Add two calls in `useReadingMode`:
  1. In a `useEffect` on mount, call `useLessonChromeStore.getState().registerReadingModeToggle(toggleReadingMode)` to register the toggle callback. On cleanup, call `registerReadingModeToggle(null)`.
  2. In a `useEffect` keyed on `isReadingMode`, call `useLessonChromeStore.getState().syncReadingMode(isReadingMode)` to keep the store in sync with local state.

  **Autofix class**: `manual` — requires design decision about cleanup timing (unmount vs route change).

- **[src/app/hooks/useLessonPlayerState.ts:110] (confidence: 95) [Correctness]**: Notes toggle in the Layout header does not control the actual notes panel. `LessonHeaderTools` calls `useLessonChromeStore.getState().toggleNotes()`, which toggles `notesOpen` in the store — but `UnifiedLessonPlayer` reads `state.notesOpen` from `useLessonPlayerState` (local `useState`), **not** from the store. The store's `notesOpen` is written but never read by the component that owns the notes panel.

  **Affects**: `LessonHeaderTools.tsx:528-529` (toggle button), `BottomNav.tsx:1078` (drawer notes), `useLessonPlayerState.ts:110` (local state), `UnifiedLessonPlayer.tsx:196,503,508,518` (panel visibility)

  **Why this matters for learners**: The Notes button in the header is a primary tool on tablet and desktop. Clicking it has no visible effect — the notes panel stays closed/open regardless of the button state.

  **Fix** (~20 min): In `UnifiedLessonPlayer`, add a subscription to `useLessonChromeStore(s => s.notesOpen)` and sync it to `state.setNotesOpen` via a `useEffect`. Alternatively, have `useLessonPlayerState` initialize `notesOpen` from the store and keep it in sync.

  **Autofix class**: `manual` — needs decision on two-way sync direction.

- **[src/stores/useLessonChromeStore.ts:49-52] (confidence: 95) [Correctness]**: `hasNotes` indicator dot never appears. The store's `setHasNotes()` is defined but never called by any component. The indicator dots in `LessonHeaderTools` (line 655) and `BottomNav` (line 1230) both check `hasNotes` from the store, which is always `false`.

  **Why this matters for learners**: The indicator dot was designed to signal "this lesson has notes you can review." Without it, learners have no visual cue that note content exists — reducing notes panel discovery to zero.

  **Fix** (~15 min): Have the notes content resolver (in `useLessonPlayerState` or `NotesPanel` on mount) call `useLessonChromeStore.getState().setHasNotes(true)` when notes are detected for the current lesson. Reset to `false` on lesson change (inside `useLessonPlayerState`'s existing reset `useEffect` at line 124).

  **Autofix class**: `gated_auto` — clear fix path, just needs the right integration point chosen.

#### High Priority

- **[src/app/components/Layout.tsx:436-447] (confidence: 90) [Silent Failure] [Correctness]**: Cmd+Option+R keyboard shortcut no longer works on non-lesson pages. The old Layout listener (which showed a "Reading mode is available on lesson pages" toast) was removed, but `useReadingMode` (which has the same toast behavior at line 34) only mounts inside `UnifiedLessonPlayer` — which is only rendered on lesson pages. On non-lesson pages (overview, courses, library, settings), pressing Cmd+Option+R silently does nothing.

  **Why this matters for learners**: The toast served as a discovery mechanism. Without it, learners who discover the shortcut from documentation or muscle memory get zero feedback — they'll assume it's broken, not that it's page-specific.

  **Fix** (~10 min): Either:
  - Reinstate a minimal keyboard listener in `Layout` that shows `toast.info('Reading mode is available on lesson pages')` when not on a lesson route (2-line handler)
  - Or initialize `useReadingMode` at the Layout level so its listener is always active

  **Autofix class**: `gated_auto` — straightforward fix, user should approve the approach.

- **[src/app/components/course/LessonHeaderTools.tsx:137,143] (confidence: 90) [Correctness]**: Reading mode tooltip and aria-label both display the wrong keyboard shortcut. They say "Cmd+Shift+R" but the actual shortcut registered in `useReadingMode` (line 73) uses `e.altKey`, which is Cmd+**Option**+R (Mac) / Ctrl+**Alt**+R (Windows). Cmd+Shift+R is Chrome's hard refresh shortcut — pressing it will reload the page and discard the learner's lesson state (video position, unsaved notes).

  **Affects**: `LessonHeaderTools.tsx` aria-label (line 137) and `<TooltipContent>` (line 143). Also present in the tablet kebab menu item (line 182) which says "Exit Reading Mode" / "Reading Mode" without a shortcut label — that's fine.

  **Fix** (~5 min): Change both instances from `Cmd+Shift+R` to `Cmd+Option+R` (or `Ctrl+Alt+R`).

  **Autofix class**: `safe_auto` — string replacement, no behavioral change.

#### Medium

- **[src/app/pages/UnifiedLessonPlayer.tsx:204-211] (confidence: 80) [Maintainability]**: `data-theater-mode` DOM attribute is now set by two different code paths: the store's `toggleTheater()` (synchronously) and UnifiedLessonPlayer's `useEffect` (reactively). Both watch the same `isTheater` value from the store, so they always set the same thing — no conflict, but the redundancy adds confusion about which code owns the attribute. The plan says "data-theater-mode attribute is set/removed synchronously with store state" (Unit 1) implying the store should be the single source of truth.

  **Fix** (~5 min): Remove the `data-theater-mode` useEffect from `UnifiedLessonPlayer` (lines 204-211). The store already handles it. The cleanup in the effect (`return () => removeAttribute`) is a safety net for unmount during theater mode, but the `reset()` in Layout's `useEffect` (called on `!isLessonRoute`) already handles that.

  **Autofix class**: `gated_auto` — safe removal, but double-check theater exit on browser back-button during theater mode.

- **[src/app/components/Layout.tsx:356-365] (confidence: 70) [Maintainability]**: The "Back to Course" link renders on the course overview page (`/courses/:courseId`) as a self-referential link. `isCourseRoute` returns `true` for the overview page, and the link points to `/courses/${courseId}` — the same page the user is already on. Clicking it does nothing (React Router's same-route navigation).

  **Fix** (~5 min): Add a guard like `isCourseRoute && segments.length > 2` to exclude the course overview page, or add an `isCourseOverview` derived flag. The link only has value on sub-pages (lessons, flashcards, quiz).

  **Autofix class**: `gated_auto` — simple guard, but check that there are no tablet/mobile layouts where the back link on overview serves a purpose.

### Recommendations

1. **First priority (Blockers)**: Fix the three integration gaps between `useLessonChromeStore` and its consumers. These are all about wiring that was planned (see plan Units 1-3) but never connected:
   - `useReadingMode` must register its toggle and sync `isReadingMode` into the store
   - `UnifiedLessonPlayer` must read `notesOpen` from the store and sync local state
   - Notes resolver must call `setHasNotes()` when notes are detected

2. **Second priority (High)**: Fix the Cmd+Option+R shortcut regression on non-lesson pages, and correct the mislabeled "Cmd+Shift+R" tooltip that could cause data loss.

3. **Third priority (Medium)**: Clean up the redundant `data-theater-mode` effect and fix the circular back link on the course overview page.

---
Issues found: 8 | Blockers: 3 | High: 2 | Medium: 2 | Nits: 0
Confidence: avg 88 | >= 90: 4 | 70-89: 3 | < 70: 0
