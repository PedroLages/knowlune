# E20-S04: Skill Proficiency Radar Chart — Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Add a radar chart to the Overview dashboard showing skill proficiency (avg course completion %) per skill domain (derived from course categories).

**Architecture:** Create a new `getSkillProficiencyForOverview()` function in `src/lib/reportStats.ts` that computes average completion per category and maps slugs to user-friendly domain labels. Create a `SkillProficiencyRadar` component following the existing `CategoryRadar` pattern. Integrate into `Overview.tsx` as a new dashboard section with conditional rendering (hidden when < 2 categories).

**Tech Stack:** React 19, TypeScript, recharts (`RadarChart`, `Radar`, `PolarAngleAxis`, `PolarGrid`), shadcn/ui `ChartContainer`/`ChartTooltip`/`ChartTooltipContent`/`ChartConfig`, Vitest + React Testing Library for unit tests, Playwright for E2E.

**Key Design Decision:** The existing `getCategoryCompletionForRadar()` already computes category → avg completion %. Rather than duplicating that logic, the new function reuses the same computation approach but returns data shaped for the Overview context (different field names: `domain`/`proficiency`, friendly labels, minimum 2-domain threshold). This avoids code duplication while keeping the Overview data contract independent of the Reports page.

---

## Existing Code Reference

| File | What It Does | Reuse Strategy |
|------|-------------|----------------|
| `src/lib/reportStats.ts:51-72` | `getCategoryCompletionForRadar()` — groups courses by category, computes avg completion % | Replicate computation logic with different field names |
| `src/app/components/reports/CategoryRadar.tsx` | Recharts radar for categories on Reports page | Follow same component pattern (ChartContainer, Radar, accessibility) |
| `src/app/components/reports/SkillsRadar.tsx` | Recharts radar for abstract learning dimensions | Follow same accessibility pattern (role="img", aria-label) |
| `src/lib/__tests__/reportStats.test.ts:154-213` | Unit tests for `getCategoryCompletionForRadar()` | Follow same test factory/mock pattern |
| `src/app/pages/Overview.tsx` | Overview dashboard — target for integration | Add section between Study Schedule and Insight zones |

## Category → Skill Domain Label Mapping

The `CourseCategory` type has 5 values. Map them to user-friendly skill domain labels:

| Category Slug | Domain Label |
|--------------|-------------|
| `behavioral-analysis` | Behavioral Analysis |
| `influence-authority` | Influence & Authority |
| `confidence-mastery` | Confidence Mastery |
| `operative-training` | Operative Training |
| `research-library` | Research & Library |

Use `formatCategoryLabel()` (already exists in `reportStats.ts`) for the base transform, but override specific slugs that need ampersands or special formatting via a `DOMAIN_LABELS` map.

---

## Task 1: Create `getSkillProficiencyForOverview()` data function

**Files:**
- Modify: `src/lib/reportStats.ts`
- Modify: `src/lib/__tests__/reportStats.test.ts`

### Step 1: Write the failing unit tests

Add to `src/lib/__tests__/reportStats.test.ts`:

```typescript
import { getSkillProficiencyForOverview } from '../reportStats'
// (add to existing import block)

describe('getSkillProficiencyForOverview', () => {
  it('returns empty array when no courses exist', () => {
    setCourses([])
    const result = getSkillProficiencyForOverview()
    expect(result).toEqual([])
  })

  it('returns empty array when only one category is populated', () => {
    setCourses([
      makeCourse({ id: 'c1', category: 'behavioral-analysis' }),
    ])
    mockGetCourseCompletionPercent.mockReturnValue(50)
    const result = getSkillProficiencyForOverview()
    expect(result).toEqual([])
  })

  it('returns proficiency data when 2+ categories exist', () => {
    setCourses([
      makeCourse({ id: 'c1', category: 'behavioral-analysis' }),
      makeCourse({ id: 'c2', category: 'confidence-mastery' }),
    ])
    mockGetCourseCompletionPercent
      .mockReturnValueOnce(80)  // c1
      .mockReturnValueOnce(60)  // c2
    const result = getSkillProficiencyForOverview()
    expect(result).toHaveLength(2)
    expect(result[0]).toEqual({
      domain: 'Behavioral Analysis',
      proficiency: 80,
      fullMark: 100,
    })
    expect(result[1]).toEqual({
      domain: 'Confidence Mastery',
      proficiency: 60,
      fullMark: 100,
    })
  })

  it('averages completion across multiple courses in same category', () => {
    setCourses([
      makeCourse({ id: 'c1', category: 'behavioral-analysis' }),
      makeCourse({ id: 'c2', category: 'behavioral-analysis' }),
      makeCourse({ id: 'c3', category: 'confidence-mastery' }),
    ])
    mockGetCourseCompletionPercent
      .mockReturnValueOnce(40)   // c1
      .mockReturnValueOnce(80)   // c2
      .mockReturnValueOnce(100)  // c3
    const result = getSkillProficiencyForOverview()
    expect(result).toHaveLength(2)
    const ba = result.find(d => d.domain === 'Behavioral Analysis')
    expect(ba!.proficiency).toBe(60) // (40+80)/2
  })

  it('formats domain labels from category slugs', () => {
    setCourses([
      makeCourse({ id: 'c1', category: 'influence-authority' }),
      makeCourse({ id: 'c2', category: 'operative-training' }),
    ])
    mockGetCourseCompletionPercent.mockReturnValue(50)
    const result = getSkillProficiencyForOverview()
    expect(result.map(d => d.domain)).toEqual(
      expect.arrayContaining(['Influence Authority', 'Operative Training'])
    )
  })

  it('includes fullMark: 100 on all entries', () => {
    setCourses([
      makeCourse({ id: 'c1', category: 'behavioral-analysis' }),
      makeCourse({ id: 'c2', category: 'confidence-mastery' }),
    ])
    mockGetCourseCompletionPercent.mockReturnValue(0)
    const result = getSkillProficiencyForOverview()
    expect(result.every(d => d.fullMark === 100)).toBe(true)
  })
})
```

