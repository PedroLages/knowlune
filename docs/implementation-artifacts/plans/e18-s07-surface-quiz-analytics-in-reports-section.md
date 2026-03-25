# E18-S07: Surface Quiz Analytics in Reports Section — Implementation Plan

**Story:** [18-7-surface-quiz-analytics-in-reports-section.md](../18-7-surface-quiz-analytics-in-reports-section.md)
**Created:** 2026-03-23
**Complexity:** Medium (4-5 hours)

---

## 1. Overview

Add a "Quiz Analytics" tab to the Reports page that surfaces aggregate quiz metrics, recent attempts, top/bottom performing quizzes, and a per-quiz detail drill-down page. The existing Reports page already uses shadcn Tabs with "Study Analytics" and "AI Analytics" — we add a third tab.

## 2. Codebase Context

### Existing Infrastructure (no changes needed)
- **Dexie tables:** `quizzes` (Quiz definitions), `quizAttempts` (completed attempts) — schema v15+
- **Quiz types:** `src/types/quiz.ts` — `Quiz`, `QuizAttempt`, `Answer`, `Question`
- **Analytics library:** `src/lib/analytics.ts` — `calculateRetakeFrequency()`, `calculateImprovement()`, `calculateNormalizedGain()`, `calculateItemDifficulty()`, `calculateDiscriminationIndices()`
- **Quiz components:** `src/app/components/quiz/` — `ScoreTrajectoryChart`, `ItemDifficultyAnalysis`, `DiscriminationAnalysis`, `AttemptHistory`
- **Seed helpers:** `seedQuizzes()`, `seedQuizAttempts()` in `tests/support/helpers/seed-helpers.ts` and `indexeddb-seed.ts`
- **Quiz factory:** `makeQuiz()`, `makeAttempt()`, `makeQuestion()` in `tests/support/fixtures/factories/quiz-factory.ts`
- **SearchCommandPalette:** Already has link to `/reports?tab=quizzes` — will work once tab exists

### Key Patterns to Follow
- **Reports.tsx** (line 188): Uses `<Tabs defaultValue="study">` with `TabsList`/`TabsTrigger`/`TabsContent`
- **Notes.tsx** (line 107): Uses `useSearchParams` to read `?tab=` from URL — same pattern needed for Reports
- **E17-S02 E2E** (`story-e17-s02.spec.ts`): Seeds `quizAttempts` via `seedQuizAttempts()`, navigates to `/reports`, clicks tab, asserts card content
- **EmptyState** component: Reuse for AC2 (no quiz data state)
- **StatsCard** component: Has Sheet drill-down — but for simplicity, use plain `Card` with stat display (matching AC spec)

## 3. Implementation Steps

### Step 1: Add `calculateQuizAnalytics()` to `src/lib/analytics.ts`

New async function that queries Dexie for aggregate quiz metrics.

```typescript
export type QuizAnalyticsSummary = {
  totalQuizzesCompleted: number
  averageScore: number          // percentage, 0-100
  completionRate: number        // percentage, 0-100
  averageRetakeFrequency: number
  recentAttempts: QuizAttemptWithTitle[]  // last 5, most recent first
  topPerforming: QuizPerformance[]       // highest avg scores
  needsImprovement: QuizPerformance[]    // lowest avg scores
}

export type QuizAttemptWithTitle = QuizAttempt & { quizTitle: string }

export type QuizPerformance = {
  quizId: string
  quizTitle: string
  averageScore: number     // percentage
  attemptCount: number
  bestScore: number        // percentage
  lastAttemptDate: string  // ISO 8601
}
```

