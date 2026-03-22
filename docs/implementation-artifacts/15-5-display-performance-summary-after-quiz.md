---
story_id: E15-S05
story_name: "Display Performance Summary After Quiz"
status: in-progress
started: 2026-03-22
completed:
reviewed: true
review_started: 2026-03-22
review_gates_passed: [build, lint, type-check, format-check, unit-tests, e2e-tests, design-review, code-review, code-review-testing, web-design-guidelines]
burn_in_validated: false
---

# Story 15.5: Display Performance Summary After Quiz

## Story

As a learner,
I want to see a detailed performance summary after completing a quiz,
So that I understand my strengths and areas for improvement.

## Acceptance Criteria

**Given** I complete a quiz
**When** I view the results screen
**Then** I see my overall score prominently (percentage and points)
**And** I see a breakdown of questions by correctness: "10 correct, 2 incorrect, 0 skipped"
**And** I see my strongest topic areas highlighted (e.g., "Arrays & Loops: 100%")
**And** I see growth opportunity topics highlighted (e.g., "Functions: 50%")

**Given** the performance summary identifies topics
**When** questions are tagged with topics (e.g., "arrays", "functions", "objects")
**Then** the summary groups my performance by topic
**And** shows percentage correct per topic
**And** ranks topics from strongest to weakest

**Given** questions have no topic tags
**When** viewing the performance summary
**Then** all questions are grouped under a "General" topic
**And** the strengths/growth areas section is hidden (single-topic breakdown is not useful)

**Given** I want to understand my performance
**When** viewing the summary
**Then** I see an encouraging message based on my score:
  - ≥90%: "Excellent work! You've mastered this material."
  - 70-89%: "Great job! You're on the right track."
  - 50-69%: "Good effort! Review the growth areas below."
  - <50%: "Keep practicing! Focus on the topics below."

**Given** the summary displays growth areas
**When** I see "Growth Opportunities"
**Then** it lists 1-3 specific topics where I scored <70%
**And** it suggests actions: "Review questions 3, 7, 11 on Functions"

## Tasks / Subtasks

- [ ] Task 1: Add `topic?: string` field to Question type (coordinate with Epic 12.1)
- [ ] Task 2: Create `src/lib/analytics.ts` with `analyzeTopicPerformance()` function
  - [ ] 2.1 Group questions by topic (fallback to "General")
  - [ ] 2.2 Calculate percentage correct per topic
  - [ ] 2.3 Categorize into strengths (≥70%) and growth areas (<70%)
  - [ ] 2.4 Track incorrect question numbers for growth area suggestions
- [ ] Task 3: Create `src/app/components/quiz/PerformanceInsights.tsx`
  - [ ] 3.1 Overall score display (percentage and points)
  - [ ] 3.2 Question correctness breakdown
  - [ ] 3.3 Encouraging message based on score range
  - [ ] 3.4 Strengths section with topic list and icons
  - [ ] 3.5 Growth Opportunities section with question references
  - [ ] 3.6 Hide strengths/growth sections when all questions are "General" topic
- [ ] Task 4: Integrate PerformanceInsights into QuizResults page
- [ ] Task 5: Write unit tests for analyzeTopicPerformance
- [ ] Task 6: Write E2E tests for performance summary display
- [ ] Task 7: Accessibility audit (heading hierarchy, list semantics, color not sole indicator)

## Design Guidance

### Layout Strategy

The PerformanceInsights component slots into the existing QuizResults page **between** the `QuestionBreakdown` and `AreasForGrowth` components. It provides a topic-level aggregation view.

**Page flow after integration:**
1. `ScoreSummary` — score ring, percentage, tier message, encouraging text (already exists)
2. `QuestionBreakdown` — collapsible per-question detail (already exists)
3. **`PerformanceInsights`** — NEW: topic-based strengths + growth areas (this story)
4. `AreasForGrowth` — per-question incorrect items (already exists)
5. Action buttons (Retake, Review, Back to Lesson)

### Component Structure

```
<PerformanceInsights>
  ├── Correctness Summary Bar (e.g., "3 correct · 2 incorrect · 0 skipped")
  ├── <section> "Your Strengths" (conditional — hidden when single "General" topic)
  │   └── <ul> topic items with CheckCircle2 icon + percentage
  └── <section> "Growth Opportunities" (conditional — hidden when single "General" topic)
      └── <ul> topic items with percentage + "Review questions X, Y" suggestion
```

### Design Tokens & Styling

| Element | Token | Notes |
|---------|-------|-------|
| Strengths heading icon | `text-success` | CheckCircle2 from lucide-react |
| Strengths topic text | `text-foreground` | Standard text, not colored |
| Strengths percentage | `text-success` | Green to reinforce positive |
| Growth heading icon | `text-warning` | AlertTriangle or TrendingUp from lucide |
| Growth topic text | `text-foreground` | Standard text |
| Growth percentage | `text-warning` | Amber to signal attention needed |
| Question references | `text-muted-foreground text-sm` | Subdued helper text |
| Section container | `bg-muted rounded-xl p-5 sm:p-6` | Matches AreasForGrowth card style |
| Correctness summary | `text-muted-foreground text-sm` | Inline with dots separator |

### Consistency with Existing Components

Follow the established patterns from sibling quiz result components:
- **Card style**: `bg-muted rounded-xl p-5 sm:p-6 space-y-4` (from AreasForGrowth)
- **Heading pattern**: Icon + h2/h3 in `flex items-center gap-2` (from AreasForGrowth)
- **List items**: `space-y-2` or `space-y-3` with proper list semantics
- **Touch targets**: `min-h-[44px]` on any interactive elements
- **Section wrapping**: `<section aria-labelledby={headingId}>` with `useId()` for accessible labels

