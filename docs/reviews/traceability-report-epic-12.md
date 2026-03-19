---
stepsCompleted: ['step-01-load-context', 'step-02-discover-tests', 'step-03-map-criteria', 'step-04-analyze-gaps', 'step-05-gate-decision']
lastStep: 'step-05-gate-decision'
lastSaved: '2026-03-19'
epic: 'Epic 12: Take Basic Quizzes'
scope: 'E12-S01 through E12-S05 (S06 excluded — not yet implemented)'
---

# Traceability Report — Epic 12: Take Basic Quizzes

## Gate Decision: PASS

**Rationale:** P0 coverage is 100% (1/1 data integrity criterion). P1 coverage is 100% (24/24 — all core user journey criteria fully tested). Overall coverage is 95% (38/40 testable criteria). The 2 uncovered criteria are both P2 (medium priority) with low risk scores (1-2). E12-S06 excluded (backlog, not yet implemented — scoring logic is pre-tested).

**Decision Date:** 2026-03-19

---

## Coverage Summary

| Metric | Value |
|--------|-------|
| Total Requirements (implemented stories) | 40 (+ 1 N/A) |
| Fully Covered | 38 (95%) |
| Partially Covered | 0 (0%) |
| Uncovered | 2 (5%) — both P2 |
| P0 Coverage | 100% (1/1) |
| P1 Coverage | 100% (24/24) |
| P2 Coverage | 87% (13/15) |
| P3 Coverage | N/A (1 criterion — documentation-only) |

---

## Gate Criteria

| Criterion | Required | Actual | Status |
|-----------|----------|--------|--------|
| P0 Coverage | 100% | 100% | **MET** |
| P1 Coverage (PASS target) | 90% | 100% | **MET** |
| P1 Coverage (minimum) | 80% | 100% | **MET** |
| Overall Coverage (minimum) | 80% | 95% | **MET** |

---

## Test Inventory

### Unit Tests (107 tests)

| File | Tests | Story |
|------|-------|-------|
| `src/types/__tests__/quiz.test.ts` | 55 | E12-S01 |
| `src/stores/__tests__/useQuizStore.test.ts` | 29 | E12-S03 |
| `src/lib/__tests__/scoring.test.ts` | 17 | E12-S03/S06 |
| `src/db/__tests__/schema.test.ts` (quiz sections) | 6 | E12-S02 |

### E2E Tests (11 tests)

| File | Tests | Story |
|------|-------|-------|
| `tests/e2e/regression/story-e12-s04.spec.ts` | 6 | E12-S04 |
| `tests/e2e/regression/story-e12-s05.spec.ts` | 5 | E12-S05 |

### Test Factory

| File | Purpose |
|------|---------|
| `tests/support/fixtures/factories/quiz-factory.ts` | `makeQuestion()`, `makeQuiz()`, `makeAttempt()`, `makeProgress()` |

### Total: 118 tests (107 unit + 11 E2E)

---

## Traceability Matrix

### E12-S01: Create Quiz Type Definitions

| # | Acceptance Criterion | Priority | Coverage | Test Level | Tests | Heuristics |
|---|---------------------|----------|----------|------------|-------|------------|
| S01-AC1 | Exports Quiz, Question, QuizAttempt, Answer, QuizProgress, QuestionMedia interfaces | P1 | FULL | Unit | `quiz.test.ts`: validates all schemas (MC, TF, MS, FIB, Quiz, Answer, Attempt, Progress) | — |
| S01-AC2 | All properties match quiz UX specification | P2 | FULL | Unit | `quiz.test.ts`: field validation tests (id, text, points, order), type-specific refinements | — |
| S01-AC3 | Zod schemas with `.safeParse()` (never throws) | P0 | FULL | Unit | `quiz.test.ts`: all tests use `.safeParse()` and check `result.success` | — |
| S01-AC4 | QuestionType enum: MC, TF, MS, FIB | P1 | FULL | Unit | `quiz.test.ts`: validates all 4 question type variants | — |
| S01-AC5 | JSDoc comments on interfaces | P3 | N/A | — | Documentation-only; verified via code review | — |
| S01-AC6 | Types importable from `@/types/quiz` | P2 | FULL | Unit | `quiz.test.ts` line 1-11: imports all types from `../quiz` | — |
| S01-AC7 | correctAnswer supports string and string[] | P1 | FULL | Unit | `quiz.test.ts`: "correctAnswer accepts string" + "correctAnswer accepts string[]" + integrity tests | — |
| S01-AC8 | options optional for fill-in-blank | P2 | FULL | Unit | `quiz.test.ts`: "allows FIB question with empty options array" + "rejects FIB question with options" | — |
| S01-AC9 | media property uses QuestionMedia type | P2 | FULL | Unit | `quiz.test.ts`: "validates a question with media", QuestionMediaSchema tests (valid, invalid type, empty url) | — |
| S01-AC10 | markedForReview: string[] in QuizProgress | P1 | FULL | Unit | `quiz.test.ts`: QuizProgressSchema validates `markedForReview: ['q3']` | — |
| S01-AC11 | questionOrder: string[] in QuizProgress | P1 | FULL | Unit | `quiz.test.ts`: QuizProgressSchema validates `questionOrder: ['q1', 'q2', 'q3', 'q4']` | — |
| S01-AC12 | timerAccommodation in QuizProgress | P1 | FULL | Unit | `quiz.test.ts`: QuizProgressSchema with `timerAccommodation: '150%'`; QuizAttemptSchema validates all 4 values | — |
| S01-AC13 | passingScore constrained 0-100 | P1 | FULL | Unit | `quiz.test.ts`: "rejects below 0", "rejects above 100", "accepts 0", "accepts 100" | — |

