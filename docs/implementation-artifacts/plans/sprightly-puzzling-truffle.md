# E08-S01: Study Time Analytics — Implementation Plan

## Context

This story creates the first section of the Reports page: **Study Time Analytics**. The Reports page already exists but currently shows placeholder content. This implementation adds:

1. **Chart visualization** showing total study time aggregated by day/week/month using recharts (already integrated)
2. **Period toggle** (daily/weekly/monthly breakdowns) to view 12-week or 12-month trends
3. **Weekly adherence tracking** displaying percentage against configured study target with visual progress indicator
4. **Accessibility features** including chart alt text, table view fallback, and color-blind friendly patterns
5. **Empty state** when no study sessions recorded

**Why now?** Epic 8 builds on Epic 4 (Progress Tracking) and Epic 5 (Study Goals) foundations—study sessions and weekly targets are already tracked. This story surfaces that data as actionable insights, addressing FR 43, 44, 46 (time analytics, adherence, real-time updates).

**Key Constraint:** All charts must meet WCAG 2.1 AA+ standards (alt text, table view, no color-only differentiation).

## Implementation Approach

### Phase 1: Data Layer — Study Time Aggregation Utilities

**File:** `/src/lib/studyTimeAnalytics.ts` (new)

Create utility functions for aggregating study sessions by time period. Use existing `getActionsPerDay()` pattern from `/src/lib/studyLog.ts` as template.

**Functions to implement:**

```typescript
// Returns daily totals for current week (7 days)
export function getDailyStudyTime(sessions: StudySession[]): { date: string; hours: number }[]

// Returns weekly totals for past 12 weeks
export function getWeeklyStudyTime(sessions: StudySession[]): { week: string; hours: number }[]

// Returns monthly totals for past 12 months
export function getMonthlyStudyTime(sessions: StudySession[]): { month: string; hours: number }[]

// Calculates weekly adherence percentage
export function getWeeklyAdherence(
  sessions: StudySession[],
  targetDays: number = 5
): { percentage: number; daysStudied: number; targetDays: number }
```

**Pattern to follow:**
- Use `toLocalDateString()` from `/src/lib/dateUtils.ts` for consistent YYYY-MM-DD formatting
- Convert `duration` (seconds) to hours: `duration / 3600`
- Group sessions by date using `reduce()` with Map for efficient aggregation
- Filter sessions by time window (current week = past 7 days, 12 weeks = past 84 days, etc.)

**Reuse existing utilities:**
- `toLocalDateString(date)` — consistent date formatting
- Session querying pattern from `/src/stores/useSessionStore.ts`

### Phase 2: UI Components — Chart & Period Toggle

**File:** `/src/app/components/charts/StudyTimeChart.tsx` (new)

Create chart component using recharts patterns from `/src/app/components/charts/ProgressChart.tsx`.

**Component structure:**

```typescript
interface StudyTimeChartProps {
  sessions: StudySession[]
  period: 'daily' | 'weekly' | 'monthly'
  onPeriodChange: (period: 'daily' | 'weekly' | 'monthly') => void
}

export function StudyTimeChart({ sessions, period, onPeriodChange }: StudyTimeChartProps) {
  // Use recharts AreaChart or BarChart
  // Include ChartContainer, ChartTooltip, ChartTooltipContent wrappers
  // Add aria-label with descriptive trend summary
  // Return null if no data (empty state handled by parent)
}
```

**Accessibility requirements:**
- `aria-label` on chart container describing trend (e.g., "Study time chart showing 2.5 hours average per week over past 12 weeks")
- Use `ChartContainer` wrapper from `/src/app/components/ui/chart.tsx`
- Add `data-testid="study-time-chart"` for E2E tests
- Color-blind safe: Use patterns or labels, not color alone

**File:** `/src/app/components/analytics/StudyTimePeriodToggle.tsx` (new)

Create period toggle buttons (Daily/Weekly/Monthly).

**Component structure:**

```typescript
interface StudyTimePeriodToggleProps {
  selectedPeriod: 'daily' | 'weekly' | 'monthly'
  onPeriodChange: (period: 'daily' | 'weekly' | 'monthly') => void
}

export function StudyTimePeriodToggle({ selectedPeriod, onPeriodChange }: StudyTimePeriodToggleProps) {
  // Use Button components from shadcn/ui
  // Variant: 'outline' for unselected, 'default' for selected
  // Ensure keyboard accessible (Tab navigation, Enter/Space to activate)
}
```

### Phase 3: UI Components — Weekly Adherence Tracker

**File:** `/src/app/components/analytics/WeeklyAdherenceTracker.tsx` (new)

Display weekly adherence percentage with progress indicator.

**Component structure:**

