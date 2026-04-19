---
story_id: E92-S03
story_name: "Sync Table Registry and Field Mapping"
status: ready-for-dev
started:
completed:
reviewed: false
review_started:
review_gates_passed: []
burn_in_validated: false
---

# Story 92.03: Sync Table Registry and Field Mapping

## Story

As the sync engine (E92-S04 through E92-S09),
I want a single declarative configuration file that describes every syncable Dexie table — including its Supabase table name, conflict strategy, field mappings, fields to strip, monotonic fields, compound PK fields, and Vault credential fields,
so that all sync engine code reads from this registry rather than hardcoding per-table logic.

## Acceptance Criteria

**AC1 — TableRegistryEntry interface exported:** `src/lib/sync/tableRegistry.ts` exports `TableRegistryEntry` interface with exactly these fields:
```ts
export interface TableRegistryEntry {
  dexieTable: string;
  supabaseTable: string;
  conflictStrategy: 'lww' | 'monotonic' | 'insert-only' | 'conflict-copy' | 'skip';
  priority: 0 | 1 | 2 | 3 | 4;
  fieldMap: Record<string, string>;
  stripFields?: string[];
  monotonicFields?: string[];
  compoundPkFields?: string[];
  vaultFields?: string[];
  insertOnly?: boolean;
  skipSync?: boolean;
}
```

**AC2 — All 30+ syncable tables registered:** Every syncable table has a registry entry matching the lists in the epic doc:
- P0: `contentProgress`, `studySessions`, `progress`
- P1: `notes`, `bookmarks`, `flashcards`, `reviewRecords`, `embeddings`, `bookHighlights`, `vocabularyItems`, `audioBookmarks`, `audioClips`, `chatConversations`, `learnerModels`
- P2: `importedCourses`, `importedVideos`, `importedPdfs`, `authors`, `books`, `bookReviews`, `shelves`, `bookShelves`, `readingQueue`, `chapterMappings`
- P3: `learningPaths`, `learningPathEntries`, `challenges`, `courseReminders`, `notifications`, `careerPaths`, `pathEnrollments`, `studySchedules`, `opdsCatalogs`, `audiobookshelfServers`, `notificationPreferences`
- P4: `quizzes`, `quizAttempts`, `aiUsageEvents`

**AC3 — fieldMapper.ts exported:** `src/lib/sync/fieldMapper.ts` exports pure functions `toSnakeCase(entry: TableRegistryEntry, record: Record<string, unknown>): Record<string, unknown>` and `toCamelCase(entry: TableRegistryEntry, record: Record<string, unknown>): Record<string, unknown>`.

**AC4 — Round-trip tests pass:** Unit tests in `src/lib/sync/__tests__/tableRegistry.test.ts` verify that `toCamelCase(entry, toSnakeCase(entry, record))` yields the original record for all tables with non-trivial fieldMaps.

**AC5 — Non-serializable fields declared:** `stripFields` correctly lists non-serializable browser handle fields:
- `importedCourses`: `['directoryHandle', 'coverImageHandle']`
- `importedVideos`: `['fileHandle']`
- `importedPdfs`: `['fileHandle']`
- `authors`: `['photoHandle']`

**AC6 — Vault fields declared:** `vaultFields` correctly lists credential fields that must NEVER appear in Postgres rows:
- `opdsCatalogs`: `['password']`
- `audiobookshelfServers`: `['apiKey']`

**AC7 — Monotonic fields correct:**
- `progress` (video_progress): `monotonicFields: ['watchedSeconds']`
- `books`: `monotonicFields: ['progress']`
- `challenges`: `monotonicFields: ['currentProgress']`
- `vocabularyItems`: `monotonicFields: ['masteryLevel']`

**AC8 — Conflict strategies correct:**
- `aiUsageEvents`: `conflictStrategy: 'insert-only'`
- `quizAttempts`: `conflictStrategy: 'insert-only'`
- `contentProgress`: `conflictStrategy: 'monotonic'`
- `progress`, `books`, `vocabularyItems`, `challenges`: `conflictStrategy: 'monotonic'`
- All others: `conflictStrategy: 'lww'`

