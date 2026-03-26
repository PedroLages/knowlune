# E26-S05: Per Path Progress Tracking — Implementation Plan

## Context

Epic 26 ("Multi-Path Learning Journeys") introduces support for multiple named learning paths, each containing courses organized in stages. Stories E26-S01 through S04 establish the data model, list view, detail view, and AI placement. **E26-S05 adds progress tracking** — calculating and displaying how far the learner has progressed through each learning path.

### Current State

- **Single learning path**: The existing `learningPath` Dexie table (v10) stores a single AI-generated course sequence with flat `LearningPathCourse` records (courseId, position, justification). No concept of multiple paths or stages.
- **Per-course progress**: Already tracked via two systems:
  - `contentProgress` table (v7): Per-lesson completion status (`not-started`/`in-progress`/`completed`)
  - `progress.ts`: localStorage-based `completedLessons[]` per course, with `getCourseCompletionPercent(courseId, totalLessons)`
- **Celebrations**: Existing `CompletionModal` component with confetti animations for lesson/module/course completion. Uses `canvas-confetti` library with accessibility (respects `prefers-reduced-motion`).

### Dependencies (E26-S01 through S04)

This plan assumes the following exist from prior stories:

**From E26-S01 (Multi-Path Data Model):**
- New Dexie table: `learningPaths` — stores path definitions
- New Dexie table: `pathCourses` — maps courses to paths with stage and position
- Types: `LearningPath`, `PathCourse`, `PathStage` (or similar)
- Example assumed shape:
  ```typescript
  interface LearningPath {
    id: string
    title: string
    description: string
    stages: PathStage[]
    createdAt: string
    updatedAt: string
    completedAt?: string  // Added by E26-S05
  }

  interface PathStage {
    id: string
    title: string
    position: number
  }

  interface PathCourse {
    pathId: string
    courseId: string
    stageId: string
    position: number
  }
  ```

**From E26-S02 (Learning Path List View):**
- `src/app/pages/LearningPaths.tsx` — list view page
- Route: `/learning-paths`

**From E26-S03 (Path Detail View):**
- `src/app/pages/LearningPathDetail.tsx` — detail page with stages and course cards
- Route: `/learning-paths/:pathId`

**From E26-S04 (AI Path Placement):**
- AI-powered course placement within paths (does not directly affect progress tracking)

### Adaptation Strategy

If the actual data model from E26-S01 differs from assumptions above, adapt the progress calculation functions to match. The core algorithm (aggregate per-course completion into per-path/per-stage) is independent of the exact schema shape.

## Architecture Decision

**Derived progress (compute-on-read), no new DB table.**

Path progress is computed from existing `contentProgress` records + course metadata, not stored separately. This avoids data duplication, eliminates sync bugs, and leverages the existing source of truth.

