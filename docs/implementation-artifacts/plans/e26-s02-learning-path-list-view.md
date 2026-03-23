# Plan: E26-S02 — Learning Path List View

## Context

Epic 26 (Multi-Path Learning Journeys) splits the original E20-S01 "Career Paths System" into 5 granular stories. E26-S02 creates the browsable list page where users discover, compare, and enroll in multi-course learning paths.

**Dependency:** E26-S01 (Multi-Path Data Model and Migration) provides the data foundation — types (`LearningPath`, `LearningPathStage`, `LearningPathEnrollment`), Dexie v20 schema, and `useLearningPathsStore` Zustand store. **E26-S01 must be merged or this branch must be rebased onto it before implementation begins.**

### Current State

| Component | Location | State |
|-----------|----------|-------|
| AI Learning Path page | `src/app/pages/AILearningPath.tsx` | Single flat AI-generated path with dnd-kit |
| Existing store (singular) | `src/stores/useLearningPathStore.ts` | Single path: `loadLearningPath`, `generatePath`, `reorderCourse` |
| Navigation | `src/app/config/navigation.ts:54` | "Learning Path" → `/ai-learning-path` (singular) |
| Route | `src/app/routes.tsx:250-256` | `/ai-learning-path` → `AILearningPath` component |

### Target State

A new `/learning-paths` (plural) page that:
- Displays all non-archived `LearningPath` records from E26-S01's `useLearningPathsStore`
- Shows enrollment status, progress, and source badges per card
- Navigates to `/learning-paths/:pathId` (detail view — E26-S03 scope)
- Replaces or coexists with the existing `/ai-learning-path` route (coexists for now; refactored in E26-S04)

### Downstream Stories

| Story | How E26-S02 Enables It |
|-------|----------------------|
| E26-S03: Path Detail View with Drag-Drop Editor | Detail page linked from card click |
| E26-S04: AI Path Placement Suggestion | AI paths appear in the list with source badge |
| E26-S05: Per-Path Progress Tracking | Progress bar on cards shows per-path completion |

## Files to Create

| File | Purpose | Estimated Lines |
|------|---------|----------------|
| `src/app/pages/LearningPaths.tsx` | List page with header, empty state, card grid | ~120 |
| `src/app/components/figma/LearningPathCard.tsx` | Card component for a single learning path | ~100 |
| `src/app/pages/LearningPathDetail.tsx` | Placeholder for E26-S03 (renders path title + "Coming soon") | ~25 |
| `tests/e2e/learning-paths.spec.ts` | E2E tests for the list view | ~120 |
| `tests/helpers/learning-path-factories.ts` | Test data factories for LearningPath and LearningPathEnrollment | ~60 |

## Files to Modify

| File | Change | Why |
|------|--------|-----|
| `src/app/routes.tsx` | Add lazy imports + routes for `/learning-paths` and `/learning-paths/:pathId` | Routing (AC1, AC6) |
| `src/app/config/navigation.ts` | Add "Learning Paths" nav item to "Learn" group (keep existing "Learning Path" for now) | Sidebar navigation (AC1) |
| `tests/helpers/navigation.ts` | Add `goToLearningPaths(page)` navigation helper | E2E test convention |

## Files to Reference (read-only)

| File | Why |
|------|-----|
| `src/app/pages/Courses.tsx` | List page pattern: header, empty state, responsive grid, filter/sort |
| `src/app/pages/Authors.tsx` | Simpler card grid pattern |
| `src/app/components/figma/ImportedCourseCard.tsx` | Card component pattern: rounded-[24px], hover effects, badge layout |
| `src/app/components/EmptyState.tsx` | Empty state component API |
| `src/app/components/ui/progress.tsx` | Progress bar component API |
| `src/app/components/ui/badge.tsx` | Badge variant patterns |
| `src/stores/useLearningPathStore.ts` | Zustand store consumption patterns |
| `src/data/types.ts` | Type definitions (after E26-S01 merge) |
| `tests/e2e/courses.spec.ts` | E2E test structure and assertions |

## Implementation

### Task 1: Add Route and Navigation (AC1)

**1.1 Add lazy import in `src/app/routes.tsx`** (after line 59):

