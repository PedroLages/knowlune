# Non-Functional Requirements Assessment — Epic 20: Learning Pathways & Knowledge Retention

**Date:** 2026-03-26
**Assessor:** Claude Opus 4.6 (testarch-nfr)
**Overall Assessment:** PASS (with minor concerns)

---

## Scope

| Story | Components Assessed |
|-------|-------------------|
| E20-S01 | `CareerPaths.tsx`, `CareerPathDetail.tsx`, `useCareerPathStore.ts` |
| E20-S02 | `Flashcards.tsx`, `FlashcardReviewCard.tsx`, `CreateFlashcardDialog.tsx`, `useFlashcardStore.ts`, `spacedRepetition.ts`, `RatingButtons.tsx` |
| E20-S03 | `ActivityHeatmap.tsx`, `activityHeatmap.ts` |
| E20-S04 | `SkillsRadar.tsx`, `SkillProficiencyRadar.tsx` |

---

## 1. Performance

**Verdict: PASS**

### Build Time & Bundle Size

- Build completes in **15.2s** — no regression.
- No new chunk exceeds the 500 kB warning threshold for Epic 20 code. The recharts chart library (`chart-Bo3NUUju.js` at 422 kB) is shared across multiple features, not unique to this epic.
- Career paths, flashcards, and heatmap pages are route-level code-split via React Router lazy loading.

### Rendering — 365-Cell Activity Heatmap (E20-S03)

**Performance-conscious patterns observed:**
- **Bounded DB query**: Uses indexed `db.studySessions.where('startTime').above(cutoff)` instead of full-table scan.
- **Memoized grid style**: `gridStyle` memoized on `totalWeeks` to avoid object churn.
- **Pre-computed formatted dates**: `formattedDates` Map computed once via `useMemo`, avoiding 365 `Intl.DateTimeFormat.format()` calls in the render loop.
- **Shared formatter**: Single `cellDateFormatter` instance rather than per-cell instantiation.
- **Debounced refresh**: `study-log-updated` events debounced at 300ms to prevent redundant re-renders.
- **CSS Grid layout**: Native CSS grid with `minmax(8px, 1fr)` — avoids JavaScript layout calculations.

**Minor concern:** Each of the ~365 cells wraps a `<Tooltip>` + `<TooltipTrigger>` (Radix primitive). This creates ~730 React component instances. Radix tooltips are lazy-mounted (content only rendered on hover), so actual DOM overhead is minimal. No observed performance issue, but worth monitoring if the heatmap is rendered in a list context.

### Flashcard Review (E20-S02)

- Single-card-at-a-time rendering — no list virtualization needed.
- 3D CSS flip animation uses `transform: rotateY()` with `will-change` implied by Framer Motion — GPU-accelerated.

### Radar Charts (E20-S04)

- SVG-based recharts radar — lightweight for 5-8 data points. No performance concern.

---

## 2. Security

**Verdict: PASS**

### XSS & Injection

- **No `dangerouslySetInnerHTML`** across any Epic 20 component.
- All user-generated content (flashcard front/back text) rendered via React JSX text interpolation — auto-escaped.
- `formatCourseName()` in `CareerPathDetail.tsx` applies string transforms (`replace`) on courseId — no HTML rendering.
- Inline `style` attributes in `CareerPathDetail.tsx` and `FlashcardReviewCard.tsx` use only CSS custom property references (`var(--brand-soft)`) and numeric values — no user-controlled input flows into style attributes.

### Data Integrity

- Career path enrollment uses `crypto.randomUUID()` for IDs — no predictable sequential IDs.
- `enrollingPaths` Set guards against double-click race conditions creating duplicate enrollment records.
- `loadInFlight` flag prevents concurrent `loadPaths()` from double-seeding the database.
- `persistWithRetry` wraps all IndexedDB writes — resilient to transient storage errors.

### Auth Patterns

- No authentication required for this epic (client-side only, IndexedDB storage). Consistent with the project's current architecture.

---

## 3. Reliability

**Verdict: PASS**

### Error Handling

| Component | Error Path | User Feedback |
|-----------|-----------|---------------|
| `useCareerPathStore.loadPaths` | DB failure | `toast.error('Failed to load career paths')` + sets error state |
| `useCareerPathStore.enrollInPath` | DB failure | `toast.error('Failed to enroll in path')` + throws |
| `useCareerPathStore.dropPath` | DB failure | `toast.error('Failed to leave path')` + throws |
| `useCareerPathStore.refreshCourseCompletion` | DB failure | `toast.warning('Progress data may be outdated')` |
| `useFlashcardStore.createFlashcard` | DB failure | `toast.error('Failed to create flashcard')` + optimistic rollback |
| `useFlashcardStore.deleteFlashcard` | DB failure | `toast.error('Failed to delete flashcard')` + rollback |
| `useFlashcardStore.rateFlashcard` | DB failure | Toast with retry action + rollback to previous state |
| `ActivityHeatmap` (initial load) | DB failure | Logs error, renders empty state (non-blocking) |
| `ActivityHeatmap` (refresh) | Event handler failure | Logs error, stale data shown (non-critical) |

