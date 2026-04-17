---
title: 'feat: E92-S03 — Sync Table Registry and Field Mapping'
type: feat
status: active
date: 2026-04-17
origin: docs/planning-artifacts/epics-supabase-data-sync.md
---

# feat: E92-S03 — Sync Table Registry and Field Mapping

## Overview

A single declarative configuration module (`tableRegistry.ts`) that describes every syncable Dexie table: its Supabase counterpart, conflict strategy, camelCase↔snake_case field map, non-serializable fields to strip, monotonic fields, compound PK fields, and Vault credential fields. A companion `fieldMapper.ts` module exposes two pure functions — `toSnakeCase(entry, record)` and `toCamelCase(entry, record)` — that all downstream sync code will use to translate between local and server representations.

No sync logic ships here. No engine, no writer, no stores rewired. This story only produces the declarative registry + pure mapper functions + round-trip unit tests that every subsequent E92 story will depend on.

### Parallelization Answer (user's direct question)

E92-S03 **cannot run in parallel with E92-S04, S05, S06, or S09**, because all four read from this registry. However, S03 itself **is independent** of all other in-flight sync work — it depends only on completed stories (E92-S01, E92-S02). It can be developed today while E93 migration work (E93-S01) is brainstormed or scaffolded in parallel, but within E92 the sequence is **S03 → S04 → S05 → S06 → S07 → S08 → S09**, with S03 as a strict prerequisite for S04, S05, S06, and S09.

Cross-epic: E93-S01 / E94-S01 Supabase migrations do not read the Dexie registry and may be prepared in parallel with S03 at the user's discretion. Within E92, sequence S03 first.

## Problem Frame

E92-S02 (done) created the Dexie v52 schema with `userId + updatedAt` indexes on every syncable table and added `syncQueue` / `syncMetadata` skeletons. What's missing is the **map between those local tables and their Supabase counterparts**: which local table maps to which Postgres table, which field names camelCase ↔ snake_case, which fields must be stripped because they are IndexedDB object references (`directoryHandle`, `fileHandle`, etc.), which fields are monotonic (never decrease), and which fields belong in Supabase Vault instead of a regular row.

Without this registry, the upload wrapper (S04) has nowhere to look up per-table rules, the upload engine (S05) cannot pick a conflict strategy, the download engine (S06) cannot apply LWW vs. monotonic merge, and store rewiring (S09) has no schema to trust.

Centralizing this in one declarative file (rather than scattering `if (table === 'progress') { ... }` across the engine) keeps the sync code **data-driven**: add a new table later by adding one registry entry, not by editing every engine phase.

## Requirements Trace

- R1. `TableRegistryEntry` interface exposes: `dexieTable`, `supabaseTable`, `conflictStrategy`, `priority` (0–4), `fieldMap`, `stripFields?`, `monotonicFields?`, `compoundPkFields?`, `vaultFields?`, `insertOnly?`, `skipSync?` (origin: E92-S03 Key Deliverables)
- R2. Registry includes an entry for every syncable Dexie table — the exact set declared in `CHECKPOINT_SCHEMA` with a `[userId+updatedAt]` compound index. Tables without that index (e.g., `videoCaptions`, `courseThumbnails`, `bookFiles`, `transcriptEmbeddings`, `courseEmbeddings`, `screenshots`, `entitlements`, `youtubeChapters`, `youtubeVideoCache`, `youtubeTranscripts`) are intentionally **excluded** from the registry.
- R3. Priority grouping matches origin doc:
  - **P0** (3 entries): `contentProgress`, `studySessions`, `progress` (Dexie) → `video_progress` (Supabase)
  - **P1** (≈13 entries): `notes`, `bookmarks`, `flashcards`, `reviewRecords`, `embeddings`, `bookHighlights`, `vocabularyItems`, `audioBookmarks`, `audioClips`, `chatConversations`, `learnerModels`
  - **P2** (≈10 entries): `importedCourses`, `importedVideos`, `importedPdfs`, `authors`, `books`, `bookReviews`, `shelves`, `bookShelves`, `readingQueue`, `chapterMappings`
  - **P3** (≈11 entries): `learningPaths`, `learningPathEntries`, `challenges`, `courseReminders`, `notifications`, `careerPaths`, `pathEnrollments`, `studySchedules`, `opdsCatalogs`, `audiobookshelfServers`, `notificationPreferences`
  - **P4** (3 entries): `quizzes`, `quizAttempts`, `aiUsageEvents`
