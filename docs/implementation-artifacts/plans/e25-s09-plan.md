# E25-S09: Empty State Improvements — Implementation Plan

## Context

Story 10.2 ("Empty State Guidance") was completed in Epic 10, establishing the `EmptyState` component at `src/app/components/EmptyState.tsx` and deploying it across 5 pages (Overview, Notes, Challenges, Reports, Courses). However, a codebase audit reveals **3 pages still using ad-hoc empty state patterns** instead of the standardized component:

1. **MyClass.tsx** — 2 custom div-based empty states (lines 113-131, 238-252)
2. **SessionHistory.tsx** — filtered empty state using raw HTML (lines 426-436)
3. **InterleavedReview.tsx** — uses composable `ui/empty.tsx` components instead of `EmptyState` (lines 267-287, 222-253)

Additionally, MyClass.tsx has a **Tailwind v4 issue**: uses `w-12 h-12` instead of the `size-12` shorthand.

E25-S09 **standardizes** these remaining pages to use the `EmptyState` component, ensuring visual consistency, accessibility compliance, and testability across the entire application.

## Scope Assessment

### What's Already Done (from E10-S02)
- `EmptyState` component: motion animation (300ms fade-up), WCAG AA, dashed-border Card, brand tokens
- Pages using it: Overview, Notes, Challenges, Reports, Courses
- E2E tests: 16 tests in `tests/e2e/regression/story-e10-s02.spec.ts`
- Props: `icon`, `title`, `description`, `headingLevel`, `actionLabel`, `actionHref`, `onAction`, `data-testid`, `className`

### What E25-S09 Addresses
- Refactor MyClass.tsx to use `EmptyState` (2 locations)
- Refactor SessionHistory.tsx filtered empty state
- Refactor InterleavedReview.tsx to use `EmptyState` (2 locations: empty phase + error)
- Add `data-testid` attributes for new empty states
- Add E2E test coverage for these newly standardized empty states

## Implementation Tasks

### Task 1: Refactor MyClass.tsx — Page-Level Empty State (AC1, AC5, AC6)
**File**: `src/app/pages/MyClass.tsx` (lines 113-131)

**Current** (custom div):
```tsx
<div className="flex flex-col items-center justify-center py-12 text-center">
  <PlayCircle className="w-12 h-12 text-muted-foreground mb-4" />
  <h2 className="text-xl font-semibold mb-2">Ready to start learning?</h2>
  <p className="text-muted-foreground mb-6 max-w-md">...</p>
  <Button variant="brand" asChild>
    <Link to="/courses">Browse All Courses <ArrowRight /></Link>
  </Button>
</div>
```

**Replace with**:
```tsx
<EmptyState
  data-testid="empty-state-my-courses"
  icon={PlayCircle}
  title="Ready to start learning?"
  description="Browse our course catalog to find the perfect course to kickstart your learning journey."
  actionLabel="Browse All Courses"
  actionHref="/courses"
/>
```

**Changes**:
- Import `EmptyState` from `@/app/components/EmptyState`
- Remove unused `ArrowRight` import if no longer needed
- Wrap in page heading (`<h1>` stays outside)
- Gains: dashed-border Card, `bg-brand-soft` icon circle, fade-up animation, `role="status"`, `aria-hidden` on icon

### Task 2: Refactor MyClass.tsx — In-Progress Tab Empty State (AC6)
**File**: `src/app/pages/MyClass.tsx` (lines 238-252)

**Current** (custom div inside "By Status" tab):
```tsx
{inProgress.length === 0 && (
  <div className="flex flex-col items-center ...">
    <Clock className="w-12 h-12 text-muted-foreground mb-4" />
    <h2>No courses in progress</h2>
    ...
  </div>
)}
```

**Replace with**:
```tsx
{inProgress.length === 0 && (
  <EmptyState
    data-testid="empty-state-in-progress"
    icon={Clock}
    headingLevel={3}
    title="No courses in progress"
    description="Start a new course to begin learning!"
    actionLabel="Browse Courses"
    actionHref="/courses"
  />
)}
```

**Notes**:
- Use `headingLevel={3}` since it's nested under a tab section (h2 is used for "In Progress" header)
- The ArrowRight icon embedded in the old CTA button is not needed — `EmptyState` handles button styling

### Task 3: Refactor SessionHistory.tsx — Filtered Empty State
**File**: `src/app/pages/SessionHistory.tsx` (lines 426-436)

**Current** (raw HTML inside `<ul>`):
```tsx
<li className="list-none rounded-[24px] border border-border bg-card p-8 text-center">
  <p className="text-muted-foreground">No sessions match your current filters.</p>
  <button onClick={handleClearFilters}>Clear all filters</button>
</li>
```