```typescript
interface WeeklyAdherenceTrackerProps {
  sessions: StudySession[]
  targetDays?: number  // Default to 5 if not configured
}

export function WeeklyAdherenceTracker({ sessions, targetDays = 5 }: WeeklyAdherenceTrackerProps) {
  const { percentage, daysStudied } = getWeeklyAdherence(sessions, targetDays)

  // Display percentage, days studied/target
  // Use Progress component from shadcn/ui for visual indicator
  // Add proper ARIA attributes for accessibility
}
```

**ARIA attributes required:**
- `role="progressbar"` on progress element
- `aria-valuenow={percentage}`, `aria-valuemin="0"`, `aria-valuemax="100"`
- `aria-label` describing value (e.g., "60 percent weekly adherence")
- Add `data-testid="weekly-adherence"` and `data-testid="adherence-progress-indicator"`

### Phase 4: Table View Alternative (Accessibility)

**File:** `/src/app/components/analytics/StudyTimeTable.tsx` (new)

Create accessible HTML table as fallback for chart.

**Component structure:**

```typescript
interface StudyTimeTableProps {
  data: { date: string; hours: number }[]
  period: 'daily' | 'weekly' | 'monthly'
}

export function StudyTimeTable({ data, period }: StudyTimeTableProps) {
  // Render semantic HTML table with <thead>, <tbody>
  // Column headers: "Period" | "Study Time (hours)"
  // Keyboard accessible (focusable rows if interactive)
}
```

**Accessibility:**
- Use `<table>`, `<thead>`, `<tbody>` semantic HTML
- Add `aria-label="Study time data"` on table element
- Ensure proper header association (`<th scope="col">`)

### Phase 5: Reports Page Integration

**File:** `/src/app/pages/Reports.tsx` (modify)

Replace placeholder content with Study Time Analytics section.

**Changes:**

1. **Import study session store:**
   ```typescript
   import { useSessionStore } from '@/stores/useSessionStore'
   ```

2. **Query sessions in component:**
   ```typescript
   const { sessions } = useSessionStore()
   ```

3. **Add state for period and view mode:**
   ```typescript
   const [period, setPeriod] = useState<'daily' | 'weekly' | 'monthly'>('daily')
   const [viewMode, setViewMode] = useState<'chart' | 'table'>('chart')
   ```

4. **Replace placeholder with Study Time Analytics section:**
   ```tsx
   <section className="space-y-6">
     <div className="flex items-center justify-between">
       <h2 className="text-2xl font-bold">Study Time Analytics</h2>
       <StudyTimePeriodToggle selectedPeriod={period} onPeriodChange={setPeriod} />
     </div>

     {sessions.length === 0 ? (
       <div data-testid="study-time-empty-state" className="...">
         <p>Data will appear once study sessions are recorded</p>
       </div>
     ) : (
       <>
         <div className="flex justify-end">
           <Button
             variant="outline"
             size="sm"
             onClick={() => setViewMode(viewMode === 'chart' ? 'table' : 'chart')}
           >
             {viewMode === 'chart' ? 'View as table' : 'View as chart'}
           </Button>
         </div>

         {viewMode === 'chart' ? (
           <StudyTimeChart sessions={sessions} period={period} onPeriodChange={setPeriod} />
         ) : (
           <StudyTimeTable data={aggregatedData} period={period} />
         )}

         <WeeklyAdherenceTracker sessions={sessions} />
       </>
     )}
   </section>
   ```

**Route verification:**
- Reports route already exists in `/src/app/routes.tsx` as `/reports`
- Sidebar navigation already highlights Reports when active

### Phase 6: E2E Test Implementation

**File:** `/tests/e2e/story-e08-s01.spec.ts` (already created with ATDD tests)

Update TODOs in the spec to pass:

1. **Chart rendering test** — Verify chart appears with session data
2. **Period toggle test** — Click Daily/Weekly/Monthly and verify chart updates
3. **Adherence calculation test** — Seed 3 sessions, verify 60% adherence (3/5 days)
4. **Accessibility tests:**
   - Chart has `aria-label` describing trend
   - Table view toggle works and renders semantic HTML table
   - Progress indicator has proper ARIA attributes (`role`, `aria-valuenow`, etc.)
5. **Empty state test** — Verify empty state shows when no sessions
6. **Keyboard navigation test** — Tab through period toggles, activate with Enter/Space

**Pattern to follow:**
- Use `seedStudySessions()` helper from `/tests/support/helpers/indexeddb-seed.ts`
- Use `createStudySession()` factory from `/tests/support/fixtures/factories/session-factory.ts`
- Import deterministic time utilities from `/tests/utils/test-time.ts` (FIXED_DATE, getRelativeDate, addMinutes)
- Navigate with `goToReports()` helper

### Phase 7: Granular Commits

After each phase, commit incrementally as save points:

1. `feat: add study time aggregation utilities`
2. `feat: add StudyTimeChart component with period toggle`
3. `feat: add WeeklyAdherenceTracker component`
4. `feat: add StudyTimeTable accessibility fallback`
5. `feat: integrate Study Time Analytics into Reports page`
6. `test: implement E2E tests for Study Time Analytics`

## Critical Files to Modify

| File | Action | Purpose |
|------|--------|---------|
| `/src/lib/studyTimeAnalytics.ts` | **Create** | Data aggregation utilities (daily/weekly/monthly) |
| `/src/app/components/charts/StudyTimeChart.tsx` | **Create** | Chart component with period toggle |
| `/src/app/components/analytics/StudyTimePeriodToggle.tsx` | **Create** | Period selection buttons |
| `/src/app/components/analytics/WeeklyAdherenceTracker.tsx` | **Create** | Adherence percentage display with progress indicator |
| `/src/app/components/analytics/StudyTimeTable.tsx` | **Create** | Accessible table fallback |
| `/src/app/pages/Reports.tsx` | **Modify** | Integrate Study Time Analytics section |
| `/tests/e2e/story-e08-s01.spec.ts` | **Modify** | Complete TODOs in ATDD tests |

## Existing Patterns & Utilities to Reuse

### Data Layer
- `useSessionStore` — Query study sessions from IndexedDB
- `db.studySessions.toCollection().toArray()` — Fetch all sessions
- `toLocalDateString()` from `/src/lib/dateUtils.ts` — Date formatting
- `getActionsPerDay()` from `/src/lib/studyLog.ts` — Aggregation pattern

### UI Components
- `ChartContainer`, `ChartTooltip`, `ChartTooltipContent` from `/src/app/components/ui/chart.tsx` — Chart wrappers
- `ProgressChart.tsx` — AreaChart implementation pattern
- `Button`, `Progress` from shadcn/ui — UI primitives
- Motion variants (`staggerContainer`, `fadeUp`) from `/src/app/pages/Overview.tsx` — Page animations

### Testing
- `createStudySession()` from `/tests/support/fixtures/factories/session-factory.ts` — Session factory
- `seedStudySessions()` from `/tests/support/helpers/indexeddb-seed.ts` — IndexedDB seeding
- `FIXED_DATE`, `getRelativeDate()`, `addMinutes()` from `/tests/utils/test-time.ts` — Deterministic time
- `goToReports()` from `/tests/support/helpers/navigation.ts` — Navigation helper

## Verification

### Manual Testing

1. **Seed test data:**
   ```typescript
   // In browser console (DevTools)
   import { db } from './src/db/db'
   await db.studySessions.bulkAdd([
     // Add 20+ sessions across different weeks
   ])
   ```

2. **Navigate to `/reports`**

3. **Verify chart displays:**
   - Daily view shows current week (7 days)
   - Weekly view shows past 12 weeks
   - Monthly view shows past 12 months

4. **Verify period toggle:**
   - Click Daily/Weekly/Monthly buttons
   - Chart updates with correct data

5. **Verify weekly adherence:**
   - Shows percentage (e.g., "60%" if 3 days studied, target 5)
   - Progress indicator reflects percentage visually

6. **Verify accessibility:**
   - Chart has descriptive `aria-label`
   - "View as table" toggle works
   - Table has proper semantic HTML
   - Keyboard navigation works (Tab through toggles)

7. **Verify empty state:**
   - Clear all sessions from IndexedDB
   - Navigate to Reports
   - Empty state message appears

### Automated Testing

Run E2E tests:
```bash
npx playwright test tests/e2e/story-e08-s01.spec.ts --project=chromium
```

**Expected:** All 11 tests pass (chart rendering, period toggle, adherence calculation, accessibility, empty state, keyboard navigation).

### Accessibility Audit

Use browser DevTools Lighthouse:
1. Navigate to `/reports`
2. Run Lighthouse audit (Accessibility)
3. Verify 100 score (no ARIA violations, proper contrast ratios, keyboard navigable)

## Dependencies

**None.** This story is independent. It builds on:
- Epic 4 (Study Sessions tracking) — ✅ Done
- Epic 5 (Study Goals configuration) — ✅ Done

## Risk Mitigation

**Risk:** Chart library (recharts) performance with large datasets (1000+ sessions)
**Mitigation:** Aggregate data before passing to chart (limit to 84 data points for 12 weeks, 365 for 12 months max)

**Risk:** Weekly adherence calculation complexity (week boundaries, timezones)
**Mitigation:** Use `toLocalDateString('sv-SE')` pattern for consistent date handling; test with sessions on week boundaries

**Risk:** Real-time updates (AC: "adherence updates in real time as new sessions recorded")
**Mitigation:** `useSessionStore` already reactive via Zustand; component will re-render automatically when sessions added
