# ATDD Checklist - Epic 1, Story 1.2: Display Course Library

**Date:** 2026-02-15
**Author:** Pedro
**Primary Test Level:** E2E

---

## Story Summary

Display all imported courses in a responsive visual library grid with proper styling, hover states, and sorting.

**As a** learner,
**I want** to view all my imported courses in a visual library grid,
**So that** I can see what courses I have and their details at a glance.

---

## Acceptance Criteria

1. **AC1 — Responsive card grid**: Courses displayed in responsive grid (4 cols desktop, 2 tablet, 1 mobile) with course title, video count, PDF count, gradient placeholder. Cards use `rounded-[24px]`, design system spacing, hover state with `scale(1.02)` + elevated shadow + blue-600 title color (300ms transition).

2. **AC2 — Empty state**: When no imported courses exist, display empty state with "Import Your First Course" CTA that triggers the folder import dialog.

3. **AC3 — Sorting**: Courses sorted by most recently imported (newest first). Layout remains performant with 10+ courses, no layout shift.

---

## Failing Tests Created (RED Phase)

### E2E Tests (23 failing, 1 baseline pass)

**File:** `tests/e2e/story-1-2-course-library.spec.ts` (440 lines)

**AC1: Course Card Grid Display (15 tests)**

- **Test:** should display imported courses grid section
  - **Status:** RED — `getByTestId('imported-courses-grid')` not found
  - **Verifies:** Imported courses grid section is rendered with data-testid

- **Test:** should render imported course card with data-testid
  - **Status:** RED — `getByTestId('imported-course-card')` not found
  - **Verifies:** ImportedCourseCard component renders with data-testid

- **Test:** should display course title on imported course card
  - **Status:** RED — `getByTestId('course-card-title')` not found
  - **Verifies:** Course title visible on card

- **Test:** should display video count on imported course card
  - **Status:** RED — `getByTestId('course-card-video-count')` not found
  - **Verifies:** Video count (e.g. "12") visible on card

- **Test:** should display PDF count on imported course card
  - **Status:** RED — `getByTestId('course-card-pdf-count')` not found
  - **Verifies:** PDF count (e.g. "3") visible on card

- **Test:** should display gradient placeholder image on imported course card
  - **Status:** RED — `getByTestId('course-card-placeholder')` not found
  - **Verifies:** Emerald/teal gradient placeholder with FolderOpen icon

- **Test:** should use 4-column grid layout on desktop
  - **Status:** RED — `getByTestId('imported-courses-grid')` not found
  - **Verifies:** Grid has `lg:grid-cols-4` class at 1440px viewport

- **Test:** should use 2-column grid layout on tablet
  - **Status:** RED — `getByTestId('imported-courses-grid')` not found
  - **Verifies:** Grid has `sm:grid-cols-2` class at 768px viewport

- **Test:** should use 1-column grid layout on mobile
  - **Status:** RED — `getByTestId('imported-courses-grid')` not found
  - **Verifies:** Grid defaults to `grid-cols-1` at 375px viewport

- **Test:** should apply rounded-[24px] border radius on imported course cards
  - **Status:** RED — `getByTestId('imported-course-card')` not found
  - **Verifies:** Card has `rounded-[24px]` class (not `rounded-3xl`)

- **Test:** should use design system background color
  - **Status:** PASS (baseline) — Background #FAF5EE already exists
  - **Verifies:** Page background matches design system

- **Test:** should apply hover scale effect on imported course card
  - **Status:** RED — `getByTestId('imported-course-card')` not found
  - **Verifies:** Card scales to 1.02 on hover

- **Test:** should apply blue-600 title color on hover
  - **Status:** RED — `getByTestId('imported-course-card')` not found
  - **Verifies:** Title color changes to blue-600 on card hover

- **Test:** should wrap imported course card in article element
  - **Status:** RED — `getByTestId('imported-course-card')` not found
  - **Verifies:** Card uses semantic `<article>` element

