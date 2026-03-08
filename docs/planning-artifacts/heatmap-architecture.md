# 52-Week Progress Heatmap Architecture

**Epic 8 Prep Sprint**
**Date:** 2026-03-08
**Status:** Design Complete

---

## Overview

GitHub-style contribution grid showing 52 weeks (364 days) of study activity. Displays study session frequency with color intensity mapping to activity level.

**Visual Reference:** GitHub contribution graph pattern
- 7 rows (Sun-Sat) × 52 columns (weeks)
- Color intensity: 0 sessions (gray) → 5+ sessions (hottest color)
- Tooltips show exact date + session count on hover
- Responsive: full grid on desktop, scrollable/condensed on mobile

---

## Data Structure

### HeatmapCell Interface

```typescript
interface HeatmapCell {
  date: string              // ISO 8601 date (YYYY-MM-DD)
  dayOfWeek: number         // 0 (Sun) - 6 (Sat)
  weekIndex: number         // 0-51 (week position in grid)
  sessionCount: number      // Study sessions on this date
  totalMinutes: number      // Total study time in minutes
  activityLevel: 0 | 1 | 2 | 3 | 4  // Intensity tier
}

interface HeatmapData {
  cells: HeatmapCell[]
  startDate: string         // First day of 52-week range
  endDate: string           // Last day of 52-week range
  maxSessionCount: number   // Max sessions on any single day (for scaling)
  totalSessions: number     // Total across all 364 days
  activeDays: number       // Days with sessionCount > 0
}
```

### Activity Level Tiers

```typescript
function getActivityLevel(sessionCount: number, maxSessions: number): 0 | 1 | 2 | 3 | 4 {
  if (sessionCount === 0) return 0  // No activity
  if (maxSessions === 0) return 0   // Edge case: no data

  const normalized = sessionCount / maxSessions
  if (normalized >= 0.75) return 4  // Very high activity
  if (normalized >= 0.50) return 3  // High activity
  if (normalized >= 0.25) return 2  // Moderate activity
  return 1                          // Low activity (but > 0)
}
```

**Rationale:** Dynamic scaling based on user's max activity prevents color saturation when one outlier day has 20 sessions while typical days have 1-2.

---

## Component Architecture

### Primary Component

**File:** `src/app/components/ProgressHeatmap.tsx`

```typescript
interface ProgressHeatmapProps {
  /**
   * Number of weeks to display (default: 52)
   * Allows future variants (e.g., 26-week half-year view)
   */
  weeks?: number

  /**
   * Whether to show month labels above grid
   */
  showMonthLabels?: boolean

  /**
   * Whether to show day-of-week labels on left
   */
  showDayLabels?: boolean

  /**
   * Compact mode: smaller cells, no labels (for dashboard widgets)
   */
  compact?: boolean
}

export function ProgressHeatmap({
  weeks = 52,
  showMonthLabels = true,
  showDayLabels = true,
  compact = false
}: ProgressHeatmapProps) {
  const heatmapData = useHeatmapData(weeks)
  // ... implementation
}
```

### Data Hook

**File:** `src/hooks/useHeatmapData.ts`

