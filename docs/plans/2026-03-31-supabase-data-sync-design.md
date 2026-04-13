# Supabase Data Sync — Design Plan

> **Updated:** 2026-04-13 — Expanded to cover Dexie v51 schema (51 tables, 30+ syncable). New features: Books/Reading ecosystem (E83-E115), AI Tutor system (E56-E72), study schedules (E50). Table count: 26 → 51. Epics: E92-E97, 28 → 39 stories.

## Context

Knowlune is offline-first (Dexie/IndexedDB + localStorage). Supabase currently handles only auth + 3 profile fields. This plan adds full data sync for: **multi-device access**, **cloud backup**, and **server-authoritative entitlements**. Self-hosted Supabase on Unraid (titan.local).

## Design Decisions

| Decision | Choice | Rationale |
|----------|--------|-----------|
| Conflict resolution | LWW + per-type strategies | Industry standard for single-user apps |
| Sync scope | Everything except video binaries | Video metadata/paths synced |
| Binary files | Supabase Storage buckets | PDFs, thumbnails, screenshots, avatars, book files |
| Multi-user | `user_id` + RLS on every table | Cheap now, painful to retrofit |
| Sync trigger | On app open + push on change + 30s periodic | No WebSocket/Realtime needed |
| Embeddings | pgvector (`vector(384)`) | Enables server-side semantic search |
| Settings | Expand existing user_metadata sync | All AppSettings + EngagementPrefs + AIConfig + CaptionPrefs + Reader/Audiobook prefs |
| API keys | Supabase Vault (`pgsodium`) | Encrypted at rest, never in browser storage, enter once works everywhere |

## Post-E89/E90/E91 Additions

| Epic | What to include in sync |
|------|------------------------|
| **E89** | `source: 'local' \| 'youtube'` column on `imported_courses` (unified course architecture) |
| **E90** | `AIConfigurationSettings` — provider, consentSettings, ollamaSettings, globalModelOverride, featureModels. **API keys via Supabase Vault** (not in user_settings table) |
| **E91** | Caption settings — `captionFontSize`, `captionBgOpacity` added to `user_settings` |

### Supabase Vault for API Keys (E90)

API keys are stored server-side using Supabase's built-in Vault extension (`pgsodium` encryption at rest):
- **Store**: Edge Function calls `vault.create_secret(key, name, description)`
- **Read**: Edge Function reads from `vault.decrypted_secrets` view (service_role only)
- **Browser**: Never stores keys — only a "key is configured" boolean per provider
- **Sync**: Inherent — single server, all devices connect to it
- **RLS**: Vault secrets scoped by user_id metadata

The `AIConfigurationSettings.providerKeys` field moves from encrypted localStorage blobs to Vault. Other AI config fields (globalModelOverride, featureModels, consentSettings) sync normally via `user_settings` JSONB.

### Post-E91 Additions (E83-E115)

The following features were built after the original sync design and require sync support:

| Epic Range | What to include in sync |
|---|---|
| **E83-E87** | `books` (title, author, format, status, progress, playbackSpeed, linkedBookId — strip `source` when `type=fileHandle`), `bookHighlights` (cfiRange, color, note, flashcardId, reviewRating), `audioBookmarks` (chapterIndex, timestamp, note). Book cover images → `book-covers` Storage bucket. Book files (EPUB/PDF) → `book-files` Storage bucket, **on-demand download only**. |
| **E88** | `opdsCatalogs` (url, name — non-auth fields only). Auth credentials (username + password) → **Supabase Vault** |
| **E101-E104** | `audiobookshelfServers` (url, name, status, libraryIds — non-apiKey fields). apiKey → **Supabase Vault**. `chapterMappings` (EPUB↔audiobook chapter alignment, compound PK `[epubBookId+audioBookId]`, mappings as JSONB) |
| **E108-E111** | `audioClips` (startTime, endTime, title, sortOrder), `vocabularyItems` (masteryLevel 0-3, definition, note, highlightId — **monotonic mastery**, never regresses) |
| **E113** | `bookReviews` (rating with half-star support, reviewText) |
| **E110** | `shelves` (name, icon, sortOrder — default shelves dedup by name), `bookShelves` (book↔shelf join table), `readingQueue` (ordered reading list) |
| **E56-E57, E72** | `chatConversations` (courseId, videoId, messages as JSONB blob — **timestamps are epoch-ms numbers, not ISO strings**), `learnerModels` (per-course: vocabularyLevel, strengths, misconceptions, quizStats as JSONB). **SKIP**: `transcriptEmbeddings` and `courseEmbeddings` — derived/regenerable per device |
| **E50** | `studySchedules` (timezone-aware, recurrence) |

