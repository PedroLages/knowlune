# Supabase Data Sync — Design Plan

## Context

Knowlune is offline-first (Dexie/IndexedDB + localStorage). Supabase currently handles only auth + 3 profile fields. This plan adds full data sync for: **multi-device access**, **cloud backup**, and **server-authoritative entitlements**. Self-hosted Supabase on Unraid (titan.local).

## Design Decisions

| Decision | Choice | Rationale |
|----------|--------|-----------|
| Conflict resolution | LWW + per-type strategies | Industry standard for single-user apps |
| Sync scope | Everything except video binaries | Video metadata/paths synced |
| Binary files | Supabase Storage buckets | PDFs, thumbnails, screenshots, avatars |
| Multi-user | `user_id` + RLS on every table | Cheap now, painful to retrofit |
| Sync trigger | On app open + push on change + 30s periodic | No WebSocket/Realtime needed |
| Embeddings | pgvector (`vector(384)`) | Enables server-side semantic search |
| Settings | Expand existing user_metadata sync | All AppSettings + EngagementPrefs + AIConfig + CaptionPrefs |
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

---

## Supabase Schema — 26 Tables + 4 Storage Buckets

### Priority Tiers

**P0 — "Where was I?" (3 tables):**
- `content_progress` (courseId, itemId, status, progress 0-100, completedAt) — monotonic upsert
- `study_sessions` (INSERT-only log — duration, idle, interactions, breaks)
- `video_progress` (watchedSeconds, watchedPercent, lastPosition) — monotonic upsert

**P1 — Learning content (6 tables):**
- `notes` (markdown content, tags, soft delete, linkedNoteIds)
- `bookmarks` (video position, label)
- `flashcards` (front, back, tags, FSRS state)
- `review_records` (FSRS review history — rating, interval, easeFactor)
- `flashcard_reviews` (NEW — INSERT-only log for cross-device FSRS replay)
- `embeddings` (pgvector `vector(384)`, HNSW index)

**P2 — Course metadata (4 tables):**
- `imported_courses` (metadata only — no directoryHandle/coverImageHandle)
- `imported_videos` (metadata + path — no fileHandle, no binary)
- `imported_pdfs` (metadata — no fileHandle)
- `authors` (name, bio — no photoHandle)

**P3 — Features (7 tables):**
- `learning_paths` + `learning_path_entries`
- `challenges` (monotonic `current_progress`)
- `course_reminders`
- `notifications`
- `career_paths` + `path_enrollments`

**P4 — Quizzes (2 tables):**
- `quizzes` + `quiz_attempts` (INSERT-only immutable history)

**Server-only (4 tables):**
- `entitlements` (existing — extend with `trial_end`, `had_trial`)
- `user_settings` (consolidates AppSettings + EngagementPrefs + PomodoroPrefs + AIConfig (minus keys) + CaptionPrefs)
- `notification_preferences`
- `api_keys` (Supabase Vault — Edge Function access only, never exposed to browser)

**Cache (skip sync):**
- `youtubeVideoCache`, `youtubeTranscripts`, `youtubeChapters`, `videoCaptions` — re-fetchable

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
3. **`calculate_streak(user_id)`** — Counts consecutive days with ≥60s study sessions
4. **`search_similar_notes(query_embedding, threshold)`** — pgvector cosine similarity search

### Supabase Storage Buckets

| Bucket | Content | Max Size | Policy |
|--------|---------|----------|--------|
| `course-thumbnails` | 200×112 JPEG | 500 KB | User-folder scoped RLS |
| `screenshots` | Study screenshots | 2 MB | User-folder scoped RLS |
| `avatars` | Profile photos | 1 MB | User-folder scoped RLS |
| `pdfs` | Course PDFs | 100 MB | User-folder scoped RLS |

Path convention: `{userId}/{recordId}/{filename}`

### Extensions Required

```sql
CREATE EXTENSION IF NOT EXISTS moddatetime;     -- auto updated_at
CREATE EXTENSION IF NOT EXISTS vector;           -- pgvector for embeddings
CREATE EXTENSION IF NOT EXISTS pgcrypto;         -- gen_random_uuid()
CREATE EXTENSION IF NOT EXISTS supabase_vault;   -- pgsodium-backed secret storage for API keys
```

### Migration Order (FK dependencies)

1. Extensions + auth.users (already exists)
2. Independent tables: imported_courses, authors, learning_paths, career_paths, user_settings, entitlements
3. FK-dependent: imported_videos → courses, imported_pdfs → courses, notes → courses, content_progress → courses, etc.
4. Junction tables: learning_path_entries → learning_paths + courses, path_enrollments → career_paths

---

## Client-Side Sync Architecture

### New Dexie Tables (v32 migration)

```typescript
// Sync queue — tracks pending pushes to Supabase
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
| `fieldMapping.ts` | camelCase ↔ snake_case per-table mapping |
| `conflictResolvers.ts` | Per-table resolution (LWW, monotonic, append-only, conflict-copy) |
| `syncStatus.ts` | Zustand store for sync UI state |
| `syncTypes.ts` | Type definitions |

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
importedCourses: ['directoryHandle', 'coverImageHandle']
importedVideos:  ['fileHandle']
importedPdfs:    ['fileHandle']
screenshots:     ['blob', 'thumbnail']  → replaced by Storage URLs
courseThumbnails: ['blob']              → replaced by Storage URLs
authors:         ['photoHandle']
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
- Add: theme, fontSize, ageRange, colorScheme, accessibilityFont, contentDensity, reduceMotion
- Add: all EngagementPrefs fields

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
2. Dexie v32 migration: add sync fields + syncQueue + syncMetadata tables
3. `syncableWrite()` + `syncEngine` core (upload/download/apply)
4. Wire `useContentProgressStore` + `useSessionStore`
5. Auth lifecycle integration
6. Sync status indicator in header

### Phase 2: Full Content Sync (P1-P2)
7. P1 table migrations + wiring (notes, bookmarks, flashcards, reviews, embeddings)
8. Note conflict preservation (conflict-copy tag)
9. Flashcard review log replay
10. P2 table migrations + wiring (courses, videos, PDFs, authors metadata)
11. Supabase Storage integration (thumbnails, screenshots, PDFs, avatars)

### Phase 3: Complete (P3-P4 + polish)
12. P3-P4 table migrations + wiring (learning paths, challenges, quizzes, notifications)
13. Settings sync expansion (all AppSettings + EngagementPrefs)
14. Server-authoritative entitlements
15. Streak server calculation
16. Sync settings panel in Settings page
17. Initial upload wizard (new device experience)

---

## Key Existing Files

| File | Relevance |
|------|-----------|
| `src/db/schema.ts` | Dexie schema — add v32 migration |
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

## Verification

1. **Unit tests**: syncableWrite, syncQueue coalescing, fieldMapping, conflictResolvers
2. **Integration test**: Write to Dexie → verify queue entry → mock Supabase upsert → verify queue cleared
3. **Manual E2E**: Sign in on device A → create note → sign in on device B → verify note appears
4. **Offline test**: Go offline → make changes → go online → verify sync completes
5. **Monotonic test**: Mark lesson complete on A, mark incomplete on B → verify stays completed
6. **Storage test**: Import course with thumbnail → verify thumbnail in Supabase Storage → verify on device B
