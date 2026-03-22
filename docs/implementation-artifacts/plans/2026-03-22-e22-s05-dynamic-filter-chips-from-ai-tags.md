# E22-S05: Dynamic Filter Chips from AI Tags — Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Merge pre-seeded course categories and imported course AI tags into a single unified ToggleGroup of filter chips on the Courses page, where selecting any chip filters both course types simultaneously.

**Architecture:** Extract chip-building logic into a pure utility (`src/lib/filterChips.ts`) so it can be unit-tested in isolation. Replace the dual filter state (`selectedCategory` + `selectedTopics`) in `Courses.tsx` with a single `selectedFilter: string`. Remove the separate `TopicFilter` component from the imported-courses section — it becomes redundant once the main ToggleGroup covers both course types. Keep `StatusFilter` untouched.

**Tech Stack:** React 19 / TypeScript / Zustand / Vitest + Testing Library

---

## Background: Current State

- `src/app/pages/Courses.tsx` has **two independent filter systems**:
  - Pre-seeded courses (bottom ToggleGroup): `selectedCategory: string` ('all' | CourseCategory slug)
  - Imported courses (TopicFilter): `selectedTopics: string[]` (multi-value)
- `useCourseImportStore.getAllTags()` returns all unique tags from imported courses (alphabetically sorted)
- `categoryLabels` (from `CourseCard.tsx`) maps `CourseCategory` slugs → human labels
- Pre-seeded `Course.category` is `CourseCategory` (slug); `Course.tags` is `string[]`
- Imported `ImportedCourse.tags` is `string[]` (lowercase, normalized via `normalizeTags`)

## What Needs to Change

| File | Change |
|------|--------|
| `src/lib/filterChips.ts` | **Create**: pure utility — merge, dedup, count, sort |
| `src/lib/__tests__/filterChips.test.ts` | **Create**: unit tests for the utility |
| `src/app/pages/Courses.tsx` | **Modify**: unified filter state, unified chip render, unified filtering |
| `src/app/pages/__tests__/Courses.test.tsx` | **Modify**: update mocks + add unified filter tests |

---

## Task 1: Create `filterChips.ts` Utility

**Files:**
- Create: `src/lib/filterChips.ts`

### What it does

```typescript
export interface FilterChip {
  value: string   // normalized key (lowercase slug or tag value)
  label: string   // display text (title-cased or categoryLabel)
  count: number   // how many courses (both types) match this chip
}
```

`buildUnifiedFilterChips(preseededCourses, categoryLabels, importedCourses): FilterChip[]`

Logic:
1. For each pre-seeded course, emit `{ value: course.category, label: categoryLabels[category] ?? category }`
2. For each imported course tag, emit `{ value: tag, label: titleCase(tag) }`
3. Dedup by `value.toLowerCase()` — if a pre-seeded category label matches an AI tag by lowercase comparison, keep the pre-seeded label (more formal)
4. Count: for each chip value, count pre-seeded courses where `c.category === value` OR `c.tags.some(t => t.toLowerCase() === value)`, PLUS imported courses where `c.tags.some(t => t.toLowerCase() === value)` OR `c.category.toLowerCase() === value`
5. Filter out chips with count === 0
6. Sort: by count descending (most courses first), then alphabetically as tiebreaker
7. Return (caller prepends "All" chip)

**Step 1: Write the failing tests first**

See Task 2 below — write tests, then implement.

**Step 2: Implement `buildUnifiedFilterChips`**

```typescript
// src/lib/filterChips.ts

export interface FilterChip {
  value: string
  label: string
  count: number
}

function titleCase(s: string): string {
  return s.replace(/\b\w/g, c => c.toUpperCase())
}

export function buildUnifiedFilterChips(
  preseededCourses: Array<{ category: string; tags: string[] }>,
  categoryLabels: Record<string, string>,
  importedCourses: Array<{ tags: string[]; category: string }>
): FilterChip[] {
  // Collect chips with normalized key → label
  const chipMap = new Map<string, string>()

  // Pre-seeded categories take priority for label
  for (const course of preseededCourses) {
    const key = course.category.toLowerCase()
    if (!chipMap.has(key)) {
      chipMap.set(key, categoryLabels[course.category] ?? titleCase(course.category))
    }
  }

  // AI tags from imported courses
  for (const course of importedCourses) {
    for (const tag of course.tags) {
      const key = tag.toLowerCase()
      if (!chipMap.has(key)) {
        chipMap.set(key, titleCase(tag))
      }
    }
  }

  // Count matches for each chip
  return [...chipMap.entries()]
    .map(([value, label]) => {
      const preCount = preseededCourses.filter(
        c =>
          c.category.toLowerCase() === value ||
          c.tags.some(t => t.toLowerCase() === value)
      ).length

      const importCount = importedCourses.filter(
        c =>
          c.tags.some(t => t.toLowerCase() === value) ||
          c.category.toLowerCase() === value
      ).length

      return { value, label, count: preCount + importCount }
    })
    .filter(chip => chip.count > 0)
    .sort((a, b) => b.count - a.count || a.label.localeCompare(b.label))
}
```

