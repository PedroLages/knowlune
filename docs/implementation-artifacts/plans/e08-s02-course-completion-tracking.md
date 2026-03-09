# Implementation Plan: E08-S02 Course Completion Tracking

**Story**: 8.2 – Course Completion Tracking
**Branch**: `feature/e08-s02-course-completion-tracking`
**Date**: 2026-03-09

---

## Overview

Add a "Course Completion Tracking" section to the Reports page, below the existing StudyTimeAnalytics component. The section displays:
1. A line/area chart of overall completion rate over time (weekly snapshots)
2. A per-course completion history list (sorted by completion date descending)
3. Tooltips on chart data points
4. A keyboard-navigable visual timeline of completion milestones
5. Empty state with in-progress course summary when no courses are completed

---

## Data Architecture

### Source Tables (IndexedDB via Dexie)

| Table | Relevant Fields | Purpose |
|---|---|---|
| `importedCourses` | `id`, `name`, `importedAt`, `videoCount`, `pdfCount` | Enrollment date + item counts |
| `contentProgress` | `courseId`, `itemId`, `status`, `updatedAt` | Per-item completion with timestamp |
| `studySessions` | `courseId`, `duration` | Total time spent per course |

### Derived Data

**Course Completion Date** (the hardest derivation):
- Group `contentProgress` records by `courseId`
- A course is complete when count of `status === 'completed'` items ≥ `videoCount + pdfCount` from importedCourse
- Completion date = `Math.max(...completedItems.map(i => new Date(i.updatedAt).getTime()))`

**Weekly Completion Rate Chart** (12 weeks):
- Reference: most recent contentProgress `updatedAt` or current date
- For each of the past 12 weeks (oldest → newest), count courses whose completion date ≤ weekEnd
- Rate = (coursesComplete / totalEnrolled) * 100
- Chart data: `{ week: string, rate: number, completed: number, total: number }`

**Completion History List**:
- Filter to courses that are 100% complete
- Join: importedCourse (name, importedAt) + completion date + studySessions total
- Sort: completion date descending

**Total Time Spent per Course**:
- Filter `studySessions` by `courseId`, sum `duration` (seconds → minutes)

### Edge Cases
- Course with `videoCount + pdfCount === 0`: skip (no items to complete, treat as not enrolled)
- No `contentProgress` records for a course: course is not started, skip from completion list
- Partial `contentProgress` (items added later): use actual completed item count vs `videoCount + pdfCount`

---

## Component Architecture

### New File: `src/app/components/CourseCompletionTracking.tsx`

Structure follows `StudyTimeAnalytics.tsx` exactly:
- `useEffect` with `ignore` flag for async data loading
- Parallel queries via `Promise.all([db.importedCourses.toArray(), db.contentProgress.toArray(), db.studySessions.toArray()])`
- `useMemo` for all derived state (no `useEffect` for derivations)
- Event listener on `course-progress-updated` for real-time updates
- Loading → Empty → Main content states
- All pure helper functions exported below component (testable in isolation)

### Chart: Recharts AreaChart

```tsx
<AreaChart data={weeklyData}>
  <XAxis dataKey="week" />
  <YAxis domain={[0, 100]} />
  <Area dataKey="rate" />
  <ChartTooltip content={<CustomTooltip />} />
</AreaChart>
```

Custom tooltip shows: "Week of [date]: 45% (5 of 11 courses completed)"

### Completion History List

Table or list of cards:
```
| Course Name       | Enrolled      | Completed     | Time Spent |
|-------------------|---------------|---------------|------------|
| React Mastery     | Jan 15, 2025  | Mar 1, 2026   | 12h 30m    |
```
Accessible: `<table>` with proper `<th scope="col">` headers.

### Visual Timeline

Horizontal or vertical timeline with focusable milestone elements:
```
[●]──────────[●]──────────[●]
Jan 2025     Aug 2025     Mar 2026
React Adv    TypeScript   Node.js
```
- Each milestone: `<div role="button" tabIndex={0}>`
- Keyboard: Tab to focus, Enter/Space shows detail
- Screen reader: `aria-label="React Advanced - completed March 1, 2026"`

### Empty State

Two sub-states:
1. **No courses at all**: "Import courses to start tracking completion"
2. **Courses in progress but none complete**: show encouragement + in-progress summary cards showing course name + current % complete

---

## Files to Create/Modify

### Create
1. `src/app/components/CourseCompletionTracking.tsx`
2. `tests/e2e/story-e08-s02.spec.ts`

### Modify
3. `src/app/pages/Reports.tsx` — import and render `<CourseCompletionTracking />` below `<StudyTimeAnalytics />`
4. `tests/support/helpers/indexeddb-seed.ts` — add `seedImportedCourses()` and `seedContentProgress()` helpers

---

## Helper Functions (pure, in CourseCompletionTracking.tsx)