### localStorage Stores Requiring Migration (E95-S01)

Three Zustand stores currently use localStorage and need migrating to the synced `user_settings` JSONB:

| Store | Fields to migrate |
|---|---|
| `useReaderStore` | readingTheme, readingFontSize, readingLineHeight, readingRuler, scrollMode |
| `useAudiobookPrefsStore` | defaultSpeed, skipSilence, defaultSleepTimer, autoBookmarkOnStop |
| `useReadingGoalStore` | dailyType, dailyTarget, yearlyBookTarget, currentReadingStreak, longestReadingStreak |

### Supabase Vault — Expanded to 3 Credential Types

The original Vault design covered only AI provider API keys. It must be extended to handle:

1. **AI provider API keys** — original (E95)
2. **OPDS catalog auth credentials** (username + password per catalog) — new (E95)
3. **Audiobookshelf server API keys** (per server) — new (E95)

Unified Edge Function API:
- `POST /vault/store-credential` — store/update any credential type
- `GET /vault/check-credential` — returns `{ configured: true/false }`
- `GET /vault/read-credential` — service_role only, returns decrypted value
- `DELETE /vault/delete-credential` — cleanup when catalog/server deleted

Browser stores only a `credentialConfigured: boolean` per OPDS catalog and per ABS server. Raw credentials never persist in browser storage.

## Per-Table Conflict Strategy

| Data Type | Strategy | Detail |
|-----------|----------|--------|
| Settings/profile | LWW (whole doc) | Latest save wins |
| Progress | LWW + `GREATEST()` | Completion never regresses |
| Notes | LWW + conflict copy | Both versions preserved, tagged `conflict-copy` |
| Study sessions | Append-only (INSERT) | Dedup by ID, no conflicts |
| Flashcards/reviews | Review log replay | Merge logs, replay through `calculateNextReview()` |
| Achievements/challenges | Additive + monotonic | `GREATEST()` on progress, once earned never removed |
| Entitlements | Server-authoritative | Clients SELECT only, server manages tier/expiry |
| Streaks | Server-calculated | Derived from `study_sessions` (min 60s per day) |
| books | LWW + `GREATEST()` monotonic | Progress/status never regresses; `source` stripped if fileHandle |
| book_highlights | LWW | User annotations |
| audio_bookmarks | LWW | User-created |
| audio_clips | LWW | User-created clip ranges |
| book_reviews | LWW | Personal ratings |
| vocabulary_items | LWW + monotonic mastery | masteryLevel 0→1→2→3 only |
| shelves / book_shelves | LWW | User organization |
| reading_queue | LWW | Sort order: last-modified device wins |
| chat_conversations | LWW | Messages as JSONB; epoch-ms timestamps |
| learner_models | LWW | Per-course profiles |
| chapter_mappings | LWW | Includes manual overrides = user data |
| opds_catalogs | LWW (non-auth fields) | Auth via Vault |
| audiobookshelf_servers | LWW (non-apiKey fields) | apiKey via Vault |
| study_schedules | LWW | Calendar integration |

---

## Supabase Schema — 51 Tables (30+ syncable) + 6 Storage Buckets

### Priority Tiers

**P0 — "Where was I?" (3 tables):**
- `content_progress` (courseId, itemId, status, progress 0-100, completedAt) — monotonic upsert
- `study_sessions` (INSERT-only log — duration, idle, interactions, breaks)
- `video_progress` (watchedSeconds, watchedPercent, lastPosition) — monotonic upsert

