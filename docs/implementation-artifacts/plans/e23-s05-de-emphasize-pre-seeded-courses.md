# De-Emphasize Pre-Seeded Courses Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Make pre-seeded sample courses visually secondary to user-imported courses on the Courses page and Overview page.

**Architecture:** The Courses page already separates imported and pre-seeded courses into two sections. We wrap the pre-seeded section in a shadcn `Collapsible` component with muted styling, rename it "Sample Courses", and default it to collapsed when imported courses exist. On the Overview page, we add opacity-based de-emphasis to pre-seeded CourseCards when imported courses are present.

**Tech Stack:** React, Tailwind CSS v4, shadcn/ui (Collapsible, Badge), localStorage, Playwright E2E

---

## Pre-Implementation Context

### Key Files

| File | Purpose |
|------|---------|
| `src/app/pages/Courses.tsx` | Courses page — two sections: imported (287-340) + pre-seeded (342-402) |
| `src/app/pages/Overview.tsx` | Overview page — "Your Library" gallery (318-345) |
| `src/app/components/ui/collapsible.tsx` | shadcn Collapsible (already exists) |
| `src/app/components/figma/CourseCard.tsx` | CourseCard component (variants: library, overview, progress) |
| `src/stores/useCourseStore.ts` | Zustand store for pre-seeded courses |
| `src/stores/useCourseImportStore.ts` | Zustand store for imported courses |

### Existing Patterns

- **Imported vs pre-seeded sections**: Already rendered separately in Courses.tsx (imported first, then pre-seeded)
- **Empty state hierarchy**: Global empty state when `totalCourses === 0`, per-section when filters match nothing
- **localStorage for UI state**: Used elsewhere (e.g., `course-progress`, sidebar collapse state in Layout)
- **Collapsible component**: Exists at `src/app/components/ui/collapsible.tsx` — Radix Collapsible primitive
- **Badge component**: Exists, used extensively in CourseCard for category/difficulty labels
- **Design tokens**: `opacity-60`, `text-muted-foreground`, `border-border/50`, `bg-muted/30` for de-emphasis

### What NOT to change

- Pre-seeded course data files (`src/data/courses/*.ts`) — content stays
- Database seeding logic (`src/db/seedCourses.ts`) — seeding stays
- MyClass.tsx — only Courses and Overview pages are in scope
- CourseDetail.tsx — individual course view is unaffected
- Authors.tsx — author page is unaffected (covered by E23-S06)

---

## Task 1: Write ATDD E2E Test File (Failing)

**Files:**
- Create: `tests/e2e/story-e23-s05.spec.ts`

**Step 1: Write failing E2E tests for all ACs**