- **Test:** should have aria-label on imported course card
  - **Status:** RED — `getByTestId('imported-course-card')` not found
  - **Verifies:** Card has `aria-label` containing course name

- **Test:** should have keyboard-focusable cards with visible focus ring
  - **Status:** RED — `getByTestId('imported-course-card')` not found
  - **Verifies:** Cards are focusable with visible `focus-visible:ring-2` indicator

**AC2: Empty State (4 tests)**

- **Test:** should display empty state section when no imported courses exist
  - **Status:** RED — `getByTestId('imported-courses-empty-state')` not found
  - **Verifies:** Empty state container rendered when no courses

- **Test:** should show Import Your First Course CTA text
  - **Status:** RED — `getByTestId('imported-courses-empty-state')` not found
  - **Verifies:** CTA text visible in empty state

- **Test:** should have CTA button with proper focus indicators
  - **Status:** RED — `getByTestId('import-first-course-cta')` not found
  - **Verifies:** CTA is a `<button>` element

- **Test:** should have aria-label on empty state section
  - **Status:** RED — `getByTestId('imported-courses-empty-state')` not found
  - **Verifies:** Empty state has accessible label

**AC3: Sorting and Performance (4 tests)**

- **Test:** should display newest imported course first
  - **Status:** RED — `getByTestId('imported-course-card')` not found
  - **Verifies:** Most recently imported course appears first

- **Test:** should display second-newest course in second position
  - **Status:** RED — `getByTestId('imported-course-card')` not found
  - **Verifies:** Courses ordered by importedAt descending

- **Test:** should render 10+ courses without layout shift
  - **Status:** RED — `getByTestId('imported-course-card')` not found
  - **Verifies:** 12 cards rendered when 12 courses seeded

- **Test:** should maintain grid gap spacing with many courses
  - **Status:** RED — `getByTestId('imported-courses-grid')` not found
  - **Verifies:** Grid has `gap-6` (24px) spacing

### API Tests (0 tests)

Not applicable — Story 1.2 uses local IndexedDB storage only, no API endpoints.

### Component Tests (0 tests in ATDD scope)

Component tests (Vitest + RTL) are defined in Story 1.2 Task 6 and will be created by the DEV agent during GREEN phase. Files:
- `src/app/components/figma/__tests__/ImportedCourseCard.test.tsx`

---

## Data Factories Created

### ImportedCourse Factory

**File:** `tests/support/fixtures/factories/imported-course-factory.ts`

**Exports:**

- `createImportedCourse(overrides?)` — Create single ImportedCourse test object
- `createImportedCourses(count, overridesFn?)` — Create array of imported courses

**Example Usage:**

```typescript
const course = createImportedCourse({ name: 'React Fundamentals', videoCount: 12 })
const courses = createImportedCourses(5, (i) => ({ name: `Course ${i + 1}` }))
```

---

## Fixtures Created

### IndexedDB Fixture

**File:** `tests/support/fixtures/indexeddb-fixture.ts`

**Fixtures:**

- `indexedDB` — Seed and cleanup IndexedDB (Dexie 'ElearningDB') data
  - **Setup:** Provides `seedImportedCourses()` and `clearImportedCourses()` helpers
  - **Provides:** Helper object with seed/clear methods
  - **Cleanup:** Auto-deletes all seeded records after each test

**Example Usage:**

```typescript
import { test, expect } from '../support/fixtures'
import { createImportedCourse } from '../support/fixtures/factories/imported-course-factory'

test('should display course', async ({ page, indexedDB }) => {
  const course = createImportedCourse({ name: 'My Course' })
  await page.goto('/courses')
  await indexedDB.seedImportedCourses([course])
  await page.reload()
  // Assert...
})
```

### Merged Fixtures (Updated)

**File:** `tests/support/fixtures/index.ts`

