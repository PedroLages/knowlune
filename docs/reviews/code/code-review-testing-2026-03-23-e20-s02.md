# Test Coverage Review — E20-S02: Flashcard System with Spaced Repetition

**Date:** 2026-03-23
**Story:** E20-S02 — Flashcard System with Spaced Repetition
**Reviewer:** code-review-testing agent

---

## AC Coverage Summary

**Acceptance Criteria Coverage:** 4/6 ACs tested (**67%**)

**COVERAGE GATE: BLOCKER** (< 80% threshold)

---

## AC Coverage Table

| AC# | Description | Unit Test | E2E Test | Verdict |
|-----|-------------|-----------|----------|---------|
| 1 | Create Flashcard dialog opens pre-filled with selected text | None | None | **Gap** |
| 2 | Flashcards page shows review queue with cards due today | `useFlashcardStore.test.ts:169`, `118` | `navigation.test.ts:21` | Partial |
| 3 | SM-2 rates Hard/Good/Easy and calculates next review date | `spacedRepetition.test.ts:21-91`, `useFlashcardStore.test.ts:184` | None | Partial |
| 4 | Completion message with stats when no cards remain | `useFlashcardStore.test.ts:224` | None | Partial |
| 5 | Easy > Good > Hard interval ordering in SM-2 | `spacedRepetition.test.ts:58-63`, `useFlashcardStore.test.ts:202` | None | Covered |
| 6 | Stats: total cards, due today, upcoming review schedule | `useFlashcardStore.test.ts:256` | None | Partial |

---

## Blockers

**B1 — Coverage gate: 67% AC coverage below mandatory 80%** (confidence: 97)

Two additional ACs must reach at least "Partial" status to unblock.

**B2 — AC1 has zero test coverage** (confidence: 95)

The entire behavior chain — selecting text in TipTap, clicking the "Create Flashcard" button in `BubbleMenuBar`, and `CreateFlashcardDialog` receiving the `defaultFront` prop pre-populated with that text — is untested at every layer.

Suggested tests:
- **Component**: `src/app/components/notes/__tests__/CreateFlashcardDialog.test.tsx` — render with `defaultFront="Spaced repetition"`, assert front textarea has that value; re-open with different `defaultFront` and assert field updates (tests `useEffect` sync at `CreateFlashcardDialog.tsx:37-42`).
- **E2E**: `tests/e2e/regression/story-e20-s02.spec.ts` — seed a course + note, navigate to note, type text, simulate selection, click "Create Flashcard" in bubble menu, assert dialog opens with front pre-filled.

---

## High Priority

**H1 — AC2 only smoke-tested via navigation config** (confidence: 88)

`startReviewSession` is unit-tested in isolation but no test verifies the page-level behavior: due cards seeded → "Start Review" button with correct count visible. `data-testid="start-review-button"` and `data-testid="flashcard-stats-due"` exist but nothing targets them.

**H2 — AC4 partial: completion transition untested in component** (confidence: 85)

`getSessionSummary` is tested at store level but the component transition (`phase === 'summary'`) is untested. No test verifies `data-testid="summary-total-reviewed"` appears after the last card is rated.

**H3 — AC3 partial: `reviewedAt` not asserted on rated card** (confidence: 83)

`rateFlashcard` tests verify `interval`, `easeFactor`, `nextReviewAt` but never assert `reviewedAt` is updated. This field is required by `predictRetention` for future sort ordering.

---

## Medium Priority

**M1 — SM-2 interval ordering test has isolation issues** (confidence: 75)

`useFlashcardStore.test.ts:202` performs three `vi.resetModules()` calls and three IDB deletions inside a single test function. If any reimport fails partway, a partially-initialized IDB is left behind. Each scenario should be an isolated `it` with its own `beforeEach`.

**M2 — Error-path spy not restored** (confidence: 72)

`useFlashcardStore.test.ts:59` spies on `db.flashcards.toArray` without restoring after the test. Add `afterEach(() => vi.restoreAllMocks())` at the describe level.

**M3 — `getUpcomingSchedule` has no dedicated unit test** (confidence: 70)

The 7-day bucketed schedule function has a boundary condition (day 0 and day 8+ excluded). The boundary is untested.

Suggested test: `src/app/pages/__tests__/Flashcards.test.ts` — exercise `getUpcomingSchedule` with cards at day 0, 1, 7, 8.

---

## Nits

- `spacedRepetition.test.ts:38-41`: "returns valid ISO 8601" test doesn't assert exact date value. Strengthen to assert `result.nextReviewAt === new Date('2026-03-18T12:00:00.000Z').toISOString()`.
- `useFlashcardStore.test.ts:11-24`: Local `makeFlashcard` factory should be in `tests/support/fixtures/factories/` for reuse.
- `schema.test.ts` and `useFlashcardStore.test.ts` each define their own `makeFlashcard` with identical shape — consolidate.
- `navigation.test.ts:21-30`: Add `path` assertion (`expect(item.path).toBe('/flashcards')`) for explicit route verification.

---

## Edge Cases Untested

- `rateFlashcard` called when `reviewQueue` is empty — no unit test asserting state is unchanged
- `deleteFlashcard` rollback on DB failure — no test for re-append to flashcards array
- `getStats` with many cards none reviewed — `nextReviewDate` should be `null` (only empty-array case covered)
- `formatNextReviewDate` with date = today — returns "Tomorrow" incorrectly (boundary untested)
- Dialog Cmd+Enter path when front/back is empty — bypasses disabled button, silently returns, no test coverage

---

**ACs:** 4/6 (67%) | Findings: 13 | Blockers: 2 | High: 3 | Medium: 3 | Nits: 4