```typescript
export function useHeatmapData(weeks: number = 52): HeatmapData | null {
  const [data, setData] = useState<HeatmapData | null>(null)

  useEffect(() => {
    async function loadHeatmapData() {
      // 1. Calculate date range (today - 364 days for 52 weeks)
      const endDate = new Date()
      const startDate = new Date(endDate)
      startDate.setDate(startDate.getDate() - (weeks * 7 - 1))

      // 2. Load study sessions from IndexedDB
      const sessions = await db.studySessions
        .where('startTime')
        .between(startDate.toISOString(), endDate.toISOString())
        .toArray()

      // 3. Group sessions by date
      const sessionsByDate = groupSessionsByDate(sessions)

      // 4. Generate grid cells (364 cells for 52 weeks)
      const cells = generateHeatmapCells(startDate, endDate, sessionsByDate)

      // 5. Calculate metadata
      const maxSessionCount = Math.max(...cells.map(c => c.sessionCount), 0)
      const totalSessions = cells.reduce((sum, c) => sum + c.sessionCount, 0)
      const activeDays = cells.filter(c => c.sessionCount > 0).length

      setData({
        cells,
        startDate: startDate.toISOString(),
        endDate: endDate.toISOString(),
        maxSessionCount,
        totalSessions,
        activeDays
      })
    }

    loadHeatmapData()

    // Reactivity: refresh when study log updates
    const handleUpdate = () => loadHeatmapData()
    window.addEventListener('study-log-updated', handleUpdate)
    return () => window.removeEventListener('study-log-updated', handleUpdate)
  }, [weeks])

  return data
}
```

**Performance Note:** IndexedDB query with date range index (`where('startTime').between()`) is O(log n) lookup + O(k) scan where k = matching sessions. For 52 weeks of data (~1800 sessions worst case), query completes in <10ms.

---

## Grid Generation Algorithm

```typescript
function generateHeatmapCells(
  startDate: Date,
  endDate: Date,
  sessionsByDate: Map<string, StudySession[]>
): HeatmapCell[] {
  const cells: HeatmapCell[] = []
  const current = new Date(startDate)
  const totalDays = 364 // 52 weeks exactly

  // Calculate max sessions for dynamic scaling
  let maxSessions = 0
  for (const sessions of sessionsByDate.values()) {
    maxSessions = Math.max(maxSessions, sessions.length)
  }

  for (let day = 0; day < totalDays; day++) {
    const dateKey = formatDate(current, 'YYYY-MM-DD')
    const sessions = sessionsByDate.get(dateKey) ?? []
    const sessionCount = sessions.length
    const totalMinutes = sessions.reduce((sum, s) => sum + s.duration, 0)

    cells.push({
      date: dateKey,
      dayOfWeek: current.getDay(), // 0-6
      weekIndex: Math.floor(day / 7),
      sessionCount,
      totalMinutes,
      activityLevel: getActivityLevel(sessionCount, maxSessions)
    })

    current.setDate(current.getDate() + 1)
  }

  return cells
}

function groupSessionsByDate(sessions: StudySession[]): Map<string, StudySession[]> {
  const map = new Map<string, StudySession[]>()
  for (const session of sessions) {
    const dateKey = formatDate(new Date(session.startTime), 'YYYY-MM-DD')
    const arr = map.get(dateKey) ?? []
    arr.push(session)
    map.set(dateKey, arr)
  }
  return map
}
```

---

## Visual Design

### Color Palette (Theme Tokens)

```css
/* theme.css - add heatmap color scale */
--heatmap-empty: hsl(var(--muted) / 0.3);       /* No activity */
--heatmap-level-1: hsl(var(--success) / 0.3);   /* Low activity */
--heatmap-level-2: hsl(var(--success) / 0.5);   /* Moderate */
--heatmap-level-3: hsl(var(--success) / 0.7);   /* High */
--heatmap-level-4: hsl(var(--success) / 1.0);   /* Very high */
```

**Dark Mode:** Colors auto-adjust via HSL alpha channel. Success color stays consistent, only intensity varies.

### Grid Layout

**Desktop (≥1024px):**
```
       Jan   Feb   Mar   Apr   May   Jun ...
Sun    □ □ □ □ □ □ □ □ □ □ □ □ □ □ ...
Mon    □ □ □ □ □ □ □ □ □ □ □ □ □ □ ...
Tue    □ □ □ □ □ □ □ □ □ □ □ □ □ □ ...
Wed    □ □ □ □ □ □ □ □ □ □ □ □ □ □ ...
Thu    □ □ □ □ □ □ □ □ □ □ □ □ □ □ ...
Fri    □ □ □ □ □ □ □ □ □ □ □ □ □ □ ...
Sat    □ □ □ □ □ □ □ □ □ □ □ □ □ □ ...

Legend: □ 0   ■ 1-2   ■ 3-4   ■ 5-6   ■ 7+
```

