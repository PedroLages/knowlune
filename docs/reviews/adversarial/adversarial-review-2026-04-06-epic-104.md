# Adversarial Review — Epic 104: Link Formats UI — Book Pairing Entry Point

**Date:** 2026-04-06
**Reviewer:** Adversarial Review Agent (Claude Sonnet 4.6)
**Scope:** E104-S01 implementation diff — `LinkFormatsDialog.tsx`, `BookContextMenu.tsx`, `useBookStore.ts` (`unlinkBooks` action)
**Tone:** Cynical, precise, professional.

---

## Summary

The implementation is competent surface-level work with real structural problems hiding underneath. The UI layer is reasonably solid, but the dialog has a flawed state machine, a timer-based reset that is a maintenance hazard, and a candidates filter that will silently produce wrong results in one critical edge case. The `unlinkBooks` action lacks any unit tests, which means the rollback path — the most dangerous code path in the entire feature — has never been exercised. Seven AC items, zero E2E tests. The story shipped as "done" with the testing notes section describing tests that were never written.

---

## Findings

1. **`handleOpenChange` sets `view` to `'unlink-confirm'` on close for linked books, then immediately schedules a reset to `'select'` after 300ms.** This means the dialog briefly renders the unlink-confirm view on every close animation for linked books. The 300ms timer is not tied to the actual dialog animation duration — it is a magic constant that will silently break if the Dialog's exit animation is ever changed or if CSS animations are disabled (e.g., `prefers-reduced-motion`). The correct pattern is to reset state only on the `onOpenChange(false)` path after animation completes, or to not pre-set the view at all during the close transition.

2. **The `candidates` filter excludes books where `b.linkedBookId` is set, but does not exclude the case where `b.linkedBookId === book.id`.** If Book A is linked to Book B, opening the dialog from Book A correctly excludes Book B from candidates. But if Book B's `linkedBookId` somehow still points to A while A's `linkedBookId` is undefined (e.g., after a partial Dexie write failure that succeeded on one record and failed on the other), Book B will appear as a linkable candidate again. This is exactly the corruption scenario that `unlinkBooks`'s atomic transaction is meant to prevent — but the dialog has no guard for already-linked-from-other-side books.

3. **`handleSave` reads `selectedBook` from a `useMemo` derived value, but `handlePairPressed` already abandoned this pattern in favor of `useBookStore.getState().books` to avoid stale closures.** These two handlers are inconsistent. If the book list updates between when the user selects a book and when they click Save (e.g., a sync completing in the background), `selectedBook` will reflect the stale render, while `handlePairPressed` would have gotten the fresh value. The save handler should use `useBookStore.getState()` consistently with the pair handler.

4. **The `DialogView` type includes `'unlink-confirm'` but this view state is never rendered as a distinct JSX branch.** The unlink UI is rendered under the condition `alreadyLinked && view !== 'select'`, which also matches `view === 'confirm'` and `view === 'editor'` for linked books. The `'unlink-confirm'` value in the type is a misleading dead state — it is used only as a reset target in `handleOpenChange` and as a navigation target in the footer's "Unlink current" button, but there is no corresponding `view === 'unlink-confirm'` JSX branch. A future maintainer modifying the view logic will be confused by a named view that renders as `alreadyLinked && view !== 'select'`.

5. **The `resetTimerRef.current` is never cleaned up via a `useEffect` return function.** If the component unmounts while the 300ms timer is still pending (e.g., parent navigates away immediately after dialog close), the timer fires and calls `setView` on an unmounted component. React 18 suppresses this warning but the cleanup is still good practice and is inconsistent with the codebase's own ESLint rule `react-hooks-async/async-cleanup`.

6. **`toEpubInputs` and `toAudioInputs` are defined as regular functions inside the component body, not memoized, and are called both in `handlePairPressed` and in the `editor` view render path.** They will re-create on every render. They are also called with `editorBooks` derived from `resolveEpubAudio` which itself is a non-memoized function defined inside the component. This is not a performance crisis for typical chapter counts, but it is architecturally inconsistent with the rest of the component which correctly uses `useMemo` and `useCallback`.

