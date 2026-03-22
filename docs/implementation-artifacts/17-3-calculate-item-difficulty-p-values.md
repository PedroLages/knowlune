---
story_id: E17-S03
story_name: "Calculate Item Difficulty P Values"
status: done
started: 2026-03-22
completed: 2026-03-23
reviewed: true
review_started: 2026-03-23
review_gates_passed:
  - build
  - lint
  - typecheck
  - prettier
  - unit-tests
  - smoke-e2e
  - story-e2e
  - code-review
  - code-review-testing
  - design-review
burn_in_validated: false
---

# Story 17.3: Calculate Item Difficulty (P-Values)

## Story

As a learner,
I want to see which quiz questions are easiest and hardest based on my performance,
so that I can understand which concepts need more practice.

## Acceptance Criteria

**Given** I have completed a quiz multiple times
**When** viewing the quiz analytics
**Then** I see a list of questions ranked by difficulty (easiest to hardest)
**And** each question shows its P-value (proportion of attempts where I answered correctly)

**Given** a question's P-value is calculated
**When** I answered it correctly 3 out of 4 times
**Then** the P-value is 0.75 (75% - relatively easy for me)

**Given** the questions are categorized by difficulty
**When** viewing the list
**Then** I see difficulty labels:
  - P >= 0.8: "Easy"
  - 0.5 <= P < 0.8: "Medium"
  - P < 0.5: "Difficult"

**Given** a question has zero attempts (never encountered)
**When** calculating difficulty
**Then** the question is excluded from the analysis or shown as "Not enough data"

**Given** I view difficult questions (P < 0.5)
**When** the analytics display
**Then** I see suggestions: "Review questions 3, 7 on [topic] - you answer correctly only 40% of the time."

## Tasks / Subtasks

- [x] Task 1: Add `calculateItemDifficulty` to `src/lib/analytics.ts` (AC: 1, 2, 3, 4)
  - [x] 1.1 Define `ItemDifficulty` type: `{ questionId, questionText, pValue, difficulty, topic, order }`
  - [x] 1.2 Implement aggregation loop across all attempts and answers
  - [x] 1.3 Apply difficulty categorization (P >= 0.8 = Easy, 0.5 <= P < 0.8 = Medium, P < 0.5 = Difficult)
  - [x] 1.4 Exclude questions with zero attempts (filter nulls)
  - [x] 1.5 Sort results easiest-first (descending P-value)

- [x] Task 2: Write unit tests for `calculateItemDifficulty` (AC: 1, 2, 3, 4)
  - [x] 2.1 P-value calculation accuracy (3/4 = 0.75)
  - [x] 2.2 Difficulty categorization boundaries (P=0.8 is Easy, P=0.79 is Medium, P=0.5 is Medium, P=0.49 is Difficult)
  - [x] 2.3 Questions with zero attempts excluded
  - [x] 2.4 Sort order: easiest first (highest P-value first)
  - [x] 2.5 Empty attempts array returns empty result
  - [x] 2.6 Single attempt with all correct returns all Easy
  - [x] 2.7 Aggregation works across multiple attempts for same question

- [x] Task 3: Create `ItemDifficultyAnalysis.tsx` component (AC: 1, 3, 4, 5)
  - [x] 3.1 Accept `quiz: Quiz` and `attempts: QuizAttempt[]` props
  - [x] 3.2 Empty state: "Not enough data to analyze difficulty." when no questions qualify
  - [x] 3.3 Render question list with difficulty badge and P-value
  - [x] 3.4 Color-code badges: Easy=success, Medium=warning, Difficult=destructive
  - [x] 3.5 Suggestion text for difficult questions (P < 0.5): show topic and percentage
  - [x] 3.6 Truncate long question text with `truncate`

- [x] Task 4: Write component tests for `ItemDifficultyAnalysis` (AC: 1, 3, 4, 5)
  - [x] 4.1 Renders empty state when no attempts
  - [x] 4.2 Renders question list sorted easiest-first
  - [x] 4.3 Shows correct difficulty badge for each category
  - [x] 4.4 Suggestion text appears only for Difficult questions

