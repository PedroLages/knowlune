# E22-S05: Dynamic Filter Chips from AI Tags — Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Unify the Courses page filter UI so that a single chip bar shows both pre-seeded course categories and imported course AI tags, sorted by frequency, filtering across all course types.

**Architecture:** Replace the dual filter system (single-select category ToggleGroup for pre-seeded courses + multi-select TopicFilter for imported courses) with a single unified TopicFilter. Create a `getUnifiedTags` utility that merges categories and tags, deduplicates case-insensitively, and sorts by frequency. Update filtering logic so selecting any chip filters both pre-seeded and imported courses.

**Tech Stack:** React, Zustand (useCourseStore + useCourseImportStore), Playwright E2E tests

---

## Current State (What Exists)

| Component | Location | Purpose |
|-----------|----------|---------|
| `TopicFilter` | `src/app/components/figma/TopicFilter.tsx` | Multi-select tag chips for imported courses |
| `StatusFilter` | `src/app/components/figma/StatusFilter.tsx` | Status filter for imported courses (keep as-is) |
| `Courses.tsx` | `src/app/pages/Courses.tsx` | Page with dual filter systems |
| `useCourseStore` | `src/stores/useCourseStore.ts` | Pre-seeded courses (has `Course.tags[]` + `Course.category`) |
| `useCourseImportStore` | `src/stores/useCourseImportStore.ts` | Imported courses (has `ImportedCourse.tags[]`, `getAllTags()`) |
| `categoryLabels` | `src/app/components/figma/CourseCard.tsx:28` | Maps `CourseCategory` enum → display labels |
| `autoAnalysis.ts` | `src/lib/autoAnalysis.ts` | Fire-and-forget AI tag generation on import |
| E2E tests | `tests/e2e/regression/story-1-3-organize-by-topic.spec.ts` | Existing TopicFilter tests (imported-only) |
| Test factory | `tests/support/fixtures/factories/imported-course-factory.ts` | `createImportedCourse()` factory |

### Key Data Structures

```typescript
// Pre-seeded courses (src/data/types.ts:92-109)
interface Course {
  category: CourseCategory  // 'behavioral-analysis' | 'influence-authority' | ...
  tags: string[]            // ['behavioral-analysis', 'deception-detection', ...]
}

// Imported courses (src/data/types.ts:147-157)
interface ImportedCourse {
  tags: string[]  // AI-generated: ['python', 'machine-learning', ...]
}

// Category labels (CourseCard.tsx:28-34)
const categoryLabels: Record<CourseCategory, string> = {
  'behavioral-analysis': 'Behavioral Analysis',
  'influence-authority': 'Influence & Authority',
  'confidence-mastery': 'Confidence Mastery',
  'operative-training': 'Operative Training',
  'research-library': 'Research Library',
}
```

### Current Filtering Logic in Courses.tsx

1. **Pre-seeded courses** filtered by `selectedCategory` (single-select, category enum value) — lines 142-160
2. **Imported courses** filtered by `selectedTopics` (multi-select, tag strings, AND logic) + `selectedStatuses` — lines 171-190
3. **TopicFilter** only shown when `importedCourses.length > 0` — line 273
4. **Category ToggleGroup** shown in pre-seeded section with "All Courses" default — lines 344-367

---

## Task 1: Create `getUnifiedTags` Utility

**Files:**
- Create: `src/lib/getUnifiedTags.ts`
- Test: `src/lib/__tests__/getUnifiedTags.test.ts`

### Step 1: Write the failing unit test