**Mobile (<1024px):**
- Horizontal scroll container (`overflow-x: auto`)
- Reduced cell size (10px → 8px)
- Hide day labels, keep month labels
- Scroll indicator (fade gradient on right edge)

### Cell Dimensions

```typescript
const CELL_SIZE = {
  desktop: 12,  // 12px square
  mobile: 8     // 8px square
}

const CELL_GAP = 2  // 2px gap between cells

const GRID_WIDTH = {
  desktop: (CELL_SIZE.desktop + CELL_GAP) * 52,  // ~728px
  mobile: (CELL_SIZE.mobile + CELL_GAP) * 52     // ~520px
}
```

---

## Tooltip Implementation

### Tooltip Content

```typescript
interface HeatmapTooltipContent {
  date: string           // "March 8, 2026"
  sessionCount: number   // 3
  totalMinutes: number   // 87
  dayOfWeek: string      // "Friday"
}

function HeatmapTooltip({ cell }: { cell: HeatmapCell }) {
  const formatted = formatDate(new Date(cell.date), 'MMMM d, yyyy')
  const hours = Math.floor(cell.totalMinutes / 60)
  const minutes = cell.totalMinutes % 60

  return (
    <div className="text-xs">
      <div className="font-semibold">{formatted}</div>
      <div className="text-muted-foreground">
        {cell.sessionCount === 0 && 'No study sessions'}
        {cell.sessionCount === 1 && '1 study session'}
        {cell.sessionCount > 1 && `${cell.sessionCount} study sessions`}
      </div>
      {cell.totalMinutes > 0 && (
        <div className="text-muted-foreground">
          {hours > 0 && `${hours}h `}
          {minutes}m total
        </div>
      )}
    </div>
  )
}
```

**Library:** Use `@/app/components/ui/tooltip` (shadcn/ui Radix Tooltip)

**Performance:** Tooltip renders on hover only (lazy). No tooltip pre-rendering for 364 cells.

---

## Accessibility

### Keyboard Navigation

```typescript
<div
  role="img"
  aria-label={`Study activity heatmap for the past ${weeks} weeks. ${data.activeDay} active days out of ${weeks * 7}.`}
  className="heatmap-grid"
>
  {/* Grid cells */}
  {cells.map(cell => (
    <Tooltip key={cell.date}>
      <TooltipTrigger asChild>
        <button
          aria-label={`${formatDate(cell.date, 'MMMM d, yyyy')}: ${cell.sessionCount} study sessions`}
          className="heatmap-cell"
          tabIndex={cell.sessionCount > 0 ? 0 : -1}  // Only focusable if active
        >
          <span className="sr-only">{cell.sessionCount} sessions</span>
        </button>
      </TooltipTrigger>
      <TooltipContent><HeatmapTooltip cell={cell} /></TooltipContent>
    </Tooltip>
  ))}
</div>
```

**Screen Reader:** `role="img"` with `aria-label` summary. Individual cells have accessible names for detailed exploration.

**Focus Management:** Arrow keys navigate grid (implement via `useGridNavigation` hook).

---

## Performance Optimizations

### 1. Virtualization (Optional)

For 52 weeks = 364 cells, virtualization NOT needed. Modern browsers render 364 small `<button>` elements in <5ms.

**When to virtualize:** If extending to multi-year view (e.g., 3 years = 1095 cells), consider `react-window` for column virtualization.

### 2. Memoization

```typescript
const cellComponents = useMemo(
  () => cells.map(cell => <HeatmapCell key={cell.date} cell={cell} />),
  [cells]
)
```

Prevents re-render of all 364 cells when parent re-renders.