```typescript
/**
 * ATDD E2E tests for E23-S05: De-Emphasize Pre-Seeded Courses
 *
 * AC1: Pre-seeded section has "Sample Courses" heading, muted styling, collapsible (collapsed when imports exist)
 * AC2: Imported courses section appears first with full visual prominence
 * AC3: Overview "Your Library" de-emphasizes pre-seeded courses when imports exist
 * AC4: Overview shows pre-seeded courses at full prominence when no imports exist
 * AC5: Collapse state persists across navigations
 * AC6: Responsive layout remains correct
 */
import { test, expect } from '../support/fixtures'
import { goToCourses, goToOverview } from '../support/helpers/navigation'
import { seedImportedCourses } from '../support/helpers/seed-helpers'

const SAMPLE_IMPORTED_COURSE = {
  id: 'test-imported-course',
  name: 'My Imported Course',
  importedAt: '2026-03-20T10:00:00.000Z',
  category: 'general',
  tags: ['test'],
  status: 'active' as const,
  videoCount: 5,
  pdfCount: 0,
}

// ---------------------------------------------------------------------------
// AC1: Pre-seeded section visual de-emphasis
// ---------------------------------------------------------------------------

test.describe('AC1: Pre-seeded section de-emphasis', () => {
  test('pre-seeded section has "Sample Courses" heading', async ({ page }) => {
    await goToCourses(page)
    const heading = page.getByRole('heading', { name: /sample courses/i })
    await expect(heading).toBeVisible()
  })

  test('pre-seeded section is collapsible and collapsed by default when imports exist', async ({ page }) => {
    await seedImportedCourses(page, [SAMPLE_IMPORTED_COURSE])
    await goToCourses(page)

    const sampleSection = page.locator('[data-testid="sample-courses-section"]')
    await expect(sampleSection).toBeVisible()

    // Section should be collapsed — course grid should not be visible
    const courseGrid = sampleSection.locator('[data-testid="sample-courses-grid"]')
    await expect(courseGrid).toBeHidden()
  })

  test('pre-seeded section is expanded by default when no imports exist', async ({ page }) => {
    await goToCourses(page)

    const courseGrid = page.locator('[data-testid="sample-courses-grid"]')
    await expect(courseGrid).toBeVisible()
  })
})

// ---------------------------------------------------------------------------
// AC2: Imported courses section appears first
// ---------------------------------------------------------------------------

test.describe('AC2: Imported courses first', () => {
  test('imported courses section appears above sample courses section', async ({ page }) => {
    await seedImportedCourses(page, [SAMPLE_IMPORTED_COURSE])
    await goToCourses(page)

    const importedSection = page.locator('[data-testid="imported-courses-grid"]')
    const sampleSection = page.locator('[data-testid="sample-courses-section"]')

    // Both sections should exist
    await expect(importedSection).toBeVisible()
    await expect(sampleSection).toBeVisible()

    // Imported section should come before sample section in DOM
    const importedBox = await importedSection.boundingBox()
    const sampleBox = await sampleSection.boundingBox()
    expect(importedBox!.y).toBeLessThan(sampleBox!.y)
  })
})

// ---------------------------------------------------------------------------
// AC3: Overview de-emphasizes pre-seeded when imports exist
// ---------------------------------------------------------------------------

test.describe('AC3: Overview de-emphasis with imports', () => {
  test('pre-seeded courses in overview have reduced opacity when imports exist', async ({ page }) => {
    await seedImportedCourses(page, [SAMPLE_IMPORTED_COURSE])
    await goToOverview(page)

    const sampleCards = page.locator('[data-testid="sample-course-card"]')
    // At least one pre-seeded course card should exist
    await expect(sampleCards.first()).toBeVisible()

    // Check that sample cards have the de-emphasis class
    const firstCard = sampleCards.first()
    await expect(firstCard).toHaveCSS('opacity', '0.6')
  })
})

// ---------------------------------------------------------------------------
// AC4: Overview full prominence when no imports
// ---------------------------------------------------------------------------

test.describe('AC4: Overview full prominence without imports', () => {
  test('pre-seeded courses in overview have full opacity when no imports', async ({ page }) => {
    await goToOverview(page)

    // Pre-seeded course cards should be at full opacity
    const librarySection = page.locator('section:has(h2:text("Your Library"))')
    const courseCards = librarySection.locator('[data-testid^="course-card-"]').first()
    await expect(courseCards).toBeVisible()
    await expect(courseCards).toHaveCSS('opacity', '1')
  })
})

// ---------------------------------------------------------------------------
// AC5: Collapse state persists
// ---------------------------------------------------------------------------

test.describe('AC5: Collapse state persistence', () => {
  test('collapse state persists across page navigations', async ({ page }) => {
    await goToCourses(page)

    // Section should start expanded (no imports)
    const courseGrid = page.locator('[data-testid="sample-courses-grid"]')
    await expect(courseGrid).toBeVisible()

    // Click collapse toggle
    const toggle = page.locator('[data-testid="sample-courses-toggle"]')
    await toggle.click()

    // Grid should be hidden
    await expect(courseGrid).toBeHidden()

    // Navigate away and back
    await goToOverview(page)
    await goToCourses(page)

    // Grid should still be hidden (persisted)
    await expect(courseGrid).toBeHidden()
  })
})

// ---------------------------------------------------------------------------
// AC6: Responsive layout
// ---------------------------------------------------------------------------

test.describe('AC6: Responsive layout', () => {
  for (const viewport of [
    { width: 375, height: 812, name: 'mobile' },
    { width: 768, height: 1024, name: 'tablet' },
    { width: 1440, height: 900, name: 'desktop' },
  ]) {
    test(`layout is correct at ${viewport.name} (${viewport.width}px)`, async ({ page }) => {
      await page.setViewportSize(viewport)
      await goToCourses(page)

      // No horizontal overflow
      const scrollWidth = await page.evaluate(() => document.documentElement.scrollWidth)
      const clientWidth = await page.evaluate(() => document.documentElement.clientWidth)
      expect(scrollWidth).toBeLessThanOrEqual(clientWidth + 1)

      // Sample courses section is visible
      const sampleSection = page.locator('[data-testid="sample-courses-section"]')
      await expect(sampleSection).toBeVisible()
    })
  }
})
```

**Step 2: Run tests to verify they fail**