**Why not store path progress?**
- `contentProgress` already tracks every lesson completion with timestamps
- Storing derived percentages creates a sync problem (what if contentProgress changes but pathProgress isn't updated?)
- Computing on-read is fast: paths contain 3-15 courses, each needing one `contentProgress` query
- Caching in Zustand state eliminates repeated DB reads during a session

**Performance**: For a path with 10 courses × ~20 lessons each = ~200 contentProgress lookups. Dexie indexed queries on `[courseId+itemId]` are sub-millisecond. Total computation < 10ms.

## Tasks

### Task 1: Path progress calculation utilities (AC: 1, 2, 3, 7)

**File**: `src/lib/pathProgress.ts` (new)

Pure functions that compute progress at three granularities:

```typescript
import type { CompletionStatus } from '@/data/types'

interface CourseProgressInfo {
  courseId: string
  completedLessons: number
  totalLessons: number
  completionPercent: number  // 0-100
  status: CompletionStatus   // derived: 0% → not-started, 100% → completed, else → in-progress
}

interface StageProgressInfo {
  stageId: string
  stageTitle: string
  courses: CourseProgressInfo[]
  completedCourses: number
  totalCourses: number
  completionPercent: number  // average of course completion percents
  isComplete: boolean        // all courses 100%
}

interface PathProgressInfo {
  pathId: string
  stages: StageProgressInfo[]
  completedCourses: number
  totalCourses: number
  overallPercent: number     // average of all course completion percents
  isComplete: boolean        // all stages complete
  completedAt?: string       // ISO timestamp when path hit 100%
}

/**
 * Calculate progress for a single course.
 * Uses contentProgress records from Dexie.
 */
async function calculateCourseProgress(
  courseId: string,
  lessonIds: string[]
): Promise<CourseProgressInfo>

/**
 * Calculate progress for an entire learning path.
 * Aggregates course progress into stage and path-level metrics.
 */
async function calculatePathProgress(
  path: LearningPath,
  pathCourses: PathCourse[],
  courseLessonMap: Map<string, string[]>  // courseId → lessonIds
): Promise<PathProgressInfo>

/**
 * Calculate progress for all paths (used by list view).
 * Returns a Map<pathId, PathProgressInfo> for O(1) lookup.
 */
async function calculateAllPathsProgress(
  paths: LearningPath[],
  allPathCourses: PathCourse[],
  courseLessonMap: Map<string, string[]>
): Promise<Map<string, PathProgressInfo>>
```

**Key implementation details:**
- Query `db.contentProgress.where({ courseId }).toArray()` for each course
- Count records with `status === 'completed'` against total lesson count
- Course completion = `(completedLessons / totalLessons) * 100` (matches existing `getCourseCompletionPercent`)
- Stage completion = average of course completions in that stage
- Path completion = average of all course completions across all stages
- Handle edge cases: 0 lessons → 0%, missing courseId → skip with warning

**Unit tests**: `src/lib/__tests__/pathProgress.test.ts`
- Test with 0%, 50%, 100% course completion
- Test multi-stage aggregation
- Test edge cases: empty path, course with 0 lessons, orphaned courses

### Task 2: Path progress store (AC: 1, 4, 7)

**File**: `src/stores/usePathProgressStore.ts` (new)

Zustand store that caches computed progress and provides reactive updates:

```typescript
interface PathProgressState {
  progressMap: Map<string, PathProgressInfo>  // pathId → progress
  isLoading: boolean
  error: string | null

  /** Load progress for all paths (list view) */
  loadAllProgress: () => Promise<void>

  /** Load progress for a single path (detail view) */
  loadPathProgress: (pathId: string) => Promise<void>

  /** Get cached progress for a path */
  getPathProgress: (pathId: string) => PathProgressInfo | undefined

  /** Refresh progress after a lesson completion event */
  refreshPathProgress: (courseId: string) => Promise<void>
}
```

**Reactive update strategy:**
- When `useContentProgressStore.setItemStatus()` is called (lesson completed/uncompleted), the affected `courseId` is known
- The path progress store exposes `refreshPathProgress(courseId)` which finds all paths containing that course and recalculates their progress
- This is called from the path detail view's effect or from a cross-store subscription

**Pattern**: Follow existing store conventions — `persistWithRetry` for writes, error state management, optimistic updates where safe.

### Task 3: Progress UI on path list view (AC: 4, 6)

**File**: `src/app/pages/LearningPaths.tsx` (modify — assumed from E26-S02)

Add to each path card:
1. **Progress bar**: `<Progress>` shadcn component with `bg-brand` fill
2. **Course count**: "3/8 courses completed" text below description
3. **Sort control**: Toggle to sort by completion % (descending)
4. **Zero-progress state**: "Start your first course to begin tracking" when 0%

```tsx
// On each path card:
<div className="mt-4 space-y-2">
  <div className="flex justify-between text-sm">
    <span className="text-muted-foreground">
      {progress.completedCourses}/{progress.totalCourses} courses
    </span>
    <span className="font-medium">{progress.overallPercent}%</span>
  </div>
  <Progress
    value={progress.overallPercent}
    className="h-2"
    aria-label={`${path.title}: ${progress.overallPercent}% complete`}
  />
</div>
```

**Completed path badge**: When `isComplete`, overlay a "Completed" badge:
```tsx
{progress.isComplete && (
  <Badge variant="success" className="absolute top-4 right-4">
    <CheckCircle2 className="size-3 mr-1" /> Completed
  </Badge>
)}
```

### Task 4: Progress UI on path detail view (AC: 2, 3, 6)

**File**: `src/app/pages/LearningPathDetail.tsx` (modify — assumed from E26-S03)

Add three progress layers:

**4a. Overall path progress header:**
- Full-width progress bar below path title
- "X% Complete — Y of Z courses finished"
- Uses `PathProgressInfo.overallPercent`

**4b. Per-stage progress sections:**
- Each stage has a collapsible section header with:
  - Stage title + progress bar
  - Checkmark badge when stage is 100% complete
  - "X/Y courses" subtitle
- Uses `StageProgressInfo`

**4c. Per-course progress on course cards:**
- Circular progress indicator or small linear progress bar
- Shows individual course completion %
- "Not started" / "In progress" / "Completed" status text
- Links to course detail page
- Uses `CourseProgressInfo`

**Accessibility:**
- `role="progressbar"` with `aria-valuenow={percent}` `aria-valuemin={0}` `aria-valuemax={100}`
- Screen reader announcement: `aria-label="Stage Foundations: 75% complete, 3 of 4 courses finished"`

### Task 5: Path completion celebration (AC: 5)

**File**: `src/app/pages/LearningPathDetail.tsx` (modify) + `src/lib/pathProgress.ts` (add detection)

**Detection**: Compare previous `isComplete` to current after `refreshPathProgress()`. If transition from `false → true`:
1. Set `completedAt` timestamp on the `LearningPath` record in Dexie
2. Trigger celebration

**Celebration approach**: Extend existing `CompletionModal` component:
- Add `'path'` to `CelebrationType` union: `'lesson' | 'module' | 'course' | 'path'`
- Path completion gets the most extravagant confetti burst (more particles than course)
- Modal shows: path title, total courses completed, estimated time invested
- "Completed" badge appears on path card in list view with `completedAt` date

**File**: `src/app/components/celebrations/CompletionModal.tsx` (modify)
- Add `path` case to `getIcon()`, `getTitle()`, `getDescription()`, `triggerConfetti()`
- Path icon: `Award` from lucide-react
- Confetti: 300 particles, full-width burst (most celebratory)

### Task 6: E2E tests (AC: all)

**File**: `tests/e2e/e26-s05-per-path-progress-tracking.spec.ts` (new)

**Test scenarios:**

```typescript
test.describe('E26-S05: Per Path Progress Tracking', () => {
  // Setup: Seed multi-path data (from E26-S01 schema) + contentProgress records

  test('AC1: displays path completion percentage on detail view', async () => {
    // Seed: path with 4 courses, 2 at 100%, 1 at 50%, 1 at 0%
    // Expected: overall = (100+100+50+0)/4 = 62%
    // Assert: progress bar shows 62%, text shows "2/4 courses"
  })

  test('AC2: displays stage-level progress with completion badges', async () => {
    // Seed: path with 2 stages, stage 1 at 100%, stage 2 at 50%
    // Assert: stage 1 has checkmark badge, stage 2 shows progress bar
  })

  test('AC3: course cards show individual completion percentage', async () => {
    // Seed: course with 10 lessons, 7 completed
    // Assert: course card shows "70%"
  })

  test('AC4: path list view shows progress summary', async () => {
    // Seed: 2 paths with different completion levels
    // Assert: each card shows progress bar + "X/Y courses"
  })

  test('AC5: celebration on path completion', async () => {
    // Seed: path at 99% (one lesson remaining)
    // Action: mark final lesson complete
    // Assert: celebration modal appears with path info
  })

  test('AC6: zero progress shows empty state messaging', async () => {
    // Seed: path with courses, no contentProgress records
    // Assert: "Start your first course" message, 0% progress
  })

  test('AC7: progress persists across navigation', async () => {
    // Seed: path at 50%
    // Navigate away, navigate back
    // Assert: still shows 50%
  })
})
```

**Test infrastructure:**
- New factory: `tests/support/fixtures/factories/learning-path-factory.ts`
  - `createLearningPath(overrides)` → LearningPath
  - `createPathCourse(overrides)` → PathCourse
  - `createPathStage(overrides)` → PathStage
- Reuse: `createContentProgress()` from existing factory
- Reuse: `createImportedCourse()` from existing factory
- Seed via `seedIndexedDBStore()` helper

## File Change Summary

### New Files (5)
| File | Purpose |
|------|---------|
| `src/lib/pathProgress.ts` | Pure progress calculation functions |
| `src/lib/__tests__/pathProgress.test.ts` | Unit tests for progress calculations |
| `src/stores/usePathProgressStore.ts` | Zustand store caching path progress |
| `tests/e2e/e26-s05-per-path-progress-tracking.spec.ts` | E2E test suite |
| `tests/support/fixtures/factories/learning-path-factory.ts` | Test data factories |

### Modified Files (3)
| File | Change |
|------|--------|
| `src/app/pages/LearningPaths.tsx` | Add progress bars, course counts, sort, zero-state |
| `src/app/pages/LearningPathDetail.tsx` | Add path/stage/course progress UI, celebration trigger |
| `src/app/components/celebrations/CompletionModal.tsx` | Add `'path'` celebration type |

## Implementation Order

```
1. pathProgress.ts (pure functions, no dependencies)
   └── pathProgress.test.ts (unit tests)
2. usePathProgressStore.ts (depends on pathProgress.ts)
3. CompletionModal.tsx (add 'path' type — small, independent)
4. LearningPaths.tsx (list view progress — depends on store)
5. LearningPathDetail.tsx (detail view progress + celebration — depends on store + modal)
6. E2E tests (depend on all UI changes)
```

Steps 1-3 can be implemented independently. Steps 4-5 depend on the E26-S01/S02/S03 data model and pages.

## Risks & Mitigations

| Risk | Impact | Mitigation |
|------|--------|------------|
| E26-S01 data model differs from assumptions | Plan needs adaptation | Core algorithm is schema-agnostic; only the data access layer needs adjustment |
| `contentProgress` doesn't have data for all courses | Some courses show 0% incorrectly | Distinguish "0 lessons completed" from "course has 0 lessons tracked" |
| Performance with many paths/courses | Slow list view load | Compute lazily (only visible paths), memoize results in store |
| Cross-store reactivity complexity | Stale progress after lesson completion | Use explicit `refreshPathProgress(courseId)` call chain, not implicit subscriptions |

## References

- Existing progress: `src/lib/progress.ts:getCourseCompletionPercent()` (line 373)
- Content progress store: `src/stores/useContentProgressStore.ts`
- Celebration system: `src/app/components/celebrations/CompletionModal.tsx`
- Challenge progress (similar pattern): `src/lib/challengeProgress.ts`
- Test factories: `tests/support/fixtures/factories/content-progress-factory.ts`
- Epic 20 planning: `docs/planning-artifacts/epic-20-learning-pathways.md`