**Optimistic update pattern** is consistently applied with proper rollback in the flashcard store — well-implemented.

### Edge Cases

- **Empty states**: All components handle empty data gracefully:
  - `CareerPaths.tsx`: `EmptyState` component for no paths or no search results.
  - `Flashcards.tsx`: `Empty` component when no flashcards exist, "All caught up" state when none due.
  - `ActivityHeatmap.tsx`: "No study sessions recorded yet" in table view; empty grid renders correctly.
  - `SkillsRadar.tsx` / `SkillProficiencyRadar.tsx`: Returns `null` when `data.length === 0`.
- **Invalid route**: `CareerPathDetail.tsx` redirects to `/career-paths` when `pathId` is not found.
- **Unmount cleanup**: `Flashcards.tsx` calls `resetReviewSession()` on unmount. `ActivityHeatmap.tsx` uses `ignore` flag to prevent state updates after unmount.
- **SM-2 boundaries**: Ease factor never drops below 1.3; interval never below 1 day.

### Minor concern

- `CareerPathDetail.tsx` lines 325-335: Catch blocks use `// silent-catch-ok` comment but the toast is actually shown by the store layer. Pattern is correct but the comment could be more specific about delegation.

---

## 4. Maintainability

**Verdict: PASS**

### Code Quality

- **Clean separation of concerns**: Pure algorithm functions in `spacedRepetition.ts` and `activityHeatmap.ts`, state management in Zustand stores, presentation in React components.
- **TypeScript strict mode**: Zero type errors (`npx tsc --noEmit` clean).
- **Lint clean**: Zero errors (192 warnings across entire codebase, none are blockers).
- **Design tokens**: All styling uses design tokens — no hardcoded colors detected.
- **Accessibility**: Comprehensive ARIA attributes throughout:
  - `role="list"` + `role="listitem"` for career paths
  - `role="img"` with descriptive `aria-label` for radar charts and heatmap cells
  - `role="group"` + `aria-label` for heatmap grid and rating buttons
  - `role="status"` for progress display
  - Roving tabindex for keyboard navigation in heatmap
  - `aria-live="polite"` for screen reader announcement on card flip
  - `MotionConfig reducedMotion="user"` respects user preferences

### Test Coverage

| Story | Unit Tests | E2E Tests |
|-------|-----------|-----------|
| E20-S01 (Career Paths) | 16 tests in `useCareerPathStore.test.ts` | 16 tests in `career-paths.spec.ts` |
| E20-S02 (Flashcards) | 15 tests in `useFlashcardStore.test.ts`, 22 tests in `spacedRepetition.test.ts` | **None** |
| E20-S03 (Activity Heatmap) | 24 tests in `activityHeatmap.test.ts` | **None** |
| E20-S04 (Skill Radar) | 3 tests in `SkillProficiencyRadar.test.tsx` | **None** |

**Coverage gap:** E20-S02, E20-S03, and E20-S04 have no E2E tests. Unit tests are thorough (boundary cases, error rollback, SM-2 invariants), but E2E coverage would provide integration confidence for:
- Flashcard create/review/rate flow
- Heatmap rendering with seeded study sessions
- Radar chart visibility with seeded data

This is a **LOW** severity concern — unit test coverage is comprehensive and the components are relatively self-contained.

---

## Summary

| Category | Status | Notes |
|----------|--------|-------|
| **Performance** | PASS | Heatmap is well-optimized (bounded queries, memoized formatting, CSS grid). No bundle regression. |
| **Security** | PASS | No XSS vectors. Race condition guards on enrollment. All user input auto-escaped. |
| **Reliability** | PASS | Consistent error handling with toast feedback and optimistic rollbacks. All edge cases covered. |
| **Maintainability** | PASS | Clean architecture, zero type/lint errors, good test coverage. E2E gap for S02-S04 is low severity. |

### Recommendations (non-blocking)

1. **E2E test gap (LOW)**: Consider adding E2E specs for flashcard review flow and heatmap rendering in a future chore.
2. **Tooltip count (NIT)**: If heatmap is ever rendered in a list/repeating context, consider a single shared tooltip positioned via pointer events rather than 365 Tooltip instances.