**P1 — Learning content (10 tables, was 6):**
- `notes` (markdown content, tags, soft delete, linkedNoteIds)
- `bookmarks` (video position, label)
- `flashcards` (front, back, tags, FSRS state — now also `sourceType='book'`, `sourceBookId`, `sourceHighlightId`)
- `review_records` (FSRS review history — rating, interval, easeFactor)
- `flashcard_reviews` (INSERT-only log for cross-device FSRS replay)
- `embeddings` (pgvector `vector(384)`, HNSW index)
- `books` (title, author, format, status, progress — LWW + `GREATEST()` monotonic; strip `source` when `type=fileHandle`)
- `book_highlights` (cfiRange, color, note, flashcardId, reviewRating — LWW)
- `audio_bookmarks` (chapterIndex, timestamp, note — LWW)
- `vocabulary_items` (masteryLevel 0-3, definition, note — LWW + **monotonic mastery**, never regresses 0→1→2→3)

**P2 — Library & Reading Org (11 tables, was 4):**
- `imported_courses` (metadata only — no directoryHandle/coverImageHandle)
- `imported_videos` (metadata + path — no fileHandle, no binary)
- `imported_pdfs` (metadata — no fileHandle)
- `authors` (name, bio — no photoHandle)
- `book_reviews` (rating with half-star support, reviewText — LWW)
- `shelves` (name, icon, sortOrder — default shelves dedup by name on download)
- `book_shelves` (book↔shelf join table — unique constraint on book_id+shelf_id)
- `reading_queue` (ordered list — sort order: last-modified device wins)
- `audio_clips` (startTime, endTime, title, sortOrder — LWW)
- `chat_conversations` (courseId, videoId, messages as JSONB blob — **timestamps are epoch-ms numbers, not ISO strings**)
- `learner_models` (per-course learner profile — strengths/misconceptions/quizStats as JSONB)

**P3 — Features (11 tables, was 7):**
- `learning_paths` + `learning_path_entries`
- `challenges` (monotonic `current_progress` — now also supports `type='books'` and `type='pages'`)
- `course_reminders`
- `notifications` (now includes types: `book-imported`, `book-deleted`, `highlight-review`)
- `career_paths` + `path_enrollments`
- `study_schedules` (timezone-aware, recurrence)
- `opds_catalogs` (url, name — non-auth fields only; auth via Vault)
- `audiobookshelf_servers` (url, name, status, libraryIds — non-apiKey fields; apiKey via Vault)
- `chapter_mappings` (EPUB↔audiobook chapter alignment — LWW; compound PK `[epubBookId+audioBookId]`; mappings as JSONB)

**P4 — Quizzes (2 tables):**
- `quizzes` + `quiz_attempts` (INSERT-only immutable history)

**Server-only (4 tables):**
- `entitlements` (existing — extend with `trial_end`, `had_trial`)
- `user_settings` (consolidates AppSettings + EngagementPrefs + AIConfig (minus keys) + CaptionPrefs + **reader prefs** + **audiobook prefs** + **reading goals**)
- `notification_preferences`
- `api_keys` (Supabase Vault — Edge Function access only, never exposed to browser)

**Skip sync (cache/derived/binary):**
- `youtubeVideoCache`, `youtubeTranscripts`, `youtubeChapters`, `videoCaptions` — re-fetchable from API
- `transcriptEmbeddings` — derived from transcripts, regenerable per device (384-dim vectors)
- `courseEmbeddings` — derived from course content, has `sourceHash` for change detection
- `bookFiles` — actual EPUB/PDF blobs go to `book-files` Storage bucket (not Postgres); on-demand download only

### Common Column Pattern (all mutable tables)

```sql
user_id     UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
created_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
updated_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
-- moddatetime trigger auto-updates updated_at on every UPDATE
```

### RLS Policy Templates

**Standard CRUD (most tables):**
```sql
CREATE POLICY "users_own_data" ON table_name
  FOR ALL USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);
```

**Immutable INSERT+SELECT (study_sessions, quiz_attempts, flashcard_reviews, ai_usage_events):**
```sql
CREATE POLICY "insert_own" ON table_name FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "select_own" ON table_name FOR SELECT USING (auth.uid() = user_id);
-- No UPDATE or DELETE policies
```