### 3. Date Formatting Cache

```typescript
const dateCache = new Map<string, string>()

function formatDateCached(date: Date, format: string): string {
  const key = `${date.toISOString()}-${format}`
  if (dateCache.has(key)) return dateCache.get(key)!

  const formatted = formatDate(date, format)
  dateCache.set(key, formatted)
  return formatted
}
```

Tooltip hover triggers date formatting. Cache prevents re-formatting same date on repeated hovers.

---

## Integration Points

### 1. Reports Page

**Location:** `src/app/pages/Reports.tsx`

```typescript
<section className="mb-8">
  <h2 className="text-xl font-semibold mb-4">Study Activity</h2>
  <Card className="p-6">
    <ProgressHeatmap weeks={52} showMonthLabels showDayLabels />
  </Card>
</section>
```

### 2. Overview Dashboard (Compact Widget)

```typescript
<Card className="p-4">
  <h3 className="text-sm font-semibold mb-3">52-Week Activity</h3>
  <ProgressHeatmap weeks={52} compact showMonthLabels={false} showDayLabels={false} />
</Card>
```

### 3. Custom Date Range (Future Enhancement)

```typescript
interface DateRangeHeatmapProps {
  startDate: string  // ISO 8601
  endDate: string    // ISO 8601
}

// Allows selecting arbitrary date range instead of fixed 52 weeks
```

---

## Edge Cases & Validation

### 1. New User (Zero Sessions)

```typescript
// All cells have activityLevel = 0 (empty state)
// Display encouragement message below grid:
{data.totalSessions === 0 && (
  <p className="text-sm text-muted-foreground mt-4">
    Start studying to see your activity patterns! 📚
  </p>
)}
```

### 2. Partial Week at Start/End

GitHub pattern: Always show full weeks (7 days), pad with empty cells if needed.

```typescript
// Align to Sunday start
const alignedStart = new Date(startDate)
while (alignedStart.getDay() !== 0) {  // 0 = Sunday
  alignedStart.setDate(alignedStart.getDate() - 1)
  // Add empty cell for padding
}
```

### 3. Timezone Handling

All dates stored in UTC (ISO 8601 format). Group sessions by **local date** for display:

```typescript
function getLocalDateKey(isoTimestamp: string): string {
  const date = new Date(isoTimestamp)
  // Format in user's local timezone
  return date.toLocaleDateString('en-CA')  // YYYY-MM-DD
}
```

### 4. Future Dates

