# Plan: E20-S01 — Career Paths System

## Context

Knowlune currently tracks progress well but lacks structured learning direction. This story adds curated multi-course career paths with staged progression, prerequisites, and progress tracking. Industry data shows 40-60% higher completion rates for structured paths vs. ad-hoc learning.

**Branch**: `feature/e20-s01-career-paths-system`
**Story file**: `docs/implementation-artifacts/20-1-career-paths-system.md`

## Architecture Overview

The Career Paths system follows established Knowlune patterns:
- **Data layer**: TypeScript types in `src/data/types.ts`, Dexie schema v20 in `src/db/schema.ts`
- **State**: Zustand store (`useCareerPathStore`) following `useChallengeStore` / `useCourseStore` patterns
- **Pages**: Two lazy-loaded pages — list view (`CareerPaths.tsx`) and detail view (`CareerPathDetail.tsx`)
- **Routing**: React Router v7 routes + sidebar navigation config entry
- **Seed data**: Static curated paths defined in `src/data/careerPaths/` (not AI-generated)
- **Progress**: Derived from existing `contentProgress` table — no duplicate tracking

### Key Design Decisions

1. **Curated paths as seed data, not user-created**: Paths ship with the app (like pre-seeded courses). Users enroll; they don't create paths. This avoids complex CRUD and aligns with the "curated" requirement.
2. **Progress derived, not duplicated**: Path progress = count of completed courses within path stages, queried from existing `contentProgress` + `importedCourses` tables. No redundant progress table.
3. **Enrollment as a lightweight record**: Only stores `pathId`, `enrolledAt`, `status`. Progress is computed on read.
4. **Stage prerequisites enforced in UI only**: Locked stages are a visual/UX constraint, not a data constraint. This keeps the data model simple.
5. **Path courses reference both seeded (`courses`) and imported (`importedCourses`) courses**: The path data model uses generic course IDs; the store resolves them from both tables.

---

## Task 1: Define TypeScript types

**File**: `src/data/types.ts` (append after `ReviewRecord` block, ~line 363)

**Types to add**:

```typescript
// --- Career Paths (Story 20.1) ---

export interface CareerPathStage {
  id: string              // e.g., 'web-dev-stage-1'
  title: string           // e.g., 'Foundations'
  description: string
  courseIds: string[]      // References to Course.id or ImportedCourse.id
  skills: string[]        // Skill tags for this stage
  estimatedHours: number
}

export interface CareerPath {
  id: string              // e.g., 'web-development'
  title: string           // e.g., 'Web Development'
  description: string
  icon: string            // Lucide icon name (e.g., 'Code')
  stages: CareerPathStage[]
  totalEstimatedHours: number
  createdAt: string       // ISO 8601
}

export type PathEnrollmentStatus = 'active' | 'completed' | 'dropped'

export interface PathEnrollment {
  id: string              // UUID
  pathId: string          // FK to CareerPath.id
  enrolledAt: string      // ISO 8601
  status: PathEnrollmentStatus
  completedAt?: string    // ISO 8601 (set when all stages done)
}
```

**Rationale**: Separating `CareerPath` (static data) from `PathEnrollment` (user state) follows the same pattern as `Course` (static) vs. `ContentProgress` (user state). The `icon` field stores a Lucide icon name string so path definitions are serializable.

---

## Task 2: Dexie schema v20 migration

**File**: `src/db/schema.ts`

**Changes**:

1. Add type imports: `CareerPath`, `PathEnrollment`
2. Add table declarations to the `Dexie &` type assertion:
   ```typescript
   careerPaths: EntityTable<CareerPath, 'id'>
   pathEnrollments: EntityTable<PathEnrollment, 'id'>
   ```
3. Add `db.version(20).stores({...})` — redeclare all 20 existing tables + 2 new:
   ```
   careerPaths: 'id'
   pathEnrollments: 'id, pathId, status'
   ```
