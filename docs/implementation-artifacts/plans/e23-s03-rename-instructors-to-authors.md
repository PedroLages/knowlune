# Plan: E23-S03 — Rename Instructors to Authors

## Context

The term "Instructors" doesn't fit Knowlune's self-directed learning model where users import their own content. "Authors" better describes content creators. This story renames ALL references — UI text, files, types, variables, routes, and database schema — for a clean, consistent codebase.

**Worktree**: `.worktrees/e23-s03` (branch: `feature/e23-s03-rename-instructors-to-authors`)

## Implementation Strategy

**Approach**: Full rename including DB migration. Work inside-out: types → data → lib → components → pages → routes → tests → DB schema.

**Commit strategy**: One granular commit per task as save points.

---

## Task 1: Rename types and interfaces

**Files**:
- `src/data/types.ts:70-109`

**Changes**:
- `Instructor` → `Author`
- `InstructorSocialLinks` → `AuthorSocialLinks`
- `Course.instructorId` → `Course.authorId`
- Comment: `// --- Author Types ---`

---

## Task 2: Rename data directory and files

**Files**:
- `src/data/instructors/` → `src/data/authors/`
- `src/data/instructors/index.ts` → `src/data/authors/index.ts`
- `src/data/instructors/chase-hughes.ts` → `src/data/authors/chase-hughes.ts`

**Changes in `index.ts`**:
- `allInstructors` → `allAuthors`
- `getInstructorById()` → `getAuthorById()`
- Update import types: `Instructor` → `Author`

**Changes in `chase-hughes.ts`**:
- Type annotation: `Instructor` → `Author`
- Image path: keep `/images/instructors/` as-is (asset paths are not user-visible; rename images separately if desired)

**Changes in course data files** (`src/data/courses/*.ts`):
- `instructorId: 'chase-hughes'` → `authorId: 'chase-hughes'` (8 files: operative-six, behavior-skills, authority, 6mx, ops-manual, nci-access, study-materials, confidence-reboot)
- `confidence-reboot.ts:158` — `'guest instructor'` in `keyTopics` array: keep as-is (this is course content describing a topic, not a code reference)

---

## Task 3: Rename lib utility file

**Files**:
- `src/lib/instructors.ts` → `src/lib/authors.ts`

**Changes**:
- `getInstructorStats()` → `getAuthorStats()`
- `getInstructorForCourse()` → `getAuthorForCourse()`
- Update imports from `@/data/authors`
- Update type references: `Instructor` → `Author`
- Update `course.instructorId` → `course.authorId`

---

## Task 4: Rename page components

**Files**:
- `src/app/pages/Instructors.tsx` → `src/app/pages/Authors.tsx`
- `src/app/pages/InstructorProfile.tsx` → `src/app/pages/AuthorProfile.tsx`

**Changes in `Authors.tsx`**:
- Export: `Instructors()` → `Authors()`
- Heading: `"Our Instructors"` → `"Our Authors"`
- All `instructor` variables → `author`
- All `allInstructors` → `allAuthors`
- Import paths: `@/data/authors`, `@/lib/authors`
- Link path: `/instructors/${author.id}` (keep route path — changed in Task 6)

**Changes in `AuthorProfile.tsx`**:
- Export: `InstructorProfile()` → `AuthorProfile()`
- `instructorId` param → `authorId`
- `"Instructor Not Found"` → `"Author Not Found"`
- `"Back to Instructors"` → `"Back to Authors"`
- Breadcrumb: `"Instructors"` → `"Authors"`
- All `instructor` variables → `author`
- Import paths updated

---

## Task 5: Update consuming components

**Files**:
- `src/app/components/figma/CourseCard.tsx` — update imports, variables (`instructor` → `author`), link paths
- `src/app/pages/CourseDetail.tsx` — update imports, variables, link paths, comment
- `src/app/components/figma/SearchCommandPalette.tsx` — update path `/instructors` → `/authors`, keywords
- `src/app/pages/prototypes/layouts/HybridLayout.tsx` — nav item label
- `src/app/pages/prototypes/layouts/SwissLayout.tsx` — nav item label
- `src/app/components/examples/ApiExample.tsx` — uses `api.ts` types (not `data/types.ts`); `course.instructor` → `course.author` (separate type system, covered in Task 10)

---

## Task 6: Update navigation and routes

**Files**:
- `src/app/config/navigation.ts:46` — `'Instructors'` → `'Authors'`, path `/instructors` → `/authors`
- `src/app/routes.tsx:25-29, 195-206` — rename lazy imports, update route paths to `/authors` and `/authors/:authorId`

**Route change**: `/instructors` → `/authors`, `/instructors/:instructorId` → `/authors/:authorId`
- No redirect needed (personal app, no SEO, no external links to preserve)

**Fix story file**: Update the `## Design Guidance` section in `23-3-rename-instructors-to-authors.md` to remove the "keep `/instructors` route" recommendation — it contradicts this plan's full rename approach.

