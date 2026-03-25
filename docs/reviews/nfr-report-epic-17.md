# Non-Functional Requirements Report: Epic 17 — Quiz Data and Patterns

**Date:** 2026-03-24
**Overall Assessment:** PASS

---

## 1. Performance

### Build Time
- **Production build:** 13.64s (acceptable for project size)
- No build warnings related to Epic 17 code

### Bundle Size
- `analytics.ts` chunk: **6.14 kB** (2.57 kB gzipped) — very lean for the amount of logic
- `QuizResults.tsx` chunk: **39.93 kB** (12.23 kB gzipped) — includes all quiz result components
- Recharts (chart library) is shared across the app at 422 kB (pre-existing dependency, not added by E17)
- **Verdict:** No bundle size concerns. Analytics logic is well-isolated in its own chunk.

### Rendering
- `useMemo` applied correctly in `QuizResults.tsx` for all derived computations (improvement data, normalized gain, trajectory data, incorrect items)
- `useMemo` used in `DiscriminationAnalysis.tsx` for expensive point-biserial calculation
- `ImprovementChart` memoizes `detectLearningTrajectory` call
- `ItemDifficultyAnalysis` calls `calculateItemDifficulty` directly (no memo) but acceptable since it runs once on render with stable props
- `prefersReducedMotion` respected for chart animations
- **Verdict:** PASS. Computation-heavy functions are memoized appropriately.

### Algorithmic Complexity
- `calculateDiscriminationIndices`: Pre-builds `answerLookup` Map to avoid O(n*m) find() calls — good optimization
- `calculateItemDifficulty`: Single pass over attempts with Map aggregation — O(n*m) where n=attempts, m=answers per attempt
- `detectLearningTrajectory`: Linear regression is O(n) with 3 model fits — negligible for typical attempt counts (<100)
- **Verdict:** PASS. All algorithms are efficient for expected data sizes.

---

## 2. Security

### XSS Prevention
- No `dangerouslySetInnerHTML` or `innerHTML` usage in any Epic 17 component
- All user-facing text rendered through React JSX (auto-escaped)
- Question text displayed via `{item.questionText}` — safe by default

### Input Validation
- `calculateCompletionRate`: `JSON.parse` of localStorage wrapped in try/catch with explicit type checking (`typeof progressQuizId === 'string' && progressQuizId.length > 0`)
- `calculateDiscriminationIndices`: Returns `null` for < 5 attempts (minimum sample guard)
- `detectLearningTrajectory`: Returns `null` for < 3 attempts
- Division-by-zero guards present in all calculation functions (`startedCount > 0`, `uniqueQuizzes > 0`, `sd === 0`, `sumX2 === 0`, `ssTot === 0`)

### Data Source
- All data sourced from local IndexedDB (Dexie) and localStorage — no remote API calls
- No authentication or authorization concerns (local-only app)
- **Verdict:** PASS. No injection vectors, proper input validation.

---

## 3. Reliability

### Error Handling
- `QuizResults.tsx`: `loadAttempts` failure caught with `toast.error()` and console logging
- `handleRetake`: Wrapped in try/catch with user-visible error toast
- `Reports.tsx`: All three async calls (`calculateCompletionRate`, `calculateRetakeFrequency`, `getTotalStudyNotes`) have individual `.catch()` handlers with toast notifications
- `Reports.tsx`: Uses `ignore` flag pattern for async cleanup (prevents state updates on unmounted components)
- `calculateCompletionRate`: Silent catch for localStorage parse failure with inline justification comment (`silent-catch-ok`)

### Edge Cases
- Empty data: All functions handle zero-length arrays gracefully
- Single attempt: `calculateImprovement` returns `null` improvement, `false` isNewBest
- All same score: `calculateLinearR2` returns 0, trajectory detection correctly classifies as "plateau"
- Perfect score ceiling: `calculateNormalizedGain` returns `null` for pre=100% (avoids division by zero)
- Unanswered/skipped questions: Consistently excluded across `calculateItemDifficulty` and `calculateDiscriminationIndices`
- `DiscriminationAnalysis` renders "Not enough data" for edge cases (all correct or all incorrect)

