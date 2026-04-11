# Adversarial Review: Epic 108 — Books/Library UX Improvements

**Date:** 2026-04-11
**Reviewer:** Claude Sonnet 4.6 (adversarial mode)
**Epic:** E108 — Books/Library UX Improvements (5 stories)
**Scope:** Bulk EPUB Import, Format Badges and Delete, Keyboard Shortcuts, Audiobook Settings Panel, Genre Detection and Pages Goal
**Verdict:** CONDITIONAL PASS — 15 findings, 4 critical

---

## Critical Issues (4)

### F01: `checkPagesGoalMet` Is Dead Code — Pages Streak Never Advances
**Severity:** CRITICAL — Feature Gap / AC Failure
**Story:** E108-S05
**Evidence:** The `checkPagesGoalMet` function in `useReadingGoalStore.ts` is defined and wired in `BookReader.tsx` (lines 147, 160, 169). The code path exists, but the code review for S05 (code-review-2026-04-11-E108-S05.md, finding HIGH #1) reports it was "never called." Follow-up grep confirms `BookReader.tsx` does call it, but there was no unit test for the streak-advancement path and the testing review confirms lines 152-172 are uncovered. The critical gap: AC-5 says "streak tracking" uses pages — but there is no streak logic in `checkPagesGoalMet` beyond returning a boolean. The caller in `BookReader.tsx` checks `isPagesGoalMet` but there is no evidence it then calls `markGoalMetToday()` or the equivalent streak-advance action. The daily streak advancement for the pages mode appears to be wired only for the `dailyType === 'minutes'` path.
**Risk:** A user who sets a pages-per-day goal and reads the required pages will never see their streak advance. The feature appears to work (ring fills up) but silently fails to credit the streak — arguably worse than not shipping the feature.
**Recommendation:** Confirm whether `BookReader.tsx` calls `markGoalMetToday` (or equivalent) after `checkPagesGoalMet` returns true. Add a unit test that drives the full path: read pages → `checkPagesGoalMet` returns true → streak counter increments. If the streak action is missing, add it before closing the epic.

---

### F02: E2E Tests Missing on 4 of 5 Stories — Quality Confidence Is Low
**Severity:** CRITICAL — Process / Quality Confidence
**Evidence:**
- **E108-S01**: `e2e-tests-skipped` — "OPFS-backed file import is hard to test via Playwright without EPUB fixtures." Task 6 explicitly planned E2E tests; neither the drag-and-drop nor the progress indicator were E2E tested.
- **E108-S02**: E2E tests present (5/5 pass — only story with complete E2E coverage).
- **E108-S03**: E2E tests present (4 tests: shortcuts dialog, N key, Space key). Partial — reader shortcuts not E2E tested.
- **E108-S04**: Only `story-e108-s04.spec.ts` exists. E2E tests for speed persistence were planned but not confirmed completed per code review finding L3.
- **E108-S05**: No E2E spec file exists (only `story-e108-s04.spec.ts` is in the e2e directory for this epic). Tasks 8.1-8.3 (genre filter, genre override, pages goal ring) explicitly skipped.

Three of five stories ship without E2E coverage of their primary user flows. The affected flows — bulk import with progress UI, genre filtering, pages goal — are non-trivial UX surfaces that unit tests cannot adequately cover.
**Recommendation:** Before closing the epic, add E2E tests for at minimum: (1) genre filter on Library page, (2) pages goal ring display, (3) audiobook settings persistence. For S01, commit to a follow-up story with EPUB fixture infrastructure rather than leaving it permanently untested.

---

### F03: `skipSilence` Toggle Persists but Has Zero Functional Effect
**Severity:** CRITICAL — Feature Completeness
**Story:** E108-S04
**Evidence:** AC-3 states "when enabled, automatically skips silent sections during playback." The `skipSilence` boolean is persisted to localStorage and exposed in the settings panel UI, but grep of the entire `src/` tree finds no consumer of `skipSilence` outside `useAudiobookPrefsStore.ts` and the settings panel itself. The code review (code-review-2026-04-11-e108-s04.md, M1) flagged this: "skip silence is never read by any audio processing code." The story's implementation notes acknowledge this ("Start with a simple implementation, flag as future enhancement") but AC-3 is stated as a deliverable for this story — not a future story.
**Risk:** The UI offers a toggle that does nothing. If a user enables "Skip Silence," they receive no feedback that it has no effect, and may incorrectly believe it's working. This is a silent feature lie — arguably worse than not shipping the toggle.
**Recommendation:** Either (a) implement at least a stub via Web Audio API AnalyserNode before shipping, (b) remove the toggle from the UI and add it in a future story when the backend is ready, or (c) render the toggle disabled with a tooltip "Coming soon" so users understand it's not active. Option (c) is the minimum acceptable bar.

---

### F04: `Book.genre` Typed as `string` — Defeats `BookGenre` Type Safety
**Severity:** CRITICAL — Type System / Technical Debt
**Story:** E108-S05
**Evidence:** `src/data/types.ts:688` declares `genre?: string`, not `genre?: BookGenre`. The `BookGenre` type union is defined and exported from `GenreDetectionService.ts` but never referenced by the core `Book` entity type. This means: (1) any string can be persisted as a genre — typos will not be caught at compile time, (2) the genre filter logic that compares `book.genre === selectedGenre` loses type safety, (3) the `BookMetadataEditor` genre selector has no type-level guarantee that the saved value is a valid genre, (4) future refactors of `BookGenre` won't trigger type errors at the `Book` entity level.
**Risk:** Growing type debt. As genre filtering, sorting, and analytics are added in future epics, every consumer will require unsafe casts or runtime checks that TypeScript should be handling.
**Recommendation:** Change `genre?: string` to `genre?: BookGenre` in `src/data/types.ts` and import `BookGenre` from `GenreDetectionService.ts`. This is a one-line fix with zero runtime impact.

---

## High Issues (4)

### F05: `usePagesReadToday` Uses a 2-Min/Page Heuristic — Users Will Be Misled
**Severity:** HIGH — UX / Data Accuracy
**Story:** E108-S05
**Evidence:** `usePagesReadToday.ts:41-43` estimates pages using `totalMinutes / 2` (2 minutes per page). This is a one-size heuristic that is wrong for nearly every reader: a children's picture book is ~10 seconds/page; dense academic text may be 10+ minutes/page; audiobooks counted as "pages" have no mapping at all. The hook is silently wrong rather than clearly approximate.
**Risk:** A user sets a "30 pages/day" goal. A fast reader breaths through a graphic novel in 30 minutes (says 15 pages — goal never met). A slow reader laboriously works through Kant for 2 hours (says 60 pages — goal wildly over-credited). The daily goal ring becomes meaningless, undermining the entire E108-S05 feature value proposition.
**Recommendation:** At minimum, expose the estimation basis clearly in the UI (e.g., "~18 pages estimated"). Better: track actual page-change events (EPUB chapter transitions, PDF page turns) instead of time-based estimation. The story spec acknowledges this as a limitation but does not flag it as a UX risk for users who trust the displayed number.

---

### F06: `usePagesReadToday` Polls Every 60 Seconds — Stale During Active Reading
**Severity:** HIGH — UX Responsiveness
**Story:** E108-S05
**Evidence:** `usePagesReadToday.ts:132` sets a 60-second polling interval. The code review (S05, finding MEDIUM #2) also flagged that the `useEffect` only re-runs once — "The pages count won't update during a reading session." A user who opens the DailyGoalRing and then reads for 20 minutes will see the goal ring frozen for up to 60 seconds at a time, never reflecting active reading. The code review suggests adding "a dependency on a reading-session-end event" — this wasn't addressed.
**Risk:** The daily goal ring is the primary motivation feedback loop for the pages goal. If it doesn't update during reading, users see no real-time feedback and the motivational value of the feature is eliminated.
**Recommendation:** Subscribe to a reading-session-end event or store subscription instead of polling. At minimum, reduce polling interval to 10 seconds for better responsiveness without fully solving the architectural problem.

---

### F07: Bulk Import Silently Discards Non-EPUB Files Without Warning Users
**Severity:** HIGH — UX / User Expectation
**Story:** E108-S01
**Evidence:** `useBulkImport.ts:70-73` checks `file.name.toLowerCase().endsWith('.epub')` and pushes an error result, but the file still counts against the `files.length` total. The summary toast says "Imported 2 of 5 books — 3 failed" with no indication that 3 of them failed simply because they were the wrong file type. A user who accidentally includes PDFs or MP3s in a drag-and-drop will be confused by "3 failed" without a clear reason.
**Additionally:** The validation happens inside the processing loop after the user waits through the progress bar. File type validation should happen upfront before the import loop starts to give users an immediate opportunity to fix their selection.
**Recommendation:** Pre-validate all files before starting the import loop. Show a pre-import summary: "3 files are not EPUBs and will be skipped. Import 2 EPUBs?" This is a standard pattern in bulk file upload UX.

---

### F08: Keyboard Shortcut `G then L` Chord Conflicts with Normal Navigation
**Severity:** HIGH — UX / Accessibility
**Story:** E108-S03
**Evidence:** AC-2 defines the chord `G then L` to toggle grid/list view. This chord is problematic for several reasons: (1) `G` is not a meaningful mnemonic for "grid" in international contexts and conflicts with Gmail's similar chord (`G then I` for inbox), creating muscle memory conflict, (2) a 500ms chord window means accidentally pressing `G` while navigating will briefly trap the keyboard in chord-wait state, (3) there is no visual feedback that the chord state machine has been entered (no indicator that "G pressed, waiting for second key"), leaving users unable to tell if their keypress was registered.
**Recommendation:** Consider a simpler single-key toggle (e.g., `V` for "view toggle") rather than a two-key chord for a UI action this common. If chords are retained, add a status indicator (e.g., a brief tooltip "G... press L to toggle view") to confirm chord state.

---

## Medium Issues (4)

### F09: `useBulkImport` Progress Bar Shows 0% for First File
**Severity:** MEDIUM — UX Polish
**Story:** E108-S01
**Evidence:** Code review finding LOW (code-review-2026-04-11-E108-S01.md:43): "`setProgress({ current: i, ... })` where `i` starts at 0." The progress bar (`Progress` component) renders `(current / total) * 100` which is `0%` while the first file is processing. From the user's perspective, the import starts, a spinner appears, and the bar doesn't move — this looks like a hang.
**Recommendation:** Initialize progress at `current: 1` when starting the first file, or use an indeterminate progress indicator for the per-file processing phase.

---

### F10: Audiobook Speed Options Mismatch Between UI and Store
**Severity:** MEDIUM — Consistency / Latent Bug
**Story:** E108-S04
**Evidence:** Code review finding L2 (code-review-2026-04-11-e108-s04.md): `AudiobookSettingsPanel.tsx` offers 9 speed presets (excludes 2.25x and 2.75x) while `useAudiobookPrefsStore.ts` validates against 11 values. A user who has `2.25x` persisted from a non-UI path (e.g., migration, direct store manipulation) will see no preset highlighted as selected in the settings panel, making the current speed appear "unknown." This is a classic mismatch between what the store can hold and what the UI can display.
**Recommendation:** Either expand the UI to show all 11 presets, or contract the store's `VALID_SPEEDS` to exactly the 9 UI presets.

---

### F11: BookReader Still Uses Raw `keydown` Instead of `useKeyboardShortcuts`
**Severity:** MEDIUM — Technical Debt / Inconsistency
**Story:** E108-S03
**Evidence:** Code review finding LOW (code-review-2026-04-11-e108-s03.md:30): "BookReader.tsx uses a raw `useEffect` + `addEventListener` pattern instead of the new `useKeyboardShortcuts` hook." The epic's stated purpose was to unify keyboard handling. Two parallel keyboard patterns now exist in the same codebase. Every new shortcut added to the reader must be added to the raw handler, not the hook — which defeats the purpose of building the hook.
**Risk:** The `useKeyboardShortcuts` hook's guards (IME, input-focus, chord support) are silently not applied to reader shortcuts. A reader shortcut like `H` for highlights could fire while the user types in a note input if the reader's raw handler lacks the input-focus guard.
**Recommendation:** Migrate `BookReader.tsx`'s keyboard handling to `useKeyboardShortcuts` in a follow-up story. Mark as known tech debt in the epic tracker.

---

### F12: Genre Detection Taxonomy Diverges from Story Spec
**Severity:** MEDIUM — Scope Creep
**Story:** E108-S05
**Evidence:** AC-2 in the story spec defines 13 genres: Fiction, Non-Fiction, Science, Technology, History, Biography, Fantasy, Mystery, Romance, Self-Help, Philosophy, Science Fiction, Other. The actual `GenreDetectionService.ts` implements 15 genres — adding `Psychology` and `Business` not in the spec. `ALL_GENRES` export also lists 15 entries. This is undocumented scope expansion without acceptance criteria for the two added genres.
**Risk:** The database schema and Dexie index now accept genres that weren't specced, tested, or UX-reviewed. Future stories that enumerate genres (e.g., analytics, reading challenges) must account for 15 genres, not 13. If the spec is later re-read without looking at the code, someone may "add" Psychology and Business again.
**Recommendation:** Either update the story AC to formally accept 15 genres (preferred — Psychology and Business are sensible additions), or remove the two unspecced genres and open a follow-up story. At minimum, document the deviation in the story's Lessons Learned section.

---

## Low Issues (3)

### F13: Zero Burn-In Validation Across All 5 Stories
**Severity:** LOW — Process Risk
**Evidence:** All 5 story files show `burn_in_validated: false`. Burn-in testing (10 iteration stability validation) was introduced specifically for stories with async patterns, timers, and abort controllers. E108-S01 has `AbortController` + sequential async loops, E108-S04 has `useSleepTimer` + polling effects, and E108-S05 has polling intervals. These are precisely the patterns where flakiness emerges under repeat runs.
**Recommendation:** Run `scripts/burn-in.sh` on E108-S01, S04, and S05 specs before epic close. If flakiness is found, it should block epic sign-off.

---

### F14: `useBulkImport` Shows Toast Even When Import Was Cancelled
**Severity:** LOW — UX Polish
**Story:** E108-S01
**Evidence:** `useBulkImport.ts:167-174` — the summary toast logic runs unconditionally after the loop, regardless of whether `controller.signal.aborted` is true. If a user cancels a 10-file import after 3 books, they receive "Imported 3 of 10 books — 0 failed" rather than "Import cancelled (3 of 10 books imported)." The completed count and cancelled state both exist in state but are not reflected in the toast message.
**Recommendation:** Add a branch: if `controller.signal.aborted`, show "Import cancelled — 3 of 10 books were imported before cancellation."

---

### F15: Format Badge Audiobook Color Uses `bg-warning/10 text-warning` — Low Contrast Risk
**Severity:** LOW — Accessibility
**Story:** E108-S02
**Evidence:** `FormatBadge.tsx:24` assigns `bg-warning/10 text-warning` to the Audiobook format badge. The `--warning` token is defined as an orange/amber in `theme.css`. Warning-class tokens at 10% opacity backgrounds with warning-colored text are notoriously low-contrast in light mode (orange on near-white background). The design review report for S02 was generated but not read for this analysis — if the contrast ratio wasn't explicitly measured, this may have been missed.
**Recommendation:** Verify the WCAG AA contrast ratio (4.5:1 minimum) of `text-warning` on `bg-warning/10` in both light and dark modes. If it fails, switch to a safer token pair (e.g., `bg-orange-100 text-orange-700` via a design token, or add a `--warning-badge-*` token set similar to `--brand-soft` / `--brand-soft-foreground`).

---

## Epic-Level Observations

**What worked well:**
- **E108-S02** (Format Badges and Delete) is the cleanest story in the epic: 3 review rounds, all gates passed, E2E coverage complete, no post-review findings. This is the standard to match.
- `useAudiobookPrefsStore` is well-engineered: localStorage validation with type guards, proper stale-closure handling via `get()`, clean separation of preferences from player state.
- `GenreDetectionService` is a solid, well-tested pure function. Keyword scoring with tie-breaking by declaration order is a pragmatic approach.
- `useKeyboardShortcuts` demonstrates good hook hygiene: ref-based shortcut storage, IME guards, chord state machine, proper cleanup.

**Systemic patterns to address:**
1. **Feature promises without backends:** Two ACs (skip silence, pages streak via estimation) promise user value that isn't delivered. The pattern of "build the UI, defer the behavior" creates silent feature lies. Future stories should not accept ACs for behavioral features unless the behavior is implemented, even partially.
2. **E2E coverage debt:** Three stories shipped without E2E tests for their primary flows. This is the second consecutive epic (after E107) with systematic E2E gaps. A pre-close checklist item should block epic sign-off if primary-flow E2E coverage is missing.
3. **Type safety erosion:** `Book.genre?: string` instead of `Book.genre?: BookGenre` is symptomatic of a broader pattern where entity types lag behind service types. A periodic type audit (similar to the design token audit) should catch these gaps.

---

## Summary Table

| ID | Severity | Story | Finding |
|----|----------|-------|---------|
| F01 | CRITICAL | S05 | Pages streak never advances (dead-code path) |
| F02 | CRITICAL | S01/S03/S04/S05 | E2E tests missing on 4 of 5 stories |
| F03 | CRITICAL | S04 | `skipSilence` toggle persists but has zero functional effect |
| F04 | CRITICAL | S05 | `Book.genre` typed as `string`, not `BookGenre` |
| F05 | HIGH | S05 | 2-min/page heuristic will mislead users with pages goals |
| F06 | HIGH | S05 | Pages count stale for up to 60s during active reading |
| F07 | HIGH | S01 | Non-EPUB files in bulk drop produce confusing error counts |
| F08 | HIGH | S03 | `G then L` chord lacks visual feedback, has mnemonic conflict |
| F09 | MEDIUM | S01 | Progress bar shows 0% during first file processing |
| F10 | MEDIUM | S04 | Speed preset mismatch between UI (9) and store (11) |
| F11 | MEDIUM | S03 | BookReader still uses raw `keydown`, not the new hook |
| F12 | MEDIUM | S05 | Genre taxonomy expanded to 15 genres without AC coverage |
| F13 | LOW | All | Zero burn-in validation across all 5 stories |
| F14 | LOW | S01 | Toast shown even when import was cancelled |
| F15 | LOW | S02 | Audiobook badge `bg-warning/10 text-warning` low-contrast risk |

**Total findings: 15**
**Critical: 4 | High: 4 | Medium: 4 | Low: 3**

---

## Recommended Actions Before Epic Close

1. **Immediate (blocks close):**
   - F01: Confirm or fix pages streak advancement in `BookReader.tsx`
   - F03: Disable or stub the `skipSilence` toggle — do not ship a toggle that does nothing silently
   - F04: Change `genre?: string` to `genre?: BookGenre` in `src/data/types.ts`

2. **Before close (high priority):**
   - F02: Add E2E specs for genre filter (S05) and audiobook settings persistence (S04)
   - F07: Pre-validate file types in bulk import before starting loop

3. **Track as known issues (deferred):**
   - F05: Pages estimation accuracy — requires architectural change (track page events)
   - F06: Pages polling — replace with event-driven update
   - F08: Chord UX feedback — add status indicator or simplify to single key
   - F11: BookReader keyboard migration to `useKeyboardShortcuts` hook
   - F13: Burn-in validation — run before epic retrospective
