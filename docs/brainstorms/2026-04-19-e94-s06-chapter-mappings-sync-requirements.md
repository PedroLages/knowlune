---
title: "Chapter Mappings Sync"
type: requirements
status: active
date: 2026-04-19
origin: docs/implementation-artifacts/stories/E94-S06-chapter-mappings-sync.md
bmad_story_id: E94-S06
---

# Chapter Mappings Sync

## Problem frame

Learners who read EPUB books while listening to the matching audiobook rely on EPUB↔audiobook chapter alignment data (chapterMappings) for synchronized reading+listening mode. Currently this alignment data is local-only: if a user sets up chapter mappings on one device, they must redo the work on every other device they use. This story wires chapterMappings through the existing E92 sync engine (syncableWrite + tableRegistry) so that chapter position data is uploaded to Supabase and downloaded on new devices automatically.

## Scope

### In scope

**AC1 — Supabase migration creates `chapter_mappings` table:**
Migration file at `supabase/migrations/20260420000001_chapter_mappings.sql` creates:
- `chapter_mappings` — `epub_book_id UUID NOT NULL, audio_book_id UUID NOT NULL, user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE, mappings JSONB NOT NULL DEFAULT '[]', created_at TIMESTAMPTZ NOT NULL DEFAULT now(), updated_at TIMESTAMPTZ NOT NULL DEFAULT now()`
- PRIMARY KEY `(epub_book_id, audio_book_id, user_id)` (composite; no separate `id` column)
- Single RLS policy: `FOR ALL TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id)`
- `BEFORE UPDATE` trigger using `extensions.moddatetime('updated_at')` named `chapter_mappings_set_updated_at`
- Download cursor index: `CREATE INDEX IF NOT EXISTS idx_chapter_mappings_user_updated ON public.chapter_mappings (user_id, updated_at)`
- Migration wrapped in `BEGIN; ... COMMIT;`, idempotent

**AC2 — Rollback script exists:**
`supabase/migrations/rollback/20260420000001_chapter_mappings_rollback.sql` drops the table with CASCADE.

**AC3 — `ChapterMappingRecord` type gets `userId` field:**
In `src/data/types.ts`, add `userId?: string | null` to `ChapterMappingRecord` interface. Optional for backward compatibility.

**AC4 — `tableRegistry.ts` entry for `chapterMappings` is complete:**
Update the existing `chapterMappings` entry to include:
- `fieldMap: { epubBookId: 'epub_book_id', audioBookId: 'audio_book_id', computedAt: 'computed_at', deleted: 'deleted' }`
- `compoundPkFields: ['epubBookId', 'audioBookId']` (already present)
- `conflictStrategy: 'lww'` (already present)

**AC5 — `useChapterMappingStore` `saveMapping` goes through `syncableWrite`:**
Replace direct `db.chapterMappings.put(fullRecord)` in `saveMapping` with `await syncableWrite('chapterMappings', 'put', fullRecord)`.

**AC6 — `useChapterMappingStore` `deleteMapping` uses soft-delete:**
Replace `db.chapterMappings.delete([epubBookId, audioBookId])` with soft-delete pattern: set `deleted: true` and call `syncableWrite('chapterMappings', 'put', { ...existing, deleted: true })`. Compound-PK delete via `syncableWrite` is unsupported per design.

**AC7 — `tableRegistry.ts` entry includes `deleted` field; Supabase migration includes `deleted` column; download apply handles soft-deletes:**
`deleted BOOLEAN NOT NULL DEFAULT FALSE` column in migration; download apply removes Dexie records where `deleted: true`.

**AC8 — Round-trip field fidelity:**
All fields (`epubBookId`, `audioBookId`, `mappings` JSONB array, `computedAt` ISO string, `confidence` float) preserve their values through upload→download round-trip without mutation.

**AC9 — Compound PK: two different book pairs store as separate Supabase rows.**

**AC10 — Manual override mappings (`confidence: 1.0`) and auto-generated mappings preserved through round-trip. LWW applies.**

**AC11 — Unit tests for `syncableWrite` with `chapterMappings`:**
Tests cover: compound recordId synthesis (`'{epubBookId}\u001f{audioBookId}'`), soft-delete path, queue entry payload.

**AC12 — `loadMappings` filters out `deleted: true` records from Zustand state.**

**AC13 — Dexie version check; `schema.test.ts` updated if version bumped.**

**AC14 — `npx tsc --noEmit` passes clean.**

### Out of scope

- Anything not listed in AC above
- Changing the chapter alignment algorithm or UI (ChapterMappingEditor component)
- Syncing `ChapterMapping` sub-items individually (they are an opaque JSONB blob)
- Adding `id` column to `chapter_mappings` table (composite PK is intentional)
- Multi-device conflict resolution beyond LWW

## Key decisions

- **Soft-delete instead of hard-delete:** `syncableWrite` does not support `delete` for compound-PK tables (design constraint from E92-S04). Soft-delete pattern (`deleted: true` put) is the standard workaround, consistent with notes (E93-S02).
- **Composite PK with no `id` column:** Supabase table uses `(epub_book_id, audio_book_id, user_id)` as PK, matching the Dexie compound index `[epubBookId+audioBookId]`. The upload engine must use `onConflict: 'epub_book_id,audio_book_id,user_id'`.
- **`fieldMap` latent bug fix:** existing `tableRegistry.ts` entry has `fieldMap: {}`, which would cause `epubBookId` to be sent as camelCase to Supabase (rejected). This story fixes it.
- **E94-S01 dependency satisfied:** `books` table (FK target) already shipped in E94-S01 migration.

## Dependencies

- E92-S03 (`tableRegistry.ts`) — already complete; entry for `chapterMappings` exists but `fieldMap` is incomplete
- E92-S04 (`syncableWrite`) — already complete; compound-PK path already handles `chapterMappings` style tables
- E94-S01 (P2 library migration, `books` table) — already shipped

## Open questions

*None yet — surface in ce:plan if any emerge.*

## Sources

- Origin: [docs/implementation-artifacts/stories/E94-S06-chapter-mappings-sync.md](docs/implementation-artifacts/stories/E94-S06-chapter-mappings-sync.md)
- Epic spec: [docs/planning-artifacts/epics-supabase-data-sync.md](docs/planning-artifacts/epics-supabase-data-sync.md) (E94-S06 section)
- Sync foundation: [src/lib/sync/syncableWrite.ts](src/lib/sync/syncableWrite.ts)
- Table registry: [src/lib/sync/tableRegistry.ts](src/lib/sync/tableRegistry.ts)
- Store: [src/stores/useChapterMappingStore.ts](src/stores/useChapterMappingStore.ts)
- Types: [src/data/types.ts](src/data/types.ts)