**AC9 — Compound PK fields declared:** `chapterMappings` has `compoundPkFields: ['epubBookId', 'audioBookId']`.

**AC10 — skipSync field exists:** Every entry has `skipSync?: boolean` in the interface; `skipSync` may be `undefined` (falsy). Registry compiles without errors.

**AC11 — backfill.ts SYNCABLE_TABLES updated:** The `SYNCABLE_TABLES` constant in `src/lib/sync/backfill.ts` should replace its inline literal with `Object.keys(tableRegistry)` (or equivalent import) so there is a single source of truth. (If this would risk destabilizing E92-S02 tests, keep as a TODO comment — confirm with Pedro.)

**AC12 — No app-layer imports:** `tableRegistry.ts` and `fieldMapper.ts` are pure — no Dexie imports, no Zustand imports, no React imports.

## Tasks / Subtasks

- [ ] Task 1: Create `src/lib/sync/tableRegistry.ts` (AC: 1, 2, 5, 6, 7, 8, 9, 10, 12)
  - [ ] 1.1 Export `TableRegistryEntry` interface with all required fields (match epic spec exactly)
  - [ ] 1.2 Create P0 entries: `contentProgress` (monotonic, compoundPk [courseId, itemId]), `studySessions` (insert-only), `progress` (monotonic, monotonicFields: watchedSeconds, maps to video_progress)
  - [ ] 1.3 Create P1 entries: `notes`, `bookmarks`, `flashcards`, `reviewRecords`, `embeddings`, `bookHighlights` (lww), `vocabularyItems` (monotonic, masteryLevel), `audioBookmarks`, `audioClips`, `chatConversations`, `learnerModels` (lww)
  - [ ] 1.4 Create P2 entries: `importedCourses` (lww, stripFields: directoryHandle+coverImageHandle), `importedVideos` (lww, stripFields: fileHandle), `importedPdfs` (lww, stripFields: fileHandle), `authors` (lww, stripFields: photoHandle), `books` (monotonic, monotonicFields: progress), `bookReviews`, `shelves`, `bookShelves`, `readingQueue`, `chapterMappings` (compoundPk)
  - [ ] 1.5 Create P3 entries: `learningPaths`, `learningPathEntries`, `challenges` (monotonic, monotonicFields: currentProgress), `courseReminders`, `notifications`, `careerPaths`, `pathEnrollments`, `studySchedules`, `opdsCatalogs` (vaultFields: password), `audiobookshelfServers` (vaultFields: apiKey), `notificationPreferences`
  - [ ] 1.6 Create P4 entries: `quizzes`, `quizAttempts` (insert-only), `aiUsageEvents` (insert-only)
  - [ ] 1.7 Export a `tableRegistry: TableRegistryEntry[]` array (or `Record<string, TableRegistryEntry>` — pick array if ordering by priority matters)
  - [ ] 1.8 Add JSDoc comments explaining priority tiers and each strategy
- [ ] Task 2: Create `src/lib/sync/fieldMapper.ts` (AC: 3, 12)
  - [ ] 2.1 `toSnakeCase(entry, record)` — applies `fieldMap` overrides; converts remaining camelCase keys to snake_case as the default
  - [ ] 2.2 `toCamelCase(entry, record)` — inverse: applies reverse of `fieldMap`; converts remaining snake_case keys to camelCase
  - [ ] 2.3 Handle `stripFields` in `toSnakeCase` — strip listed fields before returning
  - [ ] 2.4 Handle `vaultFields` in `toSnakeCase` — strip vault fields before returning (must never reach Postgres)
  - [ ] 2.5 Export both functions; no Dexie imports