**Step 3: Run type check**

```bash
npx tsc --noEmit
```
Expected: no errors

---

## Task 2: Unit Tests for `filterChips.ts`

**Files:**
- Create: `src/lib/__tests__/filterChips.test.ts`

**Step 1: Write tests**

```typescript
// src/lib/__tests__/filterChips.test.ts
import { describe, it, expect } from 'vitest'
import { buildUnifiedFilterChips } from '@/lib/filterChips'

const categoryLabels: Record<string, string> = {
  'behavioral-analysis': 'Behavioral Analysis',
  'influence-authority': 'Influence & Authority',
}

const preseededCourses = [
  { category: 'behavioral-analysis', tags: [] },
  { category: 'behavioral-analysis', tags: [] },
  { category: 'influence-authority', tags: ['python'] },
]

const importedCourses = [
  { category: '', tags: ['python', 'machine learning'] },
  { category: '', tags: ['Python'] },  // same tag, different casing
  { category: '', tags: ['machine learning', 'data science'] },
]

describe('buildUnifiedFilterChips', () => {
  it('deduplicates case-insensitively', () => {
    const chips = buildUnifiedFilterChips(preseededCourses, categoryLabels, importedCourses)
    const pythonChips = chips.filter(c => c.value === 'python')
    expect(pythonChips).toHaveLength(1)
  })

  it('sorts by frequency descending', () => {
    const chips = buildUnifiedFilterChips(preseededCourses, categoryLabels, importedCourses)
    // machine learning (2 imported) should outrank data science (1 imported)
    const mlIdx = chips.findIndex(c => c.value === 'machine learning')
    const dsIdx = chips.findIndex(c => c.value === 'data science')
    expect(mlIdx).toBeLessThan(dsIdx)
  })

  it('uses category label for pre-seeded chips', () => {
    const chips = buildUnifiedFilterChips(preseededCourses, categoryLabels, importedCourses)
    const ba = chips.find(c => c.value === 'behavioral-analysis')
    expect(ba?.label).toBe('Behavioral Analysis')
  })

  it('uses title case for AI tag chips', () => {
    const chips = buildUnifiedFilterChips([], {}, [{ category: '', tags: ['web development'] }])
    const chip = chips.find(c => c.value === 'web development')
    expect(chip?.label).toBe('Web Development')
  })

  it('counts pre-seeded category courses correctly', () => {
    const chips = buildUnifiedFilterChips(preseededCourses, categoryLabels, [])
    const ba = chips.find(c => c.value === 'behavioral-analysis')
    expect(ba?.count).toBe(2)
  })

  it('counts imported course tags correctly', () => {
    const chips = buildUnifiedFilterChips([], {}, importedCourses)
    const ml = chips.find(c => c.value === 'machine learning')
    expect(ml?.count).toBe(2)
  })

  it('pre-seeded label wins over AI tag label for same key', () => {
    // If an imported tag happens to match a pre-seeded category slug
    const courses = [{ category: 'behavioral-analysis', tags: [] }]
    const imported = [{ category: '', tags: ['behavioral-analysis'] }]
    const chips = buildUnifiedFilterChips(courses, categoryLabels, imported)
    const chip = chips.find(c => c.value === 'behavioral-analysis')
    expect(chip?.label).toBe('Behavioral Analysis') // formal label wins
  })

  it('returns empty array when no courses', () => {
    const chips = buildUnifiedFilterChips([], {}, [])
    expect(chips).toHaveLength(0)
  })

  it('handles no imported courses (only pre-seeded)', () => {
    const chips = buildUnifiedFilterChips(preseededCourses, categoryLabels, [])
    expect(chips.length).toBeGreaterThan(0)
    expect(chips.every(c => c.count > 0)).toBe(true)
  })

  it('handles no pre-seeded courses (only AI tags)', () => {
    const chips = buildUnifiedFilterChips([], {}, importedCourses)
    expect(chips.length).toBeGreaterThan(0)
  })
})
```

**Step 2: Run tests to verify they fail**

```bash
npm run test:unit -- filterChips
```
Expected: FAIL (module not found)

