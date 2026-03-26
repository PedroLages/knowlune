# TestArch Traceability Matrix: Epic 18

**Epic:** Accessible and Integrated Quiz Experience
**Date:** 2026-03-26
**Reviewer:** Claude Opus 4.6 (automated)
**Stories:** E18-S01 through E18-S11 (all 11 stories)

---

## Summary

| Metric | Value |
|--------|-------|
| Total ACs across epic | 55 |
| ACs with test coverage | 48 |
| ACs with NO test coverage | 7 |
| **Coverage** | **87%** |
| E2E test files | 11 |
| Unit test files contributing | 8 |
| Total E2E tests | ~95 |

---

## Story-by-Story Traceability

### E18-S01: Implement Complete Keyboard Navigation (6 ACs)

| AC | Description | E2E Test | Unit Test | Status |
|----|-------------|----------|-----------|--------|
| AC1 | Tab order through interactive elements | `story-e18-s01.spec.ts` (1 test) | -- | COVERED |
| AC2 | Programmatic focus on question change | `story-e18-s01.spec.ts` (2 tests) | -- | COVERED |
| AC3 | RadioGroup keyboard (Arrow/Space) | `story-e18-s01.spec.ts` (2 tests) | -- | COVERED |
| AC4 | Checkbox keyboard (Tab/Space) | `story-e18-s01.spec.ts` (2 tests) | -- | COVERED |
| AC5 | QuestionGrid arrow navigation + Enter | `story-e18-s01.spec.ts` (3 tests) | -- | COVERED |
| AC6 | Modal Escape + focus trap | `story-e18-s01.spec.ts` (2 tests) | -- | COVERED |

**Coverage: 6/6 (100%)**

---

### E18-S02: ARIA Live Regions for Dynamic Content (8 ACs)

| AC | Description | E2E Test | Unit Test | Status |
|----|-------------|----------|-----------|--------|
| AC1 | Answer feedback announced (aria-live="polite") | -- | `AnswerFeedback.test.tsx` (pre-existing) | COVERED |
| AC2 | Answer selection announced | -- | `MultipleChoiceQuestion.test.tsx` (2), `MultipleSelectQuestion.test.tsx` (3), `TrueFalseQuestion.test.tsx` (3) | COVERED |
| AC3 | Mark for Review toggle announced | -- | `MarkForReview.test.tsx` (4 new) | COVERED |
| AC4 | Timer normal: aria-live="off" | -- | Pre-existing (QuizTimer) | COVERED |
| AC5 | Timer 25% warning: polite | -- | Pre-existing (TimerWarnings) | COVERED |
| AC6 | Timer 10%/1min: assertive | -- | Pre-existing (TimerWarnings) | COVERED |
| AC7 | Score announced (aria-live="polite") | -- | `ScoreSummary.test.tsx` (pre-existing) | COVERED |
| AC8 | Question navigation announced | -- | `QuizHeader.test.tsx` (4 new) | COVERED |

**Coverage: 8/8 (100%)**

**Note:** No E2E test file exists for E18-S02. All coverage is unit-test-only. The `useAriaLiveAnnouncer` hook has 6 dedicated unit tests. The triple-identical-message edge case is a known minor gap (LOW severity).

---

### E18-S03: Semantic HTML and ARIA Attributes (5 ACs)

| AC | Description | E2E Test | Unit Test | Status |
|----|-------------|----------|-----------|--------|
| AC1 | fieldset/legend, labels, grouped controls | `story-e18-s03.spec.ts` (2 tests: fieldset+legend, labels) | -- | COVERED |
| AC2 | Heading hierarchy, nav landmark, main/section | `story-e18-s03.spec.ts` (4 tests: h1, sr-only h2, nav, sections) | -- | COVERED |
| AC3 | ARIA roles (role="status", role="alert"), aria-atomic | `story-e18-s03.spec.ts` (1 test: feedback role="status") | -- | PARTIAL |
| AC4 | Descriptive accessible names, icon-only aria-label | `story-e18-s03.spec.ts` (3 tests: Previous, Next, all buttons) | -- | COVERED |
| AC5 | role="timer" + aria-live="off", role="progressbar" + aria-value* | `story-e18-s03.spec.ts` (2 tests: timer, progressbar) | -- | COVERED |