- [x] Task 5: Integrate into `QuizResults.tsx` (AC: 1)
  - [x] 5.1 Import `ItemDifficultyAnalysis` component
  - [x] 5.2 Render after `ScoreTrajectoryChart` (only when 2+ attempts exist for meaningful analysis)
  - [x] 5.3 Pass `currentQuiz` and `attempts` as props

- [x] Task 6: Write E2E test (AC: 1, 3)
  - [x] 6.1 Seed quiz and 3 attempts with varied per-question performance
  - [x] 6.2 Navigate to `/courses/:courseId/lessons/:lessonId/quiz/results`
  - [x] 6.3 Assert "Question Difficulty Analysis" section visible
  - [x] 6.4 Assert difficulty labels (Easy/Medium/Difficult) visible

## Design Guidance

**Component location:** `src/app/components/quiz/ItemDifficultyAnalysis.tsx`

**Layout approach:**
- `<Card>` container with `<CardHeader>` + `<CardContent>` (matches other QuizResults sections)
- `<ul>` list inside CardContent with `space-y-2` between items
- Each item: `flex justify-between items-center` — question text left, badge right
- Question text: `text-sm truncate flex-1 mr-2` to handle long questions

**Badge color-coding:**
- Easy (P >= 0.8): `variant` maps to success/green — use `className="bg-success/10 text-success border-success/20"`
- Medium (0.5 <= P < 0.8): `className="bg-warning/10 text-warning border-warning/20"`
- Difficult (P < 0.5): `className="bg-destructive/10 text-destructive border-destructive/20"`

**Suggestion text:**
- Below the list, not inline per item
- Difficult questions grouped: "Review questions [N] on [topic] — you answer correctly only X% of the time."
- Use `text-sm text-muted-foreground mt-3`
- Match encouragement tone from AreasForGrowth component

**Integration in QuizResults.tsx:**
- Render after `<ScoreTrajectoryChart>` (line ~162)
- Only meaningful with 2+ attempts (same guard as trajectory chart, or always render — component handles empty state)

**Accessibility:**
- `<ul>` with `role="list"` not required (already semantic)
- Badge `aria-label` not needed — readable inline
- Question text truncation: ensure tooltip or `title` attr for full text on hover (optional, not blocking)

## Implementation Notes

**Implementation plan:** [e17-s03-item-difficulty-plan.md](plans/e17-s03-item-difficulty-plan.md)

**Key design decisions:**
- `calculateItemDifficulty` takes `(quiz: Quiz, attempts: QuizAttempt[])` — quiz provides `questionText` + `order`, attempts provide answer data. Mirrors `calculateImprovement` signature style.
- Output type includes `topic` and `order` for suggestion grouping
- Suggestion text groups by topic (falls back to "General" like `analyzeTopicPerformance`)
- Component always renders when called — empty state is the guard; caller in QuizResults decides when to show
- P-value as decimal (0.75), badge shows as percentage (75%) — matches psychometric convention
- Boundary: P=0.8 is "Easy" (inclusive), P=0.5 is "Medium" (inclusive), matches epics spec exactly

**Data flow:**
```
QuizResults.tsx
  → attempts (Dexie, already loaded)
  → currentQuiz (Zustand store)
  → <ItemDifficultyAnalysis quiz={currentQuiz} attempts={attempts} />
    → calculateItemDifficulty(quiz, attempts) [analytics.ts]
    → renders sorted list with badges
```

**Dependencies satisfied:**
- AttemptHistory component exists (E16-S02 done) — attempt data is already loaded in QuizResults
- Quiz type and QuizAttempt type are stable (E12-S01)
- analytics.ts pattern established (E15-S05, E16-S03, E16-S04)

## Testing Notes

**Unit test file:** `src/lib/__tests__/analytics.test.ts` (extend existing describe blocks)

**Component test file:** `src/app/components/quiz/__tests__/ItemDifficultyAnalysis.test.tsx`

**E2E test file:** `tests/e2e/regression/story-e17-s03.spec.ts`