**Step 3: Implement `filterChips.ts` (as above in Task 1 Step 2)**

**Step 4: Run tests to verify they pass**

```bash
npm run test:unit -- filterChips
```
Expected: all PASS

**Step 5: Commit**

```bash
git add src/lib/filterChips.ts src/lib/__tests__/filterChips.test.ts
git commit -m "feat(e22-s05): add buildUnifiedFilterChips utility with unit tests"
```

---

## Task 3: Refactor `Courses.tsx` — Unified Filter State

**Files:**
- Modify: `src/app/pages/Courses.tsx`

### Step 1: Plan the changes

Current state to replace:
```typescript
const [selectedCategory, setSelectedCategory] = useState<string>('all')
const [selectedTopics, setSelectedTopics] = useState<string[]>([])
```

Replace with:
```typescript
const [selectedFilter, setSelectedFilter] = useState<string>('')  // empty = "All"
```

The "All" chip has value `''` (empty string). The ToggleGroup uses `type="single"`.

### Step 2: Update the filter state and chip data

Replace `availableCategories` useMemo and add unified chips:

```typescript
// Import the utility
import { buildUnifiedFilterChips } from '@/lib/filterChips'
import { categoryLabels } from '@/app/components/figma/CourseCard'

// Replace availableCategories useMemo with:
const unifiedFilterChips = useMemo(
  () => buildUnifiedFilterChips(allCourses, categoryLabels, importedCourses),
  [allCourses, importedCourses]
)
```