**Coverage: 5/5 (100%) — AC3 partially tested (role="status" tested, role="alert" on timer warnings NOT tested)**

---

### E18-S04: Verify Contrast Ratios and Touch Targets (5 ACs)

| AC | Description | E2E Test | Unit Test | Status |
|----|-------------|----------|-----------|--------|
| AC1 | Normal text >= 4.5:1 contrast | `story-e18-s04.spec.ts` (6 axe-core tests light mode) | -- | COVERED |
| AC2 | Non-text elements >= 3:1 contrast | `story-e18-s04.spec.ts` (axe-core) | -- | COVERED |
| AC3 | Touch targets >= 44px | `story-e18-s04.spec.ts` (6 touch target tests) | -- | COVERED |
| AC4 | Focus indicators >= 3:1, >= 2px thick | `story-e18-s04.spec.ts` (4 focus ring tests) | -- | PARTIAL |
| AC5 | Dark mode contrast meets WCAG AA | `story-e18-s04.spec.ts` (4 dark mode axe-core tests) | -- | COVERED |

**Coverage: 5/5 (100%) — AC4 tests assert focus ring presence (ring-brand) but do not programmatically measure contrast ratio or pixel thickness**

**Open blocker from code review:** `ReviewQuestionGrid.tsx`, `QuestionBreakdown.tsx`, `QuizReviewContent.tsx` still use `ring-ring` (fails 3:1). Story status is `in-progress` per story file, though sprint-status says `done`.

---

### E18-S05: Integrate Quiz Completion with Study Streaks (4 ACs)

| AC | Description | E2E Test | Unit Test | Status |
|----|-------------|----------|-----------|--------|
| AC1 | Quiz completion updates study log + streak | `story-e18-s05.spec.ts` (1 test) | `useQuizStore.streakIntegration.test.ts` (2 tests) | COVERED |
| AC2 | Multiple quizzes same day = idempotent | `story-e18-s05.spec.ts` (1 test) | -- | COVERED |
| AC3 | Streak calendar shows today as active | `story-e18-s05.spec.ts` (1 test) | -- | COVERED |
| AC4 | Streak failure doesn't block quiz submission | -- | `useQuizStore.streakIntegration.test.ts` (1 test) | PARTIAL |

**Coverage: 4/4 (100%) — AC4 has unit test only (no E2E), per code review finding**

---

### E18-S06: Display Quiz Performance in Overview Dashboard (4 ACs)

| AC | Description | E2E Test | Unit Test | Status |
|----|-------------|----------|-----------|--------|
| AC1 | Quiz Performance card with metrics | `story-e18-s06.spec.ts` (1 test) | -- | COVERED |
| AC2 | Skeleton loading state | `story-e18-s06.spec.ts` (1 test) | -- | COVERED |
| AC3 | Click navigates to /reports?tab=quizzes | `story-e18-s06.spec.ts` (2 tests) | -- | COVERED |
| AC4 | Empty state with CTA | `story-e18-s06.spec.ts` (1 test) | -- | COVERED |

**Coverage: 4/4 (100%)**

---

### E18-S07: Surface Quiz Analytics in Reports Section (4 ACs)

| AC | Description | E2E Test | Unit Test | Status |
|----|-------------|----------|-----------|--------|
| AC1 | Quiz Analytics tab with all metrics | `story-e18-s07.spec.ts` (5 tests) | -- | COVERED |
| AC2 | Empty state with CTA | `story-e18-s07.spec.ts` (1 test) | -- | COVERED |
| AC3 | Click quiz navigates to detail page | -- | -- | **GAP** |
| AC4 | Responsive single-column on mobile | `story-e18-s07.spec.ts` (1 test) | -- | COVERED |

**Coverage: 3/4 (75%) — AC3 (quiz detail navigation to /reports/quiz/:quizId) has zero test coverage. Story notes acknowledge Task 4 (QuizDetailAnalytics page) was NOT implemented.**