**E12-S01 Coverage: 12/12 testable ACs FULL (AC5 is documentation-only, N/A)**

---

### E12-S02: Set Up Dexie Schema v15 Migration

| # | Acceptance Criterion | Priority | Coverage | Test Level | Tests | Heuristics |
|---|---------------------|----------|----------|------------|-------|------------|
| S02-AC1 | Dexie migration adds quizzes and quizAttempts tables | P1 | FULL | Unit | `schema.test.ts`: verifies table list includes `quizzes` and `quizAttempts` | — |
| S02-AC2 | Correct indexes (lessonId, createdAt, [quizId+completedAt]) | P2 | FULL | Unit | `schema.test.ts`: "query by lessonId", "query by createdAt", "query by compound [quizId+completedAt]" | — |
| S02-AC3 | Schema version correct | P2 | FULL | Unit | `schema.test.ts`: "should be at version 18" + "preserve key indexes on existing tables" | — |

**E12-S02 Coverage: 3/3 FULL**

---

### E12-S03: Create useQuizStore with Zustand

| # | Acceptance Criterion | Priority | Coverage | Test Level | Tests | Heuristics |
|---|---------------------|----------|----------|------------|-------|------------|
| S03-AC1 | Follows persist pattern, individual selectors, optimistic updates | P1 | FULL | Unit | `useQuizStore.test.ts`: "persist partialize" test validates localStorage key + partialize config; "individual selectors" tests for all 5 selectors | — |
| S03-AC2 | startQuiz: loads quiz, Fisher-Yates shuffle, persists order | P1 | FULL | Unit | `useQuizStore.test.ts`: "loads quiz and initializes progress with shuffled order" + "preserves original order when shuffleQuestions is false" + "sets error when not found" | — |
| S03-AC3 | submitAnswer: optimistic update, no Dexie write | P1 | FULL | Unit | `useQuizStore.test.ts`: "updates currentProgress.answers optimistically without writing to Dexie" — verifies Dexie empty | — |
| S03-AC4 | submitQuiz: score, Dexie write with retry, rollback on failure, clears progress | P1 | FULL | Unit | `useQuizStore.test.ts`: "creates QuizAttempt in Dexie and clears currentProgress" + "reverts state and shows toast on Dexie failure" | Error path: COVERED |
| S03-AC5 | Cross-store: setItemStatus on passing, NOT on failing | P1 | FULL | Unit | `useQuizStore.test.ts`: "calls setItemStatus only when score >= passingScore" + "does NOT call when score < passingScore" | — |
| S03-AC6 | retakeQuiz: calls startQuiz, resets progress | P1 | FULL | Unit | `useQuizStore.test.ts`: "calls startQuiz internally to reset progress" | — |
| S03-AC7 | resumeQuiz: restores from localStorage | P2 | FULL | Unit + E2E | `useQuizStore.test.ts`: "is a no-op (persist middleware handles rehydration)". Effectively covered by E12-S04 AC3 E2E (resume button with correct position) + E12-S05 AC2b E2E (answer persists across navigation). | — |
| S03-AC8 | toggleReviewMark: add/remove questionId | P2 | FULL | Unit | `useQuizStore.test.ts`: "adds questionId when not present" + "removes when present" + guard "no-op when null" | — |
| S03-AC9 | startQuiz: timeRemaining from quiz.timeLimit | P1 | FULL | Unit | `useQuizStore.test.ts`: "sets timeRemaining to quiz.timeLimit when non-null" | — |
| S03-AC10 | Guard: submitAnswer no-op when no progress | P2 | FULL | Unit | `useQuizStore.test.ts`: "is a no-op when currentProgress is null" | Error path: COVERED |
| S03-AC11 | Guard: submitQuiz early return when no quiz | P2 | FULL | Unit | `useQuizStore.test.ts`: "returns early without DB write when no active quiz" | Error path: COVERED |
| S03-AC12 | clearQuiz/clearError actions | P2 | FULL | Unit | `useQuizStore.test.ts`: "resets all state fields" + "clears error without touching other state" | — |
| S03-AC13 | loadAttempts: queries Dexie, sets array | P2 | FULL | Unit | `useQuizStore.test.ts`: "queries Dexie and sets attempts array" + "sets empty array when no records" | — |

