---
story_id: E08-S05
story_name: "Actionable Study Insights"
status: done
started: 2026-03-09
completed: 2026-03-09
reviewed: true           # false | in-progress | true
review_started: 2026-03-09
review_gates_passed: [build, lint, typescript, prettier, unit-tests, e2e-smoke, e2e-story, code-review, code-review-testing, design-review]
burn_in_validated: false # true if burn-in testing (10 iterations) passed
---

# Story 8.5: Actionable Study Insights

## Story

As a learner,
I want to receive 3 to 5 actionable insights derived from my study patterns,
so that I can make informed adjustments to improve my learning outcomes without manually analyzing my data.

## Acceptance Criteria

**Given** the user has at least 2 weeks of study session data across multiple courses
**When** the user navigates to the Reports page and views the Actionable Insights section
**Then** between 3 and 5 insight cards are displayed, each containing a concise observation and a specific recommendation
**And** insights are generated from the user's actual study data, not generic tips

**Given** the insight generation engine analyzes the user's data
**When** insights are produced
**Then** the engine evaluates at minimum the following pattern categories: optimal study day/time (e.g., "You study most effectively on Tuesdays — consider scheduling focused sessions then"), course momentum alerts (e.g., "Course X has had no activity for 10 days — it may be at risk of abandonment"), and behavioral correlations (e.g., "Courses where you take notes have a 3x higher completion rate")
**And** each insight includes a relevance indicator showing which data points informed it

**Given** insights were previously generated
**When** the user accumulates 7 or more days of new study data since the last generation
**Then** insights are refreshed to reflect the latest patterns
**And** the section displays a "Last updated" timestamp showing when insights were last recalculated

**Given** the user has fewer than 2 weeks of study data
**When** the Actionable Insights section loads
**Then** a message is displayed explaining that insights require at least 2 weeks of study activity
**And** a progress indicator shows how much more data is needed

**Given** the user views an insight card
**When** the card renders
**Then** each card uses semantic markup with a heading for the observation and body text for the recommendation
**And** cards are keyboard navigable and screen reader accessible
**And** no insight relies solely on color or iconography to convey its meaning

## Tasks / Subtasks

- [x] Task 1: Write E2E tests (ATDD — before implementation) (AC: 1-5)
  - [x] 1.1 AC1: User with 2+ weeks data sees 3-5 insight cards with observation + recommendation
  - [x] 1.2 AC2: Engine evaluates optimal day/time, momentum alerts, note-taking correlation; relevance indicators present
  - [x] 1.3 AC3: "Last updated" timestamp visible; insights regenerate after 7+ new study days
  - [x] 1.4 AC4: <2 weeks data → explanation + progress indicator showing how much more data needed
  - [x] 1.5 AC5: Semantic markup (heading/body), keyboard navigation, no color-only meaning

- [x] Task 2: Implement pure insight engine (`src/lib/studyInsights.ts`) (AC: 1-3)
  - [x] 2.1 Define `StudyInsight` and `InsightCache` TypeScript interfaces
  - [x] 2.2 `hasEnoughDataForInsights(sessions)` — checks 14+ distinct study days
  - [x] 2.3 `getDataSufficiencyProgress(sessions)` — returns 0–1 fraction toward 14-day threshold
  - [x] 2.4 `findOptimalStudyDayInsight(sessions)` — detects highest-frequency weekday
  - [x] 2.5 `findMomentumAlertInsights(sessions, courses)` — detects courses with 10+ days inactivity
  - [x] 2.6 `findNoteCorrelationInsight(sessions, notes, courses)` — detects note-takers vs non-note-takers completion correlation
  - [x] 2.7 `generateInsights(sessions, courses, notes)` — assembles 3-5 insights, caps and sorts by relevance
  - [x] 2.8 `shouldRefreshInsights(sessions, cacheGeneratedAt, cachedSessionDays)` — returns true if 7+ new distinct study days