### Step 2: Implement the function

Add to `src/lib/reportStats.ts`:

```typescript
/* ------------------------------------------------------------------ */
/*  Skill proficiency data for Overview radar chart (E20-S04)          */
/* ------------------------------------------------------------------ */

export interface SkillProficiencyData {
  domain: string
  proficiency: number // 0-100 average completion %
  fullMark: 100
}

export function getSkillProficiencyForOverview(): SkillProficiencyData[] {
  const allCourses = useCourseStore.getState().courses
  const domainMap: Record<string, { totalCompletion: number; count: number }> = {}

  for (const course of allCourses) {
    const totalLessons = course.modules.reduce((sum, m) => sum + m.lessons.length, 0)
    const completion = getCourseCompletionPercent(course.id, totalLessons)
    const cat = course.category

    if (!domainMap[cat]) {
      domainMap[cat] = { totalCompletion: 0, count: 0 }
    }
    domainMap[cat].totalCompletion += completion
    domainMap[cat].count++
  }

  const entries = Object.entries(domainMap)

  // Need at least 2 domains for a meaningful radar chart
  if (entries.length < 2) return []

  return entries.map(([category, data]) => ({
    domain: formatCategoryLabel(category),
    proficiency: Math.round(data.totalCompletion / data.count),
    fullMark: 100 as const,
  }))
}
```

### Step 3: Run tests — verify all pass

```bash
npm run test:unit -- --reporter=verbose src/lib/__tests__/reportStats.test.ts
```

**AC Coverage:** AC2 (proficiency calculation), AC4 (empty/single-category returns [])

---

## Task 2: Create `SkillProficiencyRadar` component

**Files:**
- Create: `src/app/components/overview/SkillProficiencyRadar.tsx`
- Create: `src/app/components/overview/__tests__/SkillProficiencyRadar.test.tsx`

### Step 1: Write the failing unit tests

Create `src/app/components/overview/__tests__/SkillProficiencyRadar.test.tsx`:

```tsx
import { render, screen } from '@testing-library/react'
import { describe, it, expect, vi } from 'vitest'
import { SkillProficiencyRadar } from '../SkillProficiencyRadar'
import type { SkillProficiencyData } from '@/lib/reportStats'

// Mock recharts — follow Reports.test.tsx pattern
vi.mock('recharts', async importOriginal => {
  const actual = await importOriginal<typeof import('recharts')>()
  const Passthrough = ({ children }: { children?: React.ReactNode }) => <>{children}</>
  return {
    ...actual,
    ResponsiveContainer: Passthrough,
    RadarChart: ({ children }: { children?: React.ReactNode }) => (
      <div data-testid="radar-chart">{children}</div>
    ),
    Radar: () => null,
    PolarAngleAxis: () => null,
    PolarGrid: () => null,
    PolarRadiusAxis: () => null,
  }
})

const mockData: SkillProficiencyData[] = [
  { domain: 'Behavioral Analysis', proficiency: 80, fullMark: 100 },
  { domain: 'Confidence Mastery', proficiency: 60, fullMark: 100 },
  { domain: 'Operative Training', proficiency: 40, fullMark: 100 },
]

describe('SkillProficiencyRadar', () => {
  it('renders chart when data is provided', () => {
    render(<SkillProficiencyRadar data={mockData} />)
    expect(screen.getByTestId('radar-chart')).toBeInTheDocument()
  })

  it('returns null when data is empty', () => {
    const { container } = render(<SkillProficiencyRadar data={[]} />)
    expect(container.firstChild).toBeNull()
  })

  it('provides accessible aria-label with proficiency summary', () => {
    render(<SkillProficiencyRadar data={mockData} />)
    const img = screen.getByRole('img')
    expect(img).toHaveAttribute(
      'aria-label',
      expect.stringContaining('Behavioral Analysis 80%')
    )
    expect(img).toHaveAttribute(
      'aria-label',
      expect.stringContaining('Confidence Mastery 60%')
    )
  })
})
```