4. Add `.populate()` callback to seed 3-5 curated career paths on first creation (only runs for new databases; existing users get seed via the store's `loadPaths` which checks if table is empty)

**Index design**:
- `careerPaths`: Only queried by `id` or full scan — `'id'` is sufficient
- `pathEnrollments`: Queried by `pathId` (find enrollment for a path) and `status` (filter active enrollments)

**Why v20**: Current latest is v19 (E23-S03 instructor→author rename). v20 is the next sequential version.

---

## Task 3: Create seed data for curated paths

**New file**: `src/data/careerPaths/index.ts`

Define 3-5 curated career paths. Each path references existing course IDs from the seeded courses table (`src/data/courses/*.ts`). The paths:

1. **Behavioral Intelligence** — Paths through behavioral analysis courses
2. **Influence & Authority** — Persuasion and authority building courses
3. **Operative Foundations** — Core operative training progression
4. **Complete Mastery** — All courses in recommended order

Each path has 2-3 stages with 2-4 courses per stage.

**Course ID mapping**: Reference the existing `Course.id` values from `src/data/courses/` files. The store will resolve these against both `courses` and `importedCourses` tables.

**Important**: Use the existing `CourseCategory` values to align paths with categories:
- `behavioral-analysis`, `influence-authority`, `confidence-mastery`, `operative-training`, `research-library`

The `icon` field maps to Lucide icon component names: `'Brain'`, `'Shield'`, `'Crosshair'`, `'Trophy'`.

---

## Task 4: Create `useCareerPathStore` Zustand store

**New file**: `src/stores/useCareerPathStore.ts`

**State shape**:
```typescript
interface CareerPathState {
  paths: CareerPath[]
  enrollments: PathEnrollment[]
  isLoaded: boolean
  error: string | null

  // Actions
  loadPaths: () => Promise<void>
  enrollInPath: (pathId: string) => Promise<void>
  dropPath: (pathId: string) => Promise<void>
  getPathProgress: (pathId: string) => PathProgress
  getStageProgress: (pathId: string, stageId: string) => StageProgress
  isStageUnlocked: (pathId: string, stageId: string) => boolean
}

interface PathProgress {
  totalCourses: number
  completedCourses: number
  percentage: number
}

interface StageProgress {
  totalCourses: number
  completedCourses: number
  percentage: number
}
```

**Key behaviors**:
- `loadPaths()`: Loads from Dexie `careerPaths` table. If empty, seeds from static data (Task 3). Also loads enrollments.
- `enrollInPath()`: Creates `PathEnrollment` record in Dexie, updates local state.
- `getPathProgress()`: Computes from `contentProgress` table — counts completed items that match path course IDs. Uses both `courses` and `importedCourses` as source.
- `isStageUnlocked()`: Stage 1 always unlocked. Stage N unlocked if Stage N-1 has 100% course completion.

**Pattern reference**: Follows `useChallengeStore` pattern — loads from Dexie, exposes computed getters, persists mutations.

**Progress computation approach**:
- Query `contentProgress` where `courseId` is in the stage's `courseIds` and `status === 'completed'`
- For imported courses: check if all content items within the course are completed
- For seeded courses: check module/lesson completion status
- Cache computed progress in the store to avoid repeated DB queries; invalidate on enrollment changes

---

## Task 5: Create CareerPaths list page

**New file**: `src/app/pages/CareerPaths.tsx`

**Layout**:
- Page heading: "Career Paths" (h1) with subtitle
- Responsive grid: 1 col mobile, 2 cols tablet, 3 cols desktop
- Each path card shows:
  - Icon (from Lucide, mapped by `path.icon` string)
  - Title
  - Description (truncated to 2 lines)
  - Course count (sum across stages)
  - Estimated hours
  - Progress bar (if enrolled) or "Start Path" badge
- Cards link to `/career-paths/:pathId`

**Components used**:
- `Card`, `CardContent` from shadcn/ui
- `Badge` for status
- `Progress` for progress bar
- `EmptyState` if no paths (shouldn't happen with seed data, but defensive)
- Motion animations via `staggerContainer` / `fadeUp` from `src/lib/motion.ts`

**Skeleton loading**: Use `DelayedFallback` + `Skeleton` pattern (same as other pages).

**Icon mapping**: Create a `pathIconMap` that maps string names to Lucide components:
```typescript
const pathIconMap: Record<string, LucideIcon> = {
  Brain, Shield, Crosshair, Trophy, Code, // etc.
}
```

---

## Task 6: Create CareerPathDetail page

**New file**: `src/app/pages/CareerPathDetail.tsx`

**Layout**:
- Back link to `/career-paths`
- Path header: icon, title, description, total estimated hours, overall progress bar
- "Start Path" / "Enrolled" button (variant="brand")
- Stage timeline (vertical):
  - Each stage: title, description, skills badges, estimated hours
  - Course cards within each stage (compact format: title, status icon)
  - Locked stages: reduced opacity, lock icon, "Complete [Previous Stage] to unlock" message
  - Completed courses: checkmark overlay with `text-success` token

**Stage rendering logic**:
- Stage 1: Always unlocked
- Stage N: Unlocked if ALL courses in Stage N-1 are completed
- Locked stage: `opacity-50`, `pointer-events-none` on course links, lock icon + message
- Completed stage: Success border accent, all courses show checkmarks

**Course card behavior**:
- Completed: Checkmark + `bg-success/10` subtle background
- In progress: Normal styling
- Not started (in unlocked stage): Normal styling with "Start" action
- In locked stage: Grayed out, no link

**Component structure**:
```
CareerPathDetail
  ├── PathHeader (icon, title, description, progress, enroll button)
  ├── StageTimeline
  │   ├── StageCard (per stage)
  │   │   ├── StageHeader (title, skills, hours, lock status)
  │   │   └── CourseList
  │   │       └── PathCourseCard (per course in stage)
  ```

These can be inline components within the page file (no need for separate files unless they exceed ~80 lines each).

---

## Task 7: Implement enrollment + progress tracking logic

**This is the core business logic in the store (Task 4) + the UI wiring.**

**Enrollment flow**:
1. User clicks "Start Path" on detail page
2. Store calls `enrollInPath(pathId)`
3. Creates `PathEnrollment` in Dexie
4. Optimistic update: add enrollment to store state AFTER DB write succeeds (per engineering patterns — no optimistic UI before persistence)
5. UI updates: button changes to "Enrolled", progress bar appears

**Progress tracking flow**:
1. On page load, store computes progress for enrolled paths
2. For each course ID in each stage, query completion status
3. For seeded courses (`courses` table): course is "completed" if the user has marked all modules/lessons as completed in `contentProgress`
4. For imported courses (`importedCourses` table): course is "completed" if `status === 'completed'`
5. Stage completion = all courses in stage completed
6. Path completion = all stages completed → auto-update enrollment status to 'completed'

**Edge cases**:
- Course referenced in path but deleted/not found: Skip gracefully, show "(Course removed)" placeholder
- User unenrolls: Set enrollment status to 'dropped', preserve record for potential re-enrollment
- Path completed: Set `completedAt` on enrollment, show celebration state

---

## Task 8: Add routes and sidebar navigation

**File modifications**:

### `src/app/routes.tsx`
Add two lazy-loaded routes:
```typescript
const CareerPaths = React.lazy(() =>
  import('./pages/CareerPaths').then(m => ({ default: m.CareerPaths }))
)
const CareerPathDetail = React.lazy(() =>
  import('./pages/CareerPathDetail').then(m => ({ default: m.CareerPathDetail }))
)
```

Add route entries (after `courses` routes, before `imported-courses`):
```typescript
{ path: 'career-paths', element: <SuspensePage><CareerPaths /></SuspensePage> },
{ path: 'career-paths/:pathId', element: <SuspensePage><CareerPathDetail /></SuspensePage> },
```

### `src/app/config/navigation.ts`
Add to the "Learn" group, after "Courses":
```typescript
{ name: 'Career Paths', path: '/career-paths', icon: Route },
```

Import `Route` (or `Map`, `Milestone`) from lucide-react — pick the icon that best represents structured learning journeys.

---

## Task 9: Create E2E tests

**New file**: `tests/e2e/career-paths.spec.ts`

**Test scenarios**:

1. **List page renders paths**: Navigate to `/career-paths`, verify 3+ path cards visible with titles
2. **Path detail loads stages**: Click a path card, verify stage headings and course cards visible
3. **Enrollment flow**: Click "Start Path", verify button changes to enrolled state, verify progress bar appears
4. **Stage locking**: On detail page, verify Stage 2+ shows locked state when Stage 1 incomplete
5. **Progress updates**: Seed completed courses in IDB, navigate to path detail, verify checkmarks on completed courses and updated progress %
6. **Navigation integration**: Verify "Career Paths" link in sidebar, verify it navigates correctly

**Test fixtures needed**:
- Career path seed data (auto-seeded by Dexie populate or store init)
- Course completion data for progress tests (use existing `seedContentProgress` helper)

**Pattern**: Follow `tests/e2e/navigation.spec.ts` and `tests/e2e/courses.spec.ts` patterns — use role-based selectors, `test` from `../support/fixtures`, helper functions for navigation.

---

## Task 10: Add IndexedDB seed helpers for tests

**File**: `tests/support/helpers/indexeddb-seed.ts`

Add two new seed functions:
```typescript
export async function seedCareerPaths(page: Page, paths: Record<string, unknown>[]): Promise<void>
export async function seedPathEnrollments(page: Page, enrollments: Record<string, unknown>[]): Promise<void>
```

Follow the existing pattern (e.g., `seedQuizzes`, `seedReviewRecords`) — these evaluate scripts in browser context to insert records into the Dexie tables.

**File**: `tests/support/fixtures/factories/career-path-factory.ts`

Create factory functions:
```typescript
export function createCareerPath(overrides?: Partial<CareerPath>): CareerPath
export function createPathEnrollment(overrides?: Partial<PathEnrollment>): PathEnrollment
```

Register in `tests/support/fixtures/factories/index.ts`.

---

## Implementation Order

Execute tasks in this sequence (respects dependencies):

```
Task 1 (types) → Task 2 (schema) → Task 3 (seed data) → Task 4 (store)
                                                              ↓
                                          Task 5 (list page) + Task 6 (detail page)
                                                              ↓
                                                    Task 7 (enrollment logic)
                                                              ↓
                                                    Task 8 (routes + nav)
                                                              ↓
                                              Task 9 (E2E) + Task 10 (test helpers)
```

**Commit strategy**: One commit per task as save points.

---

## Risk Assessment

| Risk | Likelihood | Impact | Mitigation |
|------|-----------|--------|------------|
| Course IDs in paths don't match seeded data | Medium | High | Verify IDs against `src/data/courses/*.ts` in Task 3 |
| Progress computation expensive (many DB queries) | Low | Medium | Batch queries, cache in store |
| Dexie v20 migration breaks existing data | Low | High | No upgrade logic needed — new tables only, no modifications to existing |
| Seed data doesn't load for existing users | Medium | Medium | Store `loadPaths` checks if table empty and seeds if needed |

## Files Summary

### New Files (6)
- `src/data/types.ts` (modify — add types)
- `src/data/careerPaths/index.ts` (seed data)
- `src/stores/useCareerPathStore.ts` (Zustand store)
- `src/app/pages/CareerPaths.tsx` (list page)
- `src/app/pages/CareerPathDetail.tsx` (detail page)
- `tests/e2e/career-paths.spec.ts` (E2E tests)
- `tests/support/fixtures/factories/career-path-factory.ts` (test factory)

### Modified Files (5)
- `src/data/types.ts` (add CareerPath, PathEnrollment types)
- `src/db/schema.ts` (v20 migration + table declarations)
- `src/app/routes.tsx` (add 2 routes)
- `src/app/config/navigation.ts` (add sidebar item)
- `tests/support/helpers/indexeddb-seed.ts` (add seed functions)
- `tests/support/fixtures/factories/index.ts` (register factory)
