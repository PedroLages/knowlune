# E11-S05: Interleaved Review Mode — Implementation Plan

## Context

Learners need to review notes from multiple courses in a mixed sequence weighted by topic similarity and time since last review. This strengthens cross-topic connections and improves long-term retention through varied practice (interleaving effect). The spaced review system (E11-S01) and note infrastructure (Epic 3) are already complete — this story builds a new review mode on top of that foundation.

## Architecture

Single new route `/review/interleaved` with 3 new components + 1 pure algorithm function. Reuses existing `RatingButtons`, `useReviewStore.rateNote()`, and `spacedRepetition` functions. No database schema changes.

```
src/lib/interleave.ts              (NEW — pure algorithm)
src/stores/useReviewStore.ts       (MODIFY — add session state)
src/app/components/figma/InterleavedCard.tsx    (NEW — 3D card-flip)
src/app/components/figma/InterleavedSummary.tsx (NEW — session summary)
src/app/pages/InterleavedReview.tsx             (NEW — page orchestrator)
src/app/routes.tsx                 (MODIFY — add route)
src/app/pages/ReviewQueue.tsx      (MODIFY — add entry point link)
```

## Tasks (in order)

### Task 1: Interleaving Algorithm
**File:** `src/lib/interleave.ts` + `src/lib/__tests__/interleave.test.ts`

Greedy algorithm that picks notes to maximize variety:
- **Time urgency** (60%): Lower `predictRetention()` → higher urgency
- **Topic dissimilarity** (40%): Jaccard distance on `tags[]` from last-selected note → spread topics apart

```typescript
export function interleaveReviews(dueReviews: ReviewRecord[], noteMap: Map<string, Note>, now: Date): ReviewRecord[]
export function jaccardSimilarity(tagsA: string[], tagsB: string[]): number
```

O(n²) greedy selection — fine for typical queue sizes (10-50 notes).

**Unit tests:** Empty input, single item, same-course spreading, time urgency dominance when tags are empty.

**Commit:** `feat(E11-S05): add interleaving algorithm with Jaccard similarity`

### Task 2: Extend Review Store
**File:** `src/stores/useReviewStore.ts`

Add interleaved session state and actions:
```typescript
interleavedQueue: ReviewRecord[]    // ordered from interleave()
interleavedIndex: number            // current card (0-based)
interleavedRatings: ReviewRating[]  // session ratings
interleavedCourseIds: Set<string>   // unique courses
isInterleavedActive: boolean

startInterleavedSession(noteMap, now?) → void
rateInterleavedNote(rating, now?) → Promise<void>  // delegates to rateNote()
endInterleavedSession() → InterleavedSessionSummary
```

**Commit:** `feat(E11-S05): add interleaved session state to review store`

### Task 3: InterleavedCard Component
**File:** `src/app/components/figma/InterleavedCard.tsx`

3D card-flip using `motion/react`:
- **Front:** Course badge, topic tag, note prompt excerpt, "Tap to reveal" hint
- **Back:** Full note excerpt, retention badge, `<RatingButtons>` (existing component)
- Flip via `animate={{ rotateY: isFlipped ? 180 : 0 }}` with `perspective: 1000px`
- `backfaceVisibility: 'hidden'` on both faces
- Rating buttons hidden until flipped
- Keyboard: Space/Enter to flip
- `role="button"`, `aria-label`, `aria-live="polite"` on back face

**Commit:** `feat(E11-S05): add InterleavedCard with 3D flip animation`

### Task 4: InterleavedSummary Component
**File:** `src/app/components/figma/InterleavedSummary.tsx`

Session completion card:
- Stats grid: total reviewed, courses covered, ratings distribution (colored bars), retention improvement
- Actions: "Start New Session" (brand) | "Return to Review Queue" (outline)
- Uses `CheckCircle2` icon, design tokens for colors

**Commit:** `feat(E11-S05): add InterleavedSummary component`

### Task 5: Page + Route + Navigation
**Files:**
- `src/app/pages/InterleavedReview.tsx` (NEW — page orchestrator)
- `src/app/routes.tsx` (MODIFY — add lazy route)
- `src/app/pages/ReviewQueue.tsx` (MODIFY — add "Interleaved Mode" link)

Page state machine: `idle` → `reviewing` → `summary`

- **Single-course detection (AC4):** Check unique courseIds in due notes. If 1, show `AlertDialog` with "Continue Anyway" / "Return to Review Queue".
- **Reviewing:** Progress bar + InterleavedCard. Manages `isFlipped` locally. On rate → advance. When done → summary.
- **Keyboard shortcuts:** `useEffect` with `keydown` — Space/Enter to flip, 1/2/3 for ratings (only when card focused + flipped).
- **Entry point:** "Interleaved Mode" button with `Shuffle` icon on ReviewQueue page header.

**Commit:** `feat(E11-S05): add InterleavedReview page with route and entry point`

### Task 6: E2E Tests
**Files:**
- `tests/e2e/story-e11-s05.spec.ts` (MODIFY — flesh out scaffolded tests)
- `tests/support/fixtures/factories/review-factory.ts` (NEW — factory)
- `tests/support/helpers/indexeddb-seed.ts` (MODIFY — add `seedReviewRecords` helper)

Each AC mapped to a test with proper seeding (notes + review records across 2 courses).

**Commit:** `test(E11-S05): implement E2E tests for all acceptance criteria`

## Key Reuse Points

| Existing | Reused For |
|----------|-----------|
| `RatingButtons.tsx` | Back face of InterleavedCard (unchanged) |
| `useReviewStore.rateNote()` | Rating persistence + optimistic updates |
| `predictRetention()` | Time urgency scoring in algorithm |
| `isDue()` | Filtering due reviews |
| `AlertDialog` (shadcn/ui) | Single-course fallback dialog |
| `motion/react` | Card flip + enter/exit animations |
| `staggerContainer`/`fadeUp` | Summary card entry animation |

## Data Testids

| Element | `data-testid` |
|---------|---------------|
| Page | `interleaved-review` |
| Progress | `interleaved-progress` |
| Card front | `interleaved-card-front` |
| Card back | `interleaved-card-back` |
| Course name | `interleaved-course-name` |
| Single-course dialog | `single-course-dialog` |
| Summary | `interleaved-summary` |
| Summary total | `summary-total-reviewed` |
| Summary courses | `summary-courses-covered` |

## Verification

1. **Unit tests:** `npm run test:unit -- --grep interleave` — algorithm + store tests pass
2. **Build:** `npm run build` — no TypeScript errors
3. **Lint:** `npm run lint` — no design token violations
4. **E2E:** `npx playwright test tests/e2e/story-e11-s05.spec.ts` — all 5 ACs pass
5. **Manual:** Navigate to `/review`, click "Interleaved Mode", flip cards, rate, see summary