---

## Task 7: Database schema migration

**File**: `src/db/schema.ts`

**Add v19** (after v18):
```typescript
db.version(19).stores({
  // Redeclare ALL v18 tables, changing instructorId → authorId
  courses: 'id, category, difficulty, authorId',
  // ... all other tables unchanged
}).upgrade(tx => {
  return tx.table('courses').toCollection().modify(course => {
    if (course.instructorId !== undefined) {
      course.authorId = course.instructorId
      delete course.instructorId
    }
  })
})
```

**Stores**: No Dexie `.where('instructorId')` queries exist — only `lib/instructors.ts` filters in-memory via `c.instructorId === instructor.id` (handled in Task 3).

**Seeding**: `src/db/seedCourses.ts` does `db.courses.bulkAdd(allCourses)` — after Task 2, the static data will have `authorId`. The Dexie v19 migration runs during `db.open()` (before any reads/writes), so existing records get migrated before new seeds could conflict.

**Type safety**: `src/db/schema.ts:41` declares `courses: EntityTable<Course, 'id'>` — TypeScript enforces the `Course` type change cascades correctly through all DB operations.

---

## Task 8: Update unit tests

**Files** (update `instructorId` → `authorId` in test data):
- `src/stores/__tests__/useQuizStore.test.ts`
- `src/stores/__tests__/useQuizStore.crossStore.test.ts`
- `src/lib/suggestions.test.ts`
- `src/lib/__tests__/noteSearch.test.ts`
- `src/lib/__tests__/reportStats.test.ts`
- `src/lib/__tests__/recommendations.test.ts`
- `src/lib/__tests__/progress.test.ts`
- `src/app/pages/__tests__/Notes.test.tsx`
- `src/app/pages/__tests__/MyClass.test.tsx`
- `src/app/pages/__tests__/Overview.test.tsx`
- `src/app/pages/__tests__/Reports.test.tsx`
- `src/app/components/NextCourseSuggestion.test.tsx`

**Pattern**: Find/replace `instructorId` → `authorId` in course mock objects.

---

## Task 9: Update E2E tests

**Files**:
- `tests/capture-wireframe-screenshots.spec.ts` — update screenshot names and paths
- `tests/e2e/regression/story-e07-s02.spec.ts` — update comments
- `tests/e2e/story-e09b-s01.spec.ts` — "The instructor explains..." is LLM output text, keep as-is
- `tests/e2e/regression/story-e09b-s01.spec.ts` — same, keep as-is
- `tests/analysis/error-path-corrupted-courses.spec.ts` — `instructorId` → `authorId` in test data
- `tests/support/helpers/navigation.ts` — add `goToAuthors()` helper
- `tests/e2e/story-e23-s03.spec.ts` — update route path from `/instructors` to `/authors`

---

## Task 10: Update API types

**File**: `src/types/api.ts`
- `Instructor` interface → `Author`
- `course.instructor` → `course.author`
- `role: 'instructor'` → `role: 'author'`

---

## Task 11: Verify and fix

1. `npm run build` — fix any remaining import errors
2. `npm run lint` — fix any ESLint issues
3. `npm run test:unit` — all 2151 tests passing
4. Run E2E ATDD tests: `npx playwright test tests/e2e/story-e23-s03.spec.ts`
5. `grep -ri "instructor" src/` — confirm zero remaining references (except image asset paths if kept)

---

## Verification

```bash
# Build
npm run build

# Lint
npm run lint

# Unit tests
npm run test:unit

# E2E ATDD tests
npx playwright test tests/e2e/story-e23-s03.spec.ts --project=chromium

# Comprehensive instructor grep (should return 0 in src/ except "guest instructor" content)
grep -ri "instructor" src/ --include="*.ts" --include="*.tsx" | grep -v "images/instructors" | grep -v "guest instructor"

# Also check tests/ (exclude LLM output text "The instructor explains")
grep -ri "instructor" tests/ --include="*.ts" | grep -v "The instructor explains"

# Smoke test navigation
npm run dev  # verify /authors route loads
```

## Files Summary (~35 files modified)

| Category | Files | Count |
|----------|-------|-------|
| Types | `src/data/types.ts`, `src/types/api.ts` | 2 |
| Data | `src/data/authors/` (renamed), 8 course files | 10 |
| Lib | `src/lib/authors.ts` (renamed) | 1 |
| Pages | `Authors.tsx`, `AuthorProfile.tsx` (renamed) | 2 |
| Components | `CourseCard.tsx`, `CourseDetail.tsx`, `SearchCommandPalette.tsx`, 2 prototypes | 5 |
| Config | `navigation.ts`, `routes.tsx` | 2 |
| DB | `schema.ts` | 1 |
| Unit tests | 12 test files | 12 |
| E2E tests | 5 test files + 1 helper | 6 |
