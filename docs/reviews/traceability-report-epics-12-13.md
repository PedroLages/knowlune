---
stepsCompleted: ['step-01-load-context', 'step-02-discover-tests', 'step-03-map-criteria', 'step-04-analyze-gaps', 'step-05-gate-decision']
lastStep: 'step-05-gate-decision'
lastSaved: '2026-03-21'
scope: 'Epics 12-13 (Quiz System)'
---

# Requirements-to-Tests Traceability Report

**Scope:** Epics 12–13 (Take Basic Quizzes + Navigate and Control Quiz Flow)
**Generated:** 2026-03-21
**Workflow:** BMAD TestArch Trace (Create mode)

---

## Gate Decision: CONCERNS → PASS (after gap fixes)

**Original (2026-03-21):** CONCERNS — P1 at 86% (44/51), below 90% target.

**Updated (2026-03-21):** PASS — P1 at 94% (48/51) after adding 4 gap-closing tests. P0 100%, P1 94%, Overall 88%.

---

## Coverage Summary

| Metric | Value | Target | Status |
|--------|-------|--------|--------|
| **P0 Coverage** | 100% (7/7) | 100% | ✅ MET |
| **P1 Coverage** | 94% (48/51) | 90% | ✅ MET |
| **P2 Coverage** | 75% (12/16) | Best effort | ℹ️ OK |
| **P3 Coverage** | 81% (13/16) | Best effort | ℹ️ OK |
| **Overall Coverage** | 88% (79/90) | ≥80% | ✅ MET |

### Coverage Breakdown

| Status | Count | % |
|--------|-------|---|
| FULL | 79 | 88% |
| PARTIAL | 5 | 6% |
| NONE | 6 | 7% |
| **Total** | **90** | |

### Gap Fixes Applied (2026-03-21)

| Gap | Fix | File |
|-----|-----|------|
| E12-S03-AC4c (rollback) | 4 unit tests: state rollback, error toast, answer preservation, no cross-store | `src/stores/__tests__/useQuizStore.submitError.test.ts` |
| E12-S03-AC5 (cross-store) | 3 unit tests: setItemStatus on pass, skip on fail, isolated failure | `src/stores/__tests__/useQuizStore.crossStore.test.ts` |
| E13-S03-AC4 (timer) | 1 E2E test: timer sync via visibilitychange, restoration on resume | `tests/e2e/regression/story-e13-s03.spec.ts` |
| E12-S05-AC5 (degradation) | 4 unit tests: 0, 1, 7, 4 options edge cases | `src/app/components/quiz/__tests__/QuestionDisplay.edge-cases.test.tsx` |
| Duplicate spec | Removed `tests/e2e/story-e13-s02.spec.ts` (identical to regression copy) | — |
| Import fix | Fixed `../support/` → `../../support/` in story-e13-s03.spec.ts | — |

---

## Test Inventory

### E2E Tests (18 tests across 8 spec files)

| File | Story | Tests |
|------|-------|-------|
| `tests/e2e/regression/story-e12-s04.spec.ts` | E12-S04 | 6 |
| `tests/e2e/regression/story-e12-s05.spec.ts` | E12-S05 | 5 |
| `tests/e2e/story-12-6.spec.ts` | E12-S06 | 7 |
| `tests/e2e/regression/story-e13-s01.spec.ts` | E13-S01 | 5 |
| `tests/e2e/regression/story-e13-s02.spec.ts` | E13-S02 | 5 |
| `tests/e2e/regression/story-e13-s03.spec.ts` | E13-S03 | 5 |
| `tests/e2e/regression/story-13-4.spec.ts` | E13-S04 | 5 |
| `tests/e2e/regression/story-e13-s05.spec.ts` | E13-S05 | 3 |

### Unit Tests (80+ test cases across 4 files)

| File | Focus | Cases |
|------|-------|-------|
| `src/types/__tests__/quiz.test.ts` | Zod schema validation | 55+ |
| `src/lib/__tests__/scoring.test.ts` | Score calculation | 20+ |
| `src/lib/__tests__/shuffle.test.ts` | Fisher-Yates algorithm | 7 |
| `src/lib/__tests__/quotaResilientStorage.test.ts` | Quota fallback | 14 |
| `src/stores/__tests__/useQuizStore.quota.test.ts` | Store quota handling | 2 |

### Duplicate Test File (Note)

`tests/e2e/story-e13-s02.spec.ts` is identical to `tests/e2e/regression/story-e13-s02.spec.ts` — recommend removing the non-regression copy.

---

## Traceability Matrix

### Epic 12: Take Basic Quizzes