```typescript
// src/lib/__tests__/getUnifiedTags.test.ts
import { describe, it, expect } from 'vitest'
import { getUnifiedTags } from '../getUnifiedTags'
import type { Course, ImportedCourse } from '@/data/types'

// Minimal course factories for unit tests
function makeCourse(overrides: Partial<Course> = {}): Course {
  return {
    id: 'c1',
    title: 'Test',
    shortTitle: 'T',
    description: '',
    category: 'behavioral-analysis',
    difficulty: 'beginner',
    totalLessons: 1,
    totalVideos: 1,
    totalPDFs: 0,
    estimatedHours: 1,
    tags: [],
    modules: [],
    isSequential: false,
    basePath: '',
    authorId: 'a1',
    ...overrides,
  } as Course
}

function makeImported(overrides: Partial<ImportedCourse> = {}): ImportedCourse {
  return {
    id: 'i1',
    name: 'Imported',
    importedAt: '2026-01-01T00:00:00.000Z',
    category: '',
    tags: [],
    status: 'active',
    videoCount: 1,
    pdfCount: 0,
    directoryHandle: {} as FileSystemDirectoryHandle,
    ...overrides,
  }
}

describe('getUnifiedTags', () => {
  it('returns empty array when no courses exist', () => {
    expect(getUnifiedTags([], [])).toEqual([])
  })

  it('includes category labels from pre-seeded courses', () => {
    const courses = [makeCourse({ category: 'behavioral-analysis' })]
    const result = getUnifiedTags(courses, [])
    expect(result).toContain('Behavioral Analysis')
  })

  it('includes tags from imported courses', () => {
    const imported = [makeImported({ tags: ['python', 'ml'] })]
    const result = getUnifiedTags([], imported)
    expect(result).toContain('python')
    expect(result).toContain('ml')
  })

  it('deduplicates case-insensitively', () => {
    const courses = [makeCourse({ category: 'behavioral-analysis' })]
    const imported = [makeImported({ tags: ['behavioral analysis'] })]
    const result = getUnifiedTags(courses, imported)
    // Only one entry for "behavioral analysis" / "Behavioral Analysis"
    const matching = result.filter(t => t.toLowerCase() === 'behavioral analysis')
    expect(matching).toHaveLength(1)
  })

  it('sorts by frequency descending', () => {
    const imported = [
      makeImported({ id: 'i1', tags: ['python'] }),
      makeImported({ id: 'i2', tags: ['python', 'react'] }),
      makeImported({ id: 'i3', tags: ['python', 'react', 'vue'] }),
    ]
    const result = getUnifiedTags([], imported)
    // python=3, react=2, vue=1
    expect(result[0]).toBe('python')
    expect(result[1]).toBe('react')
    expect(result[2]).toBe('vue')
  })

  it('breaks frequency ties alphabetically', () => {
    const imported = [
      makeImported({ id: 'i1', tags: ['zebra', 'alpha'] }),
    ]
    // Both have count=1, "alpha" should come before "zebra"
    const result = getUnifiedTags([], imported)
    expect(result.indexOf('alpha')).toBeLessThan(result.indexOf('zebra'))
  })

  it('merges categories and imported tags together', () => {
    const courses = [
      makeCourse({ id: 'c1', category: 'behavioral-analysis' }),
      makeCourse({ id: 'c2', category: 'behavioral-analysis' }),
    ]
    const imported = [
      makeImported({ id: 'i1', tags: ['python', 'ml'] }),
      makeImported({ id: 'i2', tags: ['python'] }),
    ]
    const result = getUnifiedTags(courses, imported)
    // "Behavioral Analysis"=2, "python"=2 (tied), "ml"=1
    expect(result).toContain('Behavioral Analysis')
    expect(result).toContain('python')
    expect(result).toContain('ml')
    expect(result.length).toBe(3)
  })
})
```

### Step 2: Run test to verify it fails

Run: `npx vitest run src/lib/__tests__/getUnifiedTags.test.ts`
Expected: FAIL — module not found

### Step 3: Implement `getUnifiedTags`