Note: `categoryLabels` is already exported from `CourseCard.tsx` (it's used in Courses.tsx via `CourseCard, categoryLabels` import on line 12 — verify this export exists).

### Step 3: Update pre-seeded courses filter

Old:
```typescript
if (selectedCategory && selectedCategory !== 'all') {
  courses = courses.filter(c => c.category === selectedCategory)
}
```

New:
```typescript
if (selectedFilter) {
  courses = courses.filter(
    c =>
      c.category.toLowerCase() === selectedFilter ||
      c.tags.some(t => t.toLowerCase() === selectedFilter)
  )
}
```

### Step 4: Update imported courses filter

Old:
```typescript
if (selectedTopics.length > 0) {
  courses = courses.filter(c => selectedTopics.every(topic => c.tags.includes(topic)))
}
```

New:
```typescript
if (selectedFilter) {
  courses = courses.filter(
    c =>
      c.tags.some(t => t.toLowerCase() === selectedFilter) ||
      c.category.toLowerCase() === selectedFilter
  )
}
```

### Step 5: Update the ToggleGroup render

Replace the current ToggleGroup (lines 328–344) with:

```tsx
<ToggleGroup
  type="single"
  value={selectedFilter}
  onValueChange={v => setSelectedFilter(v ?? '')}
  aria-label="Filter by category or topic"
  className="flex flex-wrap gap-2"
>
  <ToggleGroupItem
    value=""
    className={chipClassName(true)}
  >
    All Courses
  </ToggleGroupItem>
  {unifiedFilterChips.map(chip => (
    <ToggleGroupItem
      key={chip.value}
      value={chip.value}
      className={chipClassName(false)}
    >
      {chip.label}
    </ToggleGroupItem>
  ))}
</ToggleGroup>
{selectedFilter && (
  <button
    type="button"
    onClick={() => setSelectedFilter('')}
    className="text-xs text-muted-foreground hover:text-foreground underline ml-1"
  >
    Clear filters
  </button>
)}
```

Where `chipClassName` is a small helper (inline or extracted):
```typescript
const chipClassName = (isAllChip: boolean) =>
  `h-auto rounded-full! border px-4 py-3 sm:py-1.5 text-sm font-medium transition-colors ` +
  `data-[state=on]:bg-brand data-[state=on]:text-brand-foreground data-[state=on]:hover:bg-brand-hover ` +
  `data-[state=on]:border-transparent data-[state=off]:bg-card data-[state=off]:text-muted-foreground ` +
  `data-[state=off]:hover:bg-accent data-[state=off]:hover:text-foreground data-[state=off]:border-border ` +
  `cursor-pointer shadow-none${isAllChip ? ' mr-1' : ''}`
```

### Step 6: Remove TopicFilter from imported courses section

Remove the `TopicFilter` block (currently in the `{importedCourses.length > 0 && (...)}` section). The unified ToggleGroup replaces it.

Keep `StatusFilter` — it is orthogonal (filters by learner status, not topic).

Update the conditional rendering:
```tsx
{importedCourses.length > 0 && (
  <div className="flex flex-wrap gap-x-6 gap-y-2 items-start mb-6">
    <StatusFilter
      selectedStatuses={selectedStatuses}
      onSelectedStatusesChange={setSelectedStatuses}
    />
  </div>
)}
```

### Step 7: Remove unused imports

Remove:
- `TopicFilter` import
- `selectedTopics` / `setSelectedTopics` state
- `selectedCategory` / `setSelectedCategory` state
- `availableCategories` useMemo

### Step 8: Verify `categoryLabels` export

Check `src/app/components/figma/CourseCard.tsx` — confirm `categoryLabels` is exported:
```typescript
export const categoryLabels: Record<CourseCategory, string> = { ... }
```

If it's not exported (currently `const categoryLabels` without `export`), add `export`.

### Step 9: Build and verify

```bash
npm run build
```
Expected: no errors

### Step 10: Commit

```bash
git add src/app/pages/Courses.tsx src/app/components/figma/CourseCard.tsx
git commit -m "feat(e22-s05): unified filter chips from pre-seeded categories + AI tags"
```

---

## Task 4: Update `Courses.test.tsx` — Unit Tests for Unified Filtering

**Files:**
- Modify: `src/app/pages/__tests__/Courses.test.tsx`

### Step 1: Update storeState mock

The storeState mock needs to remove `getAllTags` (no longer called) and add `autoAnalysisStatus`:

```typescript
const storeState = {
  importedCourses: [] as ImportedCourse[],
  isImporting: false,
  importError: null as string | null,
  importProgress: null,
  thumbnailUrls: {} as Record<string, string>,
  autoAnalysisStatus: {} as Record<string, unknown>,
  addImportedCourse: vi.fn(),
  removeImportedCourse: vi.fn(),
  updateCourseTags: vi.fn(),
  updateCourseStatus: vi.fn(),
  getAllTags: () => [] as string[],  // keep for backward compat if needed
  loadImportedCourses: vi.fn(),
  loadThumbnailUrls: vi.fn(),
  setImporting: vi.fn(),
  setImportError: vi.fn(),
  setImportProgress: vi.fn(),
  setAutoAnalysisStatus: vi.fn(),
}
```

### Step 2: Add fixture data with AI tags + pre-seeded overlap

```typescript
const coursesWithAiTags: ImportedCourse[] = [
  {
    id: 'ai-1',
    name: 'Python Basics',
    importedAt: '2026-01-01T00:00:00Z',
    category: '',
    tags: ['python', 'beginner'],
    status: 'active',
    videoCount: 5,
    pdfCount: 0,
    directoryHandle: {} as FileSystemDirectoryHandle,
  },
  {
    id: 'ai-2',
    name: 'Advanced Python',
    importedAt: '2026-01-02T00:00:00Z',
    category: '',
    tags: ['python', 'advanced'],
    status: 'active',
    videoCount: 8,
    pdfCount: 1,
    directoryHandle: {} as FileSystemDirectoryHandle,
  },
  {
    id: 'ai-3',
    name: 'Data Science',
    importedAt: '2026-01-03T00:00:00Z',
    category: '',
    tags: ['data science'],
    status: 'active',
    videoCount: 3,
    pdfCount: 0,
    directoryHandle: {} as FileSystemDirectoryHandle,
  },
]
```

### Step 3: Add new test suite for unified filter behavior

```typescript
describe('unified filter chips (AC1-AC5)', () => {
  beforeEach(() => {
    storeState.importedCourses = coursesWithAiTags
  })

  it('renders a single ToggleGroup (not a separate TopicFilter)', () => {
    renderCourses()
    // TopicFilter has data-testid="topic-filter-bar", should be gone
    expect(screen.queryByTestId('topic-filter-bar')).not.toBeInTheDocument()
    // Main ToggleGroup should be present with aria-label
    expect(screen.getByRole('group', { name: /filter by category or topic/i })).toBeInTheDocument()
  })

  it('shows "All Courses" chip (AC1)', () => {
    renderCourses()
    expect(screen.getByRole('radio', { name: 'All Courses' })).toBeInTheDocument()
  })

  it('shows AI tag chips from imported courses (AC1)', () => {
    renderCourses()
    // python tag appears across 2 courses (most frequent)
    expect(screen.getByRole('radio', { name: /python/i })).toBeInTheDocument()
  })

  it('shows "Clear filters" button only when filter is active (AC4)', async () => {
    const user = userEvent.setup()
    renderCourses()

    // No clear button initially
    expect(screen.queryByText('Clear filters')).not.toBeInTheDocument()

    // Click a tag chip
    const pythonChip = screen.getByRole('radio', { name: /python/i })
    await user.click(pythonChip)

    // Clear button appears
    expect(screen.getByText('Clear filters')).toBeInTheDocument()
  })

  it('clears filter when "Clear filters" is clicked (AC4)', async () => {
    const user = userEvent.setup()
    renderCourses()

    const pythonChip = screen.getByRole('radio', { name: /python/i })
    await user.click(pythonChip)

    // Only Python courses visible
    expect(screen.getByText('Python Basics')).toBeInTheDocument()
    expect(screen.queryByText('Data Science')).not.toBeInTheDocument()

    // Clear
    await user.click(screen.getByText('Clear filters'))

    // All courses visible again
    expect(screen.getByText('Python Basics')).toBeInTheDocument()
    expect(screen.getByText('Data Science')).toBeInTheDocument()
  })

  it('filters imported courses by AI tag (AC3)', async () => {
    const user = userEvent.setup()
    renderCourses()

    const pythonChip = screen.getByRole('radio', { name: /python/i })
    await user.click(pythonChip)

    // Python courses visible
    expect(screen.getByText('Python Basics')).toBeInTheDocument()
    expect(screen.getByText('Advanced Python')).toBeInTheDocument()

    // Non-python course hidden
    expect(screen.queryByText('Data Science')).not.toBeInTheDocument()
  })
})
```

### Step 4: Run all unit tests

```bash
npm run test:unit -- Courses
```
Expected: all tests pass (including updated status filter tests)

### Step 5: Commit

```bash
git add src/app/pages/__tests__/Courses.test.tsx
git commit -m "test(e22-s05): update Courses unit tests for unified filter chips"
```

---

## Task 5: Export `categoryLabels` from `CourseCard.tsx`

**Files:**
- Modify: `src/app/components/figma/CourseCard.tsx`

### Step 1: Verify current export status

Check line 28 of `src/app/components/figma/CourseCard.tsx`:
```typescript
const categoryLabels: Record<CourseCategory, string> = {
```

If NOT exported, change to:
```typescript
export const categoryLabels: Record<CourseCategory, string> = {
```

The import in `Courses.tsx` already uses `import { CourseCard, categoryLabels }` (line 12) so this export already exists. If the build fails, this is why.

### Step 2: Verify no regressions

```bash
npm run build && npm run lint
```

---

## Task 6: Full Test Run + Final Commit

### Step 1: Run build + lint + type check

```bash
npm run build
npm run lint
npx tsc --noEmit
```
Expected: no errors

### Step 2: Run all unit tests

```bash
npm run test:unit
```
Expected: all tests pass

### Step 3: Run E2E smoke test (Chromium only)

```bash
npx playwright test tests/e2e/courses.spec.ts --project=chromium
```
Expected: all pass

### Step 4: Final commit

```bash
git add -A
git commit -m "chore(e22-s05): all tests passing, ready for review"
```

---

## AC Verification Checklist

| AC | How Verified |
|----|-------------|
| AC1: Chips include pre-seeded categories AND imported AI tags | Unit test: "shows AI tag chips from imported courses" |
| AC2: Chips deduplicated, sorted by frequency | `filterChips.test.ts`: dedup + frequency sort tests |
| AC3: Filter works on both course types | Unit test: "filters imported courses by AI tag" + pre-seeded filter stays working |
| AC4: Clear filters resets everything | Unit test: "clears filter when Clear filters is clicked" |
| AC5: New import triggers chip update reactively | Zustand `importedCourses` reactivity + `useMemo` on `importedCourses` ensures re-render |

---

## Edge Cases to Handle

| Edge Case | Handling |
|-----------|----------|
| No imported courses | `unifiedFilterChips` only shows pre-seeded categories |
| No pre-seeded courses (unlikely) | Only AI tag chips shown |
| Both empty | Only "All Courses" chip (no other chips) |
| AI tag matches category slug exactly | Dedup keeps pre-seeded label (more formal) |
| Mixed casing ("Python" vs "python") | Normalized to lowercase for chip value; display uses `titleCase` or category label |
| Zero-count chips | Filtered out by `filter(chip => chip.count > 0)` |

---

## Files Summary

| File | Action | Purpose |
|------|--------|---------|
| `src/lib/filterChips.ts` | Create | Pure utility: merge + dedup + count + sort |
| `src/lib/__tests__/filterChips.test.ts` | Create | 9 unit tests covering all edge cases |
| `src/app/pages/Courses.tsx` | Modify | Replace dual filter with single `selectedFilter` state |
| `src/app/components/figma/CourseCard.tsx` | Verify/modify | Ensure `categoryLabels` is exported |
| `src/app/pages/__tests__/Courses.test.tsx` | Modify | Update mocks, add 5 unified filter tests |