#### E12-S01: Create Quiz Type Definitions

| AC | Description | Priority | Coverage | Test(s) |
|----|-------------|----------|----------|---------|
| AC1 | Type system completeness | P3 | UNIT-ONLY | `quiz.test.ts` — QuestionSchema, QuizSchema suites |
| AC2 | Zod validation schemas | P3 | UNIT-ONLY | `quiz.test.ts` — all validation suites |
| AC3 | QuestionType enum (4 types) | P3 | UNIT-ONLY | `quiz.test.ts` — validates MC, TF, MS, FIB |
| AC4 | JSDoc documentation | P3 | UNIT-ONLY | `quiz.test.ts` — type inference tests |
| AC5 | Import path `@/types/quiz` | P3 | UNIT-ONLY | All importing files compile successfully |
| AC6 | Polymorphic correctAnswer | P3 | UNIT-ONLY | `quiz.test.ts` — string and string[] tests |
| AC7 | Optional options property | P3 | UNIT-ONLY | `quiz.test.ts` — FIB without options |
| AC8 | QuestionMedia type | P3 | UNIT-ONLY | `quiz.test.ts` — QuestionMediaSchema suite |
| AC9 | QuizProgress markedForReview | P3 | UNIT-ONLY | `quiz.test.ts` — QuizProgressSchema |
| AC10 | QuizProgress questionOrder | P3 | UNIT-ONLY | `quiz.test.ts` — QuizProgressSchema |
| AC11 | QuizProgress timerAccommodation | P3 | UNIT-ONLY | `quiz.test.ts` — QuizAttemptSchema |
| AC12 | passingScore constraint 0-100 | P3 | UNIT-ONLY | `quiz.test.ts` — QuizSchema rejects <0 and >100 |

> **Note:** UNIT-ONLY is appropriate for type definition stories — runtime Zod validation is the correct test level.

#### E12-S03: Create useQuizStore with Zustand

| AC | Description | Priority | Coverage | Test(s) |
|----|-------------|----------|----------|---------|
| AC1 | Zustand store pattern | P2 | PARTIAL | Indirectly via all E2E quiz tests |
| AC1a | Persist middleware | P2 | PARTIAL | E2E: `story-e13-s03.spec.ts` — auto-save to localStorage |
| AC1b | Store actions exported | P2 | PARTIAL | Indirectly via E2E tests calling each action |
| AC2 | startQuiz loads quiz | P1 | FULL | E2E: `story-e12-s04.spec.ts` — Start Quiz flow |
| AC2a | startQuiz initialization | P1 | FULL | E2E: `story-e12-s04.spec.ts` — question index, empty answers |
| AC2b | startQuiz timeRemaining | P1 | FULL | E2E: `story-e12-s04.spec.ts` — timer displays MM:SS |
| AC3 | submitAnswer stores answer | P1 | FULL | E2E: `story-e12-s05.spec.ts` — selection persists |
| AC4 | submitQuiz score calculation | P0 | FULL | Unit: `scoring.test.ts` — all question types |
| AC4a | submitQuiz Dexie persistence | P0 | FULL | E2E: `story-12-6.spec.ts` — submit shows results |
| AC4b | submitQuiz ordering guarantee | P1 | PARTIAL | E2E tests submit flow but don't verify ordering explicitly |
| AC4c | submitQuiz rollback on error | P1 | FULL | Unit: `useQuizStore.submitError.test.ts` — 4 tests |
| AC5 | Cross-store on passing | P1 | FULL | Unit: `useQuizStore.crossStore.test.ts` — 3 tests |
| AC6 | retakeQuiz | P1 | FULL | E2E: `story-13-4.spec.ts` — retake clears answers |
| AC7 | resumeQuiz | P1 | FULL | E2E: `story-e13-s03.spec.ts` — Resume Quiz button |
| AC8 | toggleReviewMark | P2 | FULL | E2E: `story-e13-s02.spec.ts` — toggle on/off |

#### E12-S04: Create Quiz Route and QuizPage Component

| AC | Description | Priority | Coverage | Test(s) |
|----|-------------|----------|----------|---------|
| AC1 | Quiz route navigation | P1 | FULL | E2E: `story-e12-s04.spec.ts` — quiz start screen |
| AC1a | Quiz title and description | P1 | FULL | E2E: quiz title, description visible |
| AC1b | Metadata badges | P1 | FULL | E2E: question count, time limit, passing score badges |
| AC1c | Start Quiz button styling | P1 | FULL | E2E: Start Quiz button present |
| AC1d | No questions on start screen | P1 | FULL | E2E: questions not visible before start |
| AC2 | Start quiz → first question | P1 | FULL | E2E: clicking Start loads question 1 |
| AC2a | Timer countdown MM:SS | P1 | FULL | E2E: timer format verified |
| AC3 | Resume Quiz button | P1 | FULL | E2E: Resume button with answered count |
| AC3a | Resume restores position | P1 | FULL | E2E: position and answers restored |
| AC4 | Error handling (no quiz) | P1 | FULL | E2E: "No quiz found" + course link |

