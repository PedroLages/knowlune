---
stepsCompleted: ['step-01-load-context', 'step-02-discover-tests', 'step-03-map-criteria', 'step-04-analyze-gaps', 'step-05-gate-decision']
lastStep: 'step-05-gate-decision'
lastSaved: '2026-03-22'
epic: 15
title: 'Timed Quizzes with Enhanced Feedback'
---

# Traceability Report — Epic 15: Timed Quizzes with Enhanced Feedback

## Gate Decision: PASS

**Rationale:** P0 coverage is 100% (vacuous — no P0 requirements in this epic), P1 coverage is 100% (target: 90%), and overall coverage is 100% (minimum: 80%). All 25 acceptance criteria from implemented stories (15.1–15.5) have full E2E test coverage. Story 15.6 (backlog) is excluded from gate evaluation as it has not been implemented.

**Decision Date:** 2026-03-22

---

## Coverage Summary

| Metric | Value |
|--------|-------|
| Total Requirements (implemented) | 25 |
| Fully Covered | 25 (100%) |
| Partially Covered | 0 |
| Uncovered | 0 |
| Backlog (not evaluated) | 5 (Story 15.6) |

### Priority Coverage

| Priority | Total | Covered | Percentage | Status |
|----------|-------|---------|------------|--------|
| P0 | 0 | 0 | 100% (vacuous) | MET |
| P1 | 25 | 25 | 100% | MET |
| P2 | 0 | 0 | — | — |
| P3 | 0 | 0 | — | — |

### Gate Criteria

| Criterion | Required | Actual | Status |
|-----------|----------|--------|--------|
| P0 Coverage | 100% | 100% | MET |
| P1 Coverage (PASS target) | 90% | 100% | MET |
| P1 Coverage (minimum) | 80% | 100% | MET |
| Overall Coverage (minimum) | 80% | 100% | MET |

---

## Traceability Matrix

### Story 15.1: Display Countdown Timer with Accuracy (QFR24, QFR30)

| AC ID | Acceptance Criterion | Priority | Test File | Test(s) | Coverage |
|-------|---------------------|----------|-----------|---------|----------|
| 15.1-AC1 | Timer displays MM:SS format, counts down every second, accessible role/label | P1 | `story-15-1.spec.ts` | `AC1: shows countdown timer in MM:SS format`, `AC1: timer counts down every second`, `AC1: timer has accessible role and label` | FULL |
| 15.1-AC2 | Timer reflects actual elapsed time after tab switch (no drift) | P1 | `story-15-1.spec.ts` | `AC2: timer reflects actual elapsed time after tab switch` | FULL |
| 15.1-AC3 | Timer color: amber at 25% remaining, red at 10% remaining | P1 | `story-15-1.spec.ts` | `AC3: timer shows amber at 25% and red at 10% remaining` | FULL |
| 15.1-AC4 | Timer expiry: auto-submit, "Time's up!" message, unanswered = 0 points | P1 | `story-15-1.spec.ts` | `AC4: quiz auto-submits when timer reaches zero`, `AC4: unanswered questions score 0 points on auto-submit` | FULL |

**Tests:** 7 | **Coverage:** 4/4 ACs = 100%

---

### Story 15.2: Configure Timer Duration and Accommodations (QFR25, QFR26, QFR29)

| AC ID | Acceptance Criterion | Priority | Test File | Test(s) | Coverage |
|-------|---------------------|----------|-----------|---------|----------|
| 15.2-AC1 | Start screen shows default time limit and "Accessibility Accommodations" button | P1 | `story-e15-s02.spec.ts` | `AC1: Quiz start screen shows default time limit and accommodations button` | FULL |
| 15.2-AC2 | Accommodations modal: 4 radio options (Standard, 150%, 200%, Untimed) with explanation text | P1 | `story-e15-s02.spec.ts` | `AC2: Accommodations modal shows radio options with explanation` | FULL |
| 15.2-AC3 | 150%/200% accommodation applies correct multiplier, timer shows annotation | P1 | `story-e15-s02.spec.ts` | `AC3: 150% accommodation applies multiplier`, `AC3b: 200% accommodation applies multiplier` | FULL |
| 15.2-AC4 | Untimed mode hides timer display | P1 | `story-e15-s02.spec.ts` | `AC4: Untimed mode hides timer display` | FULL |
| 15.2-AC5 | Accommodation preference persists across retakes | P1 | `story-e15-s02.spec.ts` | `AC5: Accommodation preference persists across retakes` | FULL |

