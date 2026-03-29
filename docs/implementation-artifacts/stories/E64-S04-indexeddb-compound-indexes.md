# Story 64.4: IndexedDB compound indexes for high-volume tables

Status: ready-for-dev

## Story

As a Knowlune power user with 1000+ study records,
I want database queries to be fast,
so that the app remains responsive as my learning data grows.

## Acceptance Criteria

1. **Given** a new Dexie schema version is declared
   **When** the database upgrades on app start
   **Then** compound indexes are added for:
   - `studySessions`: `[courseId+startTime]`
   - `reviewRecords`: `[courseId+nextReviewDate]`
   - `flashcards`: `[courseId+nextReviewDate]`
   - `notes`: `[courseId+updatedAt]`
   **And** existing data is preserved (no data loss during migration)

2. **Given** the `studySessions` table contains 2000+ records
   **When** I query for sessions in the last 7 days using the `startTime` index
   **Then** the query completes in under 50ms (measured via `performance.now()`)

3. **Given** the `flashcards` table contains 1000+ records
   **When** I query for due flashcards using `nextReviewDate` index
   **Then** the query completes in under 50ms

4. **Given** the existing Dexie checkpoint test exists
   **When** schema migration tests run
   **Then** the new schema version passes checkpoint comparison (no schema drift)

## Tasks / Subtasks

- [ ] Task 1: Add new Dexie schema version with compound indexes (AC: 1)
  - [ ] 1.1 Add `database.version(30).stores({...})` in `_declareLegacyMigrations()` in `src/db/schema.ts`
  - [ ] 1.2 Declare compound indexes: `studySessions` gets `[courseId+startTime]`, `reviewRecords` gets `[courseId+nextReviewDate]`, `flashcards` gets `[courseId+nextReviewDate]`, `notes` gets `[courseId+updatedAt]`
  - [ ] 1.3 Only list tables that are changing (Dexie merges unchanged tables automatically)
  - [ ] 1.4 No `upgrade()` callback needed — Dexie indexes existing data automatically
- [ ] Task 2: Update checkpoint schema (AC: 4)
  - [ ] 2.1 Update `CHECKPOINT_VERSION` to 30 in `src/db/checkpoint.ts`
  - [ ] 2.2 Update `CHECKPOINT_SCHEMA` to include the new compound indexes
  - [ ] 2.3 Run checkpoint comparison test to verify schema consistency
- [ ] Task 3: Add development-mode query timing (AC: 2, 3)
  - [ ] 3.1 Add `performance.now()` wrapper for high-volume table queries in dev mode
  - [ ] 3.2 Log queries exceeding 50ms to console as warnings
  - [ ] 3.3 Only active when `import.meta.env.DEV` is true
- [ ] Task 4: Verify migration safety (AC: 1, 4)
  - [ ] 4.1 Run existing schema checkpoint test
  - [ ] 4.2 Verify existing E2E tests pass (data integrity preserved)
  - [ ] 4.3 Confirm no data loss by checking table contents after migration

## Dev Notes

### Architecture Decision: AD-5

Add compound indexes via new Dexie schema version for high-volume tables. Dexie handles index additions transparently — existing data is automatically indexed on upgrade. No data migration function needed. [Source: architecture-performance-optimization.md#AD-5]

### Current Schema State

- Current checkpoint version: **29** (in `src/db/checkpoint.ts`)
- New version will be **30**
- Current `studySessions` indexes: `++id, startTime, courseId`
- Current `reviewRecords` indexes: `++id, courseId, nextReviewDate`
- Current `flashcards` indexes: `++id, courseId, nextReviewDate`
- Current `notes` indexes: `++id, courseId`
- The compound indexes ADD to existing indexes, they don't replace them

### Implementation Pattern

```typescript
// In _declareLegacyMigrations(), after the version 29 block:
database.version(30).stores({
  studySessions: '++id, startTime, courseId, [courseId+startTime]',
  reviewRecords: '++id, courseId, nextReviewDate, [courseId+nextReviewDate]',
  flashcards: '++id, courseId, nextReviewDate, [courseId+nextReviewDate]',
  notes: '++id, courseId, [courseId+updatedAt]',
})
```

### Optimized Query Patterns

```typescript
// Before: Full table scan + client filter
const recentSessions = await db.studySessions.toArray()
  .then(all => all.filter(s => s.startTime > weekAgo).sort(...))

// After: Indexed range query
const recentSessions = await db.studySessions
  .where('startTime').above(weekAgo)
  .reverse().limit(100).toArray()
```

### Key Constraints

- **MUST update both** `schema.ts` (legacy migrations) AND `checkpoint.ts` (checkpoint schema)
- **MUST preserve all existing indexes** — compound indexes are additions, not replacements
- **MUST verify** the `notes` table has `updatedAt` field in the type definition (check `src/data/types.ts`)
- Schema checkpoint test in `src/db/__tests__/` must pass — this is the critical regression gate
- No `upgrade()` callback needed for pure index additions

### Project Structure Notes

- **Modified files**: `src/db/schema.ts`, `src/db/checkpoint.ts`
- Schema test: `src/db/__tests__/checkpoint.test.ts` (or similar)
- Type definitions: `src/data/types.ts`

### References

- [Source: _bmad-output/planning-artifacts/architecture-performance-optimization.md#AD-5]
- [Source: _bmad-output/planning-artifacts/prd-performance-optimization.md#FR-7]
- [Source: _bmad-output/planning-artifacts/epics-performance-optimization.md#Story-64.4]

## Dev Agent Record

### Agent Model Used

### Debug Log References

### Completion Notes List

### File List