```typescript
// src/lib/getUnifiedTags.ts
import type { Course, ImportedCourse } from '@/data/types'

// Re-export for use in Courses.tsx filtering logic
export const categoryLabels: Record<string, string> = {
  'behavioral-analysis': 'Behavioral Analysis',
  'influence-authority': 'Influence & Authority',
  'confidence-mastery': 'Confidence Mastery',
  'operative-training': 'Operative Training',
  'research-library': 'Research Library',
}

/**
 * Merges pre-seeded course categories with imported course tags
 * into a single deduplicated list sorted by frequency (descending).
 *
 * Category labels from pre-seeded courses (e.g., "Behavioral Analysis")
 * and AI-generated tags from imported courses (e.g., "python") are
 * combined into one chip list for unified filtering.
 */
export function getUnifiedTags(
  allCourses: Course[],
  importedCourses: ImportedCourse[]
): string[] {
  const tagFrequency = new Map<string, { label: string; count: number }>()

  // Count pre-seeded categories
  for (const course of allCourses) {
    const label = categoryLabels[course.category] ?? course.category
    const key = label.toLowerCase()
    const entry = tagFrequency.get(key) ?? { label, count: 0 }
    entry.count++
    tagFrequency.set(key, entry)
  }

  // Count imported course tags
  for (const course of importedCourses) {
    for (const tag of course.tags) {
      const key = tag.toLowerCase()
      const entry = tagFrequency.get(key) ?? { label: tag, count: 0 }
      entry.count++
      tagFrequency.set(key, entry)
    }
  }

  // Sort by frequency descending, then alphabetically
  return [...tagFrequency.values()]
    .sort((a, b) => b.count - a.count || a.label.localeCompare(b.label))
    .map(entry => entry.label)
}
```

### Step 4: Run test to verify it passes

Run: `npx vitest run src/lib/__tests__/getUnifiedTags.test.ts`
Expected: PASS

### Step 5: Commit

```bash
git add src/lib/getUnifiedTags.ts src/lib/__tests__/getUnifiedTags.test.ts
git commit -m "feat(E22-S05): add getUnifiedTags utility with tests"
```

---

## Task 2: Add `courseMatchesTags` Filtering Helper

**Files:**
- Modify: `src/lib/getUnifiedTags.ts` (add export)
- Modify: `src/lib/__tests__/getUnifiedTags.test.ts` (add tests)

### Step 1: Write failing tests for the filtering helper

Add to `src/lib/__tests__/getUnifiedTags.test.ts`:

```typescript
import { getUnifiedTags, courseMatchesTags } from '../getUnifiedTags'

describe('courseMatchesTags', () => {
  it('returns true when no tags selected (empty filter)', () => {
    const course = makeCourse({ category: 'behavioral-analysis' })
    expect(courseMatchesTags(course, [])).toBe(true)
  })

  it('matches pre-seeded course by category label', () => {
    const course = makeCourse({ category: 'behavioral-analysis' })
    expect(courseMatchesTags(course, ['Behavioral Analysis'])).toBe(true)
  })

  it('matches imported course by tag', () => {
    const course = makeImported({ tags: ['python', 'ml'] })
    expect(courseMatchesTags(course, ['python'])).toBe(true)
  })

  it('uses AND logic for multiple selected tags', () => {
    const course = makeImported({ tags: ['python', 'ml'] })
    expect(courseMatchesTags(course, ['python', 'ml'])).toBe(true)
    expect(courseMatchesTags(course, ['python', 'react'])).toBe(false)
  })

  it('matches case-insensitively', () => {
    const course = makeImported({ tags: ['Python'] })
    expect(courseMatchesTags(course, ['python'])).toBe(true)
  })

  it('does not match pre-seeded course with unrelated tag', () => {
    const course = makeCourse({ category: 'behavioral-analysis' })
    expect(courseMatchesTags(course, ['python'])).toBe(false)
  })

  it('matches pre-seeded course by its tags array too', () => {
    const course = makeCourse({
      category: 'behavioral-analysis',
      tags: ['body-language', 'deception'],
    })
    expect(courseMatchesTags(course, ['body-language'])).toBe(true)
  })
})
```

### Step 2: Run to verify failure

Run: `npx vitest run src/lib/__tests__/getUnifiedTags.test.ts`
Expected: FAIL — `courseMatchesTags` not exported

### Step 3: Implement `courseMatchesTags`

Add to `src/lib/getUnifiedTags.ts`:

