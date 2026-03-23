# E23-S01: Remove Hardcoded Branding from Courses Page

## Context

The Courses page header displays `"Chase Hughes — The Operative Kit"` as a hardcoded subtitle (line 209 of `Courses.tsx`). Epic 23 ("Platform Identity & Navigation Cleanup") transforms Knowlune from a single-provider showcase into a generic personal learning platform. This is the first story — removing the provider branding from the most visible location.

A prototype file (`HybridCourses.tsx:42`) has the same branding string and should be updated for consistency.

## Files to Modify

| File | Change |
|------|--------|
| `src/app/pages/Courses.tsx` | Replace hardcoded subtitle (line 209), add zero-courses empty state |
| `src/app/pages/prototypes/HybridCourses.tsx` | Replace hardcoded subtitle (line 42) |

## Reuse

| Existing code | Location | How to use |
|---------------|----------|------------|
| `EmptyState` component | `src/app/components/EmptyState.tsx` | Use for zero-courses empty state with `onAction` prop |
| `goToCourses()` helper | `tests/support/helpers/navigation.ts` | Already used in ATDD tests |
| `BookOpen` icon | lucide-react (same icon used in Overview.tsx empty state) | Icon for empty state |

## Implementation Steps

### Step 1: Replace hardcoded subtitle in Courses.tsx (AC1)

**Current** (line 208-211):
```tsx
<p className="text-muted-foreground">
  Chase Hughes — The Operative Kit ({allCourses.length} courses
  {importedCourses.length > 0 && ` + ${importedCourses.length} imported`})
</p>
```

**Replace with** dynamic course count:
```tsx
<p className="text-muted-foreground">
  {allCourses.length + importedCourses.length > 0
    ? `${allCourses.length + importedCourses.length} courses`
    : null}
</p>
```

- Shows total count when courses exist
- Shows nothing when zero courses (empty state handles this)

### Step 2: Add zero-courses empty state (AC2)

When `allCourses.length === 0 && importedCourses.length === 0`, render the `EmptyState` component instead of the search/filter/grid sections:

```tsx
import { EmptyState } from '@/app/components/EmptyState'
import { BookOpen } from 'lucide-react'

// Inside the return, wrap the main content:
{allCourses.length === 0 && importedCourses.length === 0 ? (
  <EmptyState
    icon={BookOpen}
    title="No courses yet"
    description="Import a course folder to get started"
    actionLabel="Import Course"
    onAction={handleImportCourse}
    data-testid="courses-empty-state"
  />
) : (
  // existing search, filters, imported courses, and pre-seeded courses sections
)}
```

Keep the header (h1 "All Courses" + Import button) always visible above the empty state.

### Step 3: Update prototype file (consistency)

In `src/app/pages/prototypes/HybridCourses.tsx:42`, replace the same hardcoded branding with a dynamic count.

### Step 4: Commit

```
feat(E23-S01): remove hardcoded branding from courses page
```

## Verification

1. **Build**: `npm run build` — should pass
2. **Lint**: `npm run lint` — no hardcoded color violations
3. **ATDD tests**: `npx playwright test tests/e2e/story-23-1.spec.ts --project chromium`
   - AC1: "Chase Hughes" and "The Operative Kit" should NOT appear → PASS
   - AC2: `courses-empty-state` should be visible when no courses → PASS (need to verify IndexedDB is empty in test context)
   - AC4: Responsive layout at 3 breakpoints → PASS
4. **Existing tests**: `npx playwright test tests/e2e/courses.spec.ts tests/e2e/navigation.spec.ts --project chromium` — should still pass (they check for `h1:has-text("All Courses")`, not the subtitle)
5. **Visual check**: `npm run dev` → navigate to `/courses` → verify no branding text, verify count displays correctly

## Scope Boundaries

- **In scope**: Courses.tsx subtitle, prototype file, zero-courses empty state
- **Out of scope**: Pre-seeded course data in `src/data/courses/` (E23-S05), sidebar naming (E23-S02/S03/S04), author layout (E23-S06)