7. **The confidence score displayed in the `confirm` view is the average of all mapping confidences, but the routing decision in `handlePairPressed` is also based on the average.** The average can mask a distribution where most chapters match perfectly but a handful are extremely low-confidence. A book with 20 chapters where 18 map at 0.99 and 2 map at 0.10 will compute an average of ~0.93, route to auto-save, and silently produce wrong mappings for those 2 chapters. The correct threshold should be based on the minimum confidence or the percentage of chapters below a floor, not the mean.

8. **The `ChapterMappingEditor` is wrapped in a `ScrollArea` with `max-h-[50vh]`, but the editor renders its own Save/Cancel buttons.** Those buttons will be inside the scroll area, meaning on a short viewport they may scroll out of sight below the fold. A user scrolling through chapter mappings on a mobile device or a compressed browser window will be unable to see or reach the Save button without scrolling all the way down. The footer buttons should be outside and below the `ScrollArea`, not inside it.

9. **`BookContextMenu.tsx` mounts `LinkFormatsDialog` unconditionally for every book, regardless of format.** A book with format `'pdf'` (or any non-epub, non-audiobook format the app may add in the future) will also get a "Link Format" menu item and a mounted dialog that will show an empty candidates list with a confusing "No unlinked audiobooks found" message. The menu item and dialog mount should be conditionally rendered only for `epub` and `audiobook` format books.

10. **The `book` prop passed to `LinkFormatsDialog` is a snapshot from the render cycle when `BookContextMenu` last rendered.** If `linkBooks` or `unlinkBooks` succeeds and Zustand updates `books`, the `book` prop will update on the next render — but between the action completing and the dialog closing (`onOpenChange(false)`), the `book` reference inside the dialog still reflects the old value. The `linkedBook` display and `alreadyLinked` flag computed from `book.linkedBookId` will be stale during the close transition, briefly showing the wrong state.

11. **`handleUnlink` reads `book.linkedBookId` from the prop snapshot at render time, not from live store state.** If, by some race condition (background sync), `book.linkedBookId` was cleared externally while the dialog was open, `handleUnlink` will call `unlinkBooks(book.id, undefined)` — which TypeScript accepts because `book.linkedBookId` is typed as `string | undefined` and the function signature is `(bookIdA: string, bookIdB: string)`. This is a type unsafety issue: the guard `if (!book.linkedBookId) return` provides protection only when the prop snapshot reflects the stale state at the guard check, not at the time of execution.

12. **The story's Testing Notes section explicitly lists three categories of tests (unit for `unlinkBooks`, unit for `LinkFormatsDialog` candidate rendering, E2E for context menu link flow) — none of which were written.** The story is marked `status: done` and `reviewed: true` in its frontmatter. The review gates list `unit-tests` as passed. Either the unit test suite passed because zero relevant tests exist (making the gate meaningless), or the review process did not verify that the testing notes were actually implemented. This is a process failure, not just a coverage gap.

---

## Severity Classification

| # | Severity | Finding |
|---|----------|---------|
| 7 | HIGH | Average-based confidence threshold masks low-confidence individual mappings, silent wrong mappings |
| 8 | HIGH | ChapterMappingEditor Save/Cancel inside ScrollArea — inaccessible on small viewports |
| 2 | MEDIUM | Candidate filter does not guard against partial-link corruption (A linked to B, B not linked to A) |
| 3 | MEDIUM | `handleSave` uses stale `selectedBook` memo; inconsistent with `handlePairPressed` stale-closure fix |
| 4 | MEDIUM | `'unlink-confirm'` view state is a ghost — no dedicated JSX branch, misleads future maintainers |
| 9 | MEDIUM | "Link Format" menu item shown for non-epub/non-audiobook formats (PDF, etc.) |
| 1 | LOW | `handleOpenChange` 300ms magic timer tied to animation; breaks if animation duration changes |
| 5 | LOW | `resetTimerRef` not cleaned up in `useEffect` return — potential setState-on-unmounted call |
| 6 | LOW | `toEpubInputs`/`toAudioInputs`/`resolveEpubAudio` not memoized, inconsistent with component patterns |
| 10 | LOW | `book` prop snapshot stale between action completion and dialog close |
| 11 | LOW | `handleUnlink` reads `book.linkedBookId` from prop snapshot — type-unsafe race condition path |
| 12 | LOW | Story marked done/reviewed with testing notes unimplemented — process gate failure |
