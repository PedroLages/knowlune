# Implementation Plan: E25-S03 Authors Page from IndexedDB

**Story:** E25-S03 — Authors Page from IndexedDB
**Date:** 2026-03-23
**Branch:** `feature/e25-s03-authors-page-from-indexeddb`
**Estimated Complexity:** Medium-Large (includes E25-S01 data model prerequisite)

## Context

The Authors page (`src/app/pages/Authors.tsx`) and Author profile page (`src/app/pages/AuthorProfile.tsx`) currently read from **hardcoded static data** (`src/data/authors/index.ts`). This story migrates them to read from **IndexedDB via a Zustand store**, establishing the foundation for user-created authors.

### Current Architecture
```
Authors.tsx  →  allAuthors (static)  →  hardcoded Author[]
AuthorProfile.tsx  →  getAuthorById (static)  →  hardcoded lookup
lib/authors.ts  →  getAuthorStats()  →  useCourseStore (Dexie) + static Author
```

### Target Architecture
```
Authors.tsx  →  useAuthorStore (Zustand)  →  db.authors (Dexie v20)
AuthorProfile.tsx  →  useAuthorStore.getAuthorById()  →  db.authors (Dexie v20)
lib/authors.ts  →  getAuthorStats()  →  useCourseStore + useAuthorStore
main.tsx  →  seedAuthorsIfEmpty() + loadAuthors()
```

### Dependencies
- **E25-S01 (Author Data Model):** Not completed — bundled into this story as prerequisite tasks (Steps 1-3)
- **E25-S02 (Author CRUD Dialog):** Not completed — "Add Author" button added as placeholder (Step 6)
- **E23-S03 (Rename Instructors to Authors):** Completed — v19 migration renamed `instructorId` → `authorId`

## Implementation Steps

### Step 1: Extend Author Type Interface
**Files:** `src/data/types.ts`
**Rationale:** The existing `Author` interface needs `isPreseeded`, `createdAt`, and `updatedAt` fields for IndexedDB storage. The existing fields remain unchanged for backward compatibility.

**Changes:**
- Add to `Author` interface:
  ```typescript
  isPreseeded: boolean    // true for Chase Hughes, prevents deletion
  createdAt: string       // ISO 8601 timestamp
  updatedAt: string       // ISO 8601 timestamp
  ```
- These fields are additive — existing static author data just needs defaults applied during seeding

**Risk:** Low. Additive type change. Existing code won't break since these fields are optional on the read side (only required for DB writes).

---

### Step 2: Add Dexie v20 Schema Migration
**Files:** `src/db/schema.ts`
**Rationale:** Creates the `authors` table in IndexedDB. Follows the established pattern of redeclaring all tables (Dexie requirement — omitting a table deletes it).

**Changes:**
- Add `db.version(20).stores({...})` declaring all v19 tables + new `authors: 'id, name'`
- No upgrade function needed — seeding is handled separately (idempotent, like `seedCoursesIfEmpty`)
- No existing data is modified

**Schema addition:**
```typescript
authors: 'id, name'  // id = primary key, name = indexed for lookups
```

**Risk:** Low. Pure additive migration. No data transformation.

---

### Step 3: Create Author Seeding Function
**Files:** `src/db/seedAuthors.ts` (new)
**Rationale:** Follows the exact pattern of `src/db/seedCourses.ts`. Seeds Chase Hughes from static data on first launch. Idempotent.

**Implementation:**
```typescript
export async function seedAuthorsIfEmpty(): Promise<void> {
  const count = await db.authors.count()
  if (count > 0) return

  const { chaseHughes } = await import('@/data/authors')
  await db.authors.add({
    ...chaseHughes,
    isPreseeded: true,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  })
}
```

**Key decisions:**
- Uses dynamic import for the static data (avoids bundling in non-seed paths)
- Only seeds if table is empty (idempotent)
- Adds the 3 new fields to the static Chase Hughes data

**Risk:** Low. Mirrors proven `seedCoursesIfEmpty` pattern.

---

### Step 4: Create `useAuthorStore` Zustand Store
**Files:** `src/stores/useAuthorStore.ts` (new)
**Rationale:** Mirrors the `useCourseStore` pattern. Provides reactive author data to components.

**Interface:**
```typescript
interface AuthorStoreState {
  authors: Author[]
  isLoaded: boolean
  loadAuthors: () => Promise<void>
  getAuthorById: (id: string) => Author | undefined
}
```