**Server-authoritative (entitlements):**
```sql
CREATE POLICY "read_own" ON entitlements FOR SELECT USING (auth.uid() = user_id);
-- No INSERT/UPDATE/DELETE — managed by server functions only
```

### Key Postgres Functions

1. **`upsert_video_progress()`** — `GREATEST(old.watched_percent, new.watched_percent)` prevents regression
2. **`upsert_content_progress()`** — Status precedence: completed > in-progress > not-started
3. **`upsert_book_progress()`** — `GREATEST(old.progress, new.progress)` prevents regression; status: finished > reading > want-to-read
4. **`upsert_vocabulary_mastery()`** — `GREATEST(old.mastery_level, new.mastery_level)` — mastery 0→1→2→3 only
5. **`calculate_streak(user_id)`** — Counts consecutive days with ≥60s study sessions
6. **`search_similar_notes(query_embedding, threshold)`** — pgvector cosine similarity search

### Supabase Storage Buckets

| Bucket | Content | Max Size | Policy |
|--------|---------|----------|--------|
| `course-thumbnails` | 200×112 JPEG | 500 KB | User-folder scoped RLS |
| `screenshots` | Study screenshots | 2 MB | User-folder scoped RLS |
| `avatars` | Profile photos | 1 MB | User-folder scoped RLS |
| `pdfs` | Course PDFs | 100 MB | User-folder scoped RLS |
| `book-files` | EPUB/PDF book files (on-demand download) | 200 MB | User-folder scoped RLS |
| `book-covers` | Book cover images | 2 MB | User-folder scoped RLS |

Path convention: `{userId}/{recordId}/{filename}`

Book files are **not** auto-downloaded on new device sign-in — fetched on demand when user opens a book.

### Extensions Required

```sql
CREATE EXTENSION IF NOT EXISTS moddatetime;     -- auto updated_at
CREATE EXTENSION IF NOT EXISTS vector;           -- pgvector for embeddings
CREATE EXTENSION IF NOT EXISTS pgcrypto;         -- gen_random_uuid()
CREATE EXTENSION IF NOT EXISTS supabase_vault;   -- pgsodium-backed secret storage for API keys
```

### Migration Order (FK dependencies)

1. Extensions + auth.users (already exists)
2. Independent tables: imported_courses, authors, learning_paths, career_paths, user_settings, entitlements, books, shelves, opds_catalogs, audiobookshelf_servers
3. FK-dependent: imported_videos → courses, imported_pdfs → courses, notes → courses, content_progress → courses, book_highlights → books, audio_bookmarks → books, audio_clips → books, book_reviews → books, vocabulary_items → books, book_shelves → books + shelves, reading_queue → books, chapter_mappings → books (compound PK)
4. Junction tables: learning_path_entries → learning_paths + courses, path_enrollments → career_paths, book_shelves → books + shelves
5. AI/tutor: chat_conversations → courses (optional FK), learner_models → courses

---

## Client-Side Sync Architecture

### New Dexie Tables (v52 migration)

```typescript
// Sync queue — tracks pending pushes to Supabase (covers 30+ syncable tables)
syncQueue: 'id, table, recordId, timestamp, status'
// SyncQueueEntry { id, table, recordId, operation: 'put'|'delete', timestamp, attempts, lastError?, status }

// Sync metadata — checkpoint per table
syncMetadata: 'table'
// SyncMetadata { table, lastSyncTimestamp, status }
```

### Core Module: `src/lib/sync/`

| File | Purpose |
|------|---------|
| `syncEngine.ts` | Upload/download/apply cycle, periodic timer, lifecycle |
| `syncableWrite.ts` | Wrapper for all synced Dexie writes — stamps userId + updatedAt, queues for sync |
| `syncQueue.ts` | Queue coalescing, dead-letter handling, retry with exponential backoff (5 attempts, 1-16s) |
| `tableRegistry.ts` | Declarative config for all 30+ syncable tables (see below) |
| `fieldMapping.ts` | camelCase ↔ snake_case per-table mapping |
| `conflictResolvers.ts` | Per-table resolution (LWW, monotonic, append-only, conflict-copy) |
| `syncStatus.ts` | Zustand store for sync UI state |
| `syncTypes.ts` | Type definitions |

