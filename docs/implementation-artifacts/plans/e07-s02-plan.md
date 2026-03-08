# E07-S02: Recommended Next Dashboard Section — Implementation Plan

**Story:** [7-2-recommended-next-dashboard-section.md](../7-2-recommended-next-dashboard-section.md)
**Branch:** `feature/e07-s02-recommended-next-dashboard-section`
**Date:** 2026-03-08

---

## 1. Context & Dependencies

### E07-S01 Dependency
Story 7.1 (Momentum Score) is still `backlog`. Rather than block on it, this plan introduces a **self-contained composite scoring function** that approximates momentum using data already available:
- `lastAccessedAt` from `progress.ts` (recency)
- `completedLessons` count (completion proximity)
- `studySessions` from Dexie (session frequency as proxy for momentum)

When E07-S01 is implemented later, the `computeCompositeScore` function in `recommendations.ts` will be updated to accept the proper momentum score.

### Existing Foundation
| File | Relevance |
|------|-----------|
| `src/lib/progress.ts` | `getAllProgress()`, `getCourseCompletionPercent()`, `CourseProgress` type |
| `src/stores/useSessionStore.ts` | `loadSessionStats()`, session data from Dexie |
| `src/app/pages/Overview.tsx` | Dashboard page to add the new section to |
| `src/app/components/ContinueLearning.tsx` | Pattern reference for hero section with course state logic |
| `src/app/components/figma/CourseCard.tsx` | Reusable card component with `variant="overview"` |
| `src/data/courses.ts` | `allCourses` array |
| `src/data/types.ts` | `Course` type with `tags`, `totalLessons`, `modules` |

---

## 2. Files to Create/Modify

### New Files
| File | Purpose |
|------|---------|
| `src/lib/recommendations.ts` | Pure composite scoring algorithm |
| `src/lib/__tests__/recommendations.test.ts` | Unit tests for scoring |
| `src/app/components/RecommendedNext.tsx` | Dashboard widget component |
| `tests/e2e/story-e07-s02.spec.ts` | E2E tests |

### Modified Files
| File | Change |
|------|--------|
| `src/app/pages/Overview.tsx` | Add `<RecommendedNext />` section + skeleton |

---

## 3. Algorithm Design

### 3.1 Active Course Definition
A course is "active" if:
```typescript
completedLessons.length > 0 && completionPercent < 100
```
(Has been started but not finished.)

### 3.2 Composite Score Formula
```
compositeScore = (recencyScore * 0.40) + (completionProximityScore * 0.40) + (frequencyScore * 0.20)
```

**Recency Score** (0–1):
```typescript
const daysSinceAccess = (Date.now() - new Date(lastAccessedAt).getTime()) / 86_400_000
recencyScore = Math.max(0, 1 - daysSinceAccess / 30)
// 0 days ago = 1.0, 30+ days ago = 0.0
```

**Completion Proximity Score** (0–1):
```typescript
completionProximityScore = completionPercent / 100
// 90% complete = 0.9 (closest to finishing = highest)
// NOTE: "completion proximity" means prioritize almost-done courses
```
Per AC: "courses closest to completion weighted higher" → higher completion% = higher score.

**Session Frequency Score** (0–1):
```typescript
const sessionsLast30Days = sessions.filter(s =>
  s.courseId === course.id &&
  new Date(s.startTime) > thirtyDaysAgo
).length
frequencyScore = Math.min(1, sessionsLast30Days / 10)
// 0 sessions = 0.0, 10+ sessions = 1.0 (cap at 1)
```

### 3.3 Function Signatures
```typescript
// src/lib/recommendations.ts

export interface CourseScore {
  course: Course
  score: number
  completionPercent: number
}

export function computeCompositeScore(
  course: Course,
  progress: CourseProgress,
  sessionCountLast30Days: number
): number

export function getRecommendedCourses(
  courses: Course[],
  allProgress: Record<string, CourseProgress>,
  sessionCountsPerCourse: Record<string, number>,
  limit?: number
): CourseScore[]
// Returns top `limit` active courses ranked by composite score
// Returns all active courses if fewer than `limit`
// Returns [] if no active courses
```

---

## 4. Component Design

### 4.1 RecommendedNext Component
```tsx
// src/app/components/RecommendedNext.tsx
// Uses useSessionStore to load session counts async
// Falls back gracefully if Dexie is unavailable

export function RecommendedNext()
```