- [ ] Task 3: Create `src/lib/sync/__tests__/tableRegistry.test.ts` (AC: 2, 4, 5, 6, 7, 8, 9, 10)
  - [ ] 3.1 Test every P0 table is registered with `priority: 0`
  - [ ] 3.2 Test `aiUsageEvents` has `conflictStrategy: 'insert-only'`
  - [ ] 3.3 Test `progress` maps to Supabase table `video_progress`
  - [ ] 3.4 Test `chapterMappings` has `compoundPkFields: ['epubBookId', 'audioBookId']`
  - [ ] 3.5 Test `opdsCatalogs.vaultFields` contains `'password'`
  - [ ] 3.6 Test `audiobookshelfServers.vaultFields` contains `'apiKey'`
  - [ ] 3.7 Test `importedCourses.stripFields` contains `'directoryHandle'` and `'coverImageHandle'`
  - [ ] 3.8 Test `vocabularyItems.monotonicFields` contains `'masteryLevel'`
  - [ ] 3.9 Round-trip test: `toCamelCase(entry, toSnakeCase(entry, record))` === original for tables with non-trivial fieldMap
  - [ ] 3.10 Test `stripFields` items are absent from `toSnakeCase()` output
  - [ ] 3.11 Test `vaultFields` items are absent from `toSnakeCase()` output
  - [ ] 3.12 Test all 38 tables are present in the registry (count assertion)
  - [ ] 3.13 Test `skipSync` field exists on `TableRegistryEntry` interface (TypeScript check via assignability)
- [ ] Task 4: Update `src/lib/sync/backfill.ts` to use registry (AC: 11)
  - [ ] 4.1 Import `tableRegistry` and replace inline `SYNCABLE_TABLES` array with `tableRegistry.map(e => e.dexieTable)` (or `Object.keys(tableRegistry)` if keyed by table name)
  - [ ] 4.2 Keep the `SYNCABLE_TABLES` export for backward compatibility with existing tests, but derive it from the registry
  - [ ] 4.3 Verify existing backfill tests still pass after this change
- [ ] Task 5: Verification
  - [ ] 5.1 `npm run test:unit` — all tests pass (pre-existing failures from `main` are allowed if they existed before this story)
  - [ ] 5.2 `npx tsc --noEmit` — zero TypeScript errors
  - [ ] 5.3 `npm run lint` — zero errors
  - [ ] 5.4 `npm run build` — clean

## Design Guidance

No UI components. This is a pure TypeScript infrastructure story.

## Implementation Notes

### File Location Decision

The epic spec calls for `src/lib/sync/tableRegistry.ts` (inside `sync/`). The reverted E92-S03 PR placed it at `src/db/tableRegistry.ts`. Use `src/lib/sync/tableRegistry.ts` to match the epic spec and keep all sync concerns co-located in `src/lib/sync/`.

The existing `src/lib/sync/` directory currently contains:
- `backfill.ts` — created in E92-S02
- `__tests__/backfill.test.ts`

### Interface Shape — Match Epic Spec Exactly

The epic spec names the interface `TableRegistryEntry` (not `SyncTableConfig`). Use the exact field names from the spec:
- `priority` (not `priorityTier`)
- `stripFields` (not `nonSerializableFields`)
- `fieldMap` (camelCase → snake_case)

### fieldMap Convention

Only list **non-obvious** mappings in `fieldMap`. The `fieldMapper.ts` default behavior should auto-convert camelCase to snake_case (e.g., `courseId → course_id`). Use `fieldMap` only for exceptions:
- `progress.dexieTable: 'progress'` → `supabaseTable: 'video_progress'` (completely different name)
- `chatConversations`: `createdAt → created_at_epoch` (bigint storage, not timestamptz)
- `notes`: `deleted → soft_deleted` (rename for Supabase column)

For most tables, `fieldMap` will be `{}` (empty — defaults handle it).

### camelCase ↔ snake_case Conversion

The `fieldMapper.ts` default conversion can use a simple regex: `s.replace(/([A-Z])/g, '_$1').toLowerCase()`. No external library needed — this is a pure function on keys.

Do NOT convert values — only convert key names.

### stripFields vs vaultFields