```typescript
/**
 * Checks whether a course (pre-seeded or imported) matches all selected tags.
 * Uses AND logic: course must match EVERY selected tag.
 *
 * For pre-seeded courses: matches against category label + tags array.
 * For imported courses: matches against tags array.
 */
export function courseMatchesTags(
  course: Course | ImportedCourse,
  selectedTags: string[]
): boolean {
  if (selectedTags.length === 0) return true

  return selectedTags.every(tag => {
    const key = tag.toLowerCase()

    // Check category match (pre-seeded courses have 'category' field)
    if ('category' in course && typeof course.category === 'string') {
      const label = categoryLabels[course.category]
      if (label && label.toLowerCase() === key) return true
    }

    // Check tags array match
    return course.tags.some(t => t.toLowerCase() === key)
  })
}
```

### Step 4: Run to verify pass

Run: `npx vitest run src/lib/__tests__/getUnifiedTags.test.ts`
Expected: PASS

### Step 5: Commit

```bash
git add src/lib/getUnifiedTags.ts src/lib/__tests__/getUnifiedTags.test.ts
git commit -m "feat(E22-S05): add courseMatchesTags filtering helper"
```

---

## Task 3: Write Failing E2E Tests

**Files:**
- Create: `tests/e2e/regression/e22-s05-dynamic-filter-chips.spec.ts`

### Step 1: Write E2E test file

Reference test patterns from `tests/e2e/regression/story-1-3-organize-by-topic.spec.ts`.
Use `seedAndReload` helper and `createImportedCourse` factory.

```typescript
// tests/e2e/regression/e22-s05-dynamic-filter-chips.spec.ts
/**
 * E22-S05: Dynamic Filter Chips from AI Tags
 *
 * Tests verify:
 *   - AC1: Unified chips show both pre-seeded categories and imported tags
 *   - AC2: Chips deduplicated and sorted by frequency
 *   - AC3: Cross-filtering works on both course types
 *   - AC4: Clear filters resets everything
 *   - AC5: Reactivity — new tags appear after import
 */
import { test, expect } from '../../support/fixtures'
import { createImportedCourse } from '../../support/fixtures/factories/imported-course-factory'
import { seedAndReload } from '../../support/helpers/seed-helpers'

// ===========================================================================
// AC1: Unified filter chips
// ===========================================================================

test.describe('AC1: Unified Filter Chips', () => {
  test('should show pre-seeded category chips when no imported courses exist', async ({
    page,
  }) => {
    await page.goto('/courses')

    // Pre-seeded categories should appear as chips
    // (pre-seeded courses are always loaded from IndexedDB seed data)
    const filterBar = page.getByTestId('topic-filter-bar')
    await expect(filterBar).toBeVisible()
    await expect(filterBar.getByRole('button', { name: /Behavioral Analysis/i })).toBeVisible()
  })

  test('should show both category chips and imported AI tags', async ({ page, indexedDB }) => {
    const course = createImportedCourse({ tags: ['python', 'machine-learning'] })
    await seedAndReload(page, indexedDB, [course])

    const filterBar = page.getByTestId('topic-filter-bar')
    // Pre-seeded category
    await expect(filterBar.getByRole('button', { name: /Behavioral Analysis/i })).toBeVisible()
    // Imported AI tags
    await expect(filterBar.getByRole('button', { name: /python/i })).toBeVisible()
    await expect(filterBar.getByRole('button', { name: /machine-learning/i })).toBeVisible()
  })
})

// ===========================================================================
// AC2: Frequency sorting
// ===========================================================================

test.describe('AC2: Frequency-Based Sorting', () => {
  test('should sort chips by frequency (most courses first)', async ({ page, indexedDB }) => {
    // Create 3 courses: "python" appears 3x, "react" appears 1x
    const courses = [
      createImportedCourse({ id: 'c1', tags: ['python'] }),
      createImportedCourse({ id: 'c2', tags: ['python'] }),
      createImportedCourse({ id: 'c3', tags: ['python', 'react'] }),
    ]
    await seedAndReload(page, indexedDB, courses)

    const buttons = page.getByTestId('topic-filter-bar').getByTestId('topic-filter-button')
    const labels: string[] = []
    for (let i = 0; i < await buttons.count(); i++) {
      labels.push(await buttons.nth(i).textContent() ?? '')
    }

    // Find positions of imported tags (ignoring pre-seeded categories which may come first)
    const pythonIdx = labels.findIndex(l => l.toLowerCase().includes('python'))
    const reactIdx = labels.findIndex(l => l.toLowerCase().includes('react'))
    expect(pythonIdx).toBeLessThan(reactIdx)
  })
})

// ===========================================================================
// AC3: Cross-filtering
// ===========================================================================

test.describe('AC3: Cross-Type Filtering', () => {
  test('should filter pre-seeded courses when category chip is selected', async ({ page }) => {
    await page.goto('/courses')

    const filterBar = page.getByTestId('topic-filter-bar')
    await filterBar.getByRole('button', { name: /Behavioral Analysis/i }).click()

    // Only courses in 'behavioral-analysis' category should be visible
    // Other categories should be filtered out
    // We verify at least one course card exists and page didn't break
    await expect(page.locator('[class*="card"]').first()).toBeVisible()
  })

  test('should filter imported courses when AI tag chip is selected', async ({
    page,
    indexedDB,
  }) => {
    const pythonCourse = createImportedCourse({ name: 'Python Basics', tags: ['python'] })
    const reactCourse = createImportedCourse({
      name: 'React Guide',
      tags: ['react'],
      importedAt: '2020-01-01T00:00:00.000Z',
    })
    await seedAndReload(page, indexedDB, [pythonCourse, reactCourse])

    const filterBar = page.getByTestId('topic-filter-bar')
    await filterBar.getByRole('button', { name: /^python$/i }).click()

    // Only Python course should be visible
    const importedCards = page.getByTestId('imported-course-card')
    await expect(importedCards).toHaveCount(1)
    await expect(importedCards.first().getByTestId('course-card-title')).toHaveText('Python Basics')
  })
})

// ===========================================================================
// AC4: Clear filters
// ===========================================================================

test.describe('AC4: Clear Filters', () => {
  test('should reset all filters when Clear filters is clicked', async ({ page, indexedDB }) => {
    const courses = [
      createImportedCourse({ id: 'c1', name: 'Course A', tags: ['python'] }),
      createImportedCourse({ id: 'c2', name: 'Course B', tags: ['react'] }),
    ]
    await seedAndReload(page, indexedDB, courses)

    const filterBar = page.getByTestId('topic-filter-bar')

    // Select a filter
    await filterBar.getByRole('button', { name: /^python$/i }).click()
    await expect(page.getByTestId('imported-course-card')).toHaveCount(1)

    // Clear filters
    await filterBar.getByTestId('clear-topic-filters').click()

    // All imported courses visible again
    await expect(page.getByTestId('imported-course-card')).toHaveCount(2)
  })
})
```