Run: `npx playwright test tests/e2e/story-e23-s05.spec.ts --project=chromium`
Expected: FAIL — `data-testid="sample-courses-section"` doesn't exist yet, "Sample Courses" heading missing

**Step 3: Commit**

```bash
git add tests/e2e/story-e23-s05.spec.ts
git commit -m "test(E23-S05): add failing ATDD tests for de-emphasize pre-seeded courses"
```

---

## Task 2: Update Courses Page — Collapsible Sample Courses Section

**Files:**
- Modify: `src/app/pages/Courses.tsx:342-402`

**Step 1: Add imports for Collapsible components**

At the top of `Courses.tsx`, add:

```typescript
import { Collapsible, CollapsibleTrigger, CollapsibleContent } from '@/app/components/ui/collapsible'
import { ChevronDown } from 'lucide-react'
```

**Step 2: Add collapse state with localStorage persistence**

Inside the `Courses` function, after the existing state declarations (around line 45), add:

```typescript
const COLLAPSE_KEY = 'knowlune:sample-courses-collapsed'

const [sampleCollapsed, setSampleCollapsed] = useState(() => {
  // Default: collapsed when imported courses exist, expanded otherwise
  const stored = localStorage.getItem(COLLAPSE_KEY)
  if (stored !== null) return stored === 'true'
  return false // Will be re-evaluated in useEffect when importedCourses loads
})

// Auto-collapse when imported courses are loaded for the first time
useEffect(() => {
  const stored = localStorage.getItem(COLLAPSE_KEY)
  if (stored === null && importedCourses.length > 0) {
    setSampleCollapsed(true)
    localStorage.setItem(COLLAPSE_KEY, 'true')
  }
}, [importedCourses.length])

function handleCollapseToggle(open: boolean) {
  const collapsed = !open
  setSampleCollapsed(collapsed)
  localStorage.setItem(COLLAPSE_KEY, String(collapsed))
}
```

**Step 3: Replace the pre-seeded section (lines 342-402) with collapsible version**

Replace the current pre-seeded courses section with:

```tsx
{/* Sample Courses Section */}
{allCourses.length > 0 && (
  <Collapsible
    open={!sampleCollapsed}
    onOpenChange={handleCollapseToggle}
    data-testid="sample-courses-section"
    className={`mb-6 rounded-[24px] border border-border/50 p-4 transition-opacity duration-200 ${
      importedCourses.length > 0 ? 'opacity-60 hover:opacity-100' : ''
    }`}
  >
    <div className="flex items-center justify-between mb-2">
      <h2 className="text-lg font-semibold text-muted-foreground">
        Sample Courses ({allCourses.length})
      </h2>
      <CollapsibleTrigger asChild>
        <Button
          variant="ghost"
          size="sm"
          data-testid="sample-courses-toggle"
          aria-label={sampleCollapsed ? 'Expand sample courses' : 'Collapse sample courses'}
          className="p-2"
        >
          <ChevronDown
            aria-hidden="true"
            className={`size-4 transition-transform duration-200 motion-reduce:transition-none ${
              !sampleCollapsed ? 'rotate-180' : ''
            }`}
          />
        </Button>
      </CollapsibleTrigger>
    </div>

    <CollapsibleContent>
      <div className="flex items-center gap-4 mb-4 flex-wrap">
        <div className="flex flex-wrap gap-2 items-center flex-1">
          <ToggleGroup
            type="single"
            value={selectedCategory}
            onValueChange={v => setSelectedCategory(v || 'all')}
            aria-label="Filter by category"
            className="flex flex-wrap gap-2"
          >
            {[
              { value: 'all', label: 'All Courses' },
              ...availableCategories.map(cat => ({
                value: cat,
                label: categoryLabels[cat] ?? cat,
              })),
            ].map((chip, i) => (
              <ToggleGroupItem
                key={chip.value}
                value={chip.value}
                className={`h-auto rounded-full! border px-4 py-3 sm:py-1.5 text-sm font-medium transition-colors data-[state=on]:bg-brand data-[state=on]:text-brand-foreground data-[state=on]:hover:bg-brand-hover data-[state=on]:border-transparent data-[state=off]:bg-card data-[state=off]:text-muted-foreground data-[state=off]:hover:bg-accent data-[state=off]:hover:text-foreground data-[state=off]:border-border cursor-pointer shadow-none${i === 0 ? ' mr-1' : ''}`}
              >
                {chip.label}
              </ToggleGroupItem>
            ))}
          </ToggleGroup>
        </div>
        <Select value={sortMode} onValueChange={v => setSortMode(v as SortMode)}>
          <SelectTrigger
            data-testid="sort-select"
            aria-label="Sort courses"
            className="w-[180px] rounded-xl"
          >
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="recent">Most Recent</SelectItem>
            <SelectItem value="momentum">Sort by Momentum</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {sortedCourses.length === 0 ? (
        <div className="text-center py-12 text-muted-foreground">
          No courses match your search
        </div>
      ) : (
        <div
          data-testid="sample-courses-grid"
          className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-6"
        >
          {sortedCourses.map(course => (
            <CourseCard
              key={course.id}
              course={course}
              completionPercent={getCourseCompletionPercent(course.id, course.totalLessons)}
              momentumScore={momentumMap.get(course.id)}
              atRiskStatus={atRiskMap.get(course.id)}
              completionEstimate={estimateMap.get(course.id)}
            />
          ))}
        </div>
      )}
    </CollapsibleContent>
  </Collapsible>
)}
```