```typescript
const LearningPaths = React.lazy(() =>
  import('./pages/LearningPaths').then(m => ({ default: m.LearningPaths }))
)
const LearningPathDetail = React.lazy(() =>
  import('./pages/LearningPathDetail').then(m => ({ default: m.LearningPathDetail }))
)
```

**1.2 Add routes** (after the `/ai-learning-path` route block, ~line 256):

```typescript
{
  path: 'learning-paths',
  element: (
    <SuspensePage>
      <LearningPaths />
    </SuspensePage>
  ),
},
{
  path: 'learning-paths/:pathId',
  element: (
    <SuspensePage>
      <LearningPathDetail />
    </SuspensePage>
  ),
},
```

**1.3 Update navigation in `src/app/config/navigation.ts`**:

Add a new `Route` icon import from lucide-react. Add a new navigation item in the "Learn" group after the existing "Learning Path" item:

```typescript
{ name: 'Learning Paths', path: '/learning-paths', icon: Route },
```

**Design decision:** Keep the existing "Learning Path" (singular, AI) nav item for now. E26-S04 will consolidate them. Using `Route` icon (path/journey metaphor) to visually distinguish from the AI `Sparkles` icon.

### Task 2: Create `LearningPathCard` Component (AC2, AC3, AC4, AC6, AC7)

Create `src/app/components/figma/LearningPathCard.tsx`.

**Props interface:**

```typescript
interface LearningPathCardProps {
  path: LearningPath
  enrollment: LearningPathEnrollment | null
  completedCourseCount: number
  totalCourseCount: number
}
```

**Component structure:**

```
<Link to={`/learning-paths/${path.id}`}>
  <Card className="rounded-[24px] border-0 shadow-sm hover:shadow-xl hover:scale-[1.02] transition-all cursor-pointer">
    <CardHeader>
      <div className="flex items-center justify-between">
        <CardTitle>{path.title}</CardTitle>
        {sourceIndicator}      // AC7: AI/Curated badge
      </div>
      <CardDescription className="line-clamp-2">{path.description}</CardDescription>
    </CardHeader>
    <CardContent>
      <div className="flex items-center gap-4 text-sm text-muted-foreground">
        <span>{totalCourseCount} courses</span>
        <span>{totalEstimatedHours}h</span>
      </div>
      {enrollment && progressBar}  // AC4: Progress bar
    </CardContent>
    <CardFooter>
      {enrollmentBadge}            // AC3: Enrolled/Completed badge
    </CardFooter>
  </Card>
</Link>
```

**Source indicator logic (AC7):**

| `path.source` | Icon | Label | Style |
|---------------|------|-------|-------|
| `'ai-generated'` | `Sparkles` | "AI Generated" | `text-muted-foreground` |
| `'curated'` | `BookOpen` | "Curated" | `text-muted-foreground` |
| `'manual'` | none | none | — |

**Enrollment badge logic (AC3):**

| State | Badge Text | Style |
|-------|-----------|-------|
| Not enrolled | none | — |
| Enrolled, incomplete | "Enrolled" | `bg-brand-soft text-brand-soft-foreground` |
| Enrolled, all courses complete | "Completed" | `bg-success/10 text-success` |

**Progress bar (AC4):**
- Only shown when `enrollment` is non-null
- Uses `<Progress value={percent} showLabel labelFormat={v => `${completedCourseCount} of ${totalCourseCount} courses`} />`

**Computed values:**
- `totalCourseCount`: `path.stages.reduce((sum, s) => sum + s.courseIds.length, 0)`
- `totalEstimatedHours`: Derived from path stages (if available) or computed from linked course durations
- `isComplete`: `completedCourseCount === totalCourseCount && totalCourseCount > 0`

### Task 3: Create `LearningPaths` Page Component (AC1, AC2, AC5, AC8)

Create `src/app/pages/LearningPaths.tsx`.

**State management:**

```typescript
// From E26-S01's store
const paths = useLearningPathsStore(s => s.paths)
const enrollments = useLearningPathsStore(s => s.enrollments)
const loadPaths = useLearningPathsStore(s => s.loadPaths)

// Load on mount
useEffect(() => {
  loadPaths()
}, [loadPaths])

// Filter out archived paths (AC8)
const visiblePaths = paths.filter(p => !p.isArchived)
```