52-week window always ends at "today" (user's local time). Future dates never appear.

### 5. Leap Year

Algorithm uses actual calendar days, not fixed 364. For leap years with 53 weeks starting Sunday, show 53 columns.

---

## Testing Strategy

### Unit Tests

**File:** `src/lib/__tests__/heatmap.test.ts`

```typescript
describe('generateHeatmapCells', () => {
  it('generates exactly 364 cells for 52 weeks', () => {
    const cells = generateHeatmapCells(startDate, endDate, sessionsByDate)
    expect(cells).toHaveLength(364)
  })

  it('assigns correct week indices (0-51)', () => {
    const cells = generateHeatmapCells(startDate, endDate, sessionsByDate)
    const weekIndices = [...new Set(cells.map(c => c.weekIndex))]
    expect(weekIndices).toEqual([0, 1, 2, ..., 51])
  })

  it('handles zero sessions (all cells level 0)', () => {
    const cells = generateHeatmapCells(startDate, endDate, new Map())
    expect(cells.every(c => c.activityLevel === 0)).toBe(true)
  })

  it('scales activity levels relative to max', () => {
    // Day 1: 1 session, Day 2: 4 sessions
    // maxSessions = 4
    // Day 1: 1/4 = 0.25 → level 2
    // Day 2: 4/4 = 1.00 → level 4
  })
})

describe('getActivityLevel', () => {
  it('returns 0 for zero sessions', () => {
    expect(getActivityLevel(0, 10)).toBe(0)
  })

  it('returns correct tier for normalized values', () => {
    expect(getActivityLevel(1, 4)).toBe(2)   // 0.25 → level 2
    expect(getActivityLevel(2, 4)).toBe(3)   // 0.50 → level 3
    expect(getActivityLevel(3, 4)).toBe(4)   // 0.75 → level 4
  })
})
```

### E2E Tests

**File:** `tests/e2e/heatmap.spec.ts`

```typescript
test('heatmap renders with seeded study sessions', async ({ page }) => {
  // Seed 30 study sessions across 4 weeks
  await seedStudySessions(page, generateHeatmapSessions())

  await page.goto('/reports')

  // Verify grid structure
  const grid = page.getByRole('img', { name: /Study activity heatmap/ })
  await expect(grid).toBeVisible()

  // Verify cells exist
  const cells = page.locator('.heatmap-cell')
  await expect(cells).toHaveCount(364)

  // Verify tooltip on hover
  const activeCell = cells.first()
  await activeCell.hover()
  await expect(page.getByText(/study sessions/)).toBeVisible()
})

test('heatmap shows empty state for new user', async ({ page }) => {
  await page.goto('/reports')

  const emptyMessage = page.getByText(/Start studying to see your activity/)
  await expect(emptyMessage).toBeVisible()

  // All cells should be level 0 (empty color)
  const cells = page.locator('.heatmap-cell[data-level="0"]')
  await expect(cells).toHaveCount(364)
})
```

### Visual Regression

Capture screenshots at 3 activity levels:
1. Empty (0 sessions)
2. Sparse (10% cells active)
3. Dense (80% cells active)

Compare against baseline to detect color/layout regressions.

---

## Implementation Checklist

**Story:** Epic 8, Story 1 — Progress Heatmap Component

- [ ] Create `src/lib/heatmap.ts` with data generation functions
- [ ] Create `src/hooks/useHeatmapData.ts` with IndexedDB integration
- [ ] Create `src/app/components/ProgressHeatmap.tsx` component
- [ ] Add heatmap theme tokens to `src/styles/theme.css`
- [ ] Integrate into Reports page
- [ ] Write unit tests for data generation (`heatmap.test.ts`)
- [ ] Write E2E tests for component rendering (`heatmap.spec.ts`)
- [ ] Accessibility audit (keyboard nav, screen reader, ARIA labels)
- [ ] Responsive design (mobile scroll, compact variant)
- [ ] Performance validation (<100ms render, <10ms data load)

---

## Future Enhancements

### Phase 2 (Post-Epic 8)

1. **Drill-down Modal:** Click cell → show detailed session list for that day
2. **Streak Detection:** Highlight longest active streak with visual indicator
3. **Comparison View:** Side-by-side heatmaps (this year vs last year)
4. **Export to Image:** Download heatmap as PNG/SVG for sharing
5. **Custom Color Schemes:** User preference for color palette (green/blue/purple)

### Phase 3 (Advanced Analytics)

1. **Course-Specific Heatmap:** Filter by course to see activity per course
2. **Goal Overlay:** Show weekly study goal target line on heatmap
3. **Predictive Streaks:** ML model predicts likelihood of maintaining streak
4. **Social Sharing:** Share heatmap on social media with privacy controls

---

## References

- **GitHub Contribution Graph:** Canonical example of activity heatmap
- **Cal-Heatmap Library:** Open-source JS heatmap library (inspiration, not dependency)
- **D3 Calendar View:** D3.js examples for calendar grid layouts
- **Recharts Heatmap:** Alternative charting approach (not used due to weight)

---

**Architecture Status:** ✅ Complete
**Next Step:** Create Epic 8 Story 1 implementation plan
**Estimated Complexity:** Medium (5-7 story points)
**Implementation Time:** ~4-6 hours (component + tests + integration)