Both cause fields to be omitted from the Supabase upload payload, but for different reasons:
- `stripFields` — non-serializable browser APIs (`FileSystemDirectoryHandle`, `FileSystemFileHandle`). These cannot be JSON-serialized at all.
- `vaultFields` — sensitive credentials. These COULD be serialized but MUST NOT appear in Postgres rows. They are routed to Supabase Vault separately (E95-S02).

Both should be stripped in `toSnakeCase()`.

### Monotonic Fields for `progress` Table

The `progress` Dexie table maps to `video_progress` in Supabase. The monotonic field from the epic spec is `watchedSeconds` — confirm this field name matches the `VideoProgress` type in `src/db/schema.ts`.

### Known Pre-Existing Issue (From E92-S02 Code Review)

R1-PE-01: `progress` table is declared as `EntityTable<VideoProgress, 'courseId'>` in the schema but its actual PK is compound `[courseId+videoId]`. If this is still unfixed when E92-S03 lands, document it in Challenges section and note it for E92-S04. Do NOT fix it as part of this story.

### Priority Tier Remapping vs Epic

The epic doc lists tables by priority as follows — match exactly:
- P0: `contentProgress`, `studySessions`, `progress`
- P1: `notes`, `bookmarks`, `flashcards`, `reviewRecords`, `embeddings`, `bookHighlights`, `vocabularyItems`, `audioBookmarks`, `audioClips`, `chatConversations`, `learnerModels`
- P2: `importedCourses`, `importedVideos`, `importedPdfs`, `authors`, `books`, `bookReviews`, `shelves`, `bookShelves`, `readingQueue`, `chapterMappings`
- P3: `learningPaths`, `learningPathEntries`, `challenges`, `courseReminders`, `notifications`, `careerPaths`, `pathEnrollments`, `studySchedules`, `opdsCatalogs`, `audiobookshelfServers`, `notificationPreferences`
- P4: `quizzes`, `quizAttempts`, `aiUsageEvents`

NOTE: The reverted E92-S03 PR placed `importedCourses`/`importedVideos`/`importedPdfs` at P3. The epic spec says P2. Follow the epic spec.

### flashcard_reviews is Supabase-Only

Per the epic doc: "`flashcard_reviews` is a Supabase-only INSERT-only table (no Dexie equivalent) — created in E93-S01". Do NOT include it in the table registry. It has no Dexie table to sync from. This is noted in AC2 and AC8.

### reviewRecords vs flashcard_reviews

`reviewRecords` IS a Dexie table (stores derived FSRS state) and DOES go in the registry (P1, lww). However, note in a JSDoc comment that `reviewRecords` local state is NOT synced to Supabase's `flashcard_reviews` directly — see E93-S04 for the FSRS replay mechanism.

### Array vs Record Shape

For `tableRegistry`, prefer `TableRegistryEntry[]` (array) over `Record<string, TableRegistryEntry>` because:
1. Order matters for priority-based upload (E92-S05 will iterate in priority order)
2. Easier to assert count in tests
3. The array can still be looked up by building a `Map` when needed

Export both: the array as `tableRegistry` and a helper `getTableEntry(dexieTable: string): TableRegistryEntry | undefined`.

### Backfill Integration (Task 4)

`src/lib/sync/backfill.ts` currently has a `SYNCABLE_TABLES` constant with an inline 38-element array and a `// TODO(E92-S03)` comment pointing here. Replace it with:
```ts
import { tableRegistry } from './tableRegistry'
export const SYNCABLE_TABLES = tableRegistry.map(e => e.dexieTable)
```
This achieves single-source-of-truth. The existing `SYNCABLE_TABLES` export is consumed by `backfill.test.ts` — keep it exported but now derived from the registry.

## Testing Notes

### Test Strategy

- Vitest unit tests only — no IndexedDB, no DOM needed
- Pure object assertions on exported registry data
- Round-trip field mapping tests use simple sample records

### Key Test Cases