**Page layout (follows Courses.tsx pattern):**

```
<div className="space-y-6">
  {/* Header */}
  <div>
    <h1 className="text-2xl font-bold tracking-tight">Learning Paths</h1>
    <p className="text-muted-foreground mt-1">
      Structured multi-course journeys to guide your learning
    </p>
  </div>

  {/* Empty state or card grid */}
  {visiblePaths.length === 0 ? (
    <EmptyState
      icon={Route}
      title="No learning paths yet"
      description="Create your first learning path to organize courses into a structured journey"
      actionLabel="Create Path"
      onAction={handleCreatePath}
      data-testid="learning-paths-empty-state"
    />
  ) : (
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
      {visiblePaths.map(path => (
        <LearningPathCard
          key={path.id}
          path={path}
          enrollment={enrollments.find(e => e.pathId === path.id) ?? null}
          completedCourseCount={getCompletedCount(path)}
          totalCourseCount={getTotalCourseCount(path)}
        />
      ))}
    </div>
  )}
</div>
```

**Progress computation:**

The `completedCourseCount` needs course completion data from the existing `contentProgress` table. Two approaches:

1. **Simple (recommended for this story):** Count courses that have 100% completion in `contentProgress`. Use a helper that queries IndexedDB:
   ```typescript
   function usePathProgress(path: LearningPath): { completed: number; total: number } {
     // Collect all courseIds across stages
     // Query contentProgress for each courseId
     // Count courses where all items are 'completed'
   }
   ```

2. **Deferred to E26-S05:** If per-path progress tracking is complex, show enrollment badge only (no progress bar) and add progress in E26-S05.

**Recommendation:** Implement a simple version that counts enrolled course completions. E26-S05 will enhance with stage-level progress.

### Task 4: Create `LearningPathDetail` Placeholder (AC6)

Create `src/app/pages/LearningPathDetail.tsx`:

```typescript
export function LearningPathDetail() {
  const { pathId } = useParams()
  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold tracking-tight">Learning Path Detail</h1>
      <p className="text-muted-foreground">Path ID: {pathId}</p>
      <p className="text-muted-foreground">Detail view coming in E26-S03.</p>
    </div>
  )
}
```

### Task 5: E2E Tests

Create `tests/e2e/learning-paths.spec.ts`.

**Test structure:**

```typescript
import { test, expect } from '../fixtures'
import { goToLearningPaths } from '../helpers/navigation'

test.describe('Learning Paths List View', () => {
  test('shows empty state when no paths exist', async ({ page }) => {
    await goToLearningPaths(page)
    await expect(page.getByTestId('learning-paths-empty-state')).toBeVisible()
    await expect(page.getByRole('heading', { name: 'No learning paths yet' })).toBeVisible()
  })

  test('displays path cards with metadata', async ({ page }) => {
    // Seed learning path data via IndexedDB
    await seedLearningPaths(page)
    await goToLearningPaths(page)
    // Assert cards visible with title, description, course count
  })

  test('shows enrollment badge for enrolled paths', async ({ page }) => {
    await seedLearningPaths(page, { withEnrollment: true })
    await goToLearningPaths(page)
    await expect(page.getByText('Enrolled')).toBeVisible()
  })

  test('hides archived paths', async ({ page }) => {
    await seedLearningPaths(page, { includeArchived: true })
    await goToLearningPaths(page)
    // Assert archived path title is NOT visible
  })

  test('navigates to detail view on card click', async ({ page }) => {
    await seedLearningPaths(page)
    await goToLearningPaths(page)
    await page.getByRole('link', { name: /Test Path/ }).click()
    await page.waitForURL(/\/learning-paths\//)
  })

  test('shows source badges for AI and curated paths', async ({ page }) => {
    await seedLearningPaths(page, { sources: ['ai-generated', 'curated', 'manual'] })
    await goToLearningPaths(page)
    await expect(page.getByText('AI Generated')).toBeVisible()
    await expect(page.getByText('Curated')).toBeVisible()
  })
})
```

