# Story 64.6: Overview dashboard progressive loading and data batching

Status: ready-for-dev

## Story

As a Knowlune user opening the dashboard,
I want to see useful information immediately,
so that I don't stare at a loading screen while all widgets initialize.

## Acceptance Criteria

1. **Given** I navigate to the Overview page
   **When** the page starts rendering
   **Then** Tier 1 widgets (greeting, stats cards, quick actions, continue learning) render within 500ms
   **And** Tier 2 widgets (streak calendar, goals, recent activity) render within 1000ms
   **And** Tier 3 widgets (ProgressChart, SkillProficiencyRadar) render when scrolled into viewport

2. **Given** the Overview page loads
   **When** IndexedDB transactions are observed in DevTools
   **Then** the dashboard data is fetched in 1-2 transactions (batched), not 8+ individual transactions

3. **Given** chart components (ProgressChart, SkillProficiencyRadar) use the recharts library (117 KB gz)
   **When** the Overview page first renders and charts are below the viewport
   **Then** the chart chunk is NOT downloaded until the user scrolls the chart section into view (or within 200px of viewport)

4. **Given** a `useIntersectionObserver` hook is implemented
   **When** it is used to wrap below-fold components
   **Then** the hook returns `[isVisible, ref]` and triggers loading when element enters viewport with configurable `rootMargin`

## Tasks / Subtasks

- [ ] Task 1: Create `useIntersectionObserver` hook (AC: 4)
  - [ ] 1.1 Create `src/app/hooks/useIntersectionObserver.ts`
  - [ ] 1.2 Implement hook returning `[isVisible, ref]` with configurable `rootMargin` (default: `200px`)
  - [ ] 1.3 Handle cleanup on unmount
  - [ ] 1.4 Use `once` option — once visible, stay visible (no re-hiding)
- [ ] Task 2: Create batched dashboard data loader (AC: 2)
  - [ ] 2.1 Create `useDashboardData` hook or `loadDashboardData` function
  - [ ] 2.2 Batch all dashboard queries into 1-2 Dexie transactions using `db.transaction('r', [tables], ...)`
  - [ ] 2.3 Return all widget data from a single hook/function call
  - [ ] 2.4 Replace individual widget-level data fetching with batched result
- [ ] Task 3: Implement tiered widget rendering (AC: 1)
  - [ ] 3.1 Identify Tier 1 widgets in Overview.tsx (greeting, stats, quick actions, continue learning)
  - [ ] 3.2 Identify Tier 2 widgets (streak calendar, goals, recent activity, achievement banner)
  - [ ] 3.3 Render Tier 1 immediately from batched data
  - [ ] 3.4 Render Tier 2 after Tier 1 completes (use `requestIdleCallback` or `setTimeout` deferral)
- [ ] Task 4: Lazy-load Tier 3 chart components on viewport intersection (AC: 3)
  - [ ] 4.1 Wrap ProgressChart in `React.lazy()` with `useIntersectionObserver` trigger
  - [ ] 4.2 Wrap SkillProficiencyRadar similarly
  - [ ] 4.3 Show skeleton placeholder until charts are visible and loaded
  - [ ] 4.4 Verify recharts chunk is NOT downloaded on initial page load
- [ ] Task 5: Verify rendering timing and test (AC: 1, 2, 3)
  - [ ] 5.1 Use browser DevTools Performance tab to verify tier timing
  - [ ] 5.2 Verify 1-2 IDB transactions (not 8+) in DevTools Application tab
  - [ ] 5.3 Run existing E2E tests to confirm no regressions

## Dev Notes

### Architecture Decisions: AD-2 and AD-4

- AD-2: `useIntersectionObserver` hook for viewport-triggered lazy loading
- AD-4: Tiered widget rendering with batched IndexedDB transaction
[Source: architecture-performance-optimization.md#AD-2, #AD-4]

### Data Batching Pattern

```typescript
async function loadDashboardData(): Promise<DashboardData> {
  return db.transaction('r',
    [db.courses, db.studySessions, db.notes, db.contentProgress, db.quizAttempts],
    async () => {
      const [courses, sessions, noteCount, progress, quizAttempts] = await Promise.all([
        db.courses.toArray(),
        db.studySessions.orderBy('startTime').reverse().limit(100).toArray(),
        db.notes.count(),
        db.contentProgress.toArray(),
        db.quizAttempts.orderBy('completedAt').reverse().limit(50).toArray(),
      ])
      return { courses, sessions, noteCount, progress, quizAttempts }
    }
  )
}
```

### Viewport Lazy Loading Pattern

```tsx
const ProgressChart = React.lazy(() =>
  import('@/app/components/charts/ProgressChart')
    .then(m => ({ default: m.ProgressChart }))
)

function ChartSection() {
  const [isVisible, ref] = useIntersectionObserver({ rootMargin: '200px' })
  return (
    <div ref={ref}>
      {isVisible ? (
        <Suspense fallback={<Skeleton className="h-64 w-full rounded-[24px]" />}>
          <ProgressChart />
        </Suspense>
      ) : (
        <Skeleton className="h-64 w-full rounded-[24px]" />
      )}
    </div>
  )
}
```

### Key Constraints

- Overview.tsx is a complex component with 15+ widget imports — restructure carefully
- **Do NOT change widget component APIs** — only change when/how they receive data and render
- The `recharts` library (117 KB gz) is the main target for viewport lazy loading
- Benefits from E64-S04 compound indexes but works without them
- Skeleton placeholders must use design tokens (e.g., `rounded-[24px]` for cards) — see styling rules
- Use `requestIdleCallback` with `setTimeout` fallback for Tier 2 deferral (Safari support)

### Project Structure Notes

- **New files**: `src/app/hooks/useIntersectionObserver.ts`
- **Major refactor**: `src/app/pages/Overview.tsx`
- Chart components: likely in `src/app/components/` or `src/app/components/figma/`
- Data hooks: may need new `src/app/hooks/useDashboardData.ts`

### References

- [Source: _bmad-output/planning-artifacts/architecture-performance-optimization.md#AD-2, #AD-4]
- [Source: _bmad-output/planning-artifacts/prd-performance-optimization.md#FR-6]
- [Source: _bmad-output/planning-artifacts/epics-performance-optimization.md#Story-64.6]

## Dev Agent Record

### Agent Model Used

### Debug Log References

### Completion Notes List

### File List