### Graceful Degradation
- `ImprovementChart`: Returns `null` when < 3 attempts (component simply not rendered)
- `DiscriminationAnalysis`: Shows "Need at least 5 attempts" message
- `ItemDifficultyAnalysis`: Shows "Not enough data" message
- `QuizResults`: Declarative `<Navigate>` redirect when no quiz data (not imperative navigate during render)
- **Verdict:** PASS. Comprehensive edge case handling with user-friendly fallbacks.

---

## 4. Maintainability

### Code Quality
- TypeScript: `npx tsc --noEmit` passes with zero errors
- ESLint: No errors in Epic 17 files (1 pre-existing error in unrelated file)
- All exported types are well-documented with JSDoc comments
- Functions follow single-responsibility principle (one function per metric)
- Consistent patterns across all analytics functions (input validation, edge case handling, return types)

### Test Coverage
- **Unit tests:** 94 tests in `analytics.test.ts` — **100% line coverage** on `analytics.ts` (98.64% statement, 94.23% branch)
- Branch coverage gap: Lines 357, 444, 583, 638 are uncovered branches (defensive null guards unlikely to trigger in practice)
- **E2E tests:** 5 spec files covering all 5 stories:
  - `story-e17-s01.spec.ts`: 3 tests (completion rate with various data states)
  - `story-e17-s02.spec.ts`: 4 tests (retake frequency bands + empty state)
  - `story-e17-s03.spec.ts`: 6 tests (P-values, difficulty labels, exclusions, suggestions, redirect)
  - `story-e17-s04.spec.ts`: 5 tests (high/moderate/low discrimination + minimum threshold + section visibility)
  - `story-e17-s05.spec.ts`: 4 tests (chart visibility, confidence display, accessibility, minimum attempts)
- **Total: 94 unit + 22 E2E = 116 tests**
- No unit test directory found outside `src/lib/__tests__/` for components — component logic is tested via E2E

### Architecture
- Clean separation: Pure calculation functions in `src/lib/analytics.ts`, presentation in component files
- `analytics.ts` has only 2 dependencies: `@/types/quiz` (types), `@/lib/scoring` (utility), `@/db` (data access)
- Async functions (`calculateCompletionRate`, `calculateRetakeFrequency`) properly separated from sync functions
- Components follow existing project patterns (Card/CardHeader/CardContent, design tokens, accessibility labels)

### Design Token Compliance
- All components use semantic tokens: `text-muted-foreground`, `text-success`, `text-warning`, `text-destructive-soft-foreground`, `bg-success/10`, `bg-warning/10`, `bg-destructive/10`
- Chart colors use CSS variables: `var(--color-brand)`, `var(--color-muted-foreground)`
- No hardcoded colors detected

### Accessibility
- `ImprovementChart`: Comprehensive `aria-label` with pattern description, confidence, and attempt count
- `ItemDifficultyAnalysis`: `aria-label="Questions ranked by difficulty"` on list
- `DiscriminationAnalysis`: `aria-label="Questions ranked by discrimination index"` on list
- Charts marked `aria-hidden="true"` (decorative, data available via badges/text)
- `Reports.tsx`: `<h2 className="sr-only">Study Analytics</h2>` for screen reader heading
- Touch targets: Buttons use `min-h-[44px]` (WCAG 2.1 AA)
- **Verdict:** PASS. Strong accessibility patterns throughout.

---

## Summary

| Category | Rating | Notes |
|----------|--------|-------|
| Performance | PASS | Lean bundle (6.14 kB analytics), memoized computations, efficient algorithms |
| Security | PASS | No XSS vectors, validated inputs, local-only data, division-by-zero guards |
| Reliability | PASS | Comprehensive error handling with user-visible toasts, graceful degradation |
| Maintainability | PASS | 100% line coverage on core logic, 116 total tests, clean architecture |

**Overall: PASS** — Epic 17 demonstrates strong non-functional quality across all dimensions. The psychometric analytics functions are well-tested (94 unit tests with 100% line coverage), properly guarded against edge cases, and efficiently implemented. No blockers or high-severity concerns identified.