**Replace with**:
```tsx
<li className="list-none">
  <EmptyState
    data-testid="empty-state-filtered-sessions"
    icon={History}
    headingLevel={3}
    title="No sessions match your filters"
    description="Try adjusting your course or date filters to see more sessions."
    actionLabel="Clear All Filters"
    onAction={handleClearFilters}
  />
</li>
```

**Notes**:
- Keep it inside `<li>` for valid HTML (it's inside a `<ul>`)
- The primary empty state (lines 242-249) already uses `EmptyState` — only the filtered state is custom
- `History` icon is already imported in this file

### Task 4: Refactor InterleavedReview.tsx — Empty Phase (AC6)
**File**: `src/app/pages/InterleavedReview.tsx` (lines 267-287)

**Current** (composable `Empty*` components):
```tsx
<Empty className="border-none">
  <EmptyMedia variant="icon"><Shuffle /></EmptyMedia>
  <EmptyHeader>
    <EmptyTitle>No notes due for review</EmptyTitle>
    <EmptyDescription>Rate notes after studying...</EmptyDescription>
  </EmptyHeader>
</Empty>
```

**Replace with**:
```tsx
<EmptyState
  data-testid="empty-state-interleaved-review"
  icon={Shuffle}
  title="No notes due for review"
  description="Rate notes after studying to build your review queue, then come back for interleaved practice."
  actionLabel="Back to Review Queue"
  actionHref="/review"
  className="border-none"
/>
```

**Notes**:
- Remove the `max-w-lg pt-12` outer `<div>` — `EmptyState` handles centering internally
- Add CTA to navigate back to review queue (currently missing — improves UX)
- `className="border-none"` overrides the default dashed border for this context

### Task 5: Refactor InterleavedReview.tsx — Error State
**File**: `src/app/pages/InterleavedReview.tsx` (lines 222-253)

**Current** (composable `Empty*` components + retry button):
```tsx
<Empty className="border-none">
  <EmptyMedia variant="icon"><Shuffle /></EmptyMedia>
  <EmptyHeader>
    <EmptyTitle>Failed to load review data</EmptyTitle>
    <EmptyDescription>Something went wrong...</EmptyDescription>
  </EmptyHeader>
  <Button onClick={retryLogic}>Retry</Button>
</Empty>
```

**Decision**: Keep this as-is. This is an **error state**, not an empty state. It has a retry handler with complex inline logic. Converting it to `EmptyState` would require either:
- Adding a `children` slot to `EmptyState` (scope creep), or
- Extracting the retry logic into a callback

The `EmptyState` component is designed for "no data yet" scenarios, not error recovery. Mixing error states into it would dilute its semantic purpose.

**Alternative**: If we want consistency, extract retry logic into a `handleRetry` callback and use `onAction`. But this changes the visual styling (adds dashed border, brand-soft icon circle) which may not be appropriate for error states. **Skip for now — document as future consideration.**

### Task 6: Clean Up Imports
After refactoring, remove unused imports from modified files:

- **MyClass.tsx**: Remove `ArrowRight` if no longer used. Remove `Link` from react-router if no longer directly used (check if `CourseCard` handles navigation). Fix `w-12 h-12` → `size-12` if any remain.
- **InterleavedReview.tsx**: Remove `Empty`, `EmptyMedia`, `EmptyHeader`, `EmptyTitle`, `EmptyDescription` imports from `ui/empty`. Add `EmptyState` import. Keep `ui/empty` imports if error state still uses them.

### Task 7: Add E2E Tests
**File**: `tests/e2e/regression/story-e25-s09.spec.ts` (new file)

Test structure:
```typescript
test.describe('E25-S09: Empty State Improvements', () => {

  // MyClass page-level empty state
  test.describe('MyClass — no courses', () => {
    test('displays standardized empty state', async ({ page }) => {
      // Navigate to /my-courses (or equivalent route)
      // Verify EmptyState visible with data-testid="empty-state-my-courses"
      // Verify icon, title, description, CTA
    })

    test('CTA links to courses page', async ({ page }) => {
      // Click CTA → verify URL changes to /courses
    })
  })

  // MyClass in-progress tab empty state
  test.describe('MyClass — no in-progress courses', () => {
    test('shows in-progress empty state in By Status tab', async ({ page }) => {
      // Seed data with only completed/not-started courses (no in-progress)
      // Navigate → By Status tab → verify empty-state-in-progress visible
    })
  })

  // SessionHistory filtered empty state
  test.describe('SessionHistory — filtered to empty', () => {
    test('shows standardized empty state when filters match nothing', async ({ page, indexedDB }) => {
      // Seed a session with a specific course
      // Navigate to /sessions
      // Apply date filter that excludes all sessions
      // Verify empty-state-filtered-sessions visible
    })

    test('Clear All Filters CTA resets filters', async ({ page, indexedDB }) => {
      // Same setup as above
      // Click "Clear All Filters"
      // Verify sessions reappear
    })
  })

  // InterleavedReview empty state
  test.describe('InterleavedReview — no due notes', () => {
    test('shows standardized empty state', async ({ page }) => {
      // Navigate to /interleaved
      // Verify empty-state-interleaved-review visible
      // Verify CTA links back to /review
    })
  })

  // Visual consistency verification
  test.describe('Visual consistency', () => {
    test('all empty states use dashed border card pattern', async ({ page }) => {
      // Navigate to /my-courses (or equiv) with no courses
      // Verify the EmptyState renders with expected card styling
    })
  })
})
```

**Test data notes**:
- MyClass uses `useCourseStore` (static courses from `allCourses`) — may always have data. Need to check if `hasAnyCourses` can be false with the static demo data. If not, may need to mock or this test needs adjustment.
- SessionHistory loads from Dexie `db.studySessions` — starts empty in test environment
- InterleavedReview depends on `useReviewStore` + `useNoteStore` — both start empty

## Files to Modify

| File | Change | Lines |
|------|--------|-------|
| `src/app/pages/MyClass.tsx` | Replace 2 custom empty states with `EmptyState` | 113-131, 238-252 |
| `src/app/pages/SessionHistory.tsx` | Replace filtered empty state HTML with `EmptyState` | 426-436 |
| `src/app/pages/InterleavedReview.tsx` | Replace empty phase with `EmptyState`, keep error state | 267-287 |
| `tests/e2e/regression/story-e25-s09.spec.ts` | New E2E test file | — |

## Files NOT Modified

| File | Reason |
|------|--------|
| `src/app/components/EmptyState.tsx` | No changes needed — component already supports all required props |
| `src/app/components/ui/empty.tsx` | Keep as-is — still used by InterleavedReview error state |
| `src/app/pages/Overview.tsx` | Already uses `EmptyState` correctly |
| `src/app/pages/Notes.tsx` | Already uses `EmptyState` correctly |
| `src/app/pages/Challenges.tsx` | Already uses `EmptyState` correctly |
| `src/app/pages/Reports.tsx` | Already uses `EmptyState` correctly |
| `src/app/pages/Courses.tsx` | Already uses `EmptyState` correctly |
| `tests/e2e/regression/story-e10-s02.spec.ts` | Existing tests remain valid, no changes needed |

## Design Tokens (no hardcoded colors)

All refactored empty states inherit from `EmptyState` component tokens:

| Element | Token |
|---------|-------|
| Icon background | `bg-brand-soft` |
| Icon color | `text-brand-muted` |
| Card | `border-2 border-dashed` |
| CTA | `variant="brand" size="lg"` |
| Title | `font-display text-lg font-medium` |
| Description | `text-muted-foreground` |

## Accessibility

All refactored states gain from `EmptyState`:
- `role="status"` on container (announces to screen readers)
- `aria-hidden="true"` on decorative icon
- Semantic heading (`<h2>` or `<h3>`)
- Keyboard-accessible CTA (Button or Link)
- Respects `prefers-reduced-motion`
- WCAG 2.1 AA contrast compliance

## Risk Assessment

| Risk | Likelihood | Impact | Mitigation |
|------|-----------|--------|------------|
| MyClass static courses always present | Medium | Test gap — can't test page-level empty state | Check if allCourses can be empty; if not, document limitation |
| InterleavedReview error state styling mismatch | Low | Visual inconsistency | Intentionally kept as composable pattern — not an empty state |
| Filtered empty state visual change | Low | User surprise | Minor visual upgrade (gains animation, icon) — improvement |

## Verification

1. `npm run build` — no type errors
2. `npm run lint` — no ESLint violations
3. `npx tsc --noEmit` — type check passes
4. `npx playwright test tests/e2e/regression/story-e25-s09.spec.ts --project=chromium`
5. `npx playwright test tests/e2e/regression/story-e10-s02.spec.ts --project=chromium` — existing tests still pass
6. Manual: navigate to MyClass, SessionHistory, InterleavedReview with empty data — verify standardized empty states

## Commit Strategy

1. Refactor MyClass.tsx empty states (Tasks 1-2)
2. Refactor SessionHistory.tsx filtered empty state (Task 3)
3. Refactor InterleavedReview.tsx empty phase (Task 4)
4. Clean up imports (Task 6)
5. Add E2E tests (Task 7)
6. Final verification and commit
