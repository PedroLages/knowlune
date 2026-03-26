# E20-S03: 365 Day Activity Heatmap — Implementation Plan

**Story:** [20-3-365-day-activity-heatmap.md](../20-3-365-day-activity-heatmap.md)
**Created:** 2026-03-23
**Estimated effort:** 4 hours

## Overview

Build a GitHub-style 365-day contribution heatmap showing daily study duration on the Reports page. The component reads session data from IndexedDB (`db.studySessions`), aggregates duration by date, and renders a 52×7 grid with 5 intensity levels. Includes tooltip interaction, accessibility features (alt text, opacity variation, table view toggle), and empty state handling.

## Architecture Decisions

### Why a New Component (Not Extending StudyStreakCalendar)

The existing `StudyStreakCalendar` (src/app/components/StudyStreakCalendar.tsx) differs in several key ways:

| Aspect | StudyStreakCalendar | ActivityHeatmap365 |
|--------|--------------------|--------------------|
| Data source | localStorage `study-log` (lesson counts) | IndexedDB `studySessions` (duration in seconds) |
| Time range | 16 weeks (~112 days) | 52 weeks (365 days) |
| Intensity metric | Lesson count (1, 2, 3+) | Total study duration (minutes) |
| Color tokens | `bg-gold`, `bg-warning`, `bg-momentum-warm-bg` | `--heatmap-empty` through `--heatmap-level-4` |
| Features | Streak stats, pause, freeze days, milestones | Table view toggle, monthly summary |
| Location | Overview page | Reports page |

Creating a new dedicated component avoids coupling streak-specific logic (pauses, freezes, milestones) with a pure analytics visualization. The grid-building algorithm from `buildWeekGrid()` can inform the approach but the data pipeline differs fundamentally.

### Data Flow

```
IndexedDB (studySessions table)
  → getDailyStudyDurations(365)     [src/lib/heatmapData.ts]
    → aggregate: date → totalSeconds
    → return: Array<{ date: string; totalMinutes: number }>
  → ActivityHeatmap365 component    [src/app/components/reports/ActivityHeatmap365.tsx]
    → build 52×7 grid
    → map minutes to intensity level (0-4)
    → render cells with heatmap design tokens
```

### Intensity Thresholds

5 levels based on daily study time (minutes):

| Level | Token | Duration | Opacity |
|-------|-------|----------|---------|
| 0 (none) | `--heatmap-empty` | 0 min | 0.3 |
| 1 (light) | `--heatmap-level-1` | 1–15 min | 0.3 |
| 2 (moderate) | `--heatmap-level-2` | 16–45 min | 0.5 |
| 3 (heavy) | `--heatmap-level-3` | 46–90 min | 0.7 |
| 4 (intense) | `--heatmap-level-4` | 91+ min | 1.0 |

These thresholds align with common study session patterns (15-min quick review, 30-min focused session, 60-min deep study, 90+ marathon). The opacity values match the existing theme.css `--heatmap-level-*` definitions which already use graded opacity.

## Implementation Steps

### Step 1: Data Aggregation Utility (~30 min)

**Create:** `src/lib/heatmapData.ts`

```typescript
// Pure function: accepts sessions, returns daily aggregation
// Deterministic: accepts `now` parameter for testability
export function aggregateSessionsByDay(
  sessions: StudySession[],
  days: number,
  now: Date
): Array<{ date: string; totalMinutes: number }>

// Async wrapper: loads from IndexedDB + calls pure function
export async function getDailyStudyDurations(
  days?: number
): Promise<Array<{ date: string; totalMinutes: number }>>

// Intensity level mapping
export function getIntensityLevel(minutes: number): 0 | 1 | 2 | 3 | 4

// Generate alt text summary
export function generateHeatmapAltText(
  data: Array<{ date: string; totalMinutes: number }>
): string

// Monthly summary for table view
export function getMonthlyStudySummary(
  data: Array<{ date: string; totalMinutes: number }>
): Array<{ month: string; totalHours: number; activeDays: number; avgMinutesPerDay: number }>
```