#### E12-S05: Display Multiple Choice Questions

| AC | Description | Priority | Coverage | Test(s) |
|----|-------------|----------|----------|---------|
| AC1 | Question text as Markdown | P1 | FULL | E2E: `story-e12-s05.spec.ts` — markdown rendering |
| AC1a | Card styling | P1 | FULL | E2E: card wrapper present |
| AC1b | 2-6 answer options | P1 | FULL | E2E: radio options displayed |
| AC1c | Label wrapper pattern | P1 | FULL | E2E: label-based selection |
| AC1d | No default selection | P1 | FULL | E2E: all options unselected initially |
| AC1e | Radio group behavior | P1 | FULL | E2E: single selection enforced |
| AC2 | Selected option styling | P1 | FULL | E2E: brand border/bg on selection |
| AC2a | Unselected option styling | P1 | FULL | E2E: default border/bg on unselected |
| AC2b | Previous deselected | P1 | FULL | E2E: radio behavior |
| AC2c | Store integration | P1 | FULL | E2E: answer persists across navigation |
| AC2d | Persistence | P1 | FULL | E2E: navigate away and return |
| AC3 | Mode prop | P3 | PARTIAL | Only active mode tested |
| AC3a | Active mode | P3 | FULL | E2E: active state renders |
| AC3b | Review modes | P3 | **NONE** | Deferred to Epic 16 |
| AC4 | Mobile responsiveness | P1 | FULL | E2E: 48px touch targets on 375×667 |
| AC5 | Graceful degradation | P2 | FULL | Unit: `QuestionDisplay.edge-cases.test.tsx` — 0, 1, 7, 4 options |

#### E12-S06: Calculate and Display Quiz Score

| AC | Description | Priority | Coverage | Test(s) |
|----|-------------|----------|----------|---------|
| AC1 | Score percentage display | P0 | FULL | E2E: `story-12-6.spec.ts` + Unit: `scoring.test.ts` |
| AC1a | Animated SVG indicator | P0 | FULL | E2E: score indicator visible |
| AC1b | Correct count (X of Y) | P0 | FULL | E2E: "3 of 3 correct" verified |
| AC1c | Pass/fail status message | P0 | FULL | E2E: encouraging messages |
| AC1d | No "Failed" word (QFR23) | P0 | FULL | E2E: AC5 test — word "Failed" absent |
| AC1e | Time spent display | P1 | FULL | E2E: duration format verified |
| AC2 | Unanswered confirmation | P1 | FULL | E2E: AlertDialog with count |
| AC2a | Continue Reviewing | P1 | FULL | E2E: returns to quiz |
| AC2b | Submit Anyway | P1 | FULL | E2E: submits incomplete quiz |
| AC3 | Results action buttons | P1 | FULL | E2E: Retake, Review Answers, Back to Lesson |
| AC4 | Dexie error handling | P1 | FULL | Unit: `useQuizStore.submitError.test.ts` — toast + answers preserved |

### Epic 13: Navigate and Control Quiz Flow

#### E13-S01: Navigate Between Questions

| AC | Description | Priority | Coverage | Test(s) |
|----|-------------|----------|----------|---------|
| AC1 | Next/Previous buttons | P1 | FULL | E2E: `story-e13-s01.spec.ts` — navigation + persistence |
| AC2 | First question (Previous disabled) | P1 | FULL | E2E: Previous disabled on Q1 |
| AC3 | Last question (Submit Quiz) | P1 | FULL | E2E: Next hidden, Submit shown on last Q |
| AC4 | Question grid jump navigation | P1 | FULL | E2E: click bubble jumps + visual indicators |

#### E13-S02: Mark Questions for Review

| AC | Description | Priority | Coverage | Test(s) |
|----|-------------|----------|----------|---------|
| AC1 | Mark for Review checkbox | P2 | FULL | E2E: `story-e13-s02.spec.ts` — toggle on/off |
| AC2 | Visual indicator in grid | P2 | FULL | E2E: bookmark indicator on marked |
| AC3 | Persistence across navigation | P2 | FULL | E2E: indicator persists after navigate |
| AC4 | Clear review mark | P2 | FULL | E2E: toggle off removes indicator |
| AC5 | Submit dialog review summary | P2 | FULL | E2E: marked count + jump links |