```typescript
// Derive completion date from contentProgress for a single course
function deriveCourseCompletionDate(
  courseId: string,
  totalItems: number,
  progressItems: ContentProgress[]
): Date | null

// Build weekly chart data (past 12 weeks)
function buildWeeklyCompletionRateData(
  courses: ImportedCourse[],
  allProgress: ContentProgress[],
  referenceDate: Date
): WeeklyRatePoint[]

// Build sorted completion history list
function buildCompletionHistory(
  courses: ImportedCourse[],
  allProgress: ContentProgress[],
  allSessions: StudySession[]
): CompletionHistoryItem[]

// Format duration seconds → "Xh Ym"
function formatDuration(seconds: number): string

// Generate chart alt text for accessibility
function generateChartAltText(data: WeeklyRatePoint[]): string
```

---

## E2E Test Plan: `tests/e2e/story-e08-s02.spec.ts`

### Test Setup Pattern
Following `story-e08-s01.spec.ts` exactly:
- `mockDateNow(page)` before navigation
- `context.addInitScript` to seed sidebar state (`eduvi-sidebar-v1 = false`) BEFORE `page.goto('/reports')`
- Navigate to `/reports`
- Scroll to the `CourseCompletionTracking` section

### Test Data Setup
```typescript
// 3 imported courses
const courses = [
  createImportedCourse({ id: 'c-1', name: 'React Mastery', videoCount: 5, pdfCount: 0, importedAt: getRelativeDate(-90) }),
  createImportedCourse({ id: 'c-2', name: 'TypeScript Pro', videoCount: 3, pdfCount: 1, importedAt: getRelativeDate(-60) }),
  createImportedCourse({ id: 'c-3', name: 'Node.js Basics', videoCount: 2, pdfCount: 0, importedAt: getRelativeDate(-30) }),
]

// Course 1: completed 14 days ago (all 5 lessons marked complete)
// Course 2: completed 7 days ago (all 4 items complete)
// Course 3: in-progress (only 1 of 2 lessons complete)
```

### AC Coverage

| AC | Test Name | Data Required |
|---|---|---|
| AC1 | Chart displays weekly completion rate | 2+ completed courses across different weeks |
| AC2 | History list shows correct data sorted by date desc | 2+ completed courses |
| AC3 | Tooltip shows rate + count on hover | Same as AC1 |
| AC4 | Timeline renders milestones, keyboard navigable | 2+ completed courses |
| AC5a | Empty state: no completed courses, shows in-progress | 1 in-progress, 0 complete |
| AC5b | Empty state: no courses at all | No seed data |

---

## IndexedDB Seeding Additions

Add to `tests/support/helpers/indexeddb-seed.ts`:

```typescript
export async function seedImportedCourses(
  page: Page,
  courses: Record<string, unknown>[]
): Promise<void> {
  await seedIndexedDBStore(page, 'ElearningDB', 'importedCourses', courses)
}

export async function seedContentProgress(
  page: Page,
  progress: Record<string, unknown>[]
): Promise<void> {
  await seedIndexedDBStore(page, 'ElearningDB', 'contentProgress', progress)
}
```

---

## Patterns and Decisions

### Following E08-S01 Lessons Learned

| Lesson | Action |
|---|---|
| Sidebar seed AFTER navigation causes overlay | Seed via `context.addInitScript` BEFORE `page.goto()` |
| `useEffect` for derived state → stale frames | Use `useMemo` with proper deps for all derivations |
| `Math.max(...largeArray)` can throw RangeError | Use `.reduce()` for max: `items.reduce((max, i) => i.time > max ? i.time : max, 0)` |
| Hard waits (`waitForTimeout`) violate NFR | Use `expect(...).toBeVisible()` with retries |
| Missing ignore flag causes setState on unmount | Always `let ignore = false; return () => { ignore = true }` |
| Real-time gap: component loads once | Add event listeners for `course-progress-updated` and `study-session-recorded` |

### Weekly Adherence Anchoring (Apply E08-S01 Fix)

In E08-S01, weekly adherence was anchored to most-recent session, not current date. For E08-S02:
- Anchor weekly chart to `new Date()` (current date), not most-recent data point
- The 12 weeks counted backward from today, not from most-recent event

### Data-testid Convention

```
data-testid="course-completion-tracking"            // section root
data-testid="completion-rate-chart"                 // the area chart
data-testid="completion-history-list"               // the table/list
data-testid="completion-timeline"                   // the timeline
data-testid="completion-empty-state"                // empty state root
data-testid="in-progress-summary"                   // in-progress course cards
data-testid="timeline-milestone-{courseId}"         // each timeline item
```

---

## Implementation Order

1. **Add seed helpers** to `indexeddb-seed.ts` (needed for tests first)
2. **Write E2E tests** (ATDD — tests before implementation)
3. **Create CourseCompletionTracking.tsx** with all helper functions
4. **Update Reports.tsx** to include the new component
5. **Run tests** and fix any issues

---

## Complexity Assessment

**Medium complexity.** The data derivation (reconstructing historical weekly snapshots from event-log-style contentProgress) is the hardest part. The component structure and patterns are well-established from E08-S01. Timeline keyboard navigation requires careful ARIA implementation.

**Estimated AC test coverage**: 5/5 ACs coverable with E2E tests.
**Recommendation**: Review first (run `/review-story` after implementation).