### Step 2: Implement the component

Create `src/app/components/overview/SkillProficiencyRadar.tsx`:

```tsx
import {
  ChartContainer,
  ChartTooltip,
  ChartTooltipContent,
  type ChartConfig,
} from '@/app/components/ui/chart'
import { PolarAngleAxis, PolarGrid, PolarRadiusAxis, Radar, RadarChart } from 'recharts'
import type { SkillProficiencyData } from '@/lib/reportStats'

const chartConfig = {
  proficiency: {
    label: 'Proficiency',
    color: 'var(--chart-3)',
  },
} satisfies ChartConfig

interface SkillProficiencyRadarProps {
  data: SkillProficiencyData[]
}

export function SkillProficiencyRadar({ data }: SkillProficiencyRadarProps) {
  if (data.length === 0) return null

  return (
    <div
      role="img"
      aria-label={`Skill proficiency: ${data.map(d => `${d.domain} ${d.proficiency}%`).join(', ')}`}
    >
      <ChartContainer
        config={chartConfig}
        className="mx-auto h-[280px] w-full min-h-[1px]"
        aria-hidden="true"
      >
        <RadarChart data={data} cx="50%" cy="50%" outerRadius="70%">
          <PolarGrid gridType="polygon" stroke="var(--border)" strokeOpacity={0.5} />
          <PolarAngleAxis
            dataKey="domain"
            tick={{ fontSize: 11, fill: 'var(--muted-foreground)' }}
            tickLine={false}
          />
          <PolarRadiusAxis angle={90} domain={[0, 100]} tick={false} axisLine={false} />
          <ChartTooltip
            content={<ChartTooltipContent formatter={value => [`${value}%`, 'Proficiency']} />}
          />
          <Radar
            name="Skill Proficiency"
            dataKey="proficiency"
            stroke="var(--color-proficiency)"
            fill="var(--color-proficiency)"
            fillOpacity={0.2}
            strokeWidth={2}
            dot={{
              r: 4,
              fill: 'var(--color-proficiency)',
              strokeWidth: 0,
            }}
            activeDot={{
              r: 6,
              fill: 'var(--color-proficiency)',
              stroke: 'var(--background)',
              strokeWidth: 2,
            }}
          />
        </RadarChart>
      </ChartContainer>
    </div>
  )
}
```

### Step 3: Run tests — verify all pass

```bash
npm run test:unit -- --reporter=verbose src/app/components/overview/__tests__/SkillProficiencyRadar.test.tsx
```

**AC Coverage:** AC1 (chart renders), AC3 (tooltip), AC5 (aria-label), AC6 (responsive via className)

---

## Task 3: Integrate into Overview.tsx

**Files:**
- Modify: `src/app/pages/Overview.tsx`

### Step 1: Add import and data computation

Add to Overview.tsx imports:
```typescript
import { SkillProficiencyRadar } from '@/app/components/overview/SkillProficiencyRadar'
import { getSkillProficiencyForOverview } from '@/lib/reportStats'
```

Add memoized computation inside `Overview()`:
```typescript
const skillProficiencyData = useMemo(() => getSkillProficiencyForOverview(), [])
```

### Step 2: Add radar chart section

Insert a new `motion.section` between the "Study Schedule Widget" section and the "Insight + Action Zone" section:

```tsx
{/* ── Skill Proficiency Radar ── */}
{skillProficiencyData.length > 0 && (
  <motion.section
    initial={{ opacity: 0, y: 20 }}
    whileInView={{ opacity: 1, y: 0 }}
    viewport={{ once: true, margin: '-50px' }}
    transition={{ duration: 0.5, ease: [0.16, 1, 0.3, 1] }}
    className="rounded-[24px] border border-border/50 bg-card p-6"
  >
    <h2 className="text-xl font-semibold mb-4">Skill Proficiency</h2>
    <SkillProficiencyRadar data={skillProficiencyData} />
  </motion.section>
)}
```