### Responsive Behavior

- **Mobile (< 640px)**: Stack everything vertically. Full-width sections. `p-4` padding.
- **Tablet/Desktop (≥ 640px)**: Consider side-by-side Strengths/Growth at `sm:grid sm:grid-cols-2 sm:gap-4` if both sections are present. Otherwise single column.
- **Correctness bar**: Always single line — use `flex gap-2` with middot separators.

### Conditional Rendering Logic

- **All questions tagged with topics**: Show both Strengths and Growth Opportunities sections.
- **All questions "General" (no topic tags)**: Hide the entire PerformanceInsights component except the correctness summary bar (single-topic breakdown is not useful per AC3).
- **Topics exist but no growth areas**: Show Strengths only, Growth section hidden.
- **Topics exist but no strengths**: Show Growth only, Strengths section hidden.

### Accessibility Requirements

- `h3` for section headings (under `h1` page title and `h2` QuestionBreakdown)
- `<ul>` with `<li>` for topic lists (not divs)
- Icons are `aria-hidden="true"` — text conveys all information
- Color is never the sole indicator: icons (CheckCircle2, AlertTriangle) + text labels + percentage values
- `aria-labelledby` on each `<section>` linking to the heading

### Encouraging Messages

Already implemented in `ScoreSummary.getScoreTier()` — do NOT duplicate. The four tiers map to:
- ≥90%: "Outstanding! You've mastered this material." (EXCELLENT tier, `text-success`)
- 70-89% (passed): "Great job! You're on the right track." (PASSED tier, `text-brand`)
- 50-69%: "Good effort! Review the growth areas below." (NEEDS REVIEW tier, `text-warning`)
- <50%: "Keep practicing! Focus on the topics below." (NEEDS WORK tier, `text-destructive`)

These messages already reference "growth areas below" and "topics below" — PerformanceInsights naturally fulfills that promise.

## Implementation Plan

See [plan](plans/e15-s05-performance-summary.md) for implementation approach.

## Implementation Notes

- **Analytics module** (`src/lib/analytics.ts`): Pure function `analyzeTopicPerformance()` with no side effects — takes questions and answers, returns categorized topic performance. Threshold for "strength" is ≥70%, below is "growth area".
- **Component architecture**: `PerformanceInsights` is a presentational component that receives pre-computed analytics data. Conditional rendering hides topic sections when all questions fall under "General" (no topic tags).
- **Type extension**: Added optional `topic?: string` field to `Question` type — backward-compatible with existing quiz data.
- **No new dependencies**: Uses existing lucide-react icons (CheckCircle2, TrendingUp) and design tokens.

## Testing Notes

- **Unit tests** (241 lines): 14 tests covering `analyzeTopicPerformance()` — all topics strong, all growth, mixed, single-topic General fallback, empty answers, partial answers.
- **Component tests** (142 lines): PerformanceInsights rendering — strengths/growth visibility, conditional hiding for General-only topics, accessibility attributes.
- **E2E tests** (352 lines): 7 Playwright tests covering all 5 ACs + accessibility. Uses shared `seedQuizzes` helper for IndexedDB seeding.
- **Edge cases discovered**: Playwright strict mode violations when `getByText(/growth/i)` matched both encouraging message text and heading — fixed with `getByRole('heading', ...)` selectors.

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

- **HIGH**: Heading hierarchy inverted — h3 in PerformanceInsights followed by h2 in AreasForGrowth. Fix: change h3 → h2.
- **MEDIUM**: Sections inherit `text-center` from parent card — add `text-left` override to both `<section>` elements.
- All design token usage correct, WCAG AA contrast passes, responsive grid works, touch targets meet 44px minimum.

## Code Review Feedback

- **HIGH** (82): `text-warning` used for incorrect count — should be `text-destructive` per quiz subsystem conventions.
- **HIGH** (78): Skipped questions conflated with incorrect in growth area suggestions — document intentional decision or separate.
- **HIGH** (75): Duplicated `q()`, `correct()`, `wrong()` test helpers across unit test files — extract to shared factory.
- **MEDIUM** (72): 2-column grid renders even when only one section present — conditionally apply.
- **MEDIUM** (70): Redundant `new Set(topicMap.keys())` — simplify to `topicMap.size > 1`.
- 3 nits (useMemo references, test file size, sort mutation).

## Web Design Guidelines Review

- **PASS**: 100% design token usage, proper semantic HTML, `useId()` for aria bindings, color never sole indicator.
- **LOW**: Root `<div>` could be `<section>` with visually-hidden heading for document outline consistency.

## Challenges and Lessons Learned

- **Strict mode selector discipline**: `getByText(/growth/i)` matched both the encouraging message ("Review the growth areas below") and the "Growth Opportunities" heading, causing strict mode violations. Lesson: always use `getByRole('heading', ...)` for heading assertions in Playwright tests to avoid ambiguity.
- **Shared seeding helpers reduce code**: Replacing manual IndexedDB seeding (~35 lines) with `seedQuizzes()` (1 line) removed duplication and satisfied test pattern validation. The shared helper has identical retry logic but is maintained in one place.
- **Pure analytics functions simplify testing**: Keeping `analyzeTopicPerformance()` as a pure function (no React, no side effects) enabled comprehensive unit testing without component rendering overhead — 14 edge cases tested in isolation.
- **Conditional component rendering**: The "hide when all General" logic was cleaner to implement at the component level (check `hasTopics` boolean) rather than in the analytics function, keeping the analytics layer data-focused.