#### E13-S03: Pause and Resume Quiz

| AC | Description | Priority | Coverage | Test(s) |
|----|-------------|----------|----------|---------|
| AC1 | Auto-save to localStorage | P1 | FULL | E2E: `story-e13-s03.spec.ts` — per-quiz localStorage |
| AC2 | Resume button + answered count | P1 | FULL | E2E: Resume button with "X of Y answered" |
| AC3 | Safe exit (back/close) | P1 | PARTIAL | Same-session tested; crash recovery implicit |
| AC4 | Timer state restoration | P1 | FULL | E2E: `story-e13-s03.spec.ts` — visibilitychange sync + resume |
| AC5 | Completed quiz no Resume | P2 | FULL | E2E: Start Quiz shown instead |

#### E13-S04: Unlimited Quiz Retakes

| AC | Description | Priority | Coverage | Test(s) |
|----|-------------|----------|----------|---------|
| AC1 | Retake button, no limits | P1 | FULL | E2E: `story-13-4.spec.ts` — no limit messaging |
| AC2 | Fresh attempt, re-shuffle | P1 | FULL | E2E: answers cleared, fresh start |
| AC3 | Improvement summary | P1 | FULL | E2E: "Previous best:" comparison |
| AC4 | Retake from lesson page | P1 | FULL | E2E: "Retake Quiz" on start screen |

#### E13-S05: Randomize Question Order

| AC | Description | Priority | Coverage | Test(s) |
|----|-------------|----------|----------|---------|
| AC1 | Fisher-Yates shuffle | P2 | FULL | E2E + Unit: deterministic mock |
| AC2 | Different order on retake | P2 | FULL | E2E: different sequence verified |
| AC3 | No shuffle when disabled | P2 | FULL | E2E: original order preserved |
| AC4 | Algorithm O(n), immutable | P2 | FULL | Unit: `shuffle.test.ts` — 7 tests + distribution |

#### E13-S06: Handle localStorage Quota Exceeded

| AC | Description | Priority | Coverage | Test(s) |
|----|-------------|----------|----------|---------|
| AC1 | QuotaExceededError fallback | P1 | FULL | Unit: `quotaResilientStorage.test.ts` |
| AC2 | Dexie unaffected | P1 | PARTIAL | Unit covers quota; no E2E verifies Dexie after quota |
| AC3 | sessionStorage tab close | P3 | **NONE** | Expected browser behavior, not explicitly tested |
| AC4 | Non-blocking toast | P2 | FULL | Unit: throttled warning toast verified |

---

## Coverage Heuristics

### Endpoint Coverage
Not applicable — Epics 12-13 are client-side only (IndexedDB/Dexie, localStorage, Zustand). No API endpoints involved.

### Auth/Authorization Coverage
Not applicable — quiz system has no authentication or permission model in current scope.

### Error-Path Coverage

| Criterion | Error Path Tested? | Notes |
|-----------|-------------------|-------|
| E12-S03 AC4c (submitQuiz rollback) | ❌ NO | Happy path only — no test for Dexie write failure |
| E12-S06 AC4 (Dexie error on submit) | ❌ NO | Happy path only — no error toast verification |
| E13-S03 AC4 (timer restoration) | ❌ NO | No pause/resume timer test |
| E13-S06 AC1-AC2 (quota exceeded) | ✅ YES | Unit tests cover quota fallback |
| E12-S04 AC4 (quiz not found) | ✅ YES | E2E test for missing quiz error |

**Happy-path-only criteria:** 3 (E12-S03-AC4c, E12-S06-AC4, E13-S03-AC4)

---

## Gap Analysis

### ❌ NONE Coverage (8 items)

| ID | Description | Priority | Risk Score | Recommendation |
|----|-------------|----------|------------|----------------|
| E12-S03-AC4c | submitQuiz rollback on Dexie failure | P1 | 6 (P=2, I=3) | Add unit test mocking Dexie write failure → verify state rollback |
| E12-S03-AC5 | Cross-store update on passing | P1 | 4 (P=2, I=2) | Add integration test: pass quiz → verify contentProgressStore |
| E12-S05-AC5 | Graceful degradation (< 2 or > 6 options) | P2 | 2 (P=1, I=2) | Add unit test with edge-case option counts |
| E12-S05-AC3b | Review modes (review-correct, etc.) | P3 | 1 (P=1, I=1) | Deferred to Epic 16 — no action needed |
| E12-S06-AC4 | Dexie error handling on submit | P1 | 6 (P=2, I=3) | Add unit/E2E test: submitQuiz error → toast + answers preserved |
| E13-S03-AC4 | Timer state restoration on resume | P1 | 4 (P=2, I=2) | Add E2E test: start timed quiz → navigate away → resume → verify timer |
| E13-S06-AC3 | sessionStorage loss on tab close | P3 | 1 (P=1, I=1) | Browser behavior — document as known limitation |