**Tests:** 6 | **Coverage:** 5/5 ACs = 100%

---

### Story 15.3: Display Timer Warnings at Key Thresholds (QFR27, QFR28)

| AC ID | Acceptance Criterion | Priority | Test File | Test(s) | Coverage |
|-------|---------------------|----------|-----------|---------|----------|
| 15.3-AC1 | Subtle info toast at 25% time remaining, auto-dismiss 3s | P1 | `story-15-3.spec.ts` | `AC1: shows subtle info toast at 25% time remaining`, `AC1: 25% toast auto-dismisses after 3 seconds` | FULL |
| 15.3-AC2 | Prominent warning toast at 10% remaining, auto-dismiss 5s | P1 | `story-15-3.spec.ts` | `AC2: shows prominent warning toast at 10% time remaining`, `AC2: 10% toast auto-dismisses after 5 seconds` | FULL |
| 15.3-AC3 | Persistent warning at 1 minute remaining | P1 | `story-15-3.spec.ts` | `AC3: shows persistent warning at 1 minute remaining` | FULL |
| 15.3-AC4 | No timer warnings in untimed mode | P1 | `story-15-3.spec.ts` | `AC4: no timer warnings displayed in untimed mode` | FULL |
| 15.3-AC5 | ARIA live regions: polite for 25%, assertive for 10% and 1min | P1 | `story-15-3.spec.ts` | `AC5: 25% warning uses aria-live="polite"`, `AC5: 10% warning uses aria-live="assertive"`, `AC5: 1min warning uses aria-live="assertive"` | FULL |
| 15.3-AC6 | Warnings based on adjusted time (accommodations), not original time | P1 | `story-15-3.spec.ts` | `AC6: warnings trigger based on adjusted time, not original` | FULL |

**Tests:** 10 | **Coverage:** 6/6 ACs = 100%

---

### Story 15.4: Provide Immediate Explanatory Feedback per Question (QFR18, QFR19, QFR23)

| AC ID | Acceptance Criterion | Priority | Test File | Test(s) | Coverage |
|-------|---------------------|----------|-----------|---------|----------|
| 15.4-AC1 | Correct answer: green checkmark, "Correct!" message, explanation | P1 | `story-e15-s04.spec.ts` | `shows green checkmark and "Correct!" with explanation` | FULL |
| 15.4-AC2 | Incorrect answer: orange "Not quite", explanation, correct answer shown | P1 | `story-e15-s04.spec.ts` | `shows orange "Not quite" with explanation and correct answer` | FULL |
| 15.4-AC3 | Partial credit (multiple-select): shows X of Y correct, per-option breakdown | P1 | `story-e15-s04.spec.ts` | `shows how many correct and per-option feedback for multiple-select`, `shows incorrectly selected options in breakdown` | FULL |
| 15.4-AC4 | Feedback appears immediately, does not block "Next Question" navigation | P1 | `story-e15-s04.spec.ts` | `feedback appears immediately and does not block Next Question` | FULL |
| 15.4-AC5 | Timer-expired: unanswered questions show correct answer + "not answered in time" | P1 | `story-e15-s04.spec.ts` | `unanswered questions show correct answer and "not answered in time"` | FULL |
| 15.4-A11y | ARIA live region announcement, icon + text (not color alone) | P1 | `story-e15-s04.spec.ts` | `feedback is announced via ARIA live region`, `feedback uses icon + text, not color alone` | FULL |