**Implementation details:**
- `loadAuthors()` reads from `db.authors.toArray()` (same pattern as `useCourseStore.loadCourses`)
- `getAuthorById()` does in-memory lookup from the loaded array
- `isLoaded` flag enables skeleton loading state in UI
- Error handling: log + set `isLoaded: true` with empty array (components handle fallback)

**Risk:** Low. Direct copy of established `useCourseStore` pattern.

---

### Step 5: Update App Initialization
**Files:** `src/main.tsx`
**Rationale:** Add author seeding and store loading to the deferred init chain, after course seeding.

**Changes:**
Add to the `deferInit` block, inside `db.open().then()`:
```typescript
// After seedCoursesIfEmpty and loadCourses:
await seedAuthorsIfEmpty()
await useAuthorStore.getState().loadAuthors()
```

Also add the imports to the `Promise.all` block:
```typescript
{ seedAuthorsIfEmpty } = await import('@/db/seedAuthors')
{ useAuthorStore } = await import('@/stores/useAuthorStore')
```

**Ordering:** Authors seed after courses seed (no dependency, but keeps init sequential for simplicity).

**Risk:** Low. Follows existing initialization pattern.

---

### Step 6: Refactor Authors Page
**Files:** `src/app/pages/Authors.tsx`
**Rationale:** Core deliverable. Replace static imports with store-based reactive data.

**Changes:**
1. **Replace import:** `allAuthors` from static → `useAuthorStore` hook
2. **Add loading state:** Show skeleton grid while `isLoaded === false`
3. **Add fallback:** If `isLoaded === true && authors.length === 0`, fall back to static `allAuthors`
4. **Add "Add Author" button:** In page header, right-aligned. Since E25-S02 (CRUD dialog) isn't built yet, clicking shows a toast "Author management coming soon"
5. **Keep existing card design:** No visual changes to the author cards

**Skeleton pattern:**
```tsx
{!isLoaded ? (
  <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
    {Array.from({ length: 3 }).map((_, i) => (
      <AuthorCardSkeleton key={i} />
    ))}
  </div>
) : (
  // existing grid
)}
```

**AuthorCardSkeleton:** New component using shadcn `Skeleton` to match card dimensions (avatar circle, text lines, badge pills, stats row).

**Risk:** Medium. UI refactor with loading states. Need to handle the brief flash when store hasn't loaded yet.

---

### Step 7: Refactor AuthorProfile Page
**Files:** `src/app/pages/AuthorProfile.tsx`
**Rationale:** The profile page also reads from static data and needs the same migration.

**Changes:**
1. **Replace:** `getAuthorById(authorId!)` static → `useAuthorStore.getState().getAuthorById(authorId!)`
   - Or better: use the store as a hook for reactivity
2. **Add loading state:** Skeleton for the hero card, stats strip, bio section
3. **Add fallback:** Same pattern as Authors page — if store empty, try static data

**Risk:** Medium. Same considerations as Step 6.

---

### Step 8: Adapt `lib/authors.ts` Utilities
**Files:** `src/lib/authors.ts`
**Rationale:** `getAuthorStats()` and `getAuthorForCourse()` reference static data imports that should be replaced.

**Changes:**
- `getAuthorForCourse()`: Change from `getAuthorById()` (static) to `useAuthorStore.getState().getAuthorById()`
- `getAuthorStats()`: No change needed — it already takes an `Author` parameter and uses `useCourseStore`
- `getAvatarSrc()`: No change — works with any `basePath` string

**Consumers of these functions:**
- `AuthorProfile.tsx` uses `getAuthorStats()`
- `CourseCard.tsx` uses `getAuthorForCourse()`
- These will automatically benefit from the store migration

**Risk:** Low. Function signatures don't change, only the internal lookup source for `getAuthorForCourse`.

---

### Step 9: E2E Tests
**Files:** `tests/e2e/regression/story-e25-s03.spec.ts` (new)
**Rationale:** Verify the Authors page loads from IndexedDB, not static data.

**Test cases:**
1. **AC1 — Authors grid from IndexedDB:**
   - Navigate to `/authors`
   - Verify Chase Hughes card renders with name, specialties, stats
   - Verify card links to `/authors/chase-hughes`

2. **AC4 — Author profile from IndexedDB:**
   - Navigate to `/authors/chase-hughes`
   - Verify name, title, bio, specialties, courses section all render