**E12-S03 Coverage: 13/13 FULL**

---

### E12-S04: Create Quiz Route and QuizPage Component

| # | Acceptance Criterion | Priority | Coverage | Test Level | Tests | Heuristics |
|---|---------------------|----------|----------|------------|-------|------------|
| S04-AC1 | Navigate to quiz URL → start screen with title, description, badges, Start button | P1 | FULL | E2E | `story-e12-s04.spec.ts`: "shows quiz title, description, and metadata badges" — verifies heading, text, "12 questions", "30 min", "70% to pass", Start button, no questions visible | — |
| S04-AC1b | Untimed badge variant | P2 | FULL | E2E | `story-e12-s04.spec.ts`: "shows 'Untimed' badge when quiz has no time limit" | — |
| S04-AC2 | Click Start Quiz → header with progress + timer | P1 | FULL | E2E | `story-e12-s04.spec.ts`: "clicking Start Quiz shows quiz header with progress" (Question 1 of 5, progressbar) + "timer counts down in MM:SS format" (10:00) | — |
| S04-AC3 | Resume in-progress quiz with answered count | P1 | FULL | E2E | `story-e12-s04.spec.ts`: "shows Resume Quiz button with answered count from localStorage" — seeds localStorage progress, verifies "5 of 12", clicks Resume, verifies "Question 5 of 12" | — |
| S04-AC4 | Error state for missing quiz with course link | P1 | FULL | E2E | `story-e12-s04.spec.ts`: "shows error message and course link when quiz not found" — navigates to nonexistent lesson, verifies "no quiz found" + "back to course" link | Error path: COVERED |

**E12-S04 Coverage: 5/5 FULL**

---

### E12-S05: Display Multiple Choice Questions

| # | Acceptance Criterion | Priority | Coverage | Test Level | Tests | Heuristics |
|---|---------------------|----------|----------|------------|-------|------------|
| S05-AC1 | Question text as Markdown, card styling, radio options, no default | P1 | FULL | E2E | `story-e12-s05.spec.ts`: "Question text rendered as Markdown in styled card with radio options" — verifies bold text, radiogroup, 4 options, none pre-checked, all labels visible | — |
| S05-AC2a | Selection styling (brand border/bg) + radio group behavior | P1 | FULL | E2E | `story-e12-s05.spec.ts`: "Selecting an option updates visual state — single selection only" — checks `border-brand`, `bg-brand-soft`, `border-border`, `bg-card`, re-selection | — |
| S05-AC2b | Answer persists via store across navigation | P1 | FULL | E2E | `story-e12-s05.spec.ts`: "Answer persists via store across navigation" — selects B, navigates away, returns, verifies B still checked | — |
| S05-AC3 | QuestionDisplay mode prop (active/review) | P2 | NONE | — | **No test validates the mode prop surface.** Only 'active' mode is exercised. Prop existence is verified at compile time but no test asserts mode prop acceptance or behavior differentiation. | — |
| S05-AC4 | Mobile 48px touch targets | P1 | FULL | E2E | `story-e12-s05.spec.ts`: "Mobile viewport — options have min 48px touch targets" — sets 375×667, checks each label boundingBox ≥ 48px | — |
| S05-AC5 | Graceful degradation for <2 or >6 options + console warning | P2 | NONE | — | **No test seeds a question with <2 or >6 options and verifies rendering + console.warn.** The Zod schema rejects these at validation time (covered in S01), but the component-level graceful degradation is untested. | Happy-path only |
| S05-AC6 | Accessibility: radiogroup, aria-labelledby, focusable | P1 | FULL | E2E | `story-e12-s05.spec.ts`: "Accessibility — radiogroup structure, aria-labelledby, and focusable options" — verifies role, aria-labelledby→legend, focus, radio count | — |

**E12-S05 Coverage: 5/7 FULL, 0 PARTIAL, 2 NONE (S05-AC3 mode prop, S05-AC5 degradation)**

---

### E12-S06: Calculate and Display Quiz Score (BACKLOG)