Updated to merge `indexedDBTest` fixture alongside existing `localStorageTest`, using Playwright's `mergeTests()` composition pattern.

---

## Mock Requirements

No external service mocking required. Story 1.2 uses:
- **IndexedDB (Dexie.js)** — Seeded directly via fixture
- **Zustand store** — Loads from IndexedDB on page mount
- **File System Access API** — Not tested in E2E (import trigger only; actual import is Story 1.1)

---

## Required data-testid Attributes

### Courses Page (`src/app/pages/Courses.tsx`)

- `imported-courses-grid` — Container grid element for imported course cards
- `imported-courses-empty-state` — Empty state container (when no imported courses)
- `import-first-course-cta` — "Import Your First Course" CTA button in empty state

### ImportedCourseCard Component (`src/app/components/figma/ImportedCourseCard.tsx`)

- `imported-course-card` — Root `<article>` element of each imported course card
- `course-card-title` — Course title text element
- `course-card-video-count` — Video count display (e.g., "12 videos")
- `course-card-pdf-count` — PDF count display (e.g., "3 PDFs")
- `course-card-placeholder` — Gradient placeholder image area with FolderOpen icon

**Implementation Example:**

```tsx
<article
  data-testid="imported-course-card"
  aria-label={`Course: ${course.name}`}
  className="group rounded-[24px] ... hover:scale-[1.02] hover:shadow-2xl transition-all duration-300"
  tabIndex={0}
>
  <div data-testid="course-card-placeholder" className="relative h-44 bg-gradient-to-br from-emerald-50 to-teal-100">
    <FolderOpen className="h-16 w-16 text-emerald-300" />
  </div>
  <div className="p-4">
    <h3 data-testid="course-card-title" className="font-bold line-clamp-2 group-hover:text-blue-600">
      {course.name}
    </h3>
    <span data-testid="course-card-video-count">
      <Video className="h-3.5 w-3.5" /> {course.videoCount}
    </span>
    <span data-testid="course-card-pdf-count">
      <FileText className="h-3.5 w-3.5" /> {course.pdfCount}
    </span>
  </div>
</article>
```

---

## Implementation Checklist

### Test: should display imported courses grid section

**File:** `tests/e2e/story-1-2-course-library.spec.ts`

**Tasks to make this test pass:**

- [ ] Add `data-testid="imported-courses-grid"` to the imported courses grid container in Courses.tsx
- [ ] Change grid from `grid-cols-1 md:grid-cols-2 lg:grid-cols-3` to `grid-cols-1 sm:grid-cols-2 lg:grid-cols-4`
- [ ] Run test: `npx playwright test tests/e2e/story-1-2-course-library.spec.ts -g "should display imported courses grid section"`
- [ ] Test passes (green phase)

---

### Test: should render imported course card with data-testid

**File:** `tests/e2e/story-1-2-course-library.spec.ts`

**Tasks to make this test pass:**

- [ ] Create `src/app/components/figma/ImportedCourseCard.tsx` component
- [ ] Accept `ImportedCourse` type as prop
- [ ] Add `data-testid="imported-course-card"` to root `<article>` element
- [ ] Replace inline card JSX in Courses.tsx with `<ImportedCourseCard>` component
- [ ] Run test: `npx playwright test tests/e2e/story-1-2-course-library.spec.ts -g "should render imported course card"`
- [ ] Test passes (green phase)

---

### Test: should display course title on imported course card

**File:** `tests/e2e/story-1-2-course-library.spec.ts`

**Tasks to make this test pass:**

- [ ] Add `data-testid="course-card-title"` to the title element in ImportedCourseCard
- [ ] Display `course.name` with `font-bold line-clamp-2`
- [ ] Run test: `npx playwright test tests/e2e/story-1-2-course-library.spec.ts -g "should display course title"`
- [ ] Test passes (green phase)

---

### Test: should display video count on imported course card

