# E11-S01: Spaced Review System — Implementation Plan

## Context

Story 11.1 introduces spaced repetition to LevelUp, allowing learners to schedule notes for review with a 3-grade rating system (Hard/Good/Easy) and see a prioritized review queue sorted by predicted retention. This is the first story in Epic 11 (Knowledge Retention) and feeds into Story 11.2 (Retention Dashboard). All dependencies (Epic 3 notes system) are complete.

**Worktree**: `.worktrees/e11-s01-spaced-review-system/`
**Branch**: `feature/e11-s01-spaced-review-system`

## Implementation Steps

### Step 1: Types and Spaced Repetition Algorithm
**Files**: `src/data/types.ts`, `src/lib/spacedRepetition.ts` (new)

Add `ReviewRecord` type to `types.ts`:
```typescript
export type ReviewRating = 'hard' | 'good' | 'easy'

export interface ReviewRecord {
  id: string              // UUID
  noteId: string          // FK to Note
  rating: ReviewRating
  reviewedAt: string      // ISO 8601
  nextReviewAt: string    // ISO 8601
  interval: number        // Days until next review
  easeFactor: number      // SM-2 ease factor (starts at 2.5)
  reviewCount: number     // Cumulative review count
}
```

Create `src/lib/spacedRepetition.ts` — SM-2 variant algorithm:
- `calculateNextReview(record: ReviewRecord | null, rating: ReviewRating): { interval, easeFactor, nextReviewAt }`
- `predictRetention(record: ReviewRecord): number` — exponential decay based on interval and time elapsed
- Rating mapping: Hard → quality=1 (interval ~1 day), Good → quality=3 (moderate), Easy → quality=5 (extend)
- Pure functions, no side effects — easy to unit test

**Commit**: `feat(E11-S01): add ReviewRecord type and spaced repetition algorithm`

### Step 2: Dexie Schema Migration (v13)
**File**: `src/db/schema.ts`

Add version 13 with `reviewRecords` table:
```typescript
db.version(13).stores({
  // ... all existing tables unchanged ...
  reviewRecords: 'id, noteId, nextReviewAt, reviewedAt'
})
```

Add EntityTable typing: `reviewRecords: EntityTable<ReviewRecord, 'id'>`

Import `ReviewRecord` from `@/data/types`.

**Commit**: `feat(E11-S01): add reviewRecords table (Dexie schema v13)`

### Step 3: Zustand Review Store
**File**: `src/stores/useReviewStore.ts` (new)

Follow `useChallengeStore` pattern:
- **State**: `dueReviews: ReviewRecord[]`, `allReviews: ReviewRecord[]`, `isLoading: boolean`, `error: string | null`, `pendingRating: { noteId, rating } | null` (in-memory fallback for AC5)
- **Actions**:
  - `loadReviews()` — fetch all from `db.reviewRecords`, compute due reviews sorted by retention % (lowest first)
  - `rateNote(noteId, rating)` — calculate next interval via `calculateNextReview()`, persist with `persistWithRetry()`, on failure: store in `pendingRating`, show toast with retry action
  - `retryPendingRating()` — retry the pending rating from memory
  - `getNextReviewDate()` — earliest `nextReviewAt` across all records (for empty state)
- **Selectors**: `dueReviews` computed by filtering `allReviews` where `nextReviewAt <= now`, sorted by `predictRetention()` ascending
- **Error pattern**: Use `persistWithRetry` from `@/lib/persistWithRetry`, on final failure show `toast('Failed to save rating', { action: { label: 'Retry', onClick: retryPendingRating } })`

**Commit**: `feat(E11-S01): create useReviewStore with rating and queue logic`

### Step 4: Review Queue Page
**File**: `src/app/pages/ReviewQueue.tsx` (new)

Page structure (follow Overview.tsx/Challenges.tsx pattern):
- Page heading: "Review Queue" with `font-display`
- Summary stats bar: count of due reviews, next review date
- Card list wrapped in `motion.div` with `staggerContainer` + `fadeUp` from `@/lib/motion`
- Empty state using composable `Empty` primitives from `ui/empty.tsx`
- Loading state with `DelayedFallback` + skeletons

**Commit**: `feat(E11-S01): add ReviewQueue page with card list and empty state`

### Step 5: ReviewCard and RatingButtons Components
**Files**: `src/app/components/figma/ReviewCard.tsx` (new), `src/app/components/figma/RatingButtons.tsx` (new)

**ReviewCard**: Card showing note excerpt, retention %, course name, topic, time until due
- `data-testid="review-card"` on card container
- `data-testid="retention-percentage"` on retention display
- `data-testid="course-name"`, `data-testid="topic-name"`, `data-testid="time-until-due"` on metadata
- Retention color: `<50%` = `text-destructive`, `50-79%` = `text-warning`, `80%+` = `text-success`
- Card exit animation: `motion.div` with fade out + slide up on rate