### Step 3: Add skeleton in loading state (optional)

Add a skeleton placeholder in the loading branch (between Study Schedule skeleton and Insight zone skeleton) for layout stability:

```tsx
{/* Skill Proficiency skeleton */}
<Skeleton className="h-[340px] rounded-[24px]" />
```

### Step 4: Manual verification

```bash
npm run dev
# Navigate to http://localhost:5173 and verify:
# - Radar chart appears on Overview when courses exist in 2+ categories
# - Chart is hidden when < 2 categories
# - Tooltip works on hover
# - Responsive on mobile viewport
```

**AC Coverage:** AC1 (displayed on Overview), AC4 (conditional rendering), AC6 (responsive)

---

## Task 4: E2E test

**Files:**
- Create: `tests/e2e/regression/story-e20-s04.spec.ts`

### Step 1: Write E2E test

```typescript
import { test, expect } from '../../support/fixtures'
import { goToOverview } from '../../support/helpers/navigation'

test.describe('E20-S04: Skill Proficiency Radar Chart', () => {
  test('displays radar chart on overview with pre-seeded courses', async ({ page }) => {
    // Pre-seeded courses span multiple categories so radar should render
    await goToOverview(page)

    // Radar chart section should be visible
    const heading = page.getByRole('heading', { name: 'Skill Proficiency' })
    await expect(heading).toBeVisible()

    // Chart container should be present
    const chart = page.getByRole('img', { name: /skill proficiency/i })
    await expect(chart).toBeVisible()
  })

  test('radar chart has accessible description', async ({ page }) => {
    await goToOverview(page)

    const chart = page.getByRole('img', { name: /skill proficiency/i })
    const label = await chart.getAttribute('aria-label')
    expect(label).toContain('%')
  })
})
```

### Step 2: Run E2E tests

```bash
npx playwright test tests/e2e/regression/story-e20-s04.spec.ts --project=chromium
```

**AC Coverage:** AC1 (chart visible), AC5 (accessible description)

---

## Task 5: Update existing tests (if affected)

**Files:**
- Check: `src/app/pages/__tests__/Reports.test.tsx` (verify no regressions)
- Check: `tests/e2e/overview.spec.ts` (verify no regressions)

### Step 1: Run existing test suites

```bash
npm run test:unit
npx playwright test tests/e2e/overview.spec.ts --project=chromium
```

If any tests fail due to the new import in Overview.tsx, update mocks accordingly.

---

## File Summary

| Action | File | Purpose |
|--------|------|---------|
| Modify | `src/lib/reportStats.ts` | Add `SkillProficiencyData` type + `getSkillProficiencyForOverview()` |
| Modify | `src/lib/__tests__/reportStats.test.ts` | Unit tests for new function |
| Create | `src/app/components/overview/SkillProficiencyRadar.tsx` | Radar chart component |
| Create | `src/app/components/overview/__tests__/SkillProficiencyRadar.test.tsx` | Component unit tests |
| Modify | `src/app/pages/Overview.tsx` | Add radar section with conditional rendering |
| Create | `tests/e2e/regression/story-e20-s04.spec.ts` | E2E test for Overview integration |

## Acceptance Criteria Traceability

| AC | Covered By |
|----|-----------|
| AC1: Radar chart displayed on Overview with 2+ categories | Task 1 (function), Task 2 (component), Task 3 (integration), Task 4 (E2E) |
| AC2: Proficiency = avg course completion % per category | Task 1 (function + tests) |
| AC3: Tooltip shows domain name + percentage | Task 2 (ChartTooltip config + test) |
| AC4: Hidden when < 2 categories | Task 1 (returns []), Task 3 (conditional render) |
| AC5: Accessible aria-label | Task 2 (role="img" + aria-label + test), Task 4 (E2E) |
| AC6: Responsive on mobile | Task 2 (className responsive), Task 3 (card container) |

## Risks & Mitigations

| Risk | Impact | Mitigation |
|------|--------|------------|
| Pre-seeded courses may all be in same 2 categories | Radar looks sparse | Current data has 5 categories — no risk |
| Imported courses may have arbitrary category strings | Domain labels may look odd | `formatCategoryLabel()` handles slug → Title Case for any string |
| Recharts RadarChart on mobile may overlap labels | Poor UX | Reduce `outerRadius` to 60% on mobile, reduce font to 10px |