### New module: `src/lib/sync/tableRegistry.ts`

Declarative configuration for all 30+ syncable tables. Each entry defines:
- `tableName` (Dexie), `supabaseTable` (snake_case)
- `conflictStrategy`: `'lWW'` | `'monotonic'` | `'insert-only'` | `'conflict-copy'`
- `priority`: `0` | `1` | `2` | `3` | `4`
- `fieldMap`: camelCase→snake_case per-field mapping
- `nonSerializableFields`: fields to strip before upload
- `monotonicFields`: fields where `GREATEST()` applies (never regress)
- `compoundPkFields`: for compound-PK tables (e.g. `chapterMappings`)
- `vaultFields`: fields routed to Vault instead of Postgres (e.g. `apiKey`, `password`)

The sync engine iterates the registry instead of hardcoding table names. Essential with 30+ tables.

### Sync Flows

**Push (local change → Supabase):**
1. Store calls `syncableWrite(table, record, 'put')`
2. Record stamped with `userId` + `updatedAt`, written to Dexie (instant, optimistic)
3. Entry added to `syncQueue` (fire-and-forget)
4. Every 30s (or on trigger): coalesce queue → batch upsert to Supabase → delete confirmed entries

**Pull (app open → merge):**
1. For each synced table: `SELECT * FROM table WHERE updated_at >= checkpoint`
2. For each record: compare with local → apply LWW / monotonic / append per table strategy
3. Update `syncMetadata.lastSyncTimestamp` with max `updated_at` from batch
4. Refresh affected Zustand stores via existing `load*()` methods

**File upload (blobs → Supabase Storage):**
1. Blob saved to Dexie (existing flow)
2. Upload to Storage: `supabase.storage.from(bucket).upload(path, blob)`
3. Store URL in Supabase row (replace blob reference)
4. On new device: fetch URL → convert to Blob → store in Dexie
5. Book files: on-demand only — not downloaded on initial sync

### Sync Triggers

| Trigger | Action |
|---------|--------|
| App open / `SIGNED_IN` | Full sync (download all tables + upload pending) |
| Data change | Queue entry added (uploaded on next cycle) |
| Every 30 seconds | Upload pending queue entries |
| `visibilitychange` → hidden | Flush queue (sendBeacon if available) |
| `online` event | Full sync cycle |
| `offline` event | Pause sync engine |

### Non-Serializable Field Stripping

These fields exist only locally (FileSystemHandle references):
```
importedCourses:  ['directoryHandle', 'coverImageHandle']
importedVideos:   ['fileHandle']
importedPdfs:     ['fileHandle']
screenshots:      ['blob', 'thumbnail']  → replaced by Storage URLs
courseThumbnails: ['blob']              → replaced by Storage URLs
authors:          ['photoHandle']
books:            ['source'] when source.type === 'fileHandle' (OPFS/FSA handle)
                  Note: books sourced from 'remote' (OPDS/ABS) keep their URL ref
bookFiles:        not synced to Postgres — blobs go to book-files Storage bucket
```

### Auth Integration

Modify `useAuthLifecycle.ts`:
- On `SIGNED_IN` / `INITIAL_SESSION`: call `syncEngine.start(userId)`
- On `SIGNED_OUT`: call `syncEngine.stop()`

New `useSyncLifecycle.ts` hook:
- Online/offline listeners
- Visibility change listener
- 30s periodic timer

### Error Handling

| Error | Action |
|-------|--------|
| Network timeout / 5xx | Exponential backoff (1s → 16s), max 5 attempts |
| 401 Unauthorized | Trigger re-auth flow |
| 413 Payload Too Large | Reduce batch size from 100 to 25 |
| 429 Rate Limited | Respect `Retry-After` header |
| Dead-letter (5 failures) | Surface in Settings > Sync with manual retry |
| IndexedDB quota | Show existing quota toast, skip remaining downloads |

### Settings Sync Expansion

