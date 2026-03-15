# E10-S02: Empty State Guidance — Implementation Plan

## Context

New users landing on the LevelUp platform see static demo data but have no guidance on what to do next. This story adds contextual empty states across 4 sections that explain what belongs there and link users to the relevant action — enabling immediate value discovery without documentation.

**Key architectural insight**: The app has two course systems: static demo courses (`allCourses` from `src/data/courses`) which are always present, and user-imported courses (`importedCourses` from Dexie/IndexedDB) which start empty. The "no courses imported" AC targets imported courses. Notes, challenges, and sessions also start empty (Dexie/IndexedDB).

**Existing patterns**: Empty states already exist inline in Challenges.tsx (lines 203-220), Notes.tsx (lines 602-612), Reports.tsx (lines 305-308), and Courses.tsx (lines 254-300). A reusable `EmptyState` component exists at `src/app/components/EmptyState.tsx` but isn't used everywhere. This story **standardizes** all empty states through the existing component, enhanced with `onAction` support and `data-testid`.

## Approach: Enhance Existing EmptyState Component + Update 4 Pages

### Task 1: Enhance EmptyState component
**File**: `src/app/components/EmptyState.tsx`

Add to existing `EmptyStateProps`:
- `onAction?: () => void` — for button-click handlers (import dialog, create challenge dialog)
- `'data-testid'?: string` — for E2E test targeting
- `className?: string` — for layout customization
- Add `motion/react` fade-up entrance animation (using existing `fadeUp` from `src/lib/motion.ts`)

When `onAction` is provided, render a `<Button onClick={onAction}>` instead of a `<Link>`.
When `actionHref` is provided, render `<Button asChild><Link to={actionHref}>`  (existing behavior).

Keep the existing visual pattern: dashed border Card, `bg-brand-soft` icon circle, centered layout.

### Task 2: Dashboard Overview — no imported courses (AC1)
**File**: `src/app/pages/Overview.tsx`

- Import `useCourseImportStore` and `importCourseFromFolder`
- After the "Course Gallery" section (or as a new section before it), add:
  - Check `importedCourses.length === 0`
  - Render `<EmptyState>` with:
    - `data-testid="empty-state-courses"`
    - icon: `BookOpen`
    - title: "Import your first course to get started"
    - description: "Add a folder with videos, PDFs, or documents to begin learning"
    - actionLabel: "Import Course"
    - `onAction`: calls `importCourseFromFolder()` (same pattern as Courses.tsx)
  - Wrap in `<motion.section variants={fadeUp}>` for consistency with existing page sections
- When `importedCourses.length > 0`, don't show this section

**Data detection**: `useCourseImportStore(s => s.importedCourses)` — need to call `loadImportedCourses()` on mount (same as Courses.tsx does). Check if Overview already loads imported courses.

### Task 3: Notes page — no notes (AC2)
**File**: `src/app/pages/Notes.tsx`

- Replace inline empty state (lines 602-612) with `<EmptyState>` component:
  - `data-testid="empty-state-notes"`
  - icon: `FileText` (or existing `StickyNote`)
  - title: "Start a video and take your first note"
  - description: "Capture key moments while you study"
  - actionLabel: "Browse Courses"
  - actionHref: "/courses"

### Task 4: Challenges page — enhance existing empty state (AC3)
**File**: `src/app/pages/Challenges.tsx`

- Replace inline empty state (lines 203-220) with `<EmptyState>` component:
  - `data-testid="empty-state-challenges"`
  - icon: `Trophy`
  - title: "Create your first learning challenge"
  - description: "Set goals and track your progress with timed challenges"
  - actionLabel: "Create Challenge"
  - `onAction`: `() => setDialogOpen(true)` (existing dialog)

### Task 5: Reports page — enhance empty state (AC4)
**File**: `src/app/pages/Reports.tsx`

- Add a top-level empty state check: if no study sessions AND no activity data
- Render `<EmptyState>` with:
  - `data-testid="empty-state-sessions"`
  - icon: `Clock`
  - title: "Start studying to see your analytics"
  - description: "Your study time, completion rates, and insights will appear here"
  - actionLabel: "Browse Courses"
  - actionHref: "/courses"
- Show this instead of the tabs/charts when data is empty
- Keep the existing inline "No activity yet" text for the Recent Activity card specifically (it's a sub-section empty state, not the page-level one)

### Task 6: Update ATDD tests
**File**: `tests/e2e/story-e10-s02.spec.ts`

The ATDD tests were already created. They may need minor adjustments after implementation:
- Verify `data-testid` attributes match
- Adjust navigation paths if notes/challenges are on separate pages (not dashboard)
- AC6 content replacement test: seed data via IndexedDB, reload, verify empty state disappears

## Files to Modify

| File | Change |
|------|--------|
| `src/app/components/EmptyState.tsx` | Add `onAction`, `data-testid`, `className`, animation |
| `src/app/pages/Overview.tsx` | Add imported courses empty state section |
| `src/app/pages/Notes.tsx` | Replace inline empty state with `EmptyState` component |
| `src/app/pages/Challenges.tsx` | Replace inline empty state with `EmptyState` component |
| `src/app/pages/Reports.tsx` | Add page-level empty state for no sessions |
| `tests/e2e/story-e10-s02.spec.ts` | Adjust test IDs/paths after implementation |

## Reusable Patterns

- `EmptyState` component: `src/app/components/EmptyState.tsx` (enhance, don't create new)
- Motion variants: `fadeUp` from `src/lib/motion.ts`
- Import function: `importCourseFromFolder()` from `src/lib/courseImport.ts`
- Store: `useCourseImportStore` from `src/stores/useCourseImportStore.ts`
- Challenge dialog: `CreateChallengeDialog` already used in Challenges.tsx

## Design Tokens (no hardcoded colors)

| Element | Token |
|---------|-------|
| Icon background | `bg-brand-soft` |
| Icon color | `text-brand` |
| Card | `border-dashed` (existing pattern) |
| CTA | shadcn `Button` default variant (uses `bg-primary`) |
| Text | `text-foreground` (title), `text-muted-foreground` (description) |

## Verification

1. `npm run build` — no type errors
2. `npm run lint` — no ESLint violations (design token check)
3. `npx playwright test tests/e2e/story-e10-s02.spec.ts --project=chromium` — all ATDD tests pass
4. Manual check: navigate to Overview, Notes, Challenges, Reports with empty data — verify each empty state renders
5. Manual check: import a course → Overview empty state disappears
6. Manual check: CTA buttons navigate to correct destinations

## Commit Strategy

1. Enhance `EmptyState` component (Task 1)
2. Dashboard empty state (Task 2)
3. Notes + Challenges + Reports empty states (Tasks 3-5)
4. Update ATDD tests if needed (Task 6)
