## Test Coverage Review: E18-S11 — Track Quiz Progress in Content Completion

**Date:** 2026-03-23
**Reviewer:** code-review-testing agent
**Branch:** feature/e18-s11-track-quiz-progress-in-content-completion

---

### AC Coverage Summary

**Acceptance Criteria Coverage:** 3/4 ACs tested (75%)

**COVERAGE GATE: BLOCKER** (<80%)

---

### AC Coverage Table

| AC# | Description | Unit Test | E2E Test | Verdict |
|-----|-------------|-----------|----------|---------|
| 1 | Pass quiz → `setItemStatus(lessonId, 'completed')` called AND lesson shows completed in course progress UI | `useQuizStore.crossStore.test.ts:105` | `story-18-11.spec.ts:148` (IDB only, no UI assertion) | Partial |
| 2 | Fail quiz → lesson NOT marked complete | `useQuizStore.crossStore.test.ts:127` | `story-18-11.spec.ts:168` | Covered |
| 3 | Retake quiz and pass → lesson marked complete (if not already) | None | None | **Gap** |
| 4 | Content progress failure → quiz result still saved, error logged | `useQuizStore.crossStore.test.ts:148` | None (unit coverage acceptable) | Covered |

**Coverage:** 3/4 ACs (2 fully, 1 partial, 1 gap) | 1 gap | 1 partial

---

### Test Quality Findings

#### Blockers (untested ACs)

- **[BLOCKER] AC3 zero test coverage (confidence: 95)** — "Retake quiz and pass → lesson marked complete (if not already)" has zero test coverage in both unit and E2E files. `setItemStatus` uses `db.contentProgress.put()` (upsert), so a second call is functionally safe — but never exercised. Suggested fix: Add unit test in `src/stores/__tests__/useQuizStore.crossStore.test.ts` — seed existing `contentProgress` entry with `status: 'completed'`, call `submitQuiz` second time with passing answer, assert `setItemStatusSpy` called again and record still `'completed'`.

#### High Priority

- **[HIGH] `tests/e2e/story-18-11.spec.ts:148-166` (confidence: 82)** — AC1 states lesson "shows as completed in the course progress UI," but the E2E test only reads the raw IDB record. No assertion that any UI element reflects the completed state. Fix: After confirming IDB write, navigate to `/courses/${COURSE_ID}` and assert a completion indicator is visible for the lesson.

- **[HIGH] `tests/e2e/story-18-11.spec.ts` (confidence: 90)** — No `afterEach` cleanup. Records seeded via `seedIndexedDBStore` (`quizzes`, `courses`) and app-created records (`contentProgress`, `quizAttempts`) are never cleared between tests. Fix: Add `test.afterEach` clearing `contentProgress`, `quizAttempts`, `quizzes`, and `courses` stores with `await` (not fire-and-forget).

#### Medium

- **[MEDIUM] `tests/e2e/story-18-11.spec.ts:42-76` (confidence: 70)** — `testCourse` defined as raw inline object instead of factory. Fix: Add `makeCourse()` factory or use an existing one.

- **[MEDIUM] `tests/e2e/story-18-11.spec.ts:183-185` (confidence: 65)** — AC2 assertion `entry?.status ?? 'not-started'` silently accepts both null entry and non-completed status. Can't distinguish "entry never created" from "created with wrong status." Fix: Use `expect(entry).toBeNull()` for precision.

#### Nits

- **Nit** `tests/e2e/story-18-11.spec.ts:82-118` (confidence: 55): `getContentProgressEntry` inline helper — a parallel `readContentProgressEntry` in `tests/support/helpers/indexeddb-seed.ts` would be reusable across specs.

- **Nit** `src/stores/__tests__/useQuizStore.crossStore.test.ts:29-31` (confidence: 50): Minimal placeholder IDs (`'course-1'`, `'les-1'`) — more descriptive names would improve readability.

---

### Edge Cases to Consider

- **Lesson already completed before retake (AC3 core path)**: No test verifies a pre-existing `'completed'` entry is not accidentally downgraded when `submitQuiz` called a second time.
- **Missing course in IDB at submit time**: `submitQuiz` silently skips module cascade if course deleted between quiz start and submission.
- **`persistWithRetry` failing inside `setItemStatus`**: Distinct from the mocked `setItemStatus` throw in the existing unit test.

---

**ACs:** 3/4 covered | **Findings:** 9 | Blockers: 1 | High: 2 | Medium: 2 | Nits: 2