- R4. Non-serializable fields flagged under `stripFields`: `directoryHandle` (importedCourses), `fileHandle` / `coverImageHandle` (importedPdfs / importedVideos / books — whichever actually hold them), `photoHandle` (authors)
- R5. Vault fields flagged under `vaultFields`: `password` on `opdsCatalogs`, `apiKey` on `audiobookshelfServers`
- R6. Monotonic fields flagged under `monotonicFields`: `progress.watchedSeconds` (mapped to `video_progress.watched_seconds`), `books.progress`, `challenges.currentProgress`, `vocabularyItems.masteryLevel`
- R7. `aiUsageEvents` has `conflictStrategy: 'insert-only'`; `studySessions` has `conflictStrategy: 'insert-only'` (append-only historical record per E92-S09 acceptance criteria)
- R8. `flashcard_reviews` is **NOT** a Dexie table and therefore has **no** registry entry. It's a Supabase-only INSERT-only sink written from local `reviewRecords` during upload. This is an explicit non-goal of S03 (surfaced as a code comment near `reviewRecords`).
- R9. `fieldMapper.ts` exposes two pure functions:
  - `toSnakeCase(entry: TableRegistryEntry, record: Record<string, unknown>): Record<string, unknown>` — applies `entry.fieldMap`, drops any keys in `entry.stripFields`, drops any keys in `entry.vaultFields` from the row payload
  - `toCamelCase(entry: TableRegistryEntry, record: Record<string, unknown>): Record<string, unknown>` — inverse map (inverting `entry.fieldMap`)
- R10. Round-trip test: for each registry entry, a fixture record passes `toSnakeCase → toCamelCase` and equals the original minus `stripFields`/`vaultFields` (which legitimately disappear)
- R11. `skipSync` flag exists on the interface (populated later in E96-S04); registry compiles without any `skipSync: true` entries in this story
- R12. TypeScript type for the registry is `Readonly<Record<string, TableRegistryEntry>>` keyed by `dexieTable` name — allows `registry[tableName]` lookup with compile-time narrowing

## Scope Boundaries