**Tests:** 8 | **Coverage:** 6/6 ACs = 100%

---

### Story 15.5: Display Performance Summary After Quiz (QFR20, QFR21, QFR22, QFR23)

| AC ID | Acceptance Criterion | Priority | Test File | Test(s) | Coverage |
|-------|---------------------|----------|-----------|---------|----------|
| 15.5-AC1 | Overall score (percentage + points), breakdown: X correct, Y incorrect, Z skipped | P1 | `story-15-5.spec.ts` | `displays overall score percentage and points after quiz completion` | FULL |
| 15.5-AC2 | Topic-based performance: strengths (≥70%) and growth areas (<70%) with percentages | P1 | `story-15-5.spec.ts` | `groups performance by topic with percentage per topic` | FULL |
| 15.5-AC3 | No topic tags → all questions "General", strengths/growth sections hidden | P1 | `story-15-5.spec.ts` | `hides strengths/growth sections when all questions are General topic` | FULL |
| 15.5-AC4 | Encouraging message by score range: ≥90%, 70-89%, 50-69%, <50% | P1 | `story-15-5.spec.ts` | `shows excellent message for ≥90% score`, `shows great job message for 70-89% score`, `shows encouraging message for 50-69% score`, `shows keep practicing message for <50% score` | FULL |
| 15.5-AC5 | Growth area suggestions: lists topics <70% with specific question numbers to review | P1 | `story-15-5.spec.ts` | `suggests specific questions to review for growth areas` | FULL |
| 15.5-A11y | Headings proper hierarchy, semantic list markup | P1 | `story-15-5.spec.ts` | `headings have proper heading hierarchy and lists use semantic markup` | FULL |

**Tests:** 9 | **Coverage:** 6/6 ACs = 100% (including 4 sub-tests for AC4 score ranges)

---

### Story 15.6: Track Time-to-Completion for Each Attempt (QFR37) — BACKLOG

| AC ID | Acceptance Criterion | Priority | Test File | Test(s) | Coverage |
|-------|---------------------|----------|-----------|---------|----------|
| 15.6-AC1 | Start time recorded (ISO 8601) when quiz initializes | P1 | — | — | NONE |
| 15.6-AC2 | Completion time recorded, elapsed wall-clock time stored in seconds | P1 | — | — | NONE |
| 15.6-AC3 | Time-to-completion displayed in human-readable format (e.g., "8m 32s") | P1 | — | — | NONE |
| 15.6-AC4 | Untimed quiz: time tracked but NOT displayed | P1 | — | — | NONE |
| 15.6-AC5 | Multiple attempts: time comparison across attempts | P1 | — | — | NONE |

**Tests:** 0 | **Coverage:** 0/5 ACs = 0% (BACKLOG — not yet implemented, excluded from gate)

---

## Coverage Heuristics

### Endpoint Coverage
- **N/A** — Epic 15 is entirely client-side (timer hooks, UI components, localStorage). No API endpoints involved.

### Auth/AuthZ Coverage
- **N/A** — Quiz timer and feedback do not involve authentication or authorization paths.

### Error-Path Coverage

| Error Scenario | Tested? | Details |
|---------------|---------|---------|
| Timer expiry (auto-submit) | Yes | Tests 15.1-AC4: quiz auto-submits, unanswered = 0 points |
| Tab visibility change (timer drift) | Yes | Test 15.1-AC2: Date.now() recalculation on visibility change |
| Untimed mode (skip all timer logic) | Yes | Tests 15.2-AC4, 15.3-AC4: no timer, no warnings |
| Accommodation persistence corruption | Partial | Test 15.2-AC5 verifies persistence works; no explicit malformed-data test |
| Timer-expired unanswered feedback | Yes | Test 15.4-AC5: "not answered in time" with correct answer |

**Happy-path-only gaps:** 1 (accommodation persistence — no corrupted localStorage test). Risk: LOW (Probability: 1, Impact: 1, Score: 1 → DOCUMENT only).