**State:**
- `sessionCountsPerCourse: Record<string, number>` — loaded from Dexie on mount via `useSessionStore`
- Derived from `getAllProgress()` + `allCourses` (synchronous)

**Render states:**
1. **Loading** — skeleton (3 placeholder cards, same height as course cards)
2. **No active courses** — empty state: icon + "No courses in progress" + "Explore courses" CTA → `/courses`
3. **1–2 active courses** — show all (1 or 2 cards)
4. **3+ active courses** — show top 3 cards only

### 4.2 Card Layout
Use a horizontal scrollable grid on mobile, 3-column grid on desktop:
```
grid-cols-1 sm:grid-cols-3 gap-4
```

Each card: use `CourseCard` with `variant="overview"` to reuse existing design.
The card click navigates to `/courses/:courseId`.

### 4.3 Section Header
```
"Recommended Next" heading (text-xl)
+ optional subtitle: "Based on your learning activity"
```

---

## 5. Overview Page Integration

Insert `<RecommendedNext />` between the Hero Zone (ContinueLearning) and the Metrics Strip in `Overview.tsx`:

```tsx
{/* ── Hero Zone ── */}
<motion.section variants={fadeUp} className="space-y-6">
  ...
  <ContinueLearning />
</motion.section>

{/* ── Recommended Next ── NEW */}
<motion.section variants={fadeUp}>
  <RecommendedNext />
</motion.section>

{/* ── Metrics Strip ── */}
<motion.section variants={fadeUp}>
  ...
</motion.section>
```

Also update the loading skeleton in Overview to add a placeholder for this section.

---

## 6. Test Plan

### 6.1 Unit Tests (`src/lib/__tests__/recommendations.test.ts`)

| Test | Scenario |
|------|----------|
| Returns top 3 when 5+ active courses | AC1 |
| Returns all (2) when only 2 active courses | AC2 |
| Returns [] when no active courses | AC4 |
| Higher recency scores rank first | AC1 |
| Higher completion proximity scores rank first | AC1 |
| Courses at 100% completion excluded (done = not active) | AC1 |
| Courses with 0% progress excluded (not started = not active) | AC1 |
| frequencyScore capped at 1.0 (10+ sessions) | edge case |

### 6.2 E2E Tests (`tests/e2e/story-e07-s02.spec.ts`)

| Test | Steps |
|------|-------|
| Section renders with active courses | Seed `course-progress` with 2 in-progress courses, navigate to `/`, assert heading "Recommended Next" visible, assert ≥1 course card visible |
| Empty state with no progress | No seeded data, navigate to `/`, assert empty state message visible |
| Course card navigates correctly | Seed course, click card, assert URL contains `/courses/` |

Follow `tests/e2e/overview.spec.ts` pattern:
- Import from `../support/fixtures`
- Use `createCourseProgress` factory
- Seed `course-progress` via `localStorage.seed()`

---

## 7. Implementation Order (TDD)

1. **RED**: Write failing unit tests for `recommendations.ts` functions
2. **GREEN**: Implement `src/lib/recommendations.ts` to pass tests
3. **REFACTOR**: Clean up, add edge case handling
4. **RED**: Write failing component tests / E2E skeleton
5. **GREEN**: Build `RecommendedNext.tsx` component
6. **GREEN**: Add session loading hook pattern (mirror `useSessionStore` from Overview)
7. **GREEN**: Integrate into `Overview.tsx`
8. **GREEN**: Run E2E tests, fix failures
9. **DONE**: All tests pass, run full regression

---

## 8. Accessibility & Design

- Section heading: `<h2>` with `text-xl` matching existing Overview sections
- `aria-labelledby` linking section to heading
- Empty state: descriptive text + link CTA
- Course cards: existing `CourseCard` handles accessibility
- Loading skeleton: matches existing skeleton patterns in Overview

---

## 9. Caveats & Risks

| Risk | Mitigation |
|------|-----------|
| E07-S01 not implemented → no real momentum score | Self-contained algorithm approximates it; clean seam for future upgrade |
| Dexie `studySessions` may be empty for new users | `frequencyScore` defaults to 0; recency + completion still rank correctly |
| `allCourses` is static — no live import detection | Acceptable for this story; E07 epic uses static course data |
| Session loading is async → might cause layout shift | Show loading skeleton while sessions load |