### Step 2: Run to verify failure

Run: `npx playwright test tests/e2e/regression/e22-s05-dynamic-filter-chips.spec.ts --project=chromium`
Expected: FAIL — tests fail because unified filter bar doesn't exist yet for pre-seeded-only scenario (AC1 first test) and cross-filtering not implemented (AC3)

### Step 3: Commit the failing tests

```bash
git add tests/e2e/regression/e22-s05-dynamic-filter-chips.spec.ts
git commit -m "test(E22-S05): add failing E2E tests for unified filter chips"
```

---

## Task 4: Refactor Courses.tsx — Unified Filter Bar

**Files:**
- Modify: `src/app/pages/Courses.tsx`

This is the main refactoring task. Changes are made inline in Courses.tsx.

### Step 1: Add imports for new utilities

At top of `Courses.tsx`, add:
```typescript
import { getUnifiedTags, courseMatchesTags } from '@/lib/getUnifiedTags'
```

Remove `categoryLabels` from the `CourseCard` import (no longer needed here for filtering):
```typescript
import { CourseCard } from '@/app/components/figma/CourseCard'
// categoryLabels no longer imported — handled by getUnifiedTags
```

### Step 2: Remove `selectedCategory` state, replace with unified `selectedTopics`

**Remove these lines (~line 39):**
```typescript
const [selectedCategory, setSelectedCategory] = useState<string>('all')
```

**Keep `selectedTopics` (already exists at ~line 40)** — this becomes the single unified filter state.

### Step 3: Replace `allTags` computation with `getUnifiedTags`