**Key edge cases:**
- Boundary values: P exactly 0.8 → Easy; P exactly 0.5 → Medium; P 0.7999... → Medium; P 0.4999... → Difficult
- Questions across multiple attempts: same questionId aggregated across all answers in all attempts
- Mixed attempts where a question wasn't attempted in some (total only counts answers that exist)
- Single attempt: still shows analysis (1 answer = 1 data point, P = 0 or 1)

**E2E seeding:** Follow story-e16-s05 pattern — seed quizzes + attempts via IndexedDB helpers, inject Zustand store state via localStorage, navigate to `/quiz/results`

## Pre-Review Checklist

Before requesting `/review-story`, verify:

- [ ] All changes committed (`git status` clean)
- [ ] No error swallowing — catch blocks log AND surface errors
- [ ] useEffect hooks have cleanup functions (ignore flags for async, event listener removal)
- [ ] No optimistic UI updates before persistence — state updates after DB write succeeds
- [ ] Type guards on all dynamic lookups (e.g., `LABELS[type]` when type can be empty)
- [ ] E2E afterEach cleanup uses `await` (not fire-and-forget)
- [ ] Date handling uses `toLocaleDateString('sv-SE')` pattern (not `toISOString().split('T')[0]`)
- [ ] Read [engineering-patterns.md](../engineering-patterns.md) for full patterns reference
- [ ] If story calls external APIs: CSP allowlist configured (see engineering-patterns.md § CSP Configuration)

## Design Review Feedback

[Populated by /review-story — Playwright MCP findings]

## Code Review Feedback

[Populated by /review-story — adversarial code review findings]

## Web Design Guidelines Review

[Populated by /review-story — Web Interface Guidelines compliance findings]

## Dev Agent Record

### Completion Notes

Implementation complete 2026-03-23.

**What was implemented:**
- `calculateItemDifficulty(quiz, attempts)` pure function in `src/lib/analytics.ts` — aggregates P-values per question across all attempts, categorizes Easy/Medium/Difficult, sorts easiest-first
- `ItemDifficultyAnalysis` component in `src/app/components/quiz/ItemDifficultyAnalysis.tsx` — renders ranked list with color-coded difficulty badges and suggestion text grouped by topic
- Integration in `QuizResults.tsx` after `ScoreTrajectoryChart`
- 11 unit tests for the pure function (all boundary values covered)
- 9 component tests (all render paths covered)
- 4 E2E tests verifying AC1, AC3, AC5 in a live browser

**Key findings:**
- E2E selectors needed scoping to `[aria-label="Questions ranked by difficulty"]` to avoid collision with AreasForGrowth component which also renders question text and "Review questions" text
- Import paths for regression tests must use `../../support/fixtures` (not `../support/fixtures`) from `tests/e2e/regression/`
- Stale dev server must be killed before E2E runs when file changes aren't picked up by HMR

### File List

- `src/lib/analytics.ts` (modified — added `calculateItemDifficulty` + `ItemDifficulty` type)
- `src/lib/__tests__/analytics.test.ts` (modified — added 11 new unit tests)
- `src/app/components/quiz/ItemDifficultyAnalysis.tsx` (created)
- `src/app/components/quiz/__tests__/ItemDifficultyAnalysis.test.tsx` (created)
- `src/app/pages/QuizResults.tsx` (modified — import + render)
- `tests/e2e/regression/story-e17-s03.spec.ts` (created)

### Change Log

- 2026-03-23: Implemented E17-S03 — calculateItemDifficulty function, ItemDifficultyAnalysis component, QuizResults integration, full test coverage (unit + component + E2E)

## Challenges and Lessons Learned

- E2E strict mode violations occur when question text appears in multiple components on the same page (ItemDifficultyAnalysis + AreasForGrowth both show question text). Scope locators to a containing element with a unique aria-label.
- Stale dev server serving old QuizResults.tsx code caused E2E tests to fail on the first run. Kill port 5173 before E2E runs on modified pages.
- Import path for E2E support fixtures from `tests/e2e/regression/` is `../../support/fixtures`, NOT `../support/fixtures`.