### ⚠️ PARTIAL Coverage (7 items)

| ID | Description | Priority | Gap |
|----|-------------|----------|-----|
| E12-S03-AC1 | Store pattern | P2 | No dedicated store unit test file |
| E12-S03-AC1a | Persist middleware | P2 | Tested via E2E only |
| E12-S03-AC1b | Store actions | P2 | Tested via E2E only |
| E12-S03-AC4b | submitQuiz ordering | P1 | Ordering guarantee not explicitly verified |
| E12-S05-AC3 | Mode prop | P3 | Only active mode tested (review deferred) |
| E13-S03-AC3 | Safe exit | P1 | Same-session tested; crash recovery implicit |
| E13-S06-AC2 | Dexie unaffected by quota | P1 | Unit covers quota fallback; no E2E after quota |

---

## Risk Assessment

### Risk Matrix (Probability × Impact)

| Risk | Category | P | I | Score | Action |
|------|----------|---|---|-------|--------|
| submitQuiz rollback never tested | TECH | 2 | 3 | 6 | MITIGATE |
| Dexie error on submit never tested | TECH | 2 | 3 | 6 | MITIGATE |
| Cross-store integration untested | BUS | 2 | 2 | 4 | MONITOR |
| Timer restoration untested | BUS | 2 | 2 | 4 | MONITOR |
| Edge-case option counts untested | TECH | 1 | 2 | 2 | DOCUMENT |

**No BLOCK-level risks (score=9) identified.**

---

## Gate Criteria

| Criterion | Required | Actual | Status |
|-----------|----------|--------|--------|
| P0 coverage | 100% | 100% (7/7) | ✅ MET |
| P1 coverage (PASS target) | ≥90% | 86% (44/51) | ⚠️ NOT MET |
| P1 coverage (minimum) | ≥80% | 86% (44/51) | ✅ MET |
| Overall coverage | ≥80% | 83% (75/90) | ✅ MET |

---

## Recommendations

### URGENT — To reach PASS (P1 → 90%)

Need 3 more P1 items fully covered (44 → 46 of 51 = 90%):

1. **Add submitQuiz error handling test** — Cover both E12-S03-AC4c (rollback) and E12-S06-AC4 (error toast). Mock Dexie write failure, verify: (a) Zustand state rolls back, (b) error toast shown, (c) currentProgress preserved. _One test covers two gaps._

2. **Add timer restoration test** (E13-S03-AC4) — Start timed quiz, answer questions, navigate away, return, verify timer resumes from correct value (not reset, not counting paused time).

3. **Add cross-store integration test** (E12-S03-AC5) — Submit passing quiz, verify `useContentProgressStore` marks lesson as completed.

### HIGH — Error path coverage

4. **Add submitQuiz ordering guarantee test** (E12-S03-AC4b) — Verify Dexie write completes before cross-store updates fire.

### MEDIUM — P2 gap

5. **Add graceful degradation test** (E12-S05-AC5) — Render QuestionDisplay with 0, 1, and 7 options; verify it renders without crash and logs console warning.

### LOW — Maintenance

6. **Remove duplicate spec file** — `tests/e2e/story-e13-s02.spec.ts` is identical to the regression copy. Remove to avoid confusion.

7. **Run `/testarch-test-review`** — Assess overall test quality across Epics 12-13.

---

## Next Actions

| # | Action | Priority | Gaps Addressed | Effort |
|---|--------|----------|----------------|--------|
| 1 | Add submitQuiz error/rollback test | URGENT | AC4c, AC4(E12-S06) | ~1h |
| 2 | Add timer restoration E2E test | URGENT | AC4(E13-S03) | ~30m |
| 3 | Add cross-store integration test | URGENT | AC5(E12-S03) | ~30m |
| 4 | Add submitQuiz ordering test | HIGH | AC4b(E12-S03) | ~30m |
| 5 | Add graceful degradation unit test | MEDIUM | AC5(E12-S05) | ~15m |
| 6 | Remove duplicate spec file | LOW | Maintenance | ~5m |

**Completing actions 1-3 would raise P1 coverage from 86% → 92%, achieving PASS.**