**Key patterns:**
- Pure/async split follows `retentionMetrics.ts` pattern (pure functions + async wrappers)
- `now: Date` parameter for deterministic testing (per test-patterns rule)
- Uses `toLocalDateString()` from `@/lib/dateUtils` (per engineering-patterns.md)
- Only counts sessions with `endTime` (completed sessions)

**Unit tests:** `src/lib/__tests__/heatmapData.test.ts`
- Aggregation with multiple sessions on same day
- Aggregation across 365 days with gaps
- Intensity level boundaries (0, 15, 16, 45, 46, 90, 91 min)
- Empty sessions array
- Alt text generation
- Monthly summary calculation

### Step 2: ActivityHeatmap365 Component (~90 min)

**Create:** `src/app/components/reports/ActivityHeatmap365.tsx`

**Component structure:**
```
<Card rounded-[24px]>
  <CardHeader>
    <CardTitle>"Study Activity (Past Year)"</CardTitle>
    <Button toggle>"View as Table" / "View as Chart"</Button>
  </CardHeader>
  <CardContent>
    {showTable ? <MonthlyTable /> : <HeatmapGrid />}
  </CardContent>
</Card>
```

**Grid layout approach:**
- CSS Grid: `grid-template-columns: auto repeat(53, minmax(8px, 1fr))`
- `grid-template-rows: auto repeat(7, 1fr)`
- Row 0: month labels (Jan, Feb, ... positioned at first week of each month)
- Rows 1-7: days of week (Sun-Sat)
- Col 0: day-of-week labels (odd rows only: Mon, Wed, Fri)
- Cells: `aspect-square` with `rounded-[3px]` (matching StudyStreakCalendar)
- Horizontal scroll on narrow viewports via `overflow-x-auto`

**Cell rendering:**
```tsx
<div
  tabIndex={0}
  role="img"
  aria-label={`${formattedDate}: ${formatDuration(day.totalMinutes)}`}
  className={cn(
    'aspect-square w-full rounded-[3px]',
    'focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-ring',
    intensityClasses[level]  // maps to heatmap design tokens
  )}
/>
```

**Tooltip content:**
- Date: formatted as "Mon, Mar 23"
- Duration: "2h 15m" or "45m" or "No activity"
- Uses shadcn `Tooltip` component (already imported in StudyStreakCalendar)

**Table view (accessibility):**
- Monthly summary table with columns: Month, Total Hours, Active Days, Avg Min/Day
- Semantic `<table>` with `<thead>`, `<tbody>`, `scope="col"` headers
- Keyboard accessible by default (standard HTML table)

**Legend:**
```
Less [□ □ □ □ □] More
```
5 boxes showing empty → level-4 with labels

**State management:**
- `useState` for `showTable` toggle
- `useEffect` with ignore flag to load sessions from IndexedDB (pattern from `StudyTimeAnalytics.tsx`)
- `useMemo` for grid computation
- Listen for `study-log-updated` event for real-time updates

### Step 3: Reports Page Integration (~20 min)

**Modify:** `src/app/pages/Reports.tsx`

Add as a new row in the Study Analytics tab, positioned after Row 4 (Study Activity 30-day chart + Skills Radar) and before Row 5 (Average Retake Frequency):

```tsx
{/* ── Row 5: 365-Day Activity Heatmap ── */}
<motion.div variants={fadeUp}>
  <ActivityHeatmap365 />
</motion.div>
```

**Import:** Add lazy import or direct import of ActivityHeatmap365.

**Empty state:** Handled internally by the component (shows message when no sessions loaded).

### Step 4: E2E Tests (~60 min)

**Create:** `tests/e2e/regression/story-e20-s03.spec.ts`

**Test scenarios:**

1. **AC1: Heatmap renders with session data**
   - Seed IndexedDB with sessions across multiple days using `seedIndexedDBStore` + `createStudySession` factory
   - Navigate to Reports page
   - Verify heatmap grid is visible (data-testid="activity-heatmap-365")
   - Verify cells with seeded data have correct intensity classes
   - Verify legend is present