**Step 4: Run build to verify no errors**

Run: `npm run build`
Expected: PASS

**Step 5: Run lint to verify design token compliance**

Run: `npm run lint`
Expected: PASS (no hardcoded colors)

**Step 6: Commit**

```bash
git add src/app/pages/Courses.tsx
git commit -m "feat(E23-S05): add collapsible sample courses section with de-emphasis"
```

---

## Task 3: Update Overview Page — De-Emphasize Pre-Seeded Courses in Gallery

**Files:**
- Modify: `src/app/pages/Overview.tsx:318-345`

**Step 1: Update "Your Library" section to de-emphasize pre-seeded courses when imports exist**

Replace the current "Your Library" section (lines 318-345) with:

```tsx
{/* ── Course Gallery ── */}
<motion.section
  initial={{ opacity: 0, y: 20 }}
  whileInView={{ opacity: 1, y: 0 }}
  viewport={{ once: true, margin: '-50px' }}
  transition={{ duration: 0.5, ease: [0.16, 1, 0.3, 1] }}
>
  <div className="flex items-baseline justify-between mb-6">
    <h2 className="text-xl">Your Library</h2>
    <Link
      to="/courses"
      className="text-sm text-brand hover:text-brand-hover flex items-center gap-1 motion-safe:transition-colors"
    >
      View all
      <ArrowRight className="size-3.5" aria-hidden="true" />
    </Link>
  </div>
  <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-5">
    {allCourses.map(course => (
      <div
        key={course.id}
        data-testid={importedCourses.length > 0 ? 'sample-course-card' : `course-card-${course.id}`}
        className={`transition-opacity duration-200 motion-reduce:transition-none ${
          importedCourses.length > 0 ? 'opacity-60 hover:opacity-100' : ''
        }`}
      >
        <CourseCard
          course={course}
          variant="overview"
          completionPercent={getCourseCompletionPercent(course.id, course.totalLessons)}
        />
      </div>
    ))}
  </div>
</motion.section>
```

**Note on data-testid**: When imported courses exist, pre-seeded cards use `data-testid="sample-course-card"` for E2E AC3 verification. When no imports exist, they use `course-card-{id}` for AC4 verification. Only one testid is needed per state — no conflict.

**Step 2: Run build**

Run: `npm run build`
Expected: PASS

**Step 3: Commit**

```bash
git add src/app/pages/Overview.tsx
git commit -m "feat(E23-S05): de-emphasize pre-seeded courses in overview library"
```

---

## Task 4: Update Unit Tests

**Files:**
- Modify: `src/app/pages/__tests__/Courses.test.tsx` (if it exists)

**Step 1: Check if unit tests exist**

Run: `ls src/app/pages/__tests__/Courses.test.tsx`

**Step 2: Update any unit test assertions that reference the old pre-seeded section structure**

- Update any assertions looking for the old section heading (no longer "All Courses" as section heading)
- Add assertions for "Sample Courses" heading visibility
- The existing `allCourses` mock data should still work — the component just wraps it differently

**Step 3: Run unit tests**

Run: `npm run test:unit`
Expected: PASS

**Step 4: Commit**

```bash
git add src/app/pages/__tests__/
git commit -m "test(E23-S05): update unit tests for sample courses section"
```

---

## Task 5: Run E2E Tests and Fix

**Step 1: Run ATDD tests**

Run: `npx playwright test tests/e2e/story-e23-s05.spec.ts --project=chromium`
Expected: Should pass now (or require minor selector adjustments)