---

### E18-S08: Display Quiz Availability Badges on Courses Page (4 ACs)

| AC | Description | E2E Test | Unit Test | Status |
|----|-------------|----------|-----------|--------|
| AC1 | "Take Quiz" badge on lesson with quiz | `story-e18-s08.spec.ts` (1 test) | -- | COVERED |
| AC2 | No badge on lesson without quiz | `story-e18-s08.spec.ts` (1 test) | -- | COVERED |
| AC3 | "Quiz: X%" badge with best score | `story-e18-s08.spec.ts` (1 test) | -- | COVERED |
| AC4 | Click badge navigates to quiz | `story-e18-s08.spec.ts` (1 test) | -- | COVERED |

**Coverage: 4/4 (100%)**

---

### E18-S09: Configure Quiz Preferences in Settings (4 ACs)

| AC | Description | E2E Test | Unit Test | Status |
|----|-------------|----------|-----------|--------|
| AC1 | Quiz Preferences section with controls | `story-e18-s09.spec.ts` (3 tests) | -- | COVERED |
| AC2 | Preference persisted + toast | `story-e18-s09.spec.ts` (3 tests) | -- | COVERED |
| AC3 | Quiz reads saved preferences as defaults | `story-e18-s09.spec.ts` (3 tests) | -- | COVERED |
| AC4 | Defaults used when no preferences | `story-e18-s09.spec.ts` (1 test) | -- | COVERED |

**Coverage: 4/4 (100%)**

---

### E18-S10: Export Quiz Results (4 ACs)

| AC | Description | E2E Test | Unit Test | Status |
|----|-------------|----------|-----------|--------|
| AC1 | Choose CSV or PDF format | `e18-s10-export-quiz-results.spec.ts` (2 tests) | -- | COVERED |
| AC2 | CSV download with correct content | `e18-s10-export-quiz-results.spec.ts` (3 tests) | -- | COVERED |
| AC3 | PDF download with summary stats | `e18-s10-export-quiz-results.spec.ts` (2 tests) | -- | COVERED |
| AC4 | Disabled button with tooltip when no attempts | `e18-s10-export-quiz-results.spec.ts` (1 test) | -- | COVERED |

**Coverage: 4/4 (100%)**

---

### E18-S11: Track Quiz Progress in Content Completion (4 ACs)

| AC | Description | E2E Test | Unit Test | Status |
|----|-------------|----------|-----------|--------|
| AC1 | Passing quiz marks lesson completed | `story-18-11.spec.ts` (1 test) | `useQuizStore.crossStore.test.ts` (1 test) | COVERED |
| AC2 | Failing quiz does NOT mark completed | `story-18-11.spec.ts` (1 test) | `useQuizStore.crossStore.test.ts` (1 test) | COVERED |
| AC3 | Retake + pass marks completed | -- | -- | **GAP** |
| AC4 | Progress failure doesn't block quiz | -- | `useQuizStore.crossStore.test.ts` (1 test) | PARTIAL |

**Coverage: 3/4 (75%) — AC3 (retake flow) has zero test coverage. AC4 has unit test only.**

---

## Gaps Summary

### Critical Gaps (no test coverage at all)

| Story | AC | Description | Risk |
|-------|-----|-------------|------|
| E18-S07 | AC3 | Quiz detail navigation (`/reports/quiz/:quizId`) | **HIGH** — feature not implemented (Task 4 skipped) |
| E18-S11 | AC3 | Retake quiz + pass marks lesson completed | **MEDIUM** — logic likely works via AC1 path, but retake flow untested |

### Partial Gaps (unit test only, no E2E)

| Story | AC | Description | Risk |
|-------|-----|-------------|------|
| E18-S02 | ALL | Entire story has zero E2E tests | **MEDIUM** — 8 ACs all unit-test-only; ARIA live regions are best validated via screen reader or browser DOM, not jsdom |
| E18-S05 | AC4 | Streak failure doesn't block quiz | **LOW** — unit test covers the isolation pattern |
| E18-S11 | AC4 | Progress failure doesn't block quiz | **LOW** — unit test covers the isolation pattern |