**RatingButtons**: Button group with Hard/Good/Easy
- `data-testid="rating-buttons"` on container
- `role="group"` with `aria-label="Rate your recall"`
- Each button: descriptive `aria-label` (e.g., "Rate as Hard — shorter review interval")
- Colors: Hard = `bg-destructive/10 text-destructive`, Good = `bg-brand-soft text-brand`, Easy = `bg-success-soft text-success`

**Commit**: `feat(E11-S01): add ReviewCard and RatingButtons components`

### Step 6: Route and Navigation
**Files**: `src/app/routes.tsx`, `src/app/config/navigation.ts`

- Add lazy import: `const ReviewQueue = React.lazy(() => import('./pages/ReviewQueue').then(m => ({ default: m.ReviewQueue })))`
- Add route: `{ path: 'review', element: <SuspensePage><ReviewQueue /></SuspensePage> }`
- Add nav item to "Learn" group in `navigation.ts`: `{ name: 'Review', path: '/review', icon: RotateCcw }` (or `RefreshCw` — Lucide icon for spaced review cycle)
- Position: after "Notes" in the "Learn" group (natural flow: take notes → review notes)

**Commit**: `feat(E11-S01): add /review route and sidebar navigation`

### Step 7: Unit Tests for Algorithm
**File**: `src/lib/__tests__/spacedRepetition.test.ts` (new)

Test with Vitest (existing unit test setup):
- Hard rating produces shorter interval than Good
- Good rating produces shorter interval than Easy
- First review starts at default interval (~1 day for Hard, ~3 for Good, ~7 for Easy)
- Retention percentage decreases over time (exponential decay)
- Retention is 100% immediately after review
- Ease factor adjusts correctly with repeated Hard/Good/Easy ratings
- Edge cases: very old reviews (retention near 0%), just-reviewed (retention near 100%)

**Commit**: `test(E11-S01): add unit tests for spaced repetition algorithm`

### Step 8: Update ATDD E2E Tests
**File**: `tests/e2e/story-e11-s01.spec.ts` (already created — update if needed)

- Add test data seeding using `seedIndexedDBStore` pattern for `reviewRecords` table
- Add note factory usage for seeding notes that have review records
- Ensure AC5 error test properly simulates IndexedDB failure

**Commit**: `test(E11-S01): update E2E tests with seeding and assertions`

## Critical Files

| File | Action | Purpose |
|------|--------|---------|
| `src/data/types.ts` | Edit | Add `ReviewRecord`, `ReviewRating` types |
| `src/lib/spacedRepetition.ts` | Create | SM-2 algorithm (pure functions) |
| `src/db/schema.ts` | Edit | Add v13 migration with `reviewRecords` table |
| `src/stores/useReviewStore.ts` | Create | Zustand store with queue, rating, retry |
| `src/app/pages/ReviewQueue.tsx` | Create | Route-level page component |
| `src/app/components/figma/ReviewCard.tsx` | Create | Review card with retention/metadata |
| `src/app/components/figma/RatingButtons.tsx` | Create | Hard/Good/Easy button group |
| `src/app/routes.tsx` | Edit | Add `/review` route with lazy loading |
| `src/app/config/navigation.ts` | Edit | Add "Review" to sidebar "Learn" group |
| `src/lib/__tests__/spacedRepetition.test.ts` | Create | Unit tests for algorithm |
| `tests/e2e/story-e11-s01.spec.ts` | Edit | Update ATDD tests with seeding |

## Reuse Existing Utilities

| Utility | Location | Usage |
|---------|----------|-------|
| `persistWithRetry` | `src/lib/persistWithRetry.ts` | Wrap all Dexie writes in store |
| `staggerContainer`, `fadeUp` | `src/lib/motion.ts` | Card list entrance animation |
| `Empty`, `EmptyMedia`, `EmptyTitle`, `EmptyDescription` | `src/app/components/ui/empty.tsx` | Empty state when no reviews due |
| `Card`, `CardContent` | `src/app/components/ui/card.tsx` | ReviewCard wrapper |
| `Button` | `src/app/components/ui/button.tsx` | Rating buttons |
| `Badge` | `src/app/components/ui/badge.tsx` | Retention % badge |
| `DelayedFallback` | `src/app/components/DelayedFallback.tsx` | Loading state |
| `Skeleton` | `src/app/components/ui/skeleton.tsx` | Loading skeletons |
| `toast` | `sonner` | Error/retry notifications |
| `seedIndexedDBStore` | `tests/support/helpers/indexeddb-seed.ts` | E2E test seeding |

## Verification

1. **Build**: `npm run build` — no TS errors
2. **Lint**: `npm run lint` — no hardcoded colors, no test anti-patterns
3. **Unit tests**: `npx vitest run src/lib/__tests__/spacedRepetition.test.ts`
4. **E2E tests**: `npx playwright test tests/e2e/story-e11-s01.spec.ts --project=chromium`
5. **Manual**: Navigate to `/review`, verify empty state, add review records manually via console, verify queue sorting and rating flow