**File:** `tests/e2e/story-1-2-course-library.spec.ts`

**Tasks to make this test pass:**

- [ ] Add `data-testid="course-card-video-count"` to the video count element
- [ ] Display `course.videoCount` with Video icon
- [ ] Run test: `npx playwright test tests/e2e/story-1-2-course-library.spec.ts -g "should display video count"`
- [ ] Test passes (green phase)

---

### Test: should display PDF count on imported course card

**File:** `tests/e2e/story-1-2-course-library.spec.ts`

**Tasks to make this test pass:**

- [ ] Add `data-testid="course-card-pdf-count"` to the PDF count element
- [ ] Display `course.pdfCount` with FileText icon
- [ ] Run test: `npx playwright test tests/e2e/story-1-2-course-library.spec.ts -g "should display PDF count"`
- [ ] Test passes (green phase)

---

### Test: should display gradient placeholder image

**File:** `tests/e2e/story-1-2-course-library.spec.ts`

**Tasks to make this test pass:**

- [ ] Add `data-testid="course-card-placeholder"` to the gradient placeholder container
- [ ] Use emerald/teal gradient: `bg-gradient-to-br from-emerald-50 to-teal-100`
- [ ] Include FolderOpen icon (h-16 w-16)
- [ ] Run test: `npx playwright test tests/e2e/story-1-2-course-library.spec.ts -g "should display gradient placeholder"`
- [ ] Test passes (green phase)

---

### Test: should use 4-column grid layout on desktop

**File:** `tests/e2e/story-1-2-course-library.spec.ts`

**Tasks to make this test pass:**

- [ ] Change imported courses grid to `grid-cols-1 sm:grid-cols-2 lg:grid-cols-4`
- [ ] Add `data-testid="imported-courses-grid"` to grid container
- [ ] Run test: `npx playwright test tests/e2e/story-1-2-course-library.spec.ts -g "should use 4-column grid layout on desktop"`
- [ ] Test passes (green phase)

---

### Test: should apply rounded-[24px] border radius on cards

**File:** `tests/e2e/story-1-2-course-library.spec.ts`

**Tasks to make this test pass:**

- [ ] Apply `rounded-[24px]` class to ImportedCourseCard root element (NOT `rounded-3xl`)
- [ ] Also update CourseCard.tsx from `rounded-3xl` to `rounded-[24px]`
- [ ] Run test: `npx playwright test tests/e2e/story-1-2-course-library.spec.ts -g "should apply rounded"`
- [ ] Test passes (green phase)

---

### Test: should apply hover scale and blue-600 title color

**File:** `tests/e2e/story-1-2-course-library.spec.ts`

**Tasks to make this test pass:**

- [ ] Add `group` class to card root element
- [ ] Add `hover:scale-[1.02] hover:shadow-2xl transition-all duration-300` to card
- [ ] Add `group-hover:text-blue-600` to title element
- [ ] Run test: `npx playwright test tests/e2e/story-1-2-course-library.spec.ts -g "should apply hover"`
- [ ] Test passes (green phase)

---

### Test: should wrap card in article with aria-label

**File:** `tests/e2e/story-1-2-course-library.spec.ts`

**Tasks to make this test pass:**

- [ ] Use `<article>` element as card root (not `<div>`)
- [ ] Add `aria-label={`Course: ${course.name}`}` to card
- [ ] Run test: `npx playwright test tests/e2e/story-1-2-course-library.spec.ts -g "should wrap imported course card in article"`
- [ ] Test passes (green phase)

---

### Test: should have keyboard-focusable cards with visible focus ring

**File:** `tests/e2e/story-1-2-course-library.spec.ts`

**Tasks to make this test pass:**

- [ ] Add `tabIndex={0}` to card root element
- [ ] Add `focus-visible:ring-2 focus-visible:ring-blue-600 focus-visible:ring-offset-2`
- [ ] Run test: `npx playwright test tests/e2e/story-1-2-course-library.spec.ts -g "should have keyboard-focusable"`
- [ ] Test passes (green phase)