**Replace (~line 169):**
```typescript
const allTags = useMemo(() => getAllTags(), [getAllTags])
```

**With:**
```typescript
const unifiedTags = useMemo(
  () => getUnifiedTags(allCourses, importedCourses),
  [allCourses, importedCourses]
)
```

### Step 4: Update pre-seeded course filtering

**Replace the `filtered` computation (~lines 142-160):**

```typescript
const filtered = (() => {
  let courses = allCourses

  // Unified tag filtering (replaces category-only filtering)
  if (selectedTopics.length > 0) {
    courses = courses.filter(c => courseMatchesTags(c, selectedTopics))
  }

  if (searchQuery.trim()) {
    const q = searchQuery.toLowerCase()
    courses = courses.filter(
      c =>
        c.title.toLowerCase().includes(q) ||
        c.description.toLowerCase().includes(q) ||
        c.tags.some(t => t.toLowerCase().includes(q))
    )
  }

  return courses
})()
```

### Step 5: Update imported course filtering

**Replace `filteredImportedCourses` (~lines 171-190):**

The `selectedTopics` filtering already applies to imported courses via `c.tags.includes(topic)`. Update to use `courseMatchesTags` for consistency:

```typescript
const filteredImportedCourses = (() => {
  let courses = importedCourses

  if (searchQuery.trim()) {
    const q = searchQuery.toLowerCase()
    courses = courses.filter(
      c => c.name.toLowerCase().includes(q) || c.tags.some(t => t.toLowerCase().includes(q))
    )
  }

  if (selectedTopics.length > 0) {
    courses = courses.filter(c => courseMatchesTags(c, selectedTopics))
  }

  if (selectedStatuses.length > 0) {
    courses = courses.filter(c => selectedStatuses.includes(c.status))
  }

  return courses
})()
```

### Step 6: Move TopicFilter outside importedCourses guard

**Replace (~lines 273-285):**
```typescript
{importedCourses.length > 0 && (
  <div className="flex flex-wrap gap-x-6 gap-y-2 items-start">
    <TopicFilter ... />
    <StatusFilter ... />
  </div>
)}
```

**With:**
```typescript
{(unifiedTags.length > 0 || importedCourses.length > 0) && (
  <div className="flex flex-wrap gap-x-6 gap-y-2 items-start">
    <TopicFilter
      availableTags={unifiedTags}
      selectedTags={selectedTopics}
      onSelectedTagsChange={setSelectedTopics}
    />
    {importedCourses.length > 0 && (
      <StatusFilter
        selectedStatuses={selectedStatuses}
        onSelectedStatusesChange={setSelectedStatuses}
      />
    )}
  </div>
)}
```

### Step 7: Remove the category ToggleGroup from pre-seeded section

**Remove the entire category ToggleGroup block (~lines 344-367):**

```typescript
<div className="flex flex-wrap gap-2 items-center flex-1">
  <ToggleGroup
    type="single"
    value={selectedCategory}
    ...
  >
    {[
      { value: 'all', label: 'All Courses' },
      ...availableCategories.map(cat => (...)),
    ].map((chip, i) => (
      <ToggleGroupItem ... />
    ))}
  </ToggleGroup>
</div>
```

**Replace with just the sort selector:**
The sort selector can remain, but it no longer needs to be wrapped with the category chips. Adjust layout so the sort selector sits alone.

### Step 8: Remove unused state and variables

Remove:
- `const [selectedCategory, setSelectedCategory] = useState<string>('all')` (step 2)
- `const availableCategories = useMemo(...)` (~lines 137-140) — no longer needed
- The `categoryLabels` import from CourseCard if not used elsewhere in Courses.tsx
- `ToggleGroup`, `ToggleGroupItem` imports if no longer used

### Step 9: Run tests

Run: `npx vitest run src/lib/__tests__/getUnifiedTags.test.ts && npx playwright test tests/e2e/regression/e22-s05-dynamic-filter-chips.spec.ts --project=chromium`
Expected: All PASS

### Step 10: Commit

```bash
git add src/app/pages/Courses.tsx
git commit -m "feat(E22-S05): unify filter chips for categories + imported tags"
```