- **Declarative config + pure mappers only.** No runtime integration with Dexie, Supabase, or any store.
- **No `syncableWrite` wrapper** (that's E92-S04).
- **No upload or download engine** (E92-S05/S06).
- **No store rewiring** (E92-S09).
- **No FSRS replay, no conflict-copy logic, no Vault writes** — those are implementation details of later stories. The registry just **labels** which fields those later stories will special-case.
- **No new Dexie tables or Supabase tables.** The registry references tables that already exist post-E92-S01 / E92-S02.
- **No runtime validation that the Supabase table actually exists.** The registry is a compile-time contract; E93–E96 migrations catch the production side.

### Deferred to Separate Tasks

- `syncableWrite()` and `deviceIdentity.ts`: E92-S04
- Upload engine (batching, retry, dead-letter): E92-S05
- Download engine (LWW, monotonic apply, conflict-copy): E92-S06
- Sync triggers and offline state: E92-S07
- Auth lifecycle integration: E92-S08
- P0 store rewiring: E92-S09
- Populating `skipSync: true` entries (the `youtubeChapters` / transient-cache reassessment): E96-S04

## Context & Research

### Relevant Code and Patterns

- [src/db/schema.ts](../../src/db/schema.ts) — canonical list of Dexie tables and their field-bearing indexes. Field names in the registry must match what the stores actually write (not the schema string, which only shows indexed fields).
- [src/db/checkpoint.ts](../../src/db/checkpoint.ts) — the authoritative post-v52 schema. Every table with `[userId+updatedAt]` in its index string is a registry candidate; every table without it is explicitly excluded.
- [src/lib/sync/backfill.ts](../../src/lib/sync/backfill.ts) — already uses a hardcoded list of syncable table names. E92-S03 should **reuse or replace** this list via the registry so the two sources cannot drift. Concrete plan: refactor `backfill.ts` to derive its table list from `Object.keys(tableRegistry)` in this story.
- [src/stores/](../../src/stores/) — each store's TypeScript record type is the source of truth for field names on the Dexie side. The registry field-map keys must be real property names on these types.
- [supabase/migrations/20260413000001_p0_sync_foundation.sql](../../supabase/migrations/20260413000001_p0_sync_foundation.sql) — canonical source for P0 Supabase column names. Registry field values (snake_case) must match this file exactly for P0 tables.
- [src/types/](../../src/types/) — shared record types (e.g., `Note`, `Flashcard`, `Book`) that define camelCase field names referenced in the field map.

### Institutional Learnings

- **Registry-as-single-source-of-truth beats scattered conditionals.** The E89 unified-course migration originally had `if (contentType === 'pdf')` branches in five different stores; consolidating into a content-type map eliminated three subsequent bugs where only four of the five places got updated. Apply the same discipline here: every `if (tableName === ...)` in future sync code is a smell; look up in the registry instead.
- **Avoid "stringly-typed" lookups.** Keep the registry typed as `Readonly<Record<TableName, TableRegistryEntry>>` where `TableName` is a string literal union derived from registry keys. Downstream code gets `keyof typeof tableRegistry` narrowing for free. (Pattern used successfully in `src/lib/ai/providers/registry.ts`.)
- **Test each entry as it's added, not in a single mega-test.** Round-trip each table with one fixture record; it's fast, diff-friendly when a field map is wrong, and catches typos at PR time instead of at upload time.

### External References

- Supabase JS client field-name conventions: Supabase exposes Postgres columns verbatim, so the registry's snake_case values are literal column names (no implicit camelCase-to-snake translation on the JS side).
- PostgREST requires snake_case column names for `.select()`, `.upsert()`, and RPC payloads. This is why the mapper must run **before** every Supabase call.

## Key Technical Decisions

- **Registry lives at `src/lib/sync/tableRegistry.ts`** (not `src/lib/db/`). Rationale: `src/lib/sync/` already exists with `backfill.ts`; it's the natural home for sync-only concerns. `src/lib/db/` would pull the registry into migration-only code paths unnecessarily.
- **`fieldMap` is camelCase → snake_case only.** The inverse map is computed once at module load (or cached on first call) inside `toCamelCase()`. Rationale: halves the maintenance burden; impossible for the two directions to drift.
- **Omit identity fields from `fieldMap`.** Fields like `id`, `userId`, `createdAt`, `updatedAt` appear as `user_id`, `created_at`, `updated_at` on the Supabase side but follow a universal rule. The mapper handles these via a shared `IDENTITY_FIELD_MAP` constant applied to every table (DRY), so individual registry entries don't repeat them.
- **Identity fields are merged, not replaced.** The mapper merges `IDENTITY_FIELD_MAP` with `entry.fieldMap` when translating. A per-table override in `fieldMap` takes precedence only if explicitly present (intentional override; not expected in practice).
- **`conflictStrategy` is a discriminated union, not a boolean flag.** Five values: `'lww' | 'monotonic' | 'insert-only' | 'conflict-copy' | 'skip'`. Rationale: future stories can exhaustively switch on it (`never` check at compile time); adding a strategy is a typed change.
- **`insertOnly` and `skipSync` remain as separate booleans.** They're secondary signals (e.g., `insertOnly` is redundant with `conflictStrategy: 'insert-only'` but useful for test filters). Rationale: origin doc declares both shapes; keep them to match the interface contract.
- **No runtime registry validation.** The interface is enforced at compile time via TypeScript. Adding a `validateRegistry()` that walks entries at boot is YAGNI — if the interface compiles, it's correct shape; if a field name is misspelled, the round-trip test catches it.
- **Priority is `0 | 1 | 2 | 3 | 4` literal type**, not `number`. Rationale: download phase (E92-S06) will iterate tables by priority; a literal type lets us group-by without off-by-one risk.

## Open Questions

### Resolved During Planning

- **Q: Should `reviewRecords` be in the registry if `flashcard_reviews` is Supabase-only?**
  - Resolution: Yes, `reviewRecords` stays in the registry with `conflictStrategy: 'skip'` (local-only; never uploaded as `reviewRecords`). Its upload path is special-cased in E92-S05 to **transform** into `flashcard_reviews` INSERT rows. The registry documents the intent via `skipSync: true` and a comment.
  - *Wait* — re-reading the origin doc (line 96): "`flashcard_reviews` is a **Supabase-only** INSERT-only table (no Dexie equivalent) — created in E93-S01, populated during upload from `reviewRecords`." And line 109: "`aiUsageEvents` has `conflictStrategy: 'insert-only'`; `flashcard_reviews` is Supabase-only (no Dexie entry)."
  - Revised resolution: `reviewRecords` **IS** a Dexie table (v31 FSRS migration) used for local FSRS scheduling state. It should be in the registry with `conflictStrategy: 'skip'` (never synced as-is). The P1 list in the origin doc line 96 includes `reviewRecords` among syncable tables — but line 296 of the same doc says "Local `reviewRecords` stores derived FSRS scheduling state and is NOT synced to Supabase (recomputed from merged `flashcard_reviews` log on download)."
  - **Final resolution**: Keep `reviewRecords` OUT of the registry entirely (it's local-only derived state). Add `flashcard_reviews` as a pseudo-entry keyed by `dexieTable: '__none__' | ''` with `conflictStrategy: 'insert-only'` — OR, cleaner, add an **optional second registry** (`supabaseOnlyRegistry`) holding a single entry for `flashcard_reviews` whose payload source is `reviewRecords`. E92-S05 reads both. For THIS story, the simplest path is a TODO comment plus interface support for `dexieTable: null` (server-only). Defer the actual `flashcard_reviews` entry to **E92-S05** (where the transformer logic lives). Document in the registry file.

- **Q: Where does `progress.watchedSeconds` come from when the Dexie table is keyed differently?**
  - Resolution: The Dexie `progress` table uses compound PK `[courseId+videoId]` with no `id` column, but has a `watchedSeconds` field on each record. The registry entry for `progress` sets `compoundPkFields: ['courseId', 'videoId']` and the upload engine (E92-S05) reads both fields to form the Supabase upsert key. `monotonicFields: ['watchedSeconds']` marks the field for `GREATEST()` behavior.

- **Q: How are compound-PK tables distinguished at upload time?**
  - Resolution: `compoundPkFields` presence is the signal. Upload engine (E92-S05) checks `entry.compoundPkFields?.length ?? 0 > 0` and constructs the upsert conflict target accordingly.

### Deferred to Implementation

- **Exact Supabase column names for P2/P3/P4 tables.** E93/E94/E96 migrations (backlog) will define these. For this story, use the snake_case convention derived from camelCase (`bookReviews` → `book_reviews`, `learningPathEntries` → `learning_path_entries`). If E93/E94 migrations later deviate, update the registry in those stories — the mapper does not care about semantics, only about what the registry says.
- **Whether `notificationPreferences` is one row or many.** Deferred until E95-S01 decides. Registry entry uses default single-row assumption until then.
- **Vault field encryption details.** E95 owns Vault integration; the registry just declares which fields are destined for Vault.

## High-Level Technical Design

> *This illustrates the intended approach and is directional guidance for review, not implementation specification. The implementing agent should treat it as context, not code to reproduce.*

### Module shape

```
src/lib/sync/
├── tableRegistry.ts       ← declarative data, no logic
├── fieldMapper.ts         ← pure transforms, depends on tableRegistry types only
├── backfill.ts            ← existing; refactored to consume registry keys
└── __tests__/
    ├── tableRegistry.test.ts    ← round-trip per table
    ├── fieldMapper.test.ts      ← edge cases (strip, vault, identity fields)
    └── backfill.test.ts         ← existing
```

### Data flow (illustrative, not final)

```text
Dexie record (camelCase, has non-serializable fields)
        │
        │  registry lookup: entry = tableRegistry[dexieTable]
        ▼
toSnakeCase(entry, record)
        │  ↳ strip entry.stripFields  (file handles)
        │  ↳ strip entry.vaultFields  (api keys, passwords)
        │  ↳ rename via IDENTITY_FIELD_MAP + entry.fieldMap
        ▼
Supabase row payload (snake_case, serializable)

----

Supabase row (snake_case)
        │
        ▼
toCamelCase(entry, record)
        │  ↳ rename via inverse(IDENTITY_FIELD_MAP) + inverse(entry.fieldMap)
        │  ↳ vault/strip fields are NOT restored here (they live elsewhere or are transient)
        ▼
Dexie record shape (camelCase, minus transient handles)
```

### TypeScript shape (directional, not final)

```ts
// Directional only — not implementation code.
// Final shape may differ (e.g., branded table-name type, additional fields).
interface TableRegistryEntry {
  dexieTable: string
  supabaseTable: string
  conflictStrategy: 'lww' | 'monotonic' | 'insert-only' | 'conflict-copy' | 'skip'
  priority: 0 | 1 | 2 | 3 | 4
  fieldMap: Readonly<Record<string, string>>
  stripFields?: readonly string[]
  monotonicFields?: readonly string[]
  compoundPkFields?: readonly string[]
  vaultFields?: readonly string[]
  insertOnly?: boolean
  skipSync?: boolean
}

const IDENTITY_FIELD_MAP = {
  userId: 'user_id',
  createdAt: 'created_at',
  updatedAt: 'updated_at',
} as const
```

## Implementation Units

- [ ] **Unit 1: Define `TableRegistryEntry` interface and `IDENTITY_FIELD_MAP` constant**

**Goal:** Establish the typed contract for every subsequent registry entry and mapper function.

**Requirements:** R1, R11, R12

**Dependencies:** None (E92-S02 already defines the Dexie schema this registry describes).

**Files:**
- Create: `src/lib/sync/tableRegistry.ts` (interface + `IDENTITY_FIELD_MAP` + empty registry placeholder)
- Test: none in this unit (interface-only; tests land in Unit 5)

**Approach:**
- Export `TableRegistryEntry` interface exactly as specified in R1.
- Export `IDENTITY_FIELD_MAP` (camel → snake for `userId`, `createdAt`, `updatedAt`).
- Export a `tableRegistry` placeholder: `export const tableRegistry: Readonly<Record<string, TableRegistryEntry>> = {} as const`. Actual entries added in Units 2–4.
- Export type helpers: `export type RegistryTableName = keyof typeof tableRegistry` for downstream narrowing.
- Add module header doc comment explaining: "Single source of truth for all syncable tables. Add a new table by adding one entry here — never by editing the sync engine."

**Patterns to follow:**
- [src/lib/ai/providers/registry.ts](../../src/lib/ai/providers/registry.ts) — existing registry pattern with `as const` keyed exports
- [src/db/checkpoint.ts](../../src/db/checkpoint.ts) — module header documentation style

**Test scenarios:**
- Test expectation: none — interface-only module, no behavior to test until entries and mapper land.

**Verification:**
- `tsc --noEmit` passes.
- Interface shape matches R1 exactly.

---

- [ ] **Unit 2: Populate P0 registry entries (3 tables)**

**Goal:** Register the three P0 tables that E92-S09 will wire next: `contentProgress`, `studySessions`, `progress` (→ `video_progress`).

**Requirements:** R2, R3 (P0), R6 (monotonic on `progress.watchedSeconds`), R7 (`studySessions` insert-only)

**Dependencies:** Unit 1

**Files:**
- Modify: `src/lib/sync/tableRegistry.ts`

**Approach:**
- Add three entries:
  - `contentProgress`: `conflictStrategy: 'lww'`, `priority: 0`, `compoundPkFields: ['courseId', 'itemId']`, `fieldMap` translates `courseId`→`course_id`, `itemId`→`item_id`, `progressPct`→`progress_pct`, `contentType`→`content_type`.
  - `studySessions`: `conflictStrategy: 'insert-only'`, `priority: 0`, `fieldMap` for `courseId`→`course_id`, `contentItemId`→`content_item_id`, `startTime`→`start_time`, `endTime`→`end_time`.
  - `progress` (Dexie) → `supabaseTable: 'video_progress'`, `conflictStrategy: 'monotonic'`, `priority: 0`, `compoundPkFields: ['courseId', 'videoId']`, `monotonicFields: ['watchedSeconds']`, `fieldMap` for `courseId`→`course_id`, `videoId`→`video_id`, `watchedSeconds`→`watched_seconds`, `durationSeconds`→`duration_seconds`.
- Cross-check column names against `supabase/migrations/20260413000001_p0_sync_foundation.sql` byte-for-byte.

**Patterns to follow:**
- Refer to store record types (`useContentProgressStore`, `useSessionStore`, and video progress writer) for authoritative camelCase field names.

**Test scenarios:** *(tests land in Unit 5)*

**Verification:**
- Every P0 field present in the Supabase migration appears in the corresponding entry's `fieldMap`.
- `tsc --noEmit` passes.

---

- [ ] **Unit 3: Populate P1 registry entries (≈13 tables) with strip + vault + conflict-copy metadata**

**Goal:** Register learning-content tables (`notes`, `bookmarks`, `flashcards`, `embeddings`, `bookHighlights`, `vocabularyItems`, `audioBookmarks`, `audioClips`, `chatConversations`, `learnerModels`) with their full conflict strategy, strip-field, and monotonic annotations.

**Requirements:** R2, R3 (P1), R4 (strip fields), R5 (vault fields N/A in P1), R6 (`vocabularyItems.masteryLevel` monotonic), R8 (`flashcard_reviews` deliberately absent — code comment only)

**Dependencies:** Unit 1

**Files:**
- Modify: `src/lib/sync/tableRegistry.ts`

**Approach:**
- `notes`: `conflictStrategy: 'conflict-copy'` (per origin doc; notes can diverge and be conflict-copied). `fieldMap` for `courseId`, `videoId`, tags passthrough.
- `flashcards`: `conflictStrategy: 'lww'`; `fieldMap` must cover FSRS fields (`dueDate`→`due_date`, `elapsedDays`→`elapsed_days`, `scheduledDays`→`scheduled_days`, `lastReview`→`last_review`, `sourceNoteId`→`source_note_id`, etc.).
- `embeddings`: `conflictStrategy: 'lww'`; `fieldMap` includes `noteId`→`note_id`; vector field passes through without a name change (Postgres `vector` column, JS array).
- `bookHighlights`: no soft-delete (hard delete); `conflictStrategy: 'lww'`; `fieldMap` for `bookId`, `chapterId`, `cfiRange`, `reviewRating`, `flashcardId`.
- `vocabularyItems`: `monotonicFields: ['masteryLevel']`.
- `chatConversations`: messages as `jsonb`, `createdAtEpoch`→`created_at_epoch` — but note: `updatedAt` already exists on this table per schema header; the field map still needs the other columns.
- `learnerModels`: `conflictStrategy: 'lww'`, jsonb fields for `strengths`, `misconceptions`, `quizStats`.
- `audioBookmarks`, `audioClips`, `bookmarks`: straightforward LWW, simple field maps.
- Add an adjacent comment block: `// flashcard_reviews: Supabase-only INSERT-only sink; populated in E92-S05 from reviewRecords. Not a Dexie table — no registry entry here.`
- Add a comment: `// reviewRecords: local-only FSRS scheduling state; not synced. Recomputed from flashcard_reviews log on download.` Do **not** add a `reviewRecords` entry.

**Patterns to follow:**
- Cross-reference with `src/types/note.ts`, `src/types/flashcard.ts`, `src/types/book.ts`, and any FSRS-related types for exact camelCase field names.

**Test scenarios:** *(tests land in Unit 5)*

**Verification:**
- Every P1 field listed in the origin doc's E93-S01 migration spec (line 292–303) is present in the corresponding entry's `fieldMap`.

---

- [ ] **Unit 4: Populate P2, P3, P4 registry entries with vault + strip fields**

**Goal:** Register the remaining ≈24 tables: course/book library (P2), learning paths + notifications + credential catalogs (P3), quizzes + AI usage (P4). Attach `stripFields` for IndexedDB handles and `vaultFields` for credentials.

**Requirements:** R2, R3 (P2/P3/P4), R4 (strip: `directoryHandle` on `importedCourses`, `photoHandle` on `authors`, `fileHandle`/`coverImageHandle` on the actually-offending tables), R5 (vault: `password` on `opdsCatalogs`, `apiKey` on `audiobookshelfServers`), R6 (`books.progress`, `challenges.currentProgress` monotonic), R7 (`aiUsageEvents` insert-only)

**Dependencies:** Unit 1

**Files:**
- Modify: `src/lib/sync/tableRegistry.ts`

**Approach:**
- **P2**: `importedCourses` (with `stripFields: ['directoryHandle']`), `importedVideos`, `importedPdfs`, `authors` (with `stripFields: ['photoHandle']`), `books` (confirm whether `coverImageHandle` / `fileHandle` exist on this type; if yes, add to `stripFields`; `monotonicFields: ['progress']`), `bookReviews`, `shelves`, `bookShelves`, `readingQueue`, `chapterMappings`.
- **P3**: `learningPaths`, `learningPathEntries`, `challenges` (`monotonicFields: ['currentProgress']`), `courseReminders`, `notifications`, `careerPaths`, `pathEnrollments`, `studySchedules`, `opdsCatalogs` (`vaultFields: ['password']`, conflictStrategy LWW but password never leaves Vault), `audiobookshelfServers` (`vaultFields: ['apiKey']`), `notificationPreferences`.
- **P4**: `quizzes`, `quizAttempts`, `aiUsageEvents` (`conflictStrategy: 'insert-only'`, `insertOnly: true`).
- For each table, look up actual field names in `src/types/` or the Dexie store file; do not invent fields.
- For strip-field detection, grep each Dexie store write for `Handle` typed properties — do not assume which tables actually hold file handles.

**Patterns to follow:**
- [src/db/schema.ts](../../src/db/schema.ts) lines 1390+ (v52 migration) gives you the authoritative table list.
- [src/stores/](../../src/stores/) TS types are the authoritative field names per record.

**Test scenarios:** *(tests land in Unit 5)*

**Verification:**
- Every table with `[userId+updatedAt]` in `CHECKPOINT_SCHEMA` is present in the registry OR is explicitly excluded via a comment (e.g., `entitlements` is per-user but server-authoritative; we may exclude).
- All `stripFields` entries correspond to actual typed properties on the record type.

---

- [ ] **Unit 5: Implement `fieldMapper.ts` with `toSnakeCase` and `toCamelCase` pure functions**

**Goal:** Provide two pure transform functions that every downstream sync story (S04, S05, S06) will call instead of rolling its own camel/snake logic.

**Requirements:** R9

**Dependencies:** Unit 1 (interface), any of Units 2–4 (at least one real entry to reference — call Unit 2 the hard dependency)

**Files:**
- Create: `src/lib/sync/fieldMapper.ts`
- Test: `src/lib/sync/__tests__/fieldMapper.test.ts`

**Approach:**
- Export `toSnakeCase(entry, record)`:
  1. Start with empty output object.
  2. Iterate record keys; skip any key present in `entry.stripFields`.
  3. Skip any key present in `entry.vaultFields` (these go to Vault separately in E95).
  4. Look up rename in merged map (`IDENTITY_FIELD_MAP` ∪ `entry.fieldMap`); if absent, use the original key (permits passthrough fields like `id`, `tags`, etc.).
  5. Copy value unchanged. Do **not** recurse into nested objects (jsonb fields stay as-is).
- Export `toCamelCase(entry, record)`:
  1. Invert the merged map once (cache in a `WeakMap<TableRegistryEntry, Readonly<Record<string, string>>>`).
  2. Iterate record keys; apply inverse rename where present, passthrough otherwise.
  3. Do NOT restore stripped/vault fields — callers handle those.
- Both functions are pure (no I/O, no `Date.now()`, no random IDs).
- Handle edge cases: `undefined` values, nested objects (preserve), arrays (preserve), `null` explicitly preserved.

**Execution note:** Implement test-first — write `fieldMapper.test.ts` with the round-trip assertion for at least one P0 entry (e.g., `progress`) before coding the functions. This locks the contract.

**Patterns to follow:**
- Pure function style: no mutation of the input record; return a fresh object.
- Avoid `lodash.camelCase` / `snake_case` helpers — the map is explicit per the registry.

**Test scenarios:**
- Happy path: `toSnakeCase` on a `contentProgress` record with `courseId`, `itemId`, `progressPct`, `status`, `updatedAt`, `userId`, `id` produces the correct snake_case keys.
- Happy path: `toCamelCase` inverts it exactly.
- Edge case: empty record → empty output (no identity fields injected).
- Edge case: record with `undefined` value for a mapped field → output key present with `undefined`.
- Edge case: record with `null` value → null preserved in output.
- Edge case: record key not in `fieldMap` and not in `IDENTITY_FIELD_MAP` (e.g., `tags` array) → passthrough to the same key name.
- Edge case: record with nested object (e.g., `learnerModels.strengths`) → value passed through by reference; nested keys NOT renamed.
- Edge case: record with array value (e.g., `notes.tags`) → passed through unchanged.
- Strip behavior: `toSnakeCase` on `importedCourses` with a `directoryHandle: FileSystemDirectoryHandle` field → output has no `directory_handle` key at all.
- Vault behavior: `toSnakeCase` on `opdsCatalogs` with a `password: 'secret'` field → output has no `password` key at all.
- Identity override: per-table `fieldMap` entry for `userId` (hypothetical override) takes precedence over `IDENTITY_FIELD_MAP`. (Documented, not expected in practice.)
- Integration: the merged-map cache returns the same object reference for repeated calls with the same entry (not required functionally, but validates the WeakMap usage).

**Verification:**
- All edge-case tests pass.
- `toSnakeCase` + `toCamelCase` are pure: running them 1000× on the same input produces byte-identical output each time.
- No TypeScript `any` in the implementation.

---

- [ ] **Unit 6: Round-trip registry test — every entry survives camel → snake → camel**

**Goal:** Catch field-map typos, missing fields, and accidental key swaps across all ~40 registry entries via a single parametrized test.

**Requirements:** R10

**Dependencies:** Units 2–5

**Files:**
- Create: `src/lib/sync/__tests__/tableRegistry.test.ts`

**Approach:**
- Define a test fixture per registry entry (a plausible record with every camelCase field in its `fieldMap` populated, plus `id`, `userId`, `updatedAt`).
- For each fixture: `expect(toCamelCase(entry, toSnakeCase(entry, fixture))).toEqual(fixtureMinusStripAndVaultFields)`.
- Run as a single `describe.each(Object.entries(tableRegistry))(...)`.
- Include a check that every registry entry's `conflictStrategy` is one of the five literal values (guards against typos).
- Include a check that every registry entry's `priority` ∈ `[0, 1, 2, 3, 4]`.
- Include a check that every `monotonicFields` entry exists as a camelCase key in the corresponding `fieldMap`.
- Include a check that no two entries share the same `supabaseTable` name (would be a silent collision).

**Execution note:** Test-first is optional here — the test is the acceptance signal for Units 2–4.

**Patterns to follow:**
- [src/db/__tests__/schema.test.ts](../../src/db/__tests__/schema.test.ts) — parametrized-over-tables pattern.

**Test scenarios:**
- Happy path (parametrized per table): round-trip produces the original record minus `stripFields` and `vaultFields`.
- Edge case: `progress` table (compound PK, monotonic field) round-trips correctly; `watchedSeconds` ↔ `watched_seconds`.
- Edge case: `studySessions` (insert-only) round-trips same as any other table (insert-only affects upload strategy, not field mapping).
- Edge case: `importedCourses` fixture includes `directoryHandle: {} as any` — after `toSnakeCase`, the key is absent; after `toCamelCase`, the key is still absent (not resurrected).
- Edge case: `opdsCatalogs` fixture includes `password: 'secret'` — same strip behavior.
- Invariant: every entry key equals its `dexieTable` field (no rename mismatches).
- Invariant: every `compoundPkFields` entry references a camelCase key present in the fixture.
- Invariant: no duplicate `supabaseTable` values across the registry.

**Verification:**
- `npm run test:unit -- tableRegistry` passes.
- All ~40 parametrized cases succeed.

---

- [ ] **Unit 7: Refactor `backfill.ts` to derive table list from the registry**

**Goal:** Eliminate the hardcoded list of syncable tables in `src/lib/sync/backfill.ts` — replace with `Object.keys(tableRegistry)` (filtered to exclude tables marked `skipSync: true`, which is zero entries in this story).

**Requirements:** R10 (implicit: one source of truth; origin-doc learning)

**Dependencies:** Units 2–4 (registry must be populated)

**Files:**
- Modify: `src/lib/sync/backfill.ts`
- Modify: `src/lib/sync/__tests__/backfill.test.ts` (adjust expected table list to the registry-derived set)

**Approach:**
- Replace the hardcoded array in `backfill.ts` with `const SYNCABLE_TABLES = Object.keys(tableRegistry).filter(t => !tableRegistry[t].skipSync)`.
- Retain all existing batching + no-op-when-no-user behavior.
- Update `backfill.test.ts` to expect the registry-derived list; add a test that asserts `SYNCABLE_TABLES.length === Object.keys(tableRegistry).length` as long as no entries are `skipSync`.

**Patterns to follow:**
- Existing structure of `backfill.ts`; do not rewrite the batching or async shape.

**Test scenarios:**
- Happy path: `backfill(userId)` stamps `userId` on all registry-covered tables (tested via a seeded Dexie snapshot).
- Edge case: `backfill(null)` is a no-op — preserved from existing test.
- Integration: adding a hypothetical entry with `skipSync: true` to the registry (via a test-local mock) excludes that table from the backfill list.
- Invariant: the registry and the backfill-derived list can never drift.

**Verification:**
- `npm run test:unit -- backfill` passes.
- No hardcoded table-name array remains in `src/lib/sync/backfill.ts`.

---

- [ ] **Unit 8: Lint, type-check, and doc-comment the final module**

**Goal:** Ensure the registry file is readable, documented, and compiles cleanly.

**Requirements:** Implicit — quality bar

**Dependencies:** Units 1–7

**Files:**
- Modify: `src/lib/sync/tableRegistry.ts`
- Modify: `src/lib/sync/fieldMapper.ts`

**Approach:**
- Add a module header doc comment on `tableRegistry.ts` explaining: the purpose of the registry, the "one entry per table" rule, how to add a new table, where `skipSync` gets populated (E96-S04), and the `flashcard_reviews` / `reviewRecords` special cases.
- Add a module header doc comment on `fieldMapper.ts` explaining the pure-function contract and the `IDENTITY_FIELD_MAP` behavior.
- Ensure ESLint passes (especially the design-tokens rule is inapplicable here; no UI code).
- Ensure `tsc --noEmit` passes with strict mode.
- Ensure every entry's field map keys correspond to real record-type fields — run a one-off check: for each registry entry, attempt to import its corresponding store type and verify field presence via TypeScript.

**Patterns to follow:**
- [src/db/schema.ts](../../src/db/schema.ts) header comment — informative version-by-version history.

**Test scenarios:**
- Test expectation: none — this unit is doc + type hygiene.

**Verification:**
- `npm run lint` clean.
- `npx tsc --noEmit` clean.
- `npm run test:unit` (full sync-related suite) green.

## System-Wide Impact

- **Interaction graph:** `tableRegistry` becomes a hard dependency of `backfill.ts` (this story) and will become a dependency of `syncableWrite.ts` (S04), `syncEngine.ts` upload phase (S05), `syncEngine.ts` download phase (S06), and P0 store rewiring (S09). Changing a registry entry must be treated as an interface change.
- **Error propagation:** Pure-function design means `toSnakeCase`/`toCamelCase` never throw. Invalid registry entries surface at compile time (TypeScript) or at unit-test time (round-trip fail). No runtime errors expected from this module.
- **State lifecycle risks:** None — this story introduces no state. The registry is a frozen constant.
- **API surface parity:** The registry is now the **single** camelCase ↔ snake_case source. Any future store or migration that adds a syncable table must add an entry. Flag this in the PR description so reviewers see the constraint.
- **Integration coverage:** The `backfill.ts` refactor in Unit 7 is the first integration point. Full integration of the registry into the sync engine awaits E92-S05/S06.
- **Unchanged invariants:**
  - Dexie schema (v52) is not modified by this story.
  - Supabase schema (P0 migrations) is not modified.
  - No existing store's write path changes — stores keep calling Dexie directly until E92-S09.
  - `backfill.ts` keeps its signature (`backfill(userId)`); only the internal table list source changes.

## Risks & Dependencies

| Risk | Mitigation |
|------|------------|
| Field-map typo in a registry entry silently uploads wrong column names | Unit 6 round-trip test catches any field that doesn't round-trip; additionally, downstream sync-engine tests (E92-S05) will fail loudly if a Supabase column name is wrong. |
| Registry drift between `tableRegistry.ts` and `CHECKPOINT_SCHEMA` (new table added to schema but forgotten here) | Add a periodic-check test (deferred to E92-S09) that asserts every table with `[userId+updatedAt]` in the checkpoint has a registry entry or explicit-exclusion comment. |
| `reviewRecords` / `flashcard_reviews` special case confuses future contributors | In-file comment block + `docs/solutions/` entry documenting the design; revisit in E92-S05 implementation. |
| `books` / `importedPdfs` field-handle properties may be named differently than origin doc assumes | Unit 4 explicitly instructs the implementer to grep the store types before adding `stripFields`; do not assume. |
| P2–P4 tables include columns that don't yet exist in Supabase (migrations deferred to E93/E94/E96) | Accepted — the registry declares the intended shape. E93/E94/E96 migrations must match; mismatch surfaces in those stories' upload integration tests, not here. |
| Round-trip test requires ~40 fixture objects — maintenance burden | Auto-generate fixtures from the `fieldMap` keys at test-time (populate each camelCase key with a deterministic dummy value) so adding an entry to the registry automatically covers it in the test. |

## Documentation / Operational Notes

- No production operational impact — the registry is a typed constant in the client bundle.
- Bundle-size impact: expected <3 KB gzipped. Confirm via `npm run build` bundle analysis (no baseline regression expected).
- Add one line to [docs/engineering-patterns.md](../../docs/engineering-patterns.md): "Sync table registry is the single source of truth for syncable tables and field maps; never hardcode a table list or field name outside `src/lib/sync/tableRegistry.ts`."
- Add a [docs/solutions/](../../docs/solutions/) entry: `2026-04-17-sync-table-registry-pattern.md` summarizing the declarative-registry design decision and the `reviewRecords`/`flashcard_reviews` special case. (Optional but recommended for future contributors.)

## Sources & References

- **Origin document:** [docs/planning-artifacts/epics-supabase-data-sync.md](../planning-artifacts/epics-supabase-data-sync.md) (E92-S03 section, lines 73–111)
- Related plans:
  - [docs/plans/2026-04-17-001-feat-e92-s01-p0-migrations-extensions-plan.md](2026-04-17-001-feat-e92-s01-p0-migrations-extensions-plan.md) (done — Postgres schema)
  - [docs/plans/2026-04-17-003-feat-e92-s02-dexie-v52-sync-infrastructure-plan.md](2026-04-17-003-feat-e92-s02-dexie-v52-sync-infrastructure-plan.md) (done — Dexie schema)
  - [docs/plans/2026-03-31-supabase-data-sync-design.md](2026-03-31-supabase-data-sync-design.md) (high-level sync design)
- Related code:
  - [src/db/schema.ts](../../src/db/schema.ts) (v52 migration block, authoritative table list)
  - [src/db/checkpoint.ts](../../src/db/checkpoint.ts) (post-v52 schema snapshot)
  - [src/lib/sync/backfill.ts](../../src/lib/sync/backfill.ts) (consumes registry in Unit 7)
  - [supabase/migrations/20260413000001_p0_sync_foundation.sql](../../supabase/migrations/20260413000001_p0_sync_foundation.sql) (P0 Supabase column names)
- Related memory: `project_supabase_sync_design.md` — full Supabase sync design (LWW, 26 tables, 4 Storage buckets, 3 phases)