---

### Test: should display empty state with CTA

**File:** `tests/e2e/story-1-2-course-library.spec.ts`

**Tasks to make this test pass:**

- [ ] Add `data-testid="imported-courses-empty-state"` to empty state container in Courses.tsx
- [ ] Add `aria-label` to empty state section
- [ ] Add `data-testid="import-first-course-cta"` to the CTA button
- [ ] Ensure CTA button contains "Import Your First Course" text
- [ ] Ensure CTA triggers `handleImportCourse()` on click
- [ ] Use `rounded-[24px]` on empty state card (not `rounded-3xl`)
- [ ] Run test: `npx playwright test tests/e2e/story-1-2-course-library.spec.ts -g "AC2"`
- [ ] Tests pass (green phase)

---

### Test: should sort courses newest first

**File:** `tests/e2e/story-1-2-course-library.spec.ts`

**Tasks to make this test pass:**

- [ ] Sort `filteredImportedCourses` by `importedAt` descending before rendering
- [ ] Use `useMemo` for sort to avoid unnecessary re-renders:
  ```typescript
  const sortedImportedCourses = useMemo(() =>
    [...filteredImportedCourses].sort(
      (a, b) => new Date(b.importedAt).getTime() - new Date(a.importedAt).getTime()
    ),
    [filteredImportedCourses]
  )
  ```
- [ ] Add `data-testid="imported-course-card"` to each card for DOM order verification
- [ ] Add `data-testid="course-card-title"` for title text verification
- [ ] Run test: `npx playwright test tests/e2e/story-1-2-course-library.spec.ts -g "AC3"`
- [ ] Tests pass (green phase)

---

### Test: should render 10+ courses without layout shift

**File:** `tests/e2e/story-1-2-course-library.spec.ts`

**Tasks to make this test pass:**

- [ ] Ensure grid handles dynamic number of cards
- [ ] Use `gap-6` (24px) for consistent spacing
- [ ] Verify all data-testid attributes are present
- [ ] Run test: `npx playwright test tests/e2e/story-1-2-course-library.spec.ts -g "should render 10+ courses"`
- [ ] Test passes (green phase)

---

## Running Tests

```bash
# Run all Story 1.2 failing tests
npx playwright test tests/e2e/story-1-2-course-library.spec.ts --project chromium

# Run specific test by name
npx playwright test tests/e2e/story-1-2-course-library.spec.ts -g "should display imported courses grid section"

# Run tests in headed mode (see browser)
npx playwright test tests/e2e/story-1-2-course-library.spec.ts --project chromium --headed

# Debug specific test
npx playwright test tests/e2e/story-1-2-course-library.spec.ts --project chromium --debug

# Run with UI mode
npx playwright test tests/e2e/story-1-2-course-library.spec.ts --ui
```

---

## Red-Green-Refactor Workflow

### RED Phase (Complete)

**TEA Agent Responsibilities:**

- All 23 failing tests written in Given-When-Then format
- IndexedDB fixture created with auto-cleanup
- ImportedCourse factory created with override support
- Merged fixtures updated to include IndexedDB helper
- data-testid requirements documented
- Implementation checklist created

**Verification:**

- All tests run and fail as expected (23 RED, 1 baseline PASS)
- Failure messages are clear: `getByTestId('...') not found` — missing data-testid attributes
- Failures are due to missing implementation, not test bugs

---

### GREEN Phase (DEV Team - Next Steps)

**DEV Agent Responsibilities:**

1. **Pick one failing test** from implementation checklist (start with card component)
2. **Read the test** to understand expected behavior
3. **Implement minimal code** to make that specific test pass
4. **Run the test** to verify it now passes (green)
5. **Check off the task** in implementation checklist
6. **Move to next test** and repeat