Expand existing `hydrateSettingsFromSupabase()` pattern in `src/lib/settings.ts`:
- Currently syncs: displayName, bio, profilePhotoUrl
- Add: theme, fontSize, colorScheme, accessibilityFont, contentDensity, reduceMotion, focusAutoQuiz, focusAutoFlashcard
- Add: all EngagementPrefs fields
- Add: reader prefs — readingTheme, readingFontSize, readingLineHeight, readingRuler, scrollMode (migrate from `useReaderStore` localStorage)
- Add: audiobook prefs — defaultSpeed, skipSilence, defaultSleepTimer, autoBookmarkOnStop (migrate from `useAudiobookPrefsStore` localStorage)
- Add: reading goals — dailyType, dailyTarget, yearlyBookTarget, currentReadingStreak, longestReadingStreak (migrate from `useReadingGoalStore` localStorage)

### Supabase Vault — Expanded Credential Types

Vault now covers 3 credential types (was 1). All use `pgsodium` encryption at rest, service_role-only read access.

| Credential Type | Epic | Key Name Pattern | Notes |
|----------------|------|-----------------|-------|
| AI provider API keys | E90 | `ai_key_{provider}_{userId}` | OpenAI, Anthropic, Ollama, etc. |
| OPDS catalog auth | E88 | `opds_auth_{catalogId}_{userId}` | username + password per catalog |
| Audiobookshelf server API keys | E101-E104 | `abs_key_{serverId}_{userId}` | per ABS server |

The Edge Function API handles all 3 types with a unified interface:
- `POST /vault/store-credential` — store/update credential
- `GET /vault/check-credential` — returns `{ configured: true/false }`
- `GET /vault/read-credential` — service_role only, returns decrypted value
- `DELETE /vault/delete-credential` — cleanup on catalog/server delete

Browser stores only a `credentialConfigured: true` boolean per OPDS catalog and per ABS server. On new-device sign-in, the user is prompted to re-verify OPDS/ABS credentials if the remote resource is accessed.

---

## UI Components

| Component | Location | Purpose |
|-----------|----------|---------|
| `SyncStatusIndicator` | Header bar | Cloud icon with status (synced/syncing/offline/error) |
| `SyncSettingsPanel` | Settings page | Toggle, last sync time, pending count, error log |

---

## Implementation Phases

### Phase 1: Foundation (MVP — P0 tables)
1. Supabase migrations: extensions + P0 tables (content_progress, study_sessions, video_progress) + RLS
2. Dexie v52 migration: add sync fields + syncQueue + syncMetadata tables
3. `syncableWrite()` + `syncEngine` core (upload/download/apply)
4. `tableRegistry.ts` — initial entries for P0 tables
5. Wire `useContentProgressStore` + `useSessionStore`
6. Auth lifecycle integration
7. Sync status indicator in header

### Phase 2: Full Content Sync (P1-P2) — expanded

1. P1 table migrations + wiring (notes, bookmarks, flashcards, reviews, embeddings)
2. Note conflict preservation (conflict-copy tag)
3. Flashcard review log replay (FSRS algorithm — updated from SM-2 in E59)
4. Book highlights + vocabulary items (monotonic mastery)
5. Audio bookmarks + audio clips
6. Chat conversations + learner models (epoch-ms timestamp handling)
7. P2 table migrations + wiring (courses, videos, PDFs, authors, books metadata)
8. Book reviews, shelves, reading queue, audio clips
9. Supabase Storage integration (thumbnails, screenshots, PDFs, avatars, book covers)
10. Book files Storage (on-demand upload/download — separate from auto-sync)
11. Chapter mappings sync

### Phase 3: Complete (P3-P4 + polish) — expanded

1. P3-P4 table migrations + wiring (learning paths, challenges, quizzes, notifications, study schedules)
2. OPDS catalogs + ABS servers (non-credential fields)
3. Chapter mappings
4. Settings sync expansion (all AppSettings + EngagementPrefs + reader prefs + audiobook prefs + reading goals)
5. Vault expansion (OPDS auth + ABS API keys alongside AI keys)
6. Server-authoritative entitlements
7. Streak server calculation (study + reading streaks)
8. Sync settings panel in Settings page (per-category status, Vault credential status)
9. Initial upload wizard (grouped by category, book files separate progress)
10. New device download experience (updated priority order)
11. Credential sync UX for external services (OPDS/ABS verification on new device)