```ts
// All tables present
expect(tableRegistry).toHaveLength(38)

// P0 priority check
const contentProgress = tableRegistry.find(e => e.dexieTable === 'contentProgress')
expect(contentProgress?.priority).toBe(0)

// progress → video_progress Supabase mapping
const progress = tableRegistry.find(e => e.dexieTable === 'progress')
expect(progress?.supabaseTable).toBe('video_progress')

// Vault fields never in Postgres
const opds = tableRegistry.find(e => e.dexieTable === 'opdsCatalogs')
expect(opds?.vaultFields).toContain('password')

// stripFields: non-serializable handles
const courses = tableRegistry.find(e => e.dexieTable === 'importedCourses')
expect(courses?.stripFields).toContain('directoryHandle')
expect(courses?.stripFields).toContain('coverImageHandle')

// Round-trip field mapping
const entry = tableRegistry.find(e => e.dexieTable === 'chatConversations')!
const sample = { id: 'abc', courseId: '123', createdAt: 1700000000000 }
const snaked = toSnakeCase(entry, sample)
expect(snaked.created_at_epoch).toBe(1700000000000)
expect(snaked).not.toHaveProperty('createdAt')
const camelized = toCamelCase(entry, snaked)
expect(camelized.createdAt).toBe(1700000000000)
```

### Regression Guard

After Task 4, re-run the full backfill test suite to ensure `SYNCABLE_TABLES` derived from registry still matches the 38-table set. The test count assertions will catch any drift.

## Pre-Review Checklist

Before requesting `/review-story`, verify:

- [ ] All changes committed (`git status` clean)
- [ ] No error swallowing — no async code in this story; `fieldMapper.ts` and `tableRegistry.ts` are pure sync functions
- [ ] `tsc --noEmit`: runs clean (zero TypeScript errors) before submission
- [ ] `tableRegistry` has exactly 38 entries (verify with `tableRegistry.length` in tests)
- [ ] `stripFields` and `vaultFields` are both stripped by `toSnakeCase()` — confirmed by unit tests
- [ ] `progress` Dexie table maps to `video_progress` Supabase table (non-obvious — easy to miss)
- [ ] `flashcard_reviews` is NOT in the registry (Supabase-only table, no Dexie equivalent)
- [ ] `chatConversations` has `createdAt → created_at_epoch` in fieldMap (epoch bigint, not timestamptz)
- [ ] `notes` has `deleted → soft_deleted` in fieldMap
- [ ] `backfill.ts` SYNCABLE_TABLES still exports correctly and all backfill tests pass
- [ ] No imports from app layer (`@/stores/`, `@/app/`, `@/db`) in `tableRegistry.ts` or `fieldMapper.ts`
- [ ] Read [engineering-patterns.md](../engineering-patterns.md) for full patterns reference

## Design Review Feedback

N/A — no UI components in this story.

## Code Review Feedback

[Populated by /review-story — adversarial code review findings]

## Challenges and Lessons Learned

**Prior revert context:** E92-S03 was previously implemented and reverted (PR #341, commit 2056841a). The revert reason is unknown from git history — likely a scope or interface mismatch. Key differences to address in this implementation:

1. **File location:** Previous implementation placed registry at `src/db/tableRegistry.ts`. This implementation uses `src/lib/sync/tableRegistry.ts` per the epic spec.
2. **Interface name:** Previous implementation exported `SyncTableConfig`. Epic spec requires `TableRegistryEntry`.
3. **Field names:** Previous implementation used `nonSerializableFields`. Epic spec requires `stripFields`.
4. **Priority field:** Previous implementation used `priorityTier`. Epic spec requires `priority`.
5. **fieldMapper.ts:** Previous implementation omitted `fieldMapper.ts`. Epic spec requires it as a separate file.
6. **P2 placement:** Previous implementation placed `importedCourses`/`importedVideos`/`importedPdfs` at P3. Epic spec requires P2.
7. **books stripFields:** Previous implementation used `['directoryHandle', 'fileHandle', 'coverBlob']`. Epic spec lists `authors` (not books) as having `photoHandle`. Books has `directoryHandle`/`fileHandle` — confirm exact fields against the `ImportedCourse` and `Book` type definitions.