- [x] Task 3: Build `ActionableInsights` component (AC: 1-5)
  - [x] 3.1 Load studySessions + importedCourses + notes from IndexedDB in parallel
  - [x] 3.2 Loading state card with skeleton
  - [x] 3.3 Insufficient data state: message + Progress bar (AC4)
  - [x] 3.4 Cache insights in localStorage (`study-insights-v1`) with generatedAt + sessionDays
  - [x] 3.5 Render 3-5 insight cards: `<article>` with `<h3>` observation + `<p>` recommendation (AC1, AC5)
  - [x] 3.6 Relevance indicator section showing data points used (AC2)
  - [x] 3.7 "Last updated" timestamp (AC3)
  - [x] 3.8 Accessibility: data-testid attrs, ARIA labels, keyboard-navigable cards (AC5)

- [x] Task 4: Integrate into Reports page (AC: all)
  - [x] 4.1 Import ActionableInsights in Reports.tsx
  - [x] 4.2 Render at the bottom of the Reports page with consistent spacing

- [x] Task 5: Run tests and fix (AC: all)
  - [x] 5.1 Run E2E tests against implementation
  - [x] 5.2 Fix any failures

## Implementation Plan

See [plan](plans/e08-s05-actionable-study-insights.md) for full implementation details.

## Implementation Notes

**Architecture**: Pure engine in `src/lib/studyInsights.ts` (no React, no DB calls) + React component in `src/app/components/ActionableInsights.tsx`. All insight functions accept `now = Date.now()` for deterministic testing — consistent with `atRisk.ts` and `momentum.ts` patterns.

**localStorage cache**: `study-insights-v1` key stores `{ insights, generatedAt, sessionDays }`. Invalidated when `countDistinctStudyDays(sessions) - cachedSessionDays >= 7`. Falls back to regenerating on SecurityError (private browsing).

**Parallel DB load**: `Promise.all([db.studySessions.toArray(), db.importedCourses.toArray(), db.notes.toArray()])` — minimizes load latency.

**No dependencies added**: All libraries already in project (shadcn/ui Progress, Skeleton, Card, Lucide).

## Testing Notes

**Unit tests** (34 tests, 100% statement coverage): `src/lib/__tests__/studyInsights.test.ts` — full boundary coverage for all 8 exported functions.

**E2E tests** (12 tests, all 5 ACs): `tests/e2e/story-e08-s05.spec.ts` — ATDD written before implementation. Uses `mockDateNow` pattern for deterministic momentum calculations, `seedStudySessions/seedImportedCourses/seedNotes` helpers.

**Edge cases handled**: empty sessions (no crash), all courses completed (momentum alerts skip), single course/no notes (note correlation returns null gracefully), private browsing localStorage (SecurityError caught).

## Pre-Review Checklist

Before requesting `/review-story`, verify:

- [ ] All changes committed (`git status` clean)
- [ ] No error swallowing — catch blocks log AND surface errors
- [ ] useEffect hooks have cleanup functions (ignore flags for async, event listener removal)
- [ ] No optimistic UI updates before persistence — state updates after DB write succeeds
- [ ] Type guards on all dynamic lookups (e.g., `LABELS[type]` when type can be empty)
- [ ] E2E afterEach cleanup uses `await` (not fire-and-forget)
- [ ] Date handling uses `toLocaleDateString('sv-SE')` pattern (not `toISOString().split('T')[0]`)
- [ ] Sidebar state seeded BEFORE `page.goto()` (context.addInitScript pattern)
- [ ] `Math.max()` replaced with `.reduce()` for large arrays (E08-S01 lesson)
- [ ] Read [engineering-patterns.md](../engineering-patterns.md) for full patterns reference

## Design Review Feedback

[Populated by /review-story — Playwright MCP findings]

## Code Review Feedback

[Populated by /review-story — adversarial code review findings]

## Challenges and Lessons Learned

[Document issues, solutions, and patterns worth remembering]