3. **AC5 — Skeleton loading state:**
   - Use route interception or delayed DB init to catch skeleton state
   - (May be impractical if loading is too fast — consider visual regression or skip)

4. **AC6 — Fallback on empty DB:**
   - Clear authors table in IndexedDB
   - Navigate to `/authors`
   - Verify page still renders with static fallback data

**Test infrastructure needs:**
- Add `seedAuthors()` helper to `tests/support/helpers/indexeddb-seed.ts`
- Add `createAuthor()` factory to `tests/support/fixtures/factories/`
- Add `goToAuthors(page)` navigation helper

**Risk:** Medium. Need to verify IndexedDB seeding works for the new `authors` table.

---

### Step 10: Cleanup Static Data Imports
**Files:** Various consumers
**Rationale:** After migration, audit remaining imports of `allAuthors` and `getAuthorById` from `@/data/authors`.

**Changes:**
- `src/app/pages/Authors.tsx` — already migrated (Step 6)
- `src/app/pages/AuthorProfile.tsx` — already migrated (Step 7)
- `src/lib/authors.ts` — already migrated (Step 8)
- **Keep `src/data/authors/` directory** — still needed as fallback data source and as seed source for `seedAuthorsIfEmpty()`

**Risk:** Low. Static data preserved for fallback; only import paths change.

## File Change Summary

| File | Action | Step |
|------|--------|------|
| `src/data/types.ts` | Edit — add 3 fields to Author interface | 1 |
| `src/db/schema.ts` | Edit — add v20 migration with `authors` table | 2 |
| `src/db/seedAuthors.ts` | **Create** — author seeding function | 3 |
| `src/stores/useAuthorStore.ts` | **Create** — Zustand store for authors | 4 |
| `src/main.tsx` | Edit — add author seed + store load to init | 5 |
| `src/app/pages/Authors.tsx` | Edit — replace static import, add skeleton/fallback | 6 |
| `src/app/pages/AuthorProfile.tsx` | Edit — replace static lookup, add skeleton/fallback | 7 |
| `src/lib/authors.ts` | Edit — update `getAuthorForCourse()` lookup | 8 |
| `tests/e2e/regression/story-e25-s03.spec.ts` | **Create** — E2E test suite | 9 |
| `tests/support/fixtures/factories/author-factory.ts` | **Create** — test data factory | 9 |
| `tests/support/helpers/navigation.ts` | Edit — add `goToAuthors()` | 9 |

## Risks & Mitigations

| Risk | Likelihood | Impact | Mitigation |
|------|-----------|--------|------------|
| Race condition: page renders before store loads | Medium | Low | Skeleton loading state + fallback to static data |
| Dexie v20 migration fails on existing installs | Low | High | Try/catch with graceful degradation, static fallback |
| CourseCard breaks due to `getAuthorForCourse` change | Low | Medium | Store provides same interface; integration test catches |
| E25-S02 dependency for "Add Author" button | N/A | N/A | Placeholder button with toast — deferred to E25-S02 |

## Out of Scope

- Author CRUD operations (E25-S02)
- Author auto-detection during import (E25-S04)
- Smart photo detection (E25-S05)
- Imported courses `authorId` field (E25-S06)
- Single-author featured layout (E23-S06 — not yet built, AC3 deferred)
- `importedCourses.authorId` migration — only pre-seeded courses have `authorId` today

## Acceptance Criteria Mapping

| AC | Step(s) | Verification |
|----|---------|-------------|
| AC1: Authors grid from IndexedDB | 4, 6 | E2E: authors page renders from store data |
| AC2: Add Author button | 6 | Visual: button present, shows toast |
| AC3: Single-author featured layout | Deferred | E23-S06 not built yet |
| AC4: Replace static imports | 6, 7, 8 | No imports from `@/data/authors` in pages |
| AC5: Skeleton loading state | 6, 7 | Visual: skeletons visible during load |
| AC6: Graceful fallback | 6, 7 | E2E: clear DB → page still renders |

## Implementation Order

1. Step 1 (types) — foundational, no dependencies
2. Step 2 (schema) — needs types
3. Step 3 (seeding) — needs schema
4. Step 4 (store) — needs schema + types
5. Step 5 (init) — needs seeding + store
6. Step 8 (lib/authors) — needs store (do before pages to avoid breaking CourseCard)
7. Step 6 (Authors page) — needs store + lib
8. Step 7 (AuthorProfile page) — needs store + lib
9. Step 9 (E2E tests) — needs all above
10. Step 10 (cleanup) — final audit