**Status: Not yet implemented. Excluded from traceability gate.**

The scoring logic (`src/lib/scoring.ts`) already exists and is fully tested via `scoring.test.ts` (17 tests covering MC, TF, FIB, MS, percentage rounding, passing threshold, empty quiz guard). This covers the computational foundation but the UI (QuizResults, ScoreSummary, animated score indicator) has no implementation yet.

---

## Gap Analysis

### Critical Gaps (P0): 0

No P0 gaps. The single P0 criterion (S01-AC3: Zod safeParse) is fully covered.

### High Gaps (P1): 0

All 24 P1 criteria are fully covered across all 5 implemented stories.

### Medium Gaps (P2): 2 uncovered

| Gap | Story | Criterion | Risk Score | Recommendation |
|-----|-------|-----------|------------|----------------|
| GAP-1 | E12-S05 | S05-AC3: mode prop surface | Prob=1 × Impact=1 = **1** (DOCUMENT) | Low risk — prop exists at compile time. Add unit test verifying QuestionDisplay accepts `mode='review-correct'` without error when Epic 16 is implemented |
| GAP-2 | E12-S05 | S05-AC5: Graceful degradation (<2 / >6 options) | Prob=1 × Impact=2 = **2** (DOCUMENT) | Add unit test: render MultipleChoiceQuestion with 1 option and 7 options, verify renders + console.warn |

### Partial Coverage Items: 0

All previously partial items have been resolved:
- S03-AC7 (resumeQuiz): Upgraded to FULL — effectively covered by E12-S04 AC3 E2E (resume button with correct position) + E12-S05 AC2b E2E (answer persists across navigation).

---

## Coverage Heuristics

| Category | Status |
|----------|--------|
| API Endpoint Coverage | N/A — local-first app, no API endpoints |
| Auth/Authz Coverage | N/A — no authentication (Epic 19 scope) |
| Error Path Coverage | **GOOD** — Dexie failure + rollback (S03-AC4), missing quiz (S04-AC4), guard no-ops (S03-AC10/11) all tested |
| Happy-Path-Only Criteria | 1 — S05-AC5 (degradation for invalid option counts) |

---

## Risk Assessment

| Risk ID | Category | Title | Prob | Impact | Score | Action | Status |
|---------|----------|-------|------|--------|-------|--------|--------|
| R-E12-01 | TECH | Mode prop untested (S05-AC3) | 1 | 1 | 1 | DOCUMENT | Deferred to Epic 16 |
| R-E12-02 | BUS | Degradation path untested (S05-AC5) | 1 | 2 | 2 | DOCUMENT | Low risk — Zod validation prevents invalid data upstream |

No risks ≥ 6. No blockers.

---

## Recommendations

| Priority | Action | Criteria |
|----------|--------|----------|
| MEDIUM | Add unit test for `QuestionDisplay` mode prop acceptance (prep for Epic 16 review mode) | S05-AC3 |
| MEDIUM | Add unit test for `MultipleChoiceQuestion` with <2 and >6 options + console.warn | S05-AC5 |
| LOW | Add E2E test for full resume round-trip with browser refresh (defense in depth) | S03-AC7 |
| LOW | Run `/testarch-test-review` to assess test quality across Epic 12 | All |

---

## Corrections from Previous Report

This report supersedes the initial traceability report (same date). Key corrections:

| Item | Previous Value | Corrected Value | Reason |
|------|---------------|-----------------|--------|
| Total requirements | 34 | 40 (+ 1 N/A) | Previous report undercounted; matrix rows were correct but summary aggregation was wrong |
| quiz.test.ts count | 50 | 55 | 5 tests added (lower-bound constraints, refinement error message, type inference) |
| scoring.test.ts count | 18 | 17 | Recount correction |
| useQuizStore.test.ts count | 25 | 29 | 4 tests added (guard clauses, empty loadAttempts, toggleReviewMark guard) |
| E2E S05 count | 6 | 5 | Recount correction — 5 test blocks in spec |
| P1 total | 19 | 24 | Previous report undercounted P1 criteria |
| P2 total | 14 | 15 | Previous report undercounted P2 criteria |
| Overall coverage | 91% | 95% | Follows from corrected totals (38/40) |
| P2 coverage | 79% | 87% | Follows from corrected totals (13/15) |

---

## Next Actions

1. **E12-S06**: Implement "Calculate and Display Quiz Score" (next story in sprint)
2. **Gap tests**: Add the 2 MEDIUM-priority unit tests during E12-S06 implementation
3. **Epic completion**: After S06, run `/sprint-status` → `/testarch-nfr` → `/retrospective`