**Logic:**
1. `db.quizAttempts.toArray()` — get all attempts
2. `db.quizzes.toArray()` — get all quiz definitions (for titles)
3. Group attempts by `quizId`
4. Calculate per-quiz averages, sort for top/bottom
5. `completionRate`: Since all stored attempts are submitted (abandoned quizzes don't persist to `quizAttempts`), completion rate = `(uniqueQuizzes / totalQuizzesAvailable) * 100` where `totalQuizzesAvailable` comes from `db.quizzes.count()`
6. Recent 5: sort all attempts by `completedAt` descending, take first 5, enrich with quiz titles

**Note on completion rate:** The epics.md AC says "Completion rate" but E18-S06 defines it as "submitted / total attempts". Since our `quizAttempts` table only stores completed attempts (no abandoned records), we'll define it as "unique quizzes attempted / total quizzes available" which is more meaningful for the Reports context. This differs from E18-S06's definition because we lack abandoned attempt tracking.

### Step 2: Create `src/app/components/reports/QuizAnalyticsDashboard.tsx`

New component following the pattern of existing report components (`AIAnalyticsTab`, etc.).

**Structure:**
```
QuizAnalyticsDashboard
├── Loading state (Skeleton)
├── Empty state (EmptyState component)
└── Data state
    ├── Metric cards row (3-col → 1-col responsive grid)
    │   ├── Total Quizzes Completed
    │   ├── Average Score
    │   └── Completion Rate
    ├── Average Retake Frequency (reuse existing card pattern from Reports.tsx:398-422)
    ├── Recent Quizzes table (last 5 attempts)
    │   └── Each row: quiz title, score, date, link to detail
    └── Top/Bottom grid (2-col → 1-col)
        ├── Top Performing Quizzes card
        └── Quizzes Needing Practice card
```

**Data loading pattern:** Same as existing Reports page — `useEffect` with ignore flag for async Dexie queries.

**Components to reuse:**
- `Card`, `CardHeader`, `CardTitle`, `CardContent` from shadcn
- `Table`, `TableHead`, `TableBody`, `TableRow`, `TableCell` from shadcn
- `EmptyState` component for AC2
- `Badge` for score display
- `motion` + `fadeUp` for entry animations (matching Reports page pattern)

**Design tokens (no hardcoded colors):**
- Cards: `bg-card`, `border-border`
- Metric values: `text-foreground`
- Labels: `text-muted-foreground`
- Score badges: `text-success` for good scores, `text-warning` for mid, `text-destructive` for low
- Links: `text-brand hover:underline`

### Step 3: Modify `src/app/pages/Reports.tsx`

**Changes:**
1. Import `useSearchParams` from react-router
2. Read `?tab=` param to determine default tab: `study` (default), `quizzes`, `ai`
3. Add `TabsTrigger value="quizzes"` — "Quiz Analytics"
4. Add `TabsContent value="quizzes"` wrapping `<QuizAnalyticsDashboard />`
5. Handle tab change → update URL search params (keeps URL in sync)

**Key consideration:** The existing `hasActivity` check gates the entire tabs UI behind an empty state. Quiz data should also be considered — if there are quiz attempts but no study activity, we should still show the tabs. Update `hasActivity` to include quiz data, OR handle quiz empty state within the tab itself (cleaner — AC2 specifies a quiz-specific empty state).

**Decision:** Keep the existing `hasActivity` gate as-is (it already includes `retakeData.totalAttempts > 0`), so if there are quiz attempts, the tabs will show. The quiz-specific empty state (`EmptyState` inside `QuizAnalyticsDashboard`) handles the case where the tab is shown but has no quiz data — this shouldn't happen in practice since `hasActivity` already gates it, but provides a defensive fallback.

### Step 4: Create `src/app/pages/QuizDetailAnalytics.tsx`

New page component for the `/reports/quiz/:quizId` route.

**Data loading:**
1. Read `quizId` from URL params
2. Load quiz definition from `db.quizzes.get(quizId)`
3. Load all attempts from `db.quizAttempts.where('quizId').equals(quizId).sortBy('completedAt')` (reverse for most-recent-first)
4. Pass data to existing components

**Layout:**
```
QuizDetailAnalytics
├── Back link to /reports?tab=quizzes
├── Quiz title heading
├── Score Trajectory Chart (ScoreTrajectoryChart)
├── Attempt History (AttemptHistory — needs courseId/lessonId, may need adaptation)
├── Item Difficulty Analysis (ItemDifficultyAnalysis)
├── Discrimination Indices (DiscriminationAnalysis)
├── Normalized Gain display
└── Empty/loading states
```

**Component reuse considerations:**
- `ScoreTrajectoryChart` — accepts `attempts: { attemptNumber, percentage }[]` and `passingScore` — works directly
- `ItemDifficultyAnalysis` — accepts `quiz: Quiz` and `attempts: QuizAttempt[]` — works directly
- `DiscriminationAnalysis` — accepts `quiz: Quiz` and `attempts: QuizAttempt[]` — works directly
- `AttemptHistory` — currently requires `courseId` and `lessonId` for navigation links to review pages. For the reports context, we'll need to either:
  - (a) Look up the quiz's lessonId from the quiz definition, then find the courseId from the course that contains that lesson, OR
  - (b) Create a simplified version without review links

**Decision:** Option (a) — look up courseId from the quiz's lessonId. This keeps the full functionality of navigating to review pages. If the course lookup fails (e.g., quiz exists but course was deleted), gracefully degrade by hiding review links.

### Step 5: Add route to `src/app/routes.tsx`

```typescript
const QuizDetailAnalytics = React.lazy(() =>
  import('./pages/QuizDetailAnalytics').then(m => ({ default: m.QuizDetailAnalytics }))
)

// Add to router children:
{
  path: 'reports/quiz/:quizId',
  element: (
    <SuspensePage>
      <QuizDetailAnalytics />
    </SuspensePage>
  ),
},
```

### Step 6: E2E Tests — `tests/e2e/regression/story-e18-s07.spec.ts`

**Test structure (following E17-S02 pattern):**

```
describe('E18-S07: Quiz Analytics in Reports')
  beforeEach:
    - Close sidebar (localStorage)
    - Navigate to / for Dexie init

  afterEach:
    - clearIndexedDBStore(page, 'ElearningDB', 'quizAttempts')
    - clearIndexedDBStore(page, 'ElearningDB', 'quizzes')

  test AC1: 'Quiz Analytics tab shows metrics with seeded data'
    - Seed 2 quizzes + 5 attempts (varied scores)
    - Navigate to /reports
    - Click "Quiz Analytics" tab
    - Assert: total quizzes, average score, completion rate visible
    - Assert: recent quizzes table has rows
    - Assert: top performing section visible

  test AC2: 'Empty state when no quiz data'
    - Navigate to /reports?tab=quizzes
    - Assert: empty state message "No quiz data yet"
    - Assert: CTA link visible

  test AC3: 'Click quiz navigates to detail page'
    - Seed quiz + attempts
    - Navigate to /reports?tab=quizzes
    - Click quiz row
    - Assert: URL matches /reports/quiz/:quizId
    - Assert: trajectory chart visible (if 2+ attempts)
    - Assert: item difficulty visible

  test AC4: 'Mobile viewport stacks metric cards'
    - Set viewport to 375x667
    - Seed data + navigate
    - Assert: metric cards are stacked (single column)

  test: 'Tab URL param ?tab=quizzes activates quiz tab'
    - Navigate to /reports?tab=quizzes
    - Assert: Quiz Analytics tab is active
```

**Seed data strategy:**
- Use `makeQuiz()` with stable IDs (e.g., `quiz-e18s07-a`, `quiz-e18s07-b`)
- Use `makeAttempt()` with varied percentages (90%, 60%, 45%) to test top/bottom sorting
- Seed quizzes into `quizzes` store AND attempts into `quizAttempts` store

### Step 7: Unit Tests — `src/lib/__tests__/analytics.test.ts`

Add tests for `calculateQuizAnalytics()`:
- Zero attempts → empty summary
- Single quiz, single attempt → totals correct
- Multiple quizzes, multiple attempts → averages, top/bottom lists correct
- Completion rate calculation
- Recent attempts sorted correctly (most recent first, max 5)

## 4. File Change Summary

| File | Action | Purpose |
|------|--------|---------|
| `src/lib/analytics.ts` | Modify | Add `calculateQuizAnalytics()` + types |
| `src/app/components/reports/QuizAnalyticsDashboard.tsx` | Create | Quiz Analytics tab content |
| `src/app/pages/Reports.tsx` | Modify | Add Quiz Analytics tab, URL param support |
| `src/app/pages/QuizDetailAnalytics.tsx` | Create | Per-quiz detail page |
| `src/app/routes.tsx` | Modify | Add `/reports/quiz/:quizId` route |
| `src/lib/__tests__/analytics.test.ts` | Modify | Unit tests for new analytics function |
| `tests/e2e/regression/story-e18-s07.spec.ts` | Create | E2E tests for all ACs |

## 5. Dependencies

- **E17-S01 through E17-S04** (analytics calculations) — E17-S02 is done, E17-S04 is in-progress. The analytics functions we reuse (`calculateItemDifficulty`, `calculateDiscriminationIndices`) already exist.
- **E17-S01** (completion rate) — status: backlog. Our implementation defines completion rate independently (unique quizzes attempted / total available), so no blocker.
- No new npm dependencies needed.

## 6. Risk & Edge Cases

| Risk | Mitigation |
|------|-----------|
| Large number of quiz attempts → slow aggregation | Use Dexie indexed queries; consider `useMemo` for derived data |
| Quiz exists in `quizAttempts` but deleted from `quizzes` | Graceful "Unknown Quiz" fallback in title display |
| `AttemptHistory` component needs courseId | Look up from quiz → lesson → course chain in Dexie |
| Course deleted but quiz/attempts remain | Hide review links, show data-only view |
| URL `?tab=quizzes` with no activity → empty state gate hides all tabs | `hasActivity` already includes `retakeData.totalAttempts > 0`, so quiz attempts will show tabs. For edge case where user navigates directly via URL, ensure `QuizAnalyticsDashboard` handles its own empty state |

## 7. Build Sequence

1. `calculateQuizAnalytics()` + unit tests (pure data layer, testable in isolation)
2. `QuizAnalyticsDashboard.tsx` component (depends on step 1)
3. Reports.tsx modifications (depends on step 2) — Tab + URL param
4. `QuizDetailAnalytics.tsx` + route (depends on existing quiz components)
5. E2E tests (depends on all above)
6. Manual smoke test: verify SearchCommandPalette "Quiz Analytics" link works

## 8. Design Review Focus Areas

- Tab integration styling (3 tabs fit horizontally on mobile?)
- Metric card spacing and alignment
- Table layout for recent quizzes
- Navigation to detail page (link vs. clickable row)
- Empty state design
- Responsive grid behavior (3-col → 1-col breakpoint)
- Score color coding (success/warning/destructive thresholds)