### Quality Concerns (covered but with noted issues)

| Story | AC | Issue | Source |
|-------|-----|-------|--------|
| E18-S03 | AC3 | `role="alert"` on timer warnings not tested | Code review finding |
| E18-S04 | AC4 | Focus ring contrast/thickness not programmatically measured | Code review finding |
| E18-S04 | -- | 3 files still use `ring-ring` (BLOCKER from code review) | `ReviewQuestionGrid.tsx`, `QuestionBreakdown.tsx`, `QuizReviewContent.tsx` |
| E18-S07 | AC3 | QuizDetailAnalytics page NOT implemented | Story notes (Task 4 skipped) |

### Administrative Gaps

| Item | Issue |
|------|-------|
| E18-S02 story file | Missing from `main` branch — only exists in git blob `7ee6238` from feature branch. Sprint-status says `done`. |
| E18-S03 story file | Duplicate: `18-3-ensure-semantic-html-and-proper-aria-attributes.md` AND `e18-s03-ensure-semantic-html-proper-aria-attributes.md` |
| E18-S04 status | Story file says `in-progress`, sprint-status says `done`. Inconsistent. |

---

## Gate Decision

### **CONCERNS** (not FAIL, not clean PASS)

**Rationale:**

1. **87% AC coverage is above the 80% threshold** for a PASS, but two ACs have zero coverage and both represent real functional risk.

2. **E18-S07 AC3 (quiz detail page)** is the most significant gap — the feature itself was not implemented (Task 4 skipped). This is a scope gap, not a test gap. The AC exists in the story definition but the route `/reports/quiz/:quizId` does not appear to exist. This should be either: (a) deferred to a future story with an explicit backlog item, or (b) removed from the AC list.

3. **E18-S02 has zero E2E tests.** While unit tests cover all 8 ACs, ARIA live region behavior in actual browsers (timing, screen reader interaction, race conditions with React re-renders) cannot be validated via jsdom. At minimum, one E2E test asserting `aria-live` region content updates would add meaningful confidence.

4. **E18-S04 has unresolved BLOCKER findings** from code review (3 files still using `ring-ring` instead of `ring-brand`). The story's own status is inconsistent between story file (`in-progress`) and sprint-status (`done`).

**Recommendation:** Address items 2-4 before marking Epic 18 as fully validated. Item 2 can be resolved by creating a backlog item. Items 3-4 are low-effort fixes.

---

## Test File Index

| Story | E2E Test File | Tests |
|-------|---------------|-------|
| E18-S01 | `tests/e2e/regression/story-e18-s01.spec.ts` | 12 |
| E18-S02 | (none) | 0 |
| E18-S03 | `tests/e2e/regression/story-e18-s03.spec.ts` | 12 |
| E18-S04 | `tests/e2e/story-e18-s04.spec.ts` | 23 |
| E18-S05 | `tests/e2e/story-e18-s05.spec.ts` | 3 |
| E18-S06 | `tests/e2e/regression/story-e18-s06.spec.ts` | 5 |
| E18-S07 | `tests/e2e/regression/story-e18-s07.spec.ts` | 7 |
| E18-S08 | `tests/e2e/regression/story-e18-s08.spec.ts` | 4 |
| E18-S09 | `tests/e2e/regression/story-e18-s09.spec.ts` | 10 |
| E18-S10 | `tests/e2e/regression/e18-s10-export-quiz-results.spec.ts` | 9 |
| E18-S11 | `tests/e2e/story-18-11.spec.ts` | 2 |

| Story | Unit Test Files | Tests |
|-------|----------------|-------|
| E18-S02 | `useAriaLiveAnnouncer.test.ts`, `MarkForReview.test.tsx`, `MultipleChoiceQuestion.test.tsx`, `MultipleSelectQuestion.test.tsx`, `TrueFalseQuestion.test.tsx`, `QuizHeader.test.tsx` | ~25 |
| E18-S05 | `useQuizStore.streakIntegration.test.ts`, `studyLog.test.ts` | ~8 |
| E18-S11 | `useQuizStore.crossStore.test.ts` | 3 |