---

## Key Existing Files

| File | Relevance |
|------|-----------|
| `src/db/schema.ts` | Dexie schema — add v52 migration |
| `src/data/types.ts` | All TypeScript interfaces — add SyncableFields mixin |
| `src/lib/auth/supabase.ts` | Supabase client singleton — reuse |
| `src/stores/useAuthStore.ts` | Auth state — sync engine reads userId |
| `src/app/hooks/useAuthLifecycle.ts` | Auth lifecycle — add sync start/stop |
| `src/lib/settings.ts` | Settings sync — expand to all fields |
| `src/lib/persistWithRetry.ts` | Retry pattern — reuse in sync engine |
| `src/lib/eventBus.ts` | Event bus — add sync events |
| `src/lib/spacedRepetition.ts` | FSRS pure function — reuse for review replay |
| `supabase/migrations/001_entitlements.sql` | Existing migration — extend |
| `docs/plans/sync-architecture.md` | Existing architecture doc (1200+ lines) |
| `src/stores/useBookStore.ts` | Books CRUD — wire with syncableWrite |
| `src/stores/useHighlightStore.ts` | BookHighlight CRUD — wire with syncableWrite |
| `src/stores/useVocabularyStore.ts` | VocabularyItem CRUD — wire with syncableWrite |
| `src/stores/useShelfStore.ts` | Shelf/BookShelf CRUD — wire with syncableWrite |
| `src/stores/useReadingQueueStore.ts` | ReadingQueue CRUD — wire with syncableWrite |
| `src/stores/useAudioClipStore.ts` | AudioClip CRUD — wire with syncableWrite |
| `src/stores/useBookReviewStore.ts` | BookReview CRUD — wire with syncableWrite |
| `src/stores/useTutorStore.ts` | ChatConversation + LearnerModel — wire with syncableWrite |
| `src/stores/useOpdsCatalogStore.ts` | OpdsCatalog CRUD — non-auth fields via syncableWrite; auth via Vault |
| `src/stores/useAudiobookshelfStore.ts` | ABS server CRUD — non-apiKey fields via syncableWrite; apiKey via Vault |
| `src/stores/useChapterMappingStore.ts` | ChapterMapping CRUD — wire with syncableWrite |
| `src/stores/useStudyScheduleStore.ts` | StudySchedule CRUD — wire with syncableWrite |
| `src/stores/useReaderStore.ts` | Reader settings (localStorage) — migrate to user_settings JSONB |
| `src/stores/useAudiobookPrefsStore.ts` | Audiobook prefs (localStorage) — migrate to user_settings JSONB |
| `src/stores/useReadingGoalStore.ts` | Reading goals (localStorage) — migrate to user_settings JSONB |

## Verification

1. **Unit tests**: syncableWrite, syncQueue coalescing, fieldMapping, conflictResolvers, tableRegistry entries
2. **Integration test**: Write to Dexie → verify queue entry → mock Supabase upsert → verify queue cleared
3. **Manual E2E**: Sign in on device A → create note → sign in on device B → verify note appears
4. **Offline test**: Go offline → make changes → go online → verify sync completes
5. **Monotonic test**: Mark lesson complete on A, mark incomplete on B → verify stays completed
6. **Book progress test**: Advance to page 50 on A, sync to B, regress to page 10 on B → verify stays at 50
7. **Vocabulary mastery test**: Advance mastery to level 2 on A, attempt level 0 on B → verify stays at 2
8. **Storage test**: Import course with thumbnail → verify thumbnail in Supabase Storage → verify on device B
9. **Book file test**: Upload EPUB on A → sign in on B → verify file is NOT auto-downloaded → open book → verify on-demand download
10. **Vault credential test**: Store OPDS auth on A → sign in on B → verify `credentialConfigured: true` → access catalog → verify prompt to re-enter credentials