**Test data factories** (`tests/helpers/learning-path-factories.ts`):

```typescript
export function createLearningPath(overrides?: Partial<LearningPath>): LearningPath {
  return {
    id: crypto.randomUUID(),
    title: 'Test Learning Path',
    description: 'A test path for E2E testing',
    stages: [
      {
        id: crypto.randomUUID(),
        title: 'Stage 1: Foundations',
        courseIds: [],
        order: 1,
        requiredForNext: true,
      },
    ],
    source: 'manual',
    isArchived: false,
    createdAt: '2026-01-01T00:00:00.000Z',
    updatedAt: '2026-01-01T00:00:00.000Z',
    ...overrides,
  }
}

export function createLearningPathEnrollment(
  pathId: string,
  overrides?: Partial<LearningPathEnrollment>
): LearningPathEnrollment {
  return {
    id: crypto.randomUUID(),
    pathId,
    enrolledAt: '2026-01-15T00:00:00.000Z',
    lastAccessedAt: '2026-01-20T00:00:00.000Z',
    ...overrides,
  }
}
```

**IndexedDB seeding:** Use the project's shared seeding helpers pattern (see `tests/helpers/`) to inject test data into the Dexie `learningPaths` and `learningPathEnrollments` tables.

## Build Sequence

Execute in this order:

1. **Task 1** — Route + navigation (unblocks manual testing)
2. **Task 2** — LearningPathCard component (core UI building block)
3. **Task 3** — LearningPaths page component (integrates card + store)
4. **Task 4** — Detail placeholder (enables card navigation)
5. **Task 5** — E2E tests (validates all ACs)

**Parallel opportunities:** Tasks 2 and 4 can be developed in parallel (no dependencies between card component and detail placeholder).

## Design Decisions

### Navigation: New item vs. replacing existing

**Decision:** Add a new "Learning Paths" (plural) navigation item. Keep existing "Learning Path" (singular, AI) nav item.

**Rationale:** The AI learning path page has its own distinct UX (generation, drag-reorder). Replacing it now would break the existing flow. E26-S04 will consolidate both into the new multi-path system.

### Progress computation: Simple vs. full

**Decision:** Use a simple "count completed courses" approach for the card's progress bar. Stage-level progress tracking is deferred to E26-S05.

**Rationale:** E26-S02 is a list view story — displaying approximate progress is sufficient. Per-stage completion gating and detailed progress are E26-S05 scope.

### Icon choice: Route

**Decision:** Use `Route` icon from lucide-react for the Learning Paths nav item and empty state.

**Rationale:** `Route` visually communicates "journey/path" better than generic icons. It also differentiates from `Sparkles` (AI) used by the existing singular learning path.

### Card grid: 3 columns max

**Decision:** Use `grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6` (not 4-5 columns like Courses).

**Rationale:** Learning path cards are taller (more metadata: stages, progress bar, badges) and benefit from wider cards. 3 columns provides better readability.

## Risks

| Risk | Impact | Mitigation |
|------|--------|------------|
| E26-S01 not yet merged | Blocked — no types, store, or DB tables | Rebase onto E26-S01 branch or implement both stories sequentially |
| Progress computation expensive | Slow page load with many paths | Compute lazily (only for enrolled paths), memoize results |
| Icon `Route` may not exist in current lucide-react version | Build error | Verify availability; fallback to `Map` or `Milestone` icon |

## Acceptance Criteria Traceability

| AC | Task | Test |
|----|------|------|
| AC1: Route + navigation | Task 1, Task 3 | `test('navigates to /learning-paths')` |
| AC2: Card metadata | Task 2, Task 3 | `test('displays path cards with metadata')` |
| AC3: Enrollment badges | Task 2 | `test('shows enrollment badge')` |
| AC4: Progress indicator | Task 2, Task 3 | `test('shows progress for enrolled paths')` |
| AC5: Empty state | Task 3 | `test('shows empty state')` |
| AC6: Card click → detail | Task 2, Task 4 | `test('navigates to detail view')` |
| AC7: Source indicator | Task 2 | `test('shows source badges')` |
| AC8: Archived hidden | Task 3 | `test('hides archived paths')` |
