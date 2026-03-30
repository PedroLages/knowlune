---
story_id: E32-S05
story_name: "Create Dexie Migration Checkpoint at v27"
status: ready-for-dev
started: 2026-03-27
completed:
reviewed: false
review_started:
review_gates_passed: []
burn_in_validated: false
---

# Story 32.5: Create Dexie Migration Checkpoint at v27

## Story

As a new user installing Knowlune,
I want the database to initialize quickly,
So that I don't wait for 27+ migrations to replay on first load.

## Acceptance Criteria

**Given** a brand new user (no existing IndexedDB for ElearningDB)
**When** the app initializes Dexie
**Then** the database is created at the v27 checkpoint schema directly
**And** no intermediate `upgrade()` functions from v1-v26 are executed
**And** the final schema (indexes, tables, compound keys) matches the result of running all 27 migrations sequentially

**Given** an existing user at schema version 20
**When** the app initializes Dexie
**Then** migrations v21-v27 run normally (incremental upgrade)
**And** the checkpoint does not affect existing users
**And** data is preserved through the upgrade

**Given** an existing user at schema version 27 (already current)
**When** the app initializes Dexie
**Then** no migrations run
**And** behavior is unchanged (no regression)

**Given** the checkpoint schema definition
**When** compared to the sequential migration result in an automated test
**Then** the table names are identical
**And** the index definitions for each table are identical
**And** the test fails if a future migration is added without updating the checkpoint

**Given** a future developer adds migration v28
**When** they run the test suite
**Then** the checkpoint verification test fails with a clear message: "Checkpoint at v27 is outdated. Update CHECKPOINT_SCHEMA or bump CHECKPOINT_VERSION."
**And** the developer knows to update the checkpoint

## Tasks / Subtasks

### Task 1: Extract v27 full schema snapshot
- [ ] Manually read through all 27 versions in `src/db/schema.ts` and compile the cumulative schema
- [ ] Create `src/db/checkpoint.ts` with `CHECKPOINT_VERSION = 27` and `CHECKPOINT_SCHEMA` object
- [ ] Schema object maps table names to their full index definitions (matching Dexie `.stores()` format)
- [ ] Include all tables: importedCourses, importedVideos, importedPdfs, progress, bookmarks, notes, screenshots, studySessions, contentProgress, challenges, embeddings, learningPaths, learningPathEntries, courseThumbnails, aiUsageEvents, reviewRecords, courseReminders, courses, quizzes, quizAttempts, videoCaptions, flashcards, authors, careerPaths, pathEnrollments, entitlements, youtubeVideoCache, youtubeTranscripts, youtubeChapters
- [ ] Double-check compound keys: `[courseId+videoId]`, `[courseId+itemId]`, etc.

### Task 2: Implement conditional migration logic
- [ ] In `src/db/schema.ts`, detect fresh install vs existing DB before defining versions
- [ ] Fresh install detection: use `Dexie.exists('ElearningDB')` (async check)
- [ ] For fresh installs: register only `db.version(27).stores(CHECKPOINT_SCHEMA)` — skip all upgrade() functions
- [ ] For existing installs: register all versions as currently done (unchanged behavior)
- [ ] Ensure Dexie's version management handles this correctly (Dexie requires all versions to be declared for upgrade paths)

### Task 3: Handle Dexie version declaration constraints
- [ ] Research Dexie's requirement around version declarations — Dexie may require ALL versions to be declared even if upgrade() is skipped
- [ ] If Dexie requires all versions: keep all `.stores()` declarations but conditionally skip `.upgrade()` callbacks for fresh installs
- [ ] Alternative approach: use two separate Dexie initialization paths (factory pattern)
- [ ] Document chosen approach and rationale

### Task 4: Create checkpoint verification test
- [ ] Create `tests/unit/dexie-checkpoint.test.ts`
- [ ] Test 1 — Schema equivalence: Create DB via sequential migrations (v1-v27), create DB via checkpoint, compare table names and indexes
- [ ] Test 2 — Freshness guard: Assert `CHECKPOINT_VERSION` matches the highest version number in `schema.ts`; fail if a v28+ exists without checkpoint update
- [ ] Test 3 — All tables present: Assert checkpoint has every table that the sequential path produces
- [ ] Use `fake-indexeddb` for in-memory Dexie instances in tests

### Task 5: Performance measurement
- [ ] Measure cold-start DB initialization time with sequential migrations (all 27)
- [ ] Measure cold-start DB initialization time with checkpoint
- [ ] Log timing: `console.debug('DB init: Xms (checkpoint)' | 'DB init: Xms (sequential)')`
- [ ] Expected improvement: 50-80% faster for fresh installs (fewer transactions, no upgrade() callbacks)

### Task 6: Add migration path documentation
- [ ] Add inline comments in `checkpoint.ts` explaining the checkpoint pattern
- [ ] Document in code: "When adding v28+, update CHECKPOINT_VERSION and CHECKPOINT_SCHEMA"
- [ ] Add to engineering-patterns.md: Dexie migration checkpoint pattern