**Recommended implementation order:**

1. Create `ImportedCourseCard.tsx` with all data-testid attributes (unblocks most AC1 tests)
2. Update Courses.tsx grid to `lg:grid-cols-4` and add grid data-testid
3. Add hover states and accessibility attributes
4. Add sorting logic
5. Update empty state with data-testid attributes
6. Run full suite to verify all GREEN

**Key Principles:**

- One test at a time (don't try to fix all at once)
- Minimal implementation (don't over-engineer)
- Run tests frequently (immediate feedback)
- Use implementation checklist as roadmap

---

### REFACTOR Phase (DEV Team - After All Tests Pass)

**DEV Agent Responsibilities:**

1. **Verify all tests pass** (green phase complete)
2. **Review code for quality** (readability, maintainability)
3. **Extract duplications** (DRY principle)
4. **Ensure tests still pass** after each refactor
5. **Write Vitest component tests** (Story Task 6)

---

## Next Steps

1. **Share this checklist and failing tests** with the dev workflow (manual handoff)
2. **Run failing tests** to confirm RED phase: `npx playwright test tests/e2e/story-1-2-course-library.spec.ts --project chromium`
3. **Begin implementation** starting with `ImportedCourseCard.tsx` component
4. **Work one test at a time** (red -> green for each)
5. **When all tests pass**, refactor code for quality
6. **When refactoring complete**, update story status to 'done' in sprint-status.yaml

---

## Knowledge Base References Applied

- **fixture-architecture.md** — Used `mergeTests()` composition for IndexedDB fixture alongside localStorage fixture
- **data-factories.md** — Factory pattern with override support for ImportedCourse test objects
- **selector-resilience.md** — `data-testid` selectors for all interactive/verifiable elements
- **test-quality.md** — Given-When-Then format, one assertion per test, deterministic data, auto-cleanup
- **timing-debugging.md** — Explicit waits (`toBeVisible()`), no hard waits, `waitUntil: 'domcontentloaded'` for reloads
- **network-first.md** — Not directly applicable (no API routes), but IndexedDB seeding follows "arrange before act" principle

---

## Test Execution Evidence

### Initial Test Run (RED Phase Verification)

**Command:** `npx playwright test tests/e2e/story-1-2-course-library.spec.ts --project chromium`

**Summary:**

- Total tests: 24
- Passing: 1 (baseline design system check — pre-existing behavior)
- Failing: 23 (expected — missing implementation)
- Status: RED phase verified

**Expected Failure Pattern:**

All 23 failures follow the same root cause:
```
TimeoutError: locator.getAttribute: Timeout 15000ms exceeded.
  - waiting for getByTestId('imported-courses-grid')
  - waiting for getByTestId('imported-course-card')
  - waiting for getByTestId('imported-courses-empty-state')
  - waiting for getByTestId('import-first-course-cta')
```

Tests fail because `data-testid` attributes do not yet exist in the UI implementation. Once the DEV agent adds these attributes and implements the required behavior, tests will turn GREEN.

---

## Notes

- The IndexedDB seeding fixture navigates to the page first (so Dexie creates the database), seeds data, then reloads. This is necessary because Dexie creates the database schema on first app load.
- The `directoryHandle` field from `ImportedCourse` is omitted in the test factory since it's a browser-only `FileSystemDirectoryHandle` API that cannot be serialized for IndexedDB seeding in tests.
- The design system background color test (#FAF5EE) passes as a baseline because the theme is already applied — this is not a Story 1.2-specific implementation.
- Hover state tests use `page.hover()` and `getComputedStyle()` to verify CSS transforms and color changes. These are stable patterns that don't depend on timing.
- The `CourseCard.tsx` (static courses) also needs border radius and hover updates per Story 1.2 Task 4, but those are tested visually via design review, not in this ATDD scope.

---

**Generated by BMad TEA Agent** — 2026-02-15