**Step 2: Run smoke tests to verify no regressions**

Run: `npx playwright test tests/e2e/navigation.spec.ts tests/e2e/courses.spec.ts tests/e2e/overview.spec.ts --project=chromium`
Expected: PASS

**Step 3: Fix any failing tests**

Adjust selectors, assertions, or timing as needed based on failures.

**Step 4: Commit fixes**

```bash
git add tests/
git commit -m "test(E23-S05): fix E2E test adjustments"
```

---

## Task 6: Final Verification

**Step 1: Run full build + lint + type check**

Run: `npm run build && npm run lint && npx tsc --noEmit`
Expected: All PASS

**Step 2: Run all unit tests**

Run: `npm run test:unit`
Expected: PASS

**Step 3: Run all E2E tests (Chromium)**

Run: `npx playwright test --project=chromium`
Expected: PASS

**Step 4: Visual verification**

1. Open `http://localhost:5173/courses` — verify:
   - "Sample Courses" heading visible
   - Pre-seeded section has muted border and reduced opacity
   - Collapse/expand toggle works
   - With no imported courses: section expanded, no de-emphasis
2. Open `http://localhost:5173/` (Overview) — verify:
   - "Your Library" shows pre-seeded courses
   - With imported courses: pre-seeded cards have reduced opacity
   - Without imported courses: full opacity
3. Check mobile (375px), tablet (768px), desktop (1440px)

**Step 5: Final commit if any adjustments**

```bash
git add -A
git commit -m "fix(E23-S05): final polish and verification"
```

---

## Files Summary

| File | Change |
|------|--------|
| `src/app/pages/Courses.tsx` | Wrap pre-seeded section in Collapsible, rename heading, add de-emphasis |
| `src/app/pages/Overview.tsx` | Add conditional opacity to pre-seeded CourseCards in gallery |
| `tests/e2e/story-e23-s05.spec.ts` | ATDD tests for all 6 ACs |
| `src/app/pages/__tests__/Courses.test.tsx` | Update unit test assertions |

## Scope Boundaries

- **In scope**: Courses.tsx pre-seeded section, Overview.tsx library gallery
- **Out of scope**: MyClass.tsx (mixes pre-seeded + imported in same views — separate story), CourseDetail.tsx, Authors.tsx (E23-S06), pre-seeded data files, database seeding

## Risk Notes

- **Opacity contrast**: Verify that `opacity-60` on course cards still maintains WCAG 4.5:1 contrast for text. The cards use `bg-card` background and `text-foreground` text — at 60% opacity on `bg-background`, contrast should remain adequate but verify in dark mode too.
- **localStorage key collision**: Using `knowlune:` prefix to namespace. Pattern consistent with existing localStorage keys.
- **Radix Collapsible animation**: The default Radix Collapsible has no built-in animation. The content appears/disappears instantly. If smooth animation is desired, add CSS `data-[state=open]:animate-collapsible-down data-[state=closed]:animate-collapsible-up` classes (from tw-animate-css, already included in the project).
- **Existing E2E regression**: `tests/e2e/courses.spec.ts` checks "at least one course card should be visible" — this still passes because the pre-seeded section is only collapsed when `importedCourses.length > 0` (and default test runs have no imports seeded).

## Plan Review Notes (2026-03-23)

**Validated against fresh codebase research:**
1. Collapsible pattern confirmed in `Challenges.tsx` (lines 227-272) — same Radix Collapsible + ChevronDown rotation pattern
2. `seedImportedCourses` helper confirmed in `tests/support/helpers/seed-helpers.ts:133` — accepts `(page, Record<string, unknown>[])`
3. Overview "Your Library" section confirmed at `Overview.tsx:318-345` — only renders `allCourses` (pre-seeded), no imported courses in this gallery
4. `cn()` utility not imported in current `Courses.tsx` — template literal approach for conditional classes avoids new import, consistent with existing file
5. Auto-collapse `useEffect` logic is safe: only triggers when `localStorage` has no stored value AND imports exist — won't re-collapse after user manually expands

**Fixes applied to original plan:**
- Added `aria-hidden="true"` and `motion-reduce:transition-none` to ChevronDown (matches Challenges.tsx pattern)
- Added count to section heading: "Sample Courses (8)" (matches Challenges.tsx "Completed (N)" pattern)
- Fixed data-testid conflict in Overview template — use conditional testid instead of conflicting spread
- Added `motion-reduce:transition-none` to Overview card opacity transition