## Implementation Notes

### Architecture

Dexie requires all version declarations to exist for the upgrade path to work. The key design decision is how to handle this constraint:

**Approach A — Conditional upgrade() callbacks (recommended)**:
```typescript
const isFreshInstall = !(await Dexie.exists('ElearningDB'))

// Always declare all versions for Dexie's schema diffing
db.version(1).stores({ ... })
db.version(2).stores({ ... })
// ...but only attach upgrade() when NOT a fresh install
if (!isFreshInstall) {
  db.version(2).upgrade(tx => { ... })
  db.version(4).upgrade(tx => { ... })
  // etc.
}
db.version(27).stores({ ... })
```
This works because Dexie uses `.stores()` declarations for schema diffing (to know which indexes to add/remove), but `upgrade()` callbacks are optional data migration logic. Fresh installs jump from v0 to v27 — Dexie creates all tables/indexes in one shot, and no `upgrade()` callbacks fire because no data exists to migrate.

**Approach B — Dual initialization (alternative)**:
Create two Dexie instances: one for fresh installs (single v27 declaration) and one for existing users (all versions). More isolated but requires careful singleton management.

**Recommended: Approach A** — simpler, no singleton complexity, Dexie handles it natively.

### Key Files
- `src/db/schema.ts` — modify to conditionally attach upgrade() callbacks
- `src/db/checkpoint.ts` — new file with CHECKPOINT_VERSION and CHECKPOINT_SCHEMA
- `tests/unit/dexie-checkpoint.test.ts` — new verification test

### Current Schema Tables (v27)
Based on `schema.ts`, the v27 schema includes 29 tables:
`importedCourses`, `importedVideos`, `importedPdfs`, `progress`, `bookmarks`, `notes`, `screenshots`, `studySessions`, `contentProgress`, `challenges`, `embeddings`, `learningPaths`, `learningPathEntries`, `courseThumbnails`, `aiUsageEvents`, `reviewRecords`, `courseReminders`, `courses`, `quizzes`, `quizAttempts`, `videoCaptions`, `flashcards`, `authors`, `careerPaths`, `pathEnrollments`, `entitlements`, `youtubeVideoCache`, `youtubeTranscripts`, `youtubeChapters`

### Dexie Initialization Timing
- `Dexie.exists()` is async — must be awaited before `db.open()`
- Current code likely calls `db.open()` implicitly on first access
- May need to restructure init: `await initializeDb()` called once at app startup before any store access

### Risks
- **Schema drift**: If the checkpoint schema diverges from sequential migration result, fresh installs get a different DB than upgraded installs. The verification test mitigates this.
- **Dexie.exists() race**: If two tabs open simultaneously on fresh install, both may detect "no DB" and try to create. Dexie handles this internally (IndexedDB transactions are atomic).
- **Future migrations**: Developers must remember to update the checkpoint. The freshness guard test enforces this.

## Testing Notes

### Unit Tests (`tests/unit/dexie-checkpoint.test.ts`)

- **Schema equivalence test**:
  1. Create `db1` with all sequential versions (v1-v27 with all upgrade callbacks)
  2. Create `db2` with checkpoint only (v27 stores, no upgrade callbacks)
  3. Compare `db1.tables.map(t => t.name).sort()` vs `db2.tables.map(t => t.name).sort()`
  4. For each table, compare `table.schema.indexes` between both DBs
  5. Assert they are identical

- **Freshness guard test**:
  1. Parse `schema.ts` for highest `db.version(N)` call
  2. Assert `N === CHECKPOINT_VERSION`
  3. If N > CHECKPOINT_VERSION, fail with actionable message

- **Existing user upgrade test**:
  1. Create DB at v20 with sample data
  2. Run migrations v21-v27
  3. Verify data survived upgrade
  4. Verify schema matches checkpoint

- **Fresh install performance test**:
  1. Measure time to create DB with sequential migrations
  2. Measure time to create DB with checkpoint
  3. Assert checkpoint is faster (or at minimum, not slower)

### Tools
- `fake-indexeddb` — in-memory IndexedDB for unit tests
- `Dexie` — same version as production

### Manual Verification
- Clear IndexedDB in browser DevTools
- Load app, verify DB created successfully
- Inspect DB in DevTools > Application > IndexedDB > ElearningDB
- Verify all tables and indexes present

## Pre-Review Checklist
Before requesting `/review-story`, verify:
- [ ] All changes committed (`git status` clean)
- [ ] No error swallowing — catch blocks log AND surface errors
- [ ] useEffect hooks have cleanup functions
- [ ] No optimistic UI updates before persistence
- [ ] Type guards on all dynamic lookups
- [ ] E2E afterEach cleanup uses `await`
- [ ] Read [engineering-patterns.md](../engineering-patterns.md) for full patterns reference

## Design Review Feedback
[Populated by /review-story]

## Code Review Feedback
[Populated by /review-story]

## Challenges and Lessons Learned
[Document during implementation]