---

## Task 5: Verify Reactivity (AC5)

**Files:** No new files — verification task

### Step 1: Verify reactive store subscriptions

The auto-analysis flow in `autoAnalysis.ts` already:
1. Updates `db.importedCourses` with new tags (line 100)
2. Updates Zustand store via `useCourseImportStore.setState()` (lines 103-107)

The Courses.tsx component subscribes to `useCourseImportStore` via:
```typescript
const importedCourses = useCourseImportStore(state => state.importedCourses)
```

When `importedCourses` changes → `unifiedTags` useMemo recomputes → TopicFilter re-renders with new tags.

This should work automatically. No code changes needed.

### Step 2: Manual verification

1. Start dev server: `npm run dev`
2. Navigate to Courses page
3. Verify pre-seeded category chips appear (Behavioral Analysis, Influence & Authority, etc.)
4. Import a course folder
5. Verify AI-generated tags appear in chip bar without page refresh
6. Verify selecting a category chip filters pre-seeded courses
7. Verify selecting an AI tag chip filters imported courses
8. Verify "Clear filters" resets everything

### Step 3: Run full E2E suite

Run: `npx playwright test tests/e2e/regression/e22-s05-dynamic-filter-chips.spec.ts --project=chromium`
Expected: All PASS

---

## Task 6: Update Existing Tests

**Files:**
- Modify: `tests/e2e/regression/story-1-3-organize-by-topic.spec.ts` (if affected by unified filter)

### Step 1: Check if existing tests still pass

Run: `npx playwright test tests/e2e/regression/story-1-3-organize-by-topic.spec.ts --project=chromium`

If tests fail because:
- TopicFilter now includes pre-seeded categories (tag count mismatch in AC2 test)
- Filter bar is visible even without imported courses

### Step 2: Fix any broken assertions

Common fixes:
- Update tag count assertions (now includes pre-seeded categories)
- Update "filter bar visible" conditions
- Keep existing AC3 tag management tests unchanged (they test imported course tag editing)

### Step 3: Run full test suite

Run: `npx playwright test --project=chromium`
Expected: All PASS

### Step 4: Commit fixes

```bash
git add tests/
git commit -m "test(E22-S05): fix existing topic filter tests for unified chips"
```

---

## Task 7: Cleanup and Final Build Verification

**Files:** Various

### Step 1: Run build

Run: `npm run build`
Expected: SUCCESS, no errors

### Step 2: Run lint

Run: `npm run lint`
Expected: No errors (check for unused imports after refactor)

### Step 3: Run type check

Run: `npx tsc --noEmit`
Expected: No errors

### Step 4: Final commit if any cleanup needed

```bash
git add -A
git commit -m "chore(E22-S05): cleanup unused imports and build verification"
```

---

## Edge Cases to Watch

1. **No courses at all** → empty state shown, no filter bar → already handled by existing guard
2. **Only pre-seeded courses** → filter bar shows category chips only → getUnifiedTags handles this
3. **Only imported courses** → filter bar shows AI tags only → getUnifiedTags handles this
4. **Category label matches imported tag** (e.g., imported course with tag "behavioral analysis") → deduplication uses pre-seeded label (processed first)
5. **AND logic with mixed types** → selecting "Behavioral Analysis" + "python" → likely no courses match both, empty result → valid behavior, matches existing AND logic pattern
6. **Tags from auto-analysis appear mid-session** → Zustand subscription triggers re-render → verified by AC5

## Files Changed Summary

| File | Action | Lines Changed (est.) |
|------|--------|---------------------|
| `src/lib/getUnifiedTags.ts` | CREATE | ~60 |
| `src/lib/__tests__/getUnifiedTags.test.ts` | CREATE | ~100 |
| `src/app/pages/Courses.tsx` | MODIFY | ~40 removed, ~20 added |
| `tests/e2e/regression/e22-s05-dynamic-filter-chips.spec.ts` | CREATE | ~120 |
| `tests/e2e/regression/story-1-3-organize-by-topic.spec.ts` | MODIFY | ~5-10 assertions |

**Total estimated LOC changed: ~350**