2. **AC2: Tooltip shows date and duration**
   - Hover over a cell with activity
   - Verify tooltip contains date and formatted duration

3. **AC3: Table view toggle**
   - Click "View as Table" button
   - Verify table renders with monthly summary data
   - Verify table has proper `<thead>` and column headers
   - Click "View as Chart" to switch back

4. **AC4: Empty state**
   - Navigate to Reports with no session data
   - Verify empty state message is shown in heatmap section

**Test data seeding:**
```typescript
// Use session-factory.ts to create sessions across 7+ days
const sessions = [
  createStudySession({
    startTime: '2026-03-22T10:00:00Z',
    endTime: '2026-03-22T10:30:00Z',
    duration: 1800, // 30 min
  }),
  createStudySession({
    startTime: '2026-03-21T14:00:00Z',
    endTime: '2026-03-21T15:30:00Z',
    duration: 5400, // 90 min
  }),
  // ... more sessions across multiple days
]
await seedIndexedDBStore(page, 'knowlune-db', 'studySessions', sessions)
```

### Step 5: Unit Tests (~20 min)

**Create:** `src/lib/__tests__/heatmapData.test.ts`

Already described in Step 1. Key test cases:
- `aggregateSessionsByDay()` with various session distributions
- `getIntensityLevel()` boundary values
- `generateHeatmapAltText()` output format
- `getMonthlyStudySummary()` grouping and calculations

## Files to Create

| File | Purpose |
|------|---------|
| `src/lib/heatmapData.ts` | Data aggregation utilities |
| `src/lib/__tests__/heatmapData.test.ts` | Unit tests for data utils |
| `src/app/components/reports/ActivityHeatmap365.tsx` | Heatmap component |
| `tests/e2e/regression/story-e20-s03.spec.ts` | E2E test spec |

## Files to Modify

| File | Change |
|------|--------|
| `src/app/pages/Reports.tsx` | Import and render `ActivityHeatmap365` in Study Analytics tab |

## Dependencies

- **No new packages** — uses existing Recharts (not needed for grid), shadcn/ui Tooltip, Card
- **Existing infrastructure:**
  - `db.studySessions` (IndexedDB via Dexie)
  - `toLocalDateString()` from `@/lib/dateUtils`
  - `--heatmap-*` design tokens from `src/styles/theme.css`
  - `seedIndexedDBStore()` + `createStudySession()` for tests
  - `Tooltip` from `@/app/components/ui/tooltip`

## Risks & Mitigations

| Risk | Mitigation |
|------|-----------|
| Performance: loading 365 days of sessions | Use Dexie `.toArray()` once, aggregate in memory. Sessions table is typically small (<1000 records). |
| Grid rendering: 365+ cells | Pure CSS Grid, no virtualization needed (cells are tiny 8-12px squares). StudyStreakCalendar already renders 112 cells without issue. |
| Date edge cases | Use `toLocalDateString()` helper consistently. All date parsing uses `T12:00:00` noon anchor to avoid timezone issues. |

## Implementation Order

1. Data utility (`heatmapData.ts`) + unit tests — foundation, testable in isolation
2. Component (`ActivityHeatmap365.tsx`) — depends on data utility
3. Reports integration — simple import + render
4. E2E tests — validates full integration

## Definition of Done

- [ ] 365-day heatmap visible on Reports page (Study Analytics tab)
- [ ] 5 intensity levels using `--heatmap-*` design tokens
- [ ] Tooltip on hover/focus shows date + duration
- [ ] "View as Table" toggle with monthly summary
- [ ] Alt text on heatmap grid
- [ ] Empty state when no sessions
- [ ] Light/dark mode works correctly
- [ ] Unit tests for aggregation logic pass
- [ ] E2E tests for all ACs pass
- [ ] No hardcoded colors (ESLint design-tokens rule passes)
