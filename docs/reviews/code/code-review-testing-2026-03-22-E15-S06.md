# Test Coverage Review: E15-S06 — Track Time-to-Completion for Each Attempt

**Date:** 2026-03-22
**Branch:** feature/e15-s06-track-time-to-completion-for-each-attempt
**Reviewer:** code-review-testing agent

## AC Coverage: 4/5 (80%)

| AC# | Description | Unit Test | E2E Test | Verdict |
|-----|-------------|-----------|----------|---------|
| AC1 | Start time recorded; timeSpent calculated and stored in QuizAttempt on submit | None | None | **Gap** |
| AC2 | Timed quiz results screen shows formatted time-to-completion | `ScoreSummary.test.tsx:60-63` | `story-e15-s06.spec.ts:127-143` | Covered |
| AC3 | Human-readable formatting: "Xm Ys", edge cases | `formatDuration.test.ts:4-44`, `ScoreSummary.test.tsx:142-150` | `story-e15-s06.spec.ts:127-143` | Covered |
| AC4 | Untimed quiz does NOT show time on results screen | `ScoreSummary.test.tsx:152-155` | `story-e15-s06.spec.ts:146-159` | Covered |
| AC5 | Multi-attempt: second shows previous time; first shows nothing | `ScoreSummary.test.tsx:162-182` | `story-e15-s06.spec.ts:163-207` | Covered |

## Findings

### [Blocker] AC1 has no test verifying DB write path

**Confidence:** 75

No unit or integration test confirms that `submitQuiz` produces a `QuizAttempt` with correct `timeSpent` in IndexedDB. E2E tests verify the display side implicitly, but the store contract is untested.

**Suggested test:** In quiz store tests — `"submitQuiz stores timeSpent as elapsed ms in IndexedDB"` asserting `db.quizAttempts.get(attemptId)` returns a record with `timeSpent === endTime - startTime`.

Confidence 75 (not 90) because the E2E flow exercises the full path and would fail if persistence were broken.

### [High] QuizResults integration test doesn't assert showTimeSpent wiring for untimed quizzes

**File:** `src/app/pages/__tests__/QuizResults.test.tsx`
**Confidence:** 82

AC4 behaviour is tested in ScoreSummary isolation and in E2E, but no integration test confirms the prop is wired correctly through QuizResults when `timeLimit: null`.

**Suggested test:** `"hides time display when quiz has no timeLimit"` — seed `timeLimit: null`, assert `screen.queryByText(/Completed in/)` is null.

### [High] previousAttemptTimeSpent wiring through QuizResults untested at integration level

**File:** `src/app/pages/__tests__/QuizResults.test.tsx`
**Confidence:** 78

The `useMemo` at `QuizResults.tsx:61-68` (guard conditions: `attempts.length <= 1`, `Number.isFinite`) has no integration-level tests. The E2E covers the happy path only.

**Suggested tests:** Prior attempt with `timeSpent: NaN` → "Previous:" absent; valid prior attempt → "Previous: Xm Ys" present.

### [Medium] E2E multi-attempt test only uses 2 attempts, not 3+

**Confidence:** 70

Story design spec states "use most-recent prior attempt (not best time)". With only 2 attempts tested, the ordering correctness for 3+ attempts (A=15m, B=20m, C=8m → should show B not A) is unverified.

### [Medium] timerAccommodation: 'untimed' on timed quiz not tested in E2E

**Confidence:** 65

`showTimeSpent` guard covers `timerAccommodation !== 'untimed'` but only the `timeLimit: null` case is tested E2E. An accommodated user taking a timed quiz with 'untimed' accommodation has no coverage.

### [Medium] cleanup doesn't reset Zustand store state

**File:** `tests/e2e/story-e15-s06.spec.ts:115-118`
**Confidence:** 70

`afterEach` clears DB stores but not in-memory Zustand state. Low risk with full-page reload, but a comment explaining why would help future maintainers.

### [Nit] Date constant `T_8M32S` pattern is correct but needs comment

**File:** `tests/e2e/story-e15-s06.spec.ts:23-24`
**Confidence:** 65

`new Date('...')` with fixed ISO string is deterministic (not flagged by ESLint rule). A comment clarifying this avoids future confusion.

## Edge Cases Missing Coverage

- `timerAccommodation: 'untimed'` with `timeLimit` set — no test
- Prior attempt with `timeSpent: 0` — passes guard, renders "Previous: 1s", no test
- 3+ attempts: time comparison uses second-to-last (not best) — not verified
