---
story_id: E92-S03
story_name: "Sync Table Registry and Field Mapping"
status: in-progress
started: 2026-04-18
completed:
reviewed: false
review_started:
review_gates_passed: []
burn_in_validated: false
---

# Story 92.03: Sync Table Registry and Field Mapping

## Story

As a sync engine developer,
I want a declarative table registry that maps every Dexie table to its Supabase counterpart,
so that the upload engine, download engine, and syncable-write wrapper have a single authoritative source of truth for conflict strategies, field mappings, and non-serializable field stripping.

## Acceptance Criteria

**AC1 — Registry exported:** `src/db/tableRegistry.ts` exports `tableRegistry: Record<string, SyncTableConfig>` with exactly 38 entries (one per syncable table).

**AC2 — Types exported:** The module exports `ConflictStrategy`, `PriorityTier`, `SyncTableConfig`, and `SKIP_SYNC_TABLES`.

**AC3 — Helper exported:** `getTableConfig(dexieTable: string): SyncTableConfig | undefined` returns the config for a known table and `undefined` for skip-sync and unknown tables.

**AC4 — P0 tables present:** `contentProgress`, `studySessions`, `progress` are all registered with `priorityTier: 0`.

**AC5 — Conflict strategies correct:**
- `studySessions`, `aiUsageEvents`, `quizAttempts` use `insert-only`
- `contentProgress`, `progress`, `vocabularyItems` use `monotonic`
- `opdsCatalogs`, `audiobookshelfServers` declare `vaultFields`
- `chapterMappings` declares `compoundPkFields: ['epubBookId', 'audioBookId']`
- All others use `lww`

**AC6 — Non-serializable fields stripped:** `books` entry has `nonSerializableFields: ['directoryHandle', 'fileHandle', 'coverBlob']`.

**AC7 — Skip-sync set:** `SKIP_SYNC_TABLES` is a `Set<string>` containing `courseThumbnails`, `screenshots`, `entitlements`, `youtubeVideoCache`, `youtubeTranscripts`, `youtubeChapters`, `courseEmbeddings`, `bookFiles`, `transcriptEmbeddings`, `videoCaptions`.

**AC8 — No runtime logic:** The file is purely declarative — no imports from the app layer, no functions beyond `getTableConfig`.

## Tasks / Subtasks

- [x] Task 1: Create `src/db/tableRegistry.ts` (AC: 1, 2, 3, 4, 5, 6, 7, 8)
  - [x] 1.1 Define and export types: `ConflictStrategy`, `PriorityTier`, `SyncTableConfig`
  - [x] 1.2 Define `SKIP_SYNC_TABLES` set
  - [x] 1.3 Build `tableRegistry` with all 38 entries across P0-P4 tiers
  - [x] 1.4 Export `getTableConfig` helper
- [x] Task 2: Create `src/db/__tests__/tableRegistry.test.ts` (AC: 1, 3, 4, 6)
  - [x] 2.1 Test all P0 tables exist
  - [x] 2.2 Test `getTableConfig` returns correct config for a known table
  - [x] 2.3 Test `getTableConfig` returns `undefined` for skip-sync tables
  - [x] 2.4 Test `books` has `directoryHandle` in `nonSerializableFields`

## Implementation Notes

- Pure declarative config file — no imports from the app layer, no Dexie imports
- `fieldMap` entries are camelCase → snake_case overrides for non-obvious mappings only; obvious auto-converted names (e.g. `courseId` → `course_id`) are NOT listed to keep the file concise
- Tables that require compound PK handling declare `compoundPkFields`; the upload engine (E92-S05) will use these to build the correct `ON CONFLICT (...)` clause
- `vaultFields` are stripped from the Dexie record before upload; the sync engine routes them to Supabase Vault via a separate Edge Function call
- `monotonicFields` are fields whose server value should only ever advance (uses `GREATEST()` in upsert); the download engine skips overwriting these if the server value is lower
- The `progress` Dexie table maps to `video_progress` Supabase table (non-obvious mapping; explicit in fieldMap)

## Testing Notes

Unit tests use Vitest. No DOM/IndexedDB needed — pure object assertions on the exported registry.

## Pre-Review Checklist

- [x] All changes committed (`git status` clean)
- [x] No error swallowing — no async code, nothing to catch
- [x] `tsc --noEmit`: runs clean (zero TypeScript errors) before submission

## Design Review Feedback

N/A — no UI components in this story.

## Code Review Feedback

[Populated by /review-story]

## Challenges and Lessons Learned

[Document issues, solutions, and patterns worth remembering]
