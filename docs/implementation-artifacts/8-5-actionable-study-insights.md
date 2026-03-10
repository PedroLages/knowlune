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

### Timezone-Dependent Date Bucketing: toLocaleDateString vs toISOString

The initial `countDistinctStudyDays()` implementation used `toLocaleDateString('sv-SE')` to extract YYYY-MM-DD date strings for Set-based deduplication. However, this converts timestamps to the **user's local timezone** before formatting — a session at `2026-03-09T01:30:00Z` becomes "2026-03-09" in UTC+0 but "2026-03-08" in UTC-5 (EST). Result: distinct day counts varied based on machine timezone, causing non-deterministic E2E test failures.

**Solution**: Replaced `toLocaleDateString('sv-SE')` with `toISOString().slice(0, 10)` which always operates in UTC and deterministically extracts the date portion. This ensures `countDistinctStudyDays()` returns the same count regardless of runtime timezone.

**Lesson**: For date bucketing in analytics (distinct days, weekly aggregations, etc.), **always** use UTC-based extraction (`toISOString().slice(0, 10)`) not locale-based formatting. This pattern applies across all date-grouping logic in the Reports page (StudyTimeAnalytics, LearningVelocityTrends, etc.). Only use `toLocaleDateString()` for **display** formatting shown to users.

### Regex-Parsing Display Text for Sorting: Decoupled Data Pattern

The `findMomentumAlertInsights()` generator initially embedded "daysSince" values in the observation string (e.g., "Course X has had no activity for 15 days") then used regex `/(\d+) days/` to extract and sort by inactivity duration. This violated the principle of separating data from presentation and made sorting brittle (fails if wording changes, doesn't handle pluralization edge cases).

**Solution**: Store `daysSince` as a **numeric field** on the insight object (added `metadata: { daysSince: number }` to InsightCategory type). Sort by `metadata.daysSince` directly, then format the observation string for display. This decouples data processing from presentation.

**Lesson**: Never regex-parse display strings to recover data for business logic (sorting, filtering, thresholds). Always store structured metadata alongside human-readable text. This pattern mirrors how RecentActivity stores `type` (enum) and `formattedTime` (display string) separately.

### Insight Count Guarantees: Fallback Generator Pattern

Initial implementation generated insights opportunistically (optimal day, momentum alerts, note correlation) but provided no guarantees about minimum count. Story acceptance criteria requires "3 to 5 insights" — a user with only completed courses (no momentum alerts) and no notes (no correlation) might see only 1 insight (optimal day), failing AC1.

**Solution**: Implemented **fallback generators** (`findStudyFrequencyInsight`, `findStudyConsistencyInsight`) that analyze session distribution patterns and always produce insights when 2+ weeks of data exist. The `generateInsights()` orchestrator now guarantees ≥3 insights by combining primary generators (high signal) with fallbacks (always available).

**Lesson**: When product requirements specify exact counts ("3 to 5"), implement fallback/default generators that activate when primary heuristics don't apply. This pattern ensures graceful degradation — users always see value even with atypical data patterns (all completed courses, no notes, sparse sessions, etc.).

### localStorage Cache Invalidation: Session Day Deltas vs Timestamp Comparison

Initial cache invalidation logic compared `cachedGeneratedAt` timestamp with current time to detect staleness. However, this approach doesn't account for **sparse study patterns** — 30 days elapsed time with only 2 new study days shouldn't trigger refresh (user hasn't accumulated 7+ days of new data). Conversely, a user studying daily could accumulate 7 new days in just 1 week of elapsed time.

**Solution**: Store `sessionDays` (distinct study day count at generation time) in cache. Invalidate when `countDistinctStudyDays(currentSessions) - cachedSessionDays >= 7`. This measures **data accumulation** (7+ new distinct study days) rather than elapsed time, matching how insights actually derive signal from study patterns.

**Lesson**: Cache invalidation for analytics should key on **data accumulation** (new events, distinct days, etc.) not elapsed time. This pattern applies to any derived metric that depends on event density rather than staleness (momentum calculations, streak tracking, completion trends).

### Focus Ring Contrast Failure: ring-ring Default vs WCAG 1.4.11

Initial focus indicators used Tailwind's `ring-ring` token (maps to `--color-ring` CSS variable) which has 2.30:1 contrast against `--color-card` background. WCAG 2.1 SC 1.4.11 (Non-text Contrast) requires ≥3:1 for focus indicators. Code review flagged this as a blocker.

**Solution**: Changed all focus rings from `ring-ring` to `ring-brand` (5.17:1 contrast) to meet AA+ compliance. This pattern now applies across all new interactive elements — `ring-brand` is the project standard for focus indicators, not `ring-ring`.

**Lesson**: The default `ring-ring` token in theme.css is **not** WCAG-compliant for focus indicators. Always use `ring-brand` for focus states on light backgrounds, `ring-primary-foreground` on dark. This finding applies retroactively to all Epic 7/8 components and should be validated in future design reviews.
