# Story 64.2: Conditional seed data loading

Status: done (obsolete — superseded by E89-S01)

## Story

As a returning Knowlune user,
I want the app to skip downloading demo course data on every visit,
so that my page load is faster when I already have my own courses.

## Acceptance Criteria

1. **Given** the IndexedDB `courses` table contains at least 1 record
   **When** the app initializes the database
   **Then** the `seedCourses` chunk is NOT downloaded (verified via Network tab or build analysis)
   **And** existing course data is preserved

2. **Given** a fresh install with an empty IndexedDB
   **When** the app initializes for the first time
   **Then** the `seedCourses` chunk downloads and populates the database with demo courses
   **And** the user sees the populated course catalog

3. **Given** a production build
   **When** I analyze the initial modulepreload/script tags
   **Then** `seedCourses` is not in the initial load (it loads conditionally at runtime)

## Tasks / Subtasks

- [ ] Task 1: Locate current seed data loading code (AC: 1, 2)
  - [ ] 1.1 Find where `seedCourses` / `seedDefaultCourses` is imported and called
  - [ ] 1.2 Identify if it's a static import or already dynamic
- [ ] Task 2: Convert to conditional dynamic import (AC: 1, 2, 3)
  - [ ] 2.1 Add database-empty check before importing seedCourses module
  - [ ] 2.2 Use `await import()` to load seed data only when `courses.count() === 0`
  - [ ] 2.3 Ensure the seed function still runs correctly on first load
- [ ] Task 3: Verify chunk isolation (AC: 3)
  - [ ] 3.1 Run `npm run build` and confirm `seedCourses` chunk is separate
  - [ ] 3.2 Verify no modulepreload or static script tag references seedCourses
- [ ] Task 4: Test both paths (AC: 1, 2)
  - [ ] 4.1 Test fresh install: seed data loads and populates correctly
  - [ ] 4.2 Test returning user: seed chunk not downloaded
  - [ ] 4.3 Run existing E2E tests to confirm no regressions

## Dev Notes

### Architecture Decision: AD-10

Convert eager seedCourses import to conditional dynamic import based on database-empty detection. [Source: architecture-performance-optimization.md#AD-10]

### Implementation Pattern

```typescript
// In database initialization
async function initializeDatabase() {
  const courseCount = await db.courses.count()
  if (courseCount === 0) {
    const { seedDefaultCourses } = await import('@/db/seedCourses')
    await seedDefaultCourses()
  }
}
```

### Key Constraints

- **Preserve all existing seed data functionality** — only change WHEN it loads, not WHAT it loads
- The `seedCourses` chunk is 179 KB raw / 31 KB gz — worth isolating
- Must check the `courses` table specifically (the static course system), not `importedCourses`
- Database initialization runs early in the app lifecycle — ensure the conditional check doesn't add perceptible latency
- Brownfield context: Static course system (`Course` type in `src/data/`) coexists with imported course system (`ImportedCourse` in IndexedDB). The seed data populates the static course catalog.

### Project Structure Notes

- Seed data source: likely `src/db/seedCourses.ts` or similar
- Database initialization: `src/db/schema.ts` or a dedicated init module
- The `courses` table is defined in the Dexie schema (v29 checkpoint)

### Expected Impact

- Saves ~31 KB gzipped on every returning visit
- First visit behavior unchanged

### References

- [Source: _bmad-output/planning-artifacts/architecture-performance-optimization.md#AD-10]
- [Source: _bmad-output/planning-artifacts/prd-performance-optimization.md#FR-3]
- [Source: _bmad-output/planning-artifacts/epics-performance-optimization.md#Story-64.2]

## Dev Agent Record

### Agent Model Used

ce-orchestrator (autopilot+headless), 2026-04-25

### Debug Log References

### Completion Notes List

**Obsolete — no work required.** Investigation found:

- `src/db/schema.ts:123` documents that the static `courses` table was dropped in v30 (E89-S01) — "dead regular course system removed".
- Repo-wide grep for `seedCourses`, `seedDefaultCourses`, `seedCoursesIfEmpty`, `demoCourses`, etc. in `src/**` returns zero matches in production code (only in `tests/e2e/**` as test-data helpers, which are unrelated).
- No `seedCourses` chunk appears in the production bundle (`dist/assets/`).
- The `Courses-*.js` chunk in dist is the user-facing Courses page component, not seed data.

The optimization this story targeted (~31 KB gz savings from conditional seed loading) was already realized when the static course system was deleted in E89-S01. There is no seed data to make conditional.

**Acceptance criteria status:**

- AC1: Vacuously satisfied — no seedCourses chunk exists, so it is never downloaded.
- AC2: N/A — no fresh-install seed flow exists; courses come from user imports (YouTube, OPDS, etc.).
- AC3: Verified — `dist/assets/` contains no `seedCourses` chunk.

### File List

(no production code changes — story closed as obsolete)