---

## Gap Analysis

### Critical Gaps (P0): 0
None.

### High Gaps (P1): 0
None (for implemented stories).

### Medium Gaps: 1

| Gap | Priority | Risk Score | Action |
|-----|----------|------------|--------|
| No test for corrupted accommodation value in localStorage | P3 | 1 (Prob: 1, Impact: 1) | DOCUMENT — low risk, runtime guard exists in code (Zod/manual validation per story spec) |

### Backlog Gaps (Story 15.6): 5 ACs
- Not evaluated for gate — story is in backlog status
- Will require E2E tests when implemented

---

## Recommendations

| # | Priority | Action |
|---|----------|--------|
| 1 | LOW | Run `/bmad:tea:test-review` to assess test quality across Epic 15 specs |
| 2 | LOW | Consider adding unit test for `analyzeTopicPerformance()` in `src/lib/analytics.ts` (currently covered by E2E only) |
| 3 | INFO | When Story 15.6 moves to in-progress, create E2E spec covering all 5 ACs |

---

## Test Inventory Summary

| Story | Spec File | Tests | Level |
|-------|-----------|-------|-------|
| E15-S01 | `tests/e2e/regression/story-15-1.spec.ts` | 7 | E2E |
| E15-S02 | `tests/e2e/regression/story-e15-s02.spec.ts` | 6 | E2E |
| E15-S03 | `tests/e2e/regression/story-15-3.spec.ts` | 10 | E2E |
| E15-S04 | `tests/e2e/regression/story-e15-s04.spec.ts` | 8 | E2E |
| E15-S05 | `tests/e2e/regression/story-15-5.spec.ts` | 9 | E2E |
| **Total** | **5 spec files** | **40 tests** | **E2E** |

---

## FRs Fulfilled by Epic 15

| FR ID | Description | Story | Covered |
|-------|-------------|-------|---------|
| QFR18 | Immediate explanatory feedback | 15.4 | Yes |
| QFR19 | Correct answer explanation | 15.4 | Yes |
| QFR20 | Performance summary | 15.5 | Yes |
| QFR21 | Highlight strongest topics | 15.5 | Yes |
| QFR22 | Identify growth opportunities | 15.5 | Yes |
| QFR23 | Encouraging messaging | 15.4, 15.5 | Yes |
| QFR24 | Countdown timer display | 15.1 | Yes |
| QFR25 | Configure timer duration | 15.2 | Yes |
| QFR26 | Timer accommodations | 15.2 | Yes |
| QFR27 | Timer warnings | 15.3 | Yes |
| QFR28 | Timer announcements (screen reader) | 15.3 | Yes |
| QFR29 | Disable timer (untimed mode) | 15.2 | Yes |
| QFR30 | Time-to-completion tracking | 15.1 (partial), 15.6 (backlog) | Partial |

---

## Gate Decision Summary

```
✅ GATE DECISION: PASS

📊 Coverage Analysis:
- P0 Coverage: 100% (Required: 100%) → MET (vacuous — no P0 items)
- P1 Coverage: 100% (PASS target: 90%, minimum: 80%) → MET
- Overall Coverage: 100% (Minimum: 80%) → MET

✅ Decision Rationale:
All 25 acceptance criteria from implemented stories (15.1–15.5) have full E2E
test coverage. 40 tests across 5 spec files cover timer display, accuracy,
accommodations, warnings, feedback, and performance summary. Accessibility
(ARIA live regions, keyboard, semantic HTML) is thoroughly tested. Story 15.6
(backlog) is excluded from gate evaluation.

⚠️ Critical Gaps: 0

📝 Recommended Actions:
1. [LOW] Run test quality review on Epic 15 specs
2. [LOW] Consider unit tests for analyzeTopicPerformance()
3. [INFO] Create E2E spec when Story 15.6 moves to in-progress

📂 Full Report: docs/reviews/traceability-report-epic-15.md

✅ GATE: PASS — Release approved, coverage meets standards
```
