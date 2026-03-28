# Knowlune Sync Architecture

> **Purpose:** Implementation blueprint for cross-device data synchronization via Supabase.
> **Date:** 2026-03-28
> **Scope:** 4 epics, 28-36 stories
> **Status:** Architecture — not yet scheduled for implementation

---

## Table of Contents

1. [Overview & Goals](#1-overview--goals)
2. [Current State Analysis](#2-current-state-analysis)
3. [Sync Engine Architecture](#3-sync-engine-architecture)
4. [Schema Design](#4-schema-design)
5. [Conflict Resolution](#5-conflict-resolution)
6. [Initial Upload Flow](#6-initial-upload-flow)
7. [Security](#7-security)
8. [Testing Strategy](#8-testing-strategy)
9. [Implementation Sequence](#9-implementation-sequence)
10. [Minimum Viable Sync](#10-minimum-viable-sync)
11. [Open Questions](#11-open-questions)

---

## 1. Overview & Goals

### The Promise

**"Learn on any device, continue everywhere."**

Knowlune is local-first — all user data lives in 29 IndexedDB tables (Dexie v27). This means data is fast, works offline, and stays private. But it also means your study progress, notes, and flashcards are trapped on a single device.

Sync adds cross-device continuity while preserving the local-first architecture.

### Design Principles

1. **Local-first, sync-second** — All writes go to IndexedDB immediately. Sync happens in the background. Never block user actions on network availability.
2. **Optimistic UI** — Show actions as completed before sync confirms. If sync fails, show a non-blocking warning.
3. **Free for all users** — Self-hosted Supabase on Unraid (titan.local / supabase.pedrolages.net) means zero server cost. Sync is a core feature, not premium.
4. **Multi-user support** — Multiple accounts on the same device keep data locally, filtered by `userId` per query.

### Sync Strategy

| Data Type | Strategy | Rationale |
|-----------|----------|-----------|
| Structured records (progress, sessions, bookmarks) | Last-Write-Wins (LWW) | Simple, conflicts are low-stakes |
| Notes (Tiptap rich text) | LWW + conflict preservation | Both versions saved, user chooses |
| Flashcard SRS state | Review log replay | Merge review histories, replay through SM-2 |
| Derived/cache data | Not synced | Regenerate on each device |

### Infrastructure

- **Server:** Self-hosted Supabase on Unraid (Kong proxy at `titan.local:8000`, HTTPS at `supabase.pedrolages.net`)
- **Client:** `@supabase/supabase-js` v2.100.0 (already installed)
- **Auth:** Email/password, magic link, Google OAuth (Epic 19 — complete)
- **Transport:** Supabase REST API for batch operations, Supabase Realtime for push updates

---

## 2. Current State Analysis

### 2.1 Dexie Schema (29 Tables at v27)

**Source:** `src/db/checkpoint.ts` (line 23), `src/db/schema.ts` (969 lines)

| Table | Primary Key | Indexes |
|-------|------------|---------|
| importedCourses | `id` | name, importedAt, status, *tags, source |
| importedVideos | `id` | courseId, filename, youtubeVideoId |
| importedPdfs | `id` | courseId, filename |
| progress | `[courseId+videoId]` | courseId, videoId |
| bookmarks | `id` | [courseId+lessonId], courseId, lessonId, createdAt |
| notes | `id` | [courseId+videoId], courseId, *tags, createdAt, updatedAt |
| screenshots | `id` | [courseId+lessonId], courseId, lessonId, createdAt |
| studySessions | `id` | [courseId+contentItemId], courseId, contentItemId, startTime, endTime |
| contentProgress | `[courseId+itemId]` | courseId, itemId, status |
| challenges | `id` | type, deadline, createdAt |
| embeddings | `noteId` | createdAt |
| courseThumbnails | `courseId` | — |
| aiUsageEvents | `id` | featureType, timestamp, courseId |
| reviewRecords | `id` | noteId, nextReviewAt, reviewedAt |
| courseReminders | `id` | courseId |
| courses | `id` | category, difficulty, authorId |
| quizzes | `id` | lessonId, createdAt |
| quizAttempts | `id` | quizId, [quizId+completedAt], completedAt |
| videoCaptions | `[courseId+videoId]` | courseId, videoId |
| authors | `id` | name, createdAt |
| careerPaths | `id` | — |
| pathEnrollments | `id` | pathId, status |
| flashcards | `id` | courseId, noteId, nextReviewAt, createdAt |
| entitlements | `userId` | — |
| learningPaths | `id` | createdAt |
| learningPathEntries | `id` | [pathId+courseId], pathId |
| youtubeVideoCache | `videoId` | expiresAt |
| youtubeTranscripts | `[courseId+videoId]` | courseId, videoId, status |
| youtubeChapters | `id` | courseId, order |

### 2.2 Sync Field Coverage Gaps

| Field | Tables With It | Tables Missing It |
|-------|---------------|-------------------|
| `updatedAt` | 5 (notes, learningPaths, courseReminders, authors, flashcards) | 24 |
| `userId` | 1 (entitlements — PK) | 28 |
| `syncedAt` | 0 | 29 |

**Key types:** Defined in `src/data/types.ts` (536 lines)

### 2.3 Tables: Sync vs Skip

**Sync (P0-P3):**

| Priority | Tables | Why Sync |
|----------|--------|----------|
| P0 | contentProgress, studySessions | "Where was I?" — highest cross-device value |
| P1 | notes, bookmarks, flashcards, reviewRecords | User-created study materials |
| P2 | importedCourses, importedVideos, importedPdfs | Course library metadata (not files) |
| P3 | learningPaths, learningPathEntries, challenges | User learning journeys |

**Skip (derived/cache — regenerate on each device):**

| Table | Why Skip |
|-------|----------|
| courseThumbnails | Derived from course files |
| embeddings | Regenerated from notes via OpenAI |
| youtubeVideoCache | Temporary cache with TTL |
| youtubeTranscripts | Fetched from YouTube API |
| youtubeChapters | Fetched from YouTube API |
| videoCaptions | Extracted from video files |
| courses | Catalog data (not user-specific) |
| authors | Catalog data |
| careerPaths | Template data |
| pathEnrollments | May move to sync later |
| aiUsageEvents | Analytics (low sync value) |
| screenshots | Binary data, large (may sync later) |
| courseReminders | Local notifications only |
| quizzes | Generated content (can regenerate) |
| quizAttempts | Consider syncing later (learning value) |
| progress | Legacy table, superseded by contentProgress |

### 2.4 Existing Supabase Integration

| Component | Status | File |
|-----------|--------|------|
| Client SDK | ✅ Installed | `src/lib/auth/supabase.ts` |
| Auth (email, magic link, Google) | ✅ Complete | `src/stores/useAuthStore.ts` |
| JWT middleware | ✅ Complete | `server/middleware/authenticate.ts` |
| Entitlements + RLS | ✅ Complete | `supabase/migrations/001_entitlements.sql` |
| Stripe subscriptions | ✅ Complete | `supabase/functions/stripe-webhook/index.ts` |
| Data sync | ❌ Not started | — |

---

## 3. Sync Engine Architecture

### 3.1 High-Level Design

```
┌─────────────────────────────────────────────────────────────┐
│                     KNOWLUNE APP                             │
│                                                              │
│  ┌──────────────┐    ┌──────────────┐    ┌──────────────┐   │
│  │ Zustand Store │───▶│ syncableWrite│───▶│   Dexie DB   │   │
│  │  (UI state)   │    │  (wrapper)   │    │ (IndexedDB)  │   │
│  └──────────────┘    └──────┬───────┘    └──────────────┘   │
│                             │                                │
│                             │ enqueue                        │
│                             ▼                                │
│                      ┌──────────────┐                        │
│                      │  SyncQueue   │                        │
│                      │  (Dexie tbl) │                        │
│                      └──────┬───────┘                        │
│                             │                                │
│                             ▼                                │
│  ┌──────────────────────────────────────────────────────┐   │
│  │                   SYNC ENGINE                         │   │
│  │                                                       │   │
│  │  ┌──────────┐   ┌──────────┐   ┌──────────┐         │   │
│  │  │  UPLOAD   │──▶│ DOWNLOAD │──▶│  APPLY   │         │   │
│  │  │  Phase    │   │  Phase   │   │  Phase   │         │   │
│  │  └──────────┘   └──────────┘   └──────────┘         │   │
│  │                                                       │   │
│  │  Triggers: startup | 30s periodic | Realtime | manual │   │
│  └──────────────────────────┬────────────────────────────┘   │
│                             │                                │
└─────────────────────────────┼────────────────────────────────┘
                              │ HTTPS
                              ▼
                    ┌──────────────────┐
                    │   SUPABASE       │
                    │   (Postgres +    │
                    │    Realtime +    │
                    │    RLS)          │
                    └──────────────────┘
```

### 3.2 Change Tracking via Zustand Wrappers

**Why Zustand wrappers, not Dexie hooks:**
- Dexie hooks (`hook('creating')`, `hook('updating')`) are unused in the codebase
- All persistence goes through Zustand store actions (e.g., `saveNote()`, `rateFlashcard()`, `setItemStatus()`)
- ~15 store actions to wrap — explicit and controllable
- Avoids sync-loop problem (hooks fire on ALL writes including sync-applied ones)

**The `syncableWrite()` wrapper:**

```typescript
// Conceptual design — wraps any Dexie write for sync tracking
async function syncableWrite<T extends SyncableRecord>(
  table: string,
  record: T,
  operation: 'put' | 'delete'
): Promise<void> {
  // 1. Stamp the record
  const userId = getCurrentUserId()
  record.userId = userId
  record.updatedAt = new Date().toISOString()

  // 2. Persist locally (Dexie)
  if (operation === 'put') {
    await db.table(table).put(record)
  } else {
    await db.table(table).delete(getRecordId(record))
  }

  // 3. Queue for sync (skip if currently applying remote changes)
  if (!syncEngine.isSyncing) {
    await db.syncQueue.add({
      id: crypto.randomUUID(),
      table,
      recordId: serializeRecordId(record),
      operation,
      timestamp: record.updatedAt,
      attempts: 0,
      synced: false,
    })
  }
}
```

**Integration with existing stores:**

```typescript
// Before (useContentProgressStore.ts):
await db.contentProgress.put({ courseId, itemId, status, updatedAt })

// After:
await syncableWrite('contentProgress', { courseId, itemId, status }, 'put')
```

### 3.3 SyncQueue Table

```typescript
interface SyncQueueEntry {
  id: string              // UUID, auto-generated
  table: string           // Target table name (e.g., 'contentProgress')
  recordId: string        // Serialized PK (e.g., 'courseA::lessonB' for compound keys)
  operation: 'put' | 'delete'
  timestamp: string       // ISO 8601 — when the change happened
  attempts: number        // Retry count (max 5, then dead-letter)
  lastError?: string      // Last sync failure reason
  synced: boolean         // false = pending, true = confirmed
}
```

**Coalescing:** Before upload, group pending entries by `(table, recordId)`. Keep only the latest entry per group. Re-read current record state from Dexie (don't store payload snapshots — the latest state is what matters).

**Dead-letter handling:** After 5 failed attempts, mark as `error` state. Show in sync log UI. User can retry manually or dismiss.

### 3.4 Upload / Download / Apply Phases

**UPLOAD Phase:**

1. Query `syncQueue WHERE synced = false ORDER BY timestamp ASC`
2. Coalesce: group by `(table, recordId)`, keep latest per group
3. For each group: re-read current record from Dexie
4. Batch upsert to Supabase REST API (max 100 records per request)
5. On success: mark queue entries `synced = true`, set record `syncedAt = now()`
6. On failure: increment `attempts`, log `lastError`, retry with exponential backoff (1s, 2s, 4s, 8s, 16s)

**DOWNLOAD Phase:**

1. Query Supabase: `SELECT * FROM {table} WHERE updated_at > {lastSyncTimestamp} AND user_id = auth.uid()`
2. `lastSyncTimestamp` stored per table in `syncMetadata` (Dexie table)
3. For each remote record:
   - No local record → INSERT into Dexie
   - Local record exists, no pending queue entry → UPDATE local (LWW: remote wins)
   - Local record exists WITH pending queue entry → CONFLICT (see Section 5)

**APPLY Phase:**

1. Set `syncEngine.isSyncing = true` (prevents re-queuing)
2. Write downloaded records to Dexie
3. Update Zustand store state to reflect new data
4. Set `syncEngine.isSyncing = false`
5. Update `syncMetadata.lastSyncTimestamp` for each table

### 3.5 Realtime + Offline Handling

**Supabase Realtime (primary — when online):**

- Subscribe to Postgres changes on synced tables via Supabase Realtime channels
- Filter: `user_id=eq.{currentUserId}`
- On receive: apply remote change to Dexie + Zustand (same as APPLY phase)
- Near-instant on LAN (titan.local), ~100ms remotely

**Polling fallback (secondary — mobile/unstable):**

- Every 60 seconds, run DOWNLOAD phase for all synced tables
- Used when Realtime connection drops or on metered connections

**Reconnection after offline:**

- On `navigator.onLine` transition from false → true:
  1. Run full UPLOAD phase (flush accumulated queue)
  2. Run full DOWNLOAD phase (catch up on missed remote changes)
  3. Re-establish Realtime subscriptions

**Sync triggers:**

| Trigger | When | Action |
|---------|------|--------|
| App startup | Every page load | Full sync cycle (upload + download) |
| Periodic | Every 30 seconds | Upload only (flush queue) |
| Realtime event | On Postgres change | Download + apply single record |
| Manual | User clicks "Sync now" | Full sync cycle |
| Reconnect | Online after offline | Full sync cycle |

**Sync status UI (header indicator):**

| State | Icon | Meaning |
|-------|------|---------|
| 🟢 Synced | Cloud check | Queue empty, connected |
| 🟡 Syncing (N) | Cloud arrow-up | N entries uploading |
| 🔴 Offline (N) | Cloud off | N changes queued, will sync when online |
| ⚠️ Error | Cloud alert | Failed after retries, needs attention |

---

## 4. Schema Design

### 4.1 Dexie Migration Plan

**Key insight: No compound PK changes needed.** `userId` is added as a regular indexed field, not part of primary keys. This avoids table recreation and data loss risk.

**v28 — P0 Tables (Sync Epic 1):**

```typescript
// src/db/schema.ts
db.version(28).stores({
  // Add userId + syncedAt indexes to P0 tables
  contentProgress: '[courseId+itemId], courseId, itemId, status, userId, syncedAt',
  studySessions: 'id, [courseId+contentItemId], courseId, contentItemId, startTime, endTime, userId, syncedAt',

  // Add sync infrastructure tables
  syncQueue: 'id, table, recordId, timestamp, synced',
  syncMetadata: 'table',

  // All other tables unchanged (listed for Dexie version requirement)
  // ...
}).upgrade(async tx => {
  const userId = getCurrentUserId() // from auth store or localStorage cache

  await tx.table('contentProgress').toCollection().modify(record => {
    record.userId = userId ?? null
    record.updatedAt = record.updatedAt || new Date().toISOString()
    record.syncedAt = null
  })

  await tx.table('studySessions').toCollection().modify(record => {
    record.userId = userId ?? null
    record.syncedAt = null
  })
})
```

**v29 — P1 Tables (Sync Epic 3):**

```typescript
db.version(29).stores({
  notes: 'id, [courseId+videoId], courseId, *tags, createdAt, updatedAt, userId, syncedAt',
  bookmarks: 'id, [courseId+lessonId], courseId, lessonId, createdAt, userId, syncedAt',
  flashcards: 'id, courseId, noteId, nextReviewAt, createdAt, userId, syncedAt',
  reviewRecords: 'id, noteId, nextReviewAt, reviewedAt, userId, syncedAt',

  // New table: flashcard review log (for SRS sync)
  flashcardReviews: 'id, flashcardId, reviewedAt, userId, syncedAt',

  // ...unchanged tables...
}).upgrade(async tx => {
  const userId = getCurrentUserId()

  for (const table of ['notes', 'bookmarks', 'flashcards', 'reviewRecords']) {
    await tx.table(table).toCollection().modify(record => {
      record.userId = userId ?? null
      record.syncedAt = null
    })
  }
})
```

**v30 — P2-P3 Tables (Sync Epic 4):**

```typescript
db.version(30).stores({
  importedCourses: 'id, name, importedAt, status, *tags, source, userId, syncedAt',
  importedVideos: 'id, courseId, filename, youtubeVideoId, userId, syncedAt',
  importedPdfs: 'id, courseId, filename, userId, syncedAt',
  learningPaths: 'id, createdAt, userId, syncedAt',
  learningPathEntries: 'id, [pathId+courseId], pathId, userId, syncedAt',
  challenges: 'id, type, deadline, createdAt, userId, syncedAt',
  // ...
}).upgrade(async tx => {
  const userId = getCurrentUserId()

  for (const table of ['importedCourses', 'importedVideos', 'importedPdfs', 'learningPaths', 'learningPathEntries', 'challenges']) {
    await tx.table(table).toCollection().modify(record => {
      record.userId = userId ?? null
      record.syncedAt = null
    })
  }
})
```

**Checkpoint update (`src/db/checkpoint.ts`):**

Update `CHECKPOINT_VERSION` to 30 and `CHECKPOINT_SCHEMA` to include all sync fields + new tables. Fresh installs skip v1-v29 migrations entirely.

### 4.2 TypeScript Interface Updates

```typescript
// src/data/types.ts — add to all syncable interfaces

// Base mixin for syncable records
interface SyncableFields {
  userId?: string | null    // null = unauthenticated, backfill on first login
  syncedAt?: string | null  // null = never synced, ISO 8601 after sync
}

// Example: ContentProgress gets SyncableFields
interface ContentProgress extends SyncableFields {
  courseId: string
  itemId: string
  status: CompletionStatus
  updatedAt: string
}

// New interface
interface FlashcardReview {
  id: string                // UUID
  flashcardId: string       // FK to Flashcard.id
  rating: ReviewRating      // 'hard' | 'good' | 'easy'
  reviewedAt: string        // ISO 8601
  deviceId: string          // UUID from localStorage
  userId: string            // auth.uid()
  syncedAt?: string | null
}

// New interface
interface SyncMetadata {
  table: string             // PK — table name
  lastSyncTimestamp: string  // ISO 8601 — server timestamp of last download
  lastUploadedId?: string   // For initial upload resumability
  uploadedRecords?: number
  totalRecords?: number
  status: 'idle' | 'syncing' | 'complete' | 'error'
}
```

### 4.3 Device Identity

```typescript
// Generated once on first app launch, stored in localStorage
function getDeviceId(): string {
  let deviceId = localStorage.getItem('knowlune-device-id')
  if (!deviceId) {
    deviceId = crypto.randomUUID()
    localStorage.setItem('knowlune-device-id', deviceId)
  }
  return deviceId
}
```

Used in: flashcardReviews (which device reviewed), conflict attribution UI ("Changed on your laptop"), sync metadata.

### 4.4 Supabase Postgres Tables

**P0 tables:**

```sql
-- supabase/migrations/002_sync_content_progress.sql

CREATE TABLE content_progress (
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  course_id TEXT NOT NULL,
  item_id TEXT NOT NULL,
  status TEXT NOT NULL CHECK (status IN ('not-started', 'in-progress', 'completed')),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  synced_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  PRIMARY KEY (user_id, course_id, item_id)
);

CREATE INDEX idx_cp_user_updated ON content_progress(user_id, updated_at DESC);

-- RLS
ALTER TABLE content_progress ENABLE ROW LEVEL SECURITY;
CREATE POLICY "select_own" ON content_progress FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "insert_own" ON content_progress FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "update_own" ON content_progress FOR UPDATE
  USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
CREATE POLICY "delete_own" ON content_progress FOR DELETE USING (auth.uid() = user_id);

-- Enable Realtime
ALTER PUBLICATION supabase_realtime ADD TABLE content_progress;
```

```sql
-- supabase/migrations/003_sync_study_sessions.sql

CREATE TABLE study_sessions (
  id UUID PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  course_id TEXT NOT NULL,
  content_item_id TEXT NOT NULL,
  start_time TIMESTAMPTZ NOT NULL,
  end_time TIMESTAMPTZ,
  duration INTEGER NOT NULL DEFAULT 0,
  idle_time INTEGER NOT NULL DEFAULT 0,
  videos_watched TEXT[] DEFAULT '{}',
  last_activity TIMESTAMPTZ NOT NULL,
  session_type TEXT NOT NULL CHECK (session_type IN ('video', 'pdf', 'mixed')),
  interaction_count INTEGER,
  break_count INTEGER,
  quality_score NUMERIC(5,2),
  quality_factors JSONB,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  synced_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_ss_user ON study_sessions(user_id);
CREATE INDEX idx_ss_user_course ON study_sessions(user_id, course_id);
CREATE INDEX idx_ss_user_time ON study_sessions(user_id, start_time DESC);

ALTER TABLE study_sessions ENABLE ROW LEVEL SECURITY;
CREATE POLICY "select_own" ON study_sessions FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "insert_own" ON study_sessions FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "update_own" ON study_sessions FOR UPDATE
  USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
CREATE POLICY "delete_own" ON study_sessions FOR DELETE USING (auth.uid() = user_id);

ALTER PUBLICATION supabase_realtime ADD TABLE study_sessions;
```

**P1 — Flashcard Reviews (new table, INSERT-only):**

```sql
-- supabase/migrations/004_sync_flashcard_reviews.sql

CREATE TABLE flashcard_reviews (
  id UUID PRIMARY KEY,
  flashcard_id UUID NOT NULL,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  rating TEXT NOT NULL CHECK (rating IN ('hard', 'good', 'easy')),
  reviewed_at TIMESTAMPTZ NOT NULL,
  device_id UUID NOT NULL,
  synced_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_fr_user_card ON flashcard_reviews(user_id, flashcard_id);
CREATE INDEX idx_fr_user_reviewed ON flashcard_reviews(user_id, reviewed_at DESC);

ALTER TABLE flashcard_reviews ENABLE ROW LEVEL SECURITY;
CREATE POLICY "select_own" ON flashcard_reviews FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "insert_own" ON flashcard_reviews FOR INSERT WITH CHECK (auth.uid() = user_id);
-- No UPDATE or DELETE — reviews are immutable

ALTER PUBLICATION supabase_realtime ADD TABLE flashcard_reviews;
```

### 4.5 Field Mapping (camelCase ↔ snake_case)

The sync engine translates between Dexie (camelCase) and Postgres (snake_case):

```typescript
const FIELD_MAP: Record<string, Record<string, string>> = {
  contentProgress: {
    courseId: 'course_id',
    itemId: 'item_id',
    updatedAt: 'updated_at',
    syncedAt: 'synced_at',
    userId: 'user_id',
  },
  studySessions: {
    contentItemId: 'content_item_id',
    startTime: 'start_time',
    endTime: 'end_time',
    idleTime: 'idle_time',
    videosWatched: 'videos_watched',
    lastActivity: 'last_activity',
    sessionType: 'session_type',
    interactionCount: 'interaction_count',
    breakCount: 'break_count',
    qualityScore: 'quality_score',
    qualityFactors: 'quality_factors',
    updatedAt: 'updated_at',
    syncedAt: 'synced_at',
    userId: 'user_id',
  },
  // ... per-table mappings for P1-P3
}
```

### 4.6 Auth Migration: Unauthenticated → Authenticated

**On first login (user was previously unauthenticated):**

```typescript
async function backfillUserId(userId: string): Promise<void> {
  const tables = ['contentProgress', 'studySessions', 'notes', 'bookmarks', 'flashcards', ...]

  for (const table of tables) {
    await db.table(table)
      .filter(record => !record.userId || record.userId === null)
      .modify(record => {
        record.userId = userId
      })
  }
}
```

**On user switch (different account logs in):**
- Previous user's data stays in IndexedDB (NOT deleted)
- All Dexie queries filter by `userId = currentUserId`
- Zustand stores reset state on user change
- Next login re-populates stores from Dexie filtered by new userId

**On logout:**
- Data persists locally
- Sync engine stops
- Realtime subscriptions closed
- Re-login restores access to local data + resumes sync

---

## 5. Conflict Resolution

### 5.1 LWW for Structured Data (P0 + bookmarks)

**Tables:** contentProgress, studySessions, bookmarks

**Detection:**
- Local record has pending syncQueue entry AND remote `updated_at` > local `syncedAt`
- Both sides changed since last sync

**Resolution:**
```
IF local.updatedAt > remote.updatedAt:
  KEEP local, queue re-upload
ELSE:
  APPLY remote, discard local queue entry
```

**No conflict UI.** These records are independently valid (watching lesson 7 on laptop and lesson 8 on phone are both correct).

### 5.2 Conflict Preservation for Notes

**Table:** notes

**Detection:** Same as LWW — both sides changed since last sync.

**Resolution:**
1. Keep BOTH versions
2. Apply remote version to the original record
3. Create a copy of the local version:
   ```typescript
   {
     ...localNote,
     id: crypto.randomUUID(),           // New ID
     tags: [...localNote.tags, 'conflict-copy'],
     // Content prepended with conflict notice
   }
   ```
4. Show toast: "Note conflict detected — both versions saved. Review in your notes."
5. User manually reconciles (merge content, delete copy)

**Why not CRDT:**
- Yjs + Tiptap collaboration extensions are in `package.json` but completely unused
- Enabling CRDT requires migrating all note content from HTML strings to Yjs binary documents
- This is a breaking change affecting `NoteEditor.tsx`, note storage, export service, and search indexing
- For a single-user app, note conflicts are rare (same note, two devices, both offline)
- Conflict preservation solves 95% of cases with zero new dependencies

**CRDT upgrade path (future):**
- If multi-user editing is added, or conflicts become frequent
- Migration: HTML → headless Tiptap → Y.Doc → binary encode → store as Uint8Array
- Sync: Yjs update deltas instead of full documents
- Server: Yjs merge logic in Supabase Edge Function

### 5.3 Review Log Sync for Flashcards

**Problem:** Two devices review the same flashcard independently while offline. The SM-2 state (interval, easeFactor, nextReviewAt) diverges.

**Solution:** Don't sync computed SRS state. Sync the review log, then replay.

**Flow:**

```
DEVICE A (offline): Reviews card X, rates "hard"
  → flashcardReviews: { cardId: X, rating: 'hard', reviewedAt: T1, device: A }
  → flashcard X: interval=1, ease=2.36, count=6

DEVICE B (offline): Reviews card X, rates "easy"
  → flashcardReviews: { cardId: X, rating: 'easy', reviewedAt: T2, device: B }
  → flashcard X: interval=17, ease=2.6, count=6

BOTH COME ONLINE:
  1. Upload review logs (both devices)
  2. Download reviews from other device
  3. For card X: merge reviews, sort by reviewedAt:
     [{ rating: 'hard', T1 }, { rating: 'easy', T2 }]
  4. Replay from initial state through calculateNextReview():
     Start: interval=7, ease=2.5, count=5
     Apply 'hard' (T1): interval=1, ease=2.36, count=6
     Apply 'easy' (T2): interval=2, ease=2.56, count=7
  5. Update flashcard with final computed state
```

**Key advantage:** Both reviews are counted. The final SRS state accurately reflects the card's actual review history.

**Reuses existing code:** `calculateNextReview()` at `src/lib/spacedRepetition.ts:52` is a pure function — it takes current state + rating and returns new state. Perfect for sequential replay.

**Future benefit:** FSRS upgrade (roadmap Wave 2) requires full review history. The flashcardReviews table provides this data, making the FSRS migration trivial.

---

## 6. Initial Upload Flow

### 6.1 Wizard UX

**Location:** Settings → Sync → "Enable sync"

```
┌──────────────────────────────────────────────┐
│           ENABLE SYNC                         │
│                                               │
│  Step 1/4: Preparing your data...             │
│  ├─ contentProgress: 2,341 records            │
│  ├─ studySessions: 487 records                │
│  ├─ notes: 89 records                         │
│  ├─ flashcards: 312 records                   │
│  └─ Total: 3,229 records (~1.6 MB)            │
│                                               │
│  Step 2/4: Uploading...                       │
│  ████████████████████░░░░  68%                │
│  2,196 / 3,229 records                        │
│                                               │
│  Step 3/4: Verifying...                       │
│  ✓ All records confirmed on server            │
│                                               │
│  Step 4/4: Sync enabled! ✓                    │
│  Your data will sync automatically.           │
│                                               │
│  [Done]                                       │
└──────────────────────────────────────────────┘
```

### 6.2 Resumability

Track upload progress in `syncMetadata` table:

```typescript
// On upload start:
await db.syncMetadata.put({
  table: 'contentProgress',
  lastUploadedId: null,
  uploadedRecords: 0,
  totalRecords: await db.contentProgress.count(),
  status: 'syncing',
})

// After each batch (100 records):
await db.syncMetadata.update('contentProgress', {
  lastUploadedId: lastBatchRecord.id,
  uploadedRecords: prev + batchSize,
})

// On resume after interruption:
const meta = await db.syncMetadata.get('contentProgress')
if (meta?.status === 'syncing') {
  // Continue from lastUploadedId
  const remaining = await db.contentProgress
    .where('id').above(meta.lastUploadedId)
    .toArray()
}
```

### 6.3 Idempotent Upserts

Server-side SQL ensures re-uploads don't create duplicates and don't overwrite newer data:

```sql
INSERT INTO content_progress (user_id, course_id, item_id, status, updated_at, synced_at)
VALUES ($1, $2, $3, $4, $5, now())
ON CONFLICT (user_id, course_id, item_id)
DO UPDATE SET
  status = EXCLUDED.status,
  updated_at = EXCLUDED.updated_at,
  synced_at = now()
WHERE content_progress.updated_at < EXCLUDED.updated_at;
```

The `WHERE` clause ensures that only newer data overwrites existing data. Safe to retry indefinitely.

### 6.4 New Device Download

When a user signs in on a new device:

1. **P0 first (instant "where was I?"):** Download contentProgress + studySessions
2. **Background P1:** Notes, bookmarks, flashcards download in the background
3. **Background P2-P3:** Course metadata, learning paths
4. **Storage estimate:** Before download, show "This will use ~45MB. Continue?"
5. **Progressive rendering:** Show data as it downloads, not all-at-once

---

## 7. Security

### 7.1 RLS Design

Every synced Postgres table has 4 RLS policies:

```sql
-- Template applied to every synced table
ALTER TABLE {table} ENABLE ROW LEVEL SECURITY;

CREATE POLICY "select_own" ON {table}
  FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "insert_own" ON {table}
  FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "update_own" ON {table}
  FOR UPDATE USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "delete_own" ON {table}
  FOR DELETE USING (auth.uid() = user_id);
```

**Exception: flashcard_reviews** — INSERT + SELECT only (reviews are immutable):

```sql
CREATE POLICY "select_own" ON flashcard_reviews FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "insert_own" ON flashcard_reviews FOR INSERT WITH CHECK (auth.uid() = user_id);
-- No UPDATE or DELETE policies
```

### 7.2 auth.uid() Principle

**Never trust the client's userId.** The Supabase RLS policies extract userId from the JWT via `auth.uid()`. Even if the sync engine sends a wrong `user_id`, the `WITH CHECK` policy rejects it.

The sync engine sets `user_id = supabase.auth.getUser().id` on every outgoing record, but security doesn't depend on this — it's defense-in-depth.

### 7.3 GDPR Cascade Delete

All synced tables use `REFERENCES auth.users(id) ON DELETE CASCADE`. When a user exercises their right to deletion (already implemented in Epic 19 with 7-day grace period), all synced data is automatically removed from Postgres.

Local IndexedDB data is cleared by the existing account deletion flow.

### 7.4 Transport Security

- **LAN:** Direct Kong proxy at `titan.local:8000` (HTTP, trusted network)
- **Remote:** HTTPS reverse proxy at `supabase.pedrolages.net`
- **JWT:** Short expiry (1 hour), automatic refresh via Supabase client
- **Anon key:** Client uses anon key (respects RLS), never service role key

---

## 8. Testing Strategy

### 8.1 Unit Tests

| Test | What |
|------|------|
| `conflictResolution.test.ts` | LWW comparison, conflict detection, resolution selection |
| `syncQueueCoalescing.test.ts` | Multiple edits to same record → single upload |
| `fieldMapping.test.ts` | camelCase → snake_case → camelCase round-trip for all tables |
| `reviewLogReplay.test.ts` | Two review sequences → merged replay → verify final SRS state |
| `syncableWrite.test.ts` | Verify queue entry created, isSyncing flag respected |

### 8.2 Integration Tests (against real Supabase)

| Test | What |
|------|------|
| `syncRoundTrip.test.ts` | Upload records → download on "another device" → verify match |
| `rlsIsolation.test.ts` | User A uploads → User B can't see it |
| `idempotentUpsert.test.ts` | Upload same record twice → no duplicates |
| `initialUploadResume.test.ts` | Interrupt mid-upload → resume → verify completeness |
| `concurrentWrites.test.ts` | Two clients write same record → verify LWW resolves correctly |

### 8.3 Multi-Device Simulation (E2E with Playwright)

```typescript
// Two browser contexts simulate two devices with separate IndexedDB
test('sync progress across devices', async ({ browser }) => {
  const deviceA = await browser.newContext()
  const deviceB = await browser.newContext()

  // Device A: complete a lesson
  const pageA = await deviceA.newPage()
  await pageA.goto('/courses/react-101')
  await completeLesson(pageA, 'lesson-3')
  await waitForSync(pageA) // wait for upload

  // Device B: verify progress appears
  const pageB = await deviceB.newPage()
  await loginAs(pageB, sameUser)
  await pageB.goto('/courses/react-101')
  await expect(pageB.locator('[data-lesson="lesson-3"] .status')).toHaveText('Completed')
})
```

### 8.4 Chaos Testing

| Test | What |
|------|------|
| Network failure mid-upload | Interrupt after 50% upload → verify queue retry on reconnect |
| Clock skew | Device A clock 5 minutes ahead → verify LWW still resolves correctly |
| Large dataset | Seed 10K records → initial upload → verify completes within 60s |
| Rapid writes | 100 writes in 1 second → verify coalescing reduces to few uploads |
| Realtime disconnect | Kill websocket → verify polling fallback activates |

---

## 9. Implementation Sequence

### Epic 1: Sync Infrastructure (8-10 stories)

| Story | Scope |
|-------|-------|
| S01 | Dexie v28 migration — add sync fields to P0 tables |
| S02 | Add syncQueue + syncMetadata tables to Dexie |
| S03 | Create `syncableWrite()` wrapper function |
| S04 | Build sync engine core (upload/download/apply phases) |
| S05 | Create Supabase migrations: content_progress + study_sessions tables + RLS |
| S06 | Field mapping layer (camelCase ↔ snake_case) |
| S07 | Auth → userId backfill logic (unauthenticated → authenticated migration) |
| S08 | Device identity (localStorage UUID) |
| S09 | Sync settings UI (enable toggle, status indicator in header) |
| S10 | Unit tests for sync engine, queue coalescing, field mapping |

### Epic 2: P0 Sync Live (6-8 stories)

| Story | Scope |
|-------|-------|
| S01 | Wire useContentProgressStore to syncableWrite() |
| S02 | Wire useSessionStore to syncableWrite() |
| S03 | Supabase Realtime subscriptions for P0 tables |
| S04 | Initial upload wizard (P0 scope) |
| S05 | Offline queue + reconnect sync |
| S06 | LWW conflict resolution for P0 |
| S07 | Integration tests against Supabase |
| S08 | Multi-device E2E test |

### Epic 3: P1 Tables (8-10 stories)

| Story | Scope |
|-------|-------|
| S01 | Dexie v29 migration — add sync fields to P1 tables |
| S02 | Create flashcardReviews table (Dexie + Postgres) |
| S03 | Supabase migrations: P1 tables + RLS |
| S04 | Wire useNoteStore to syncableWrite() |
| S05 | Wire useFlashcardStore to syncableWrite() + review log |
| S06 | Wire useBookmarkStore to syncableWrite() |
| S07 | Note conflict preservation UI (toast + copy creation) |
| S08 | Flashcard review log sync + SM-2 replay |
| S09 | Update initial upload wizard for P1 |
| S10 | Integration + multi-device tests for P1 |

### Epic 4: P2-P3 + Polish (6-8 stories)

| Story | Scope |
|-------|-------|
| S01 | Dexie v30 migration — add sync fields to P2-P3 tables |
| S02 | Supabase migrations: P2-P3 tables + RLS |
| S03 | Wire remaining stores (courses, videos, pdfs, paths, challenges) |
| S04 | Strip non-serializable fields (directoryHandle, fileHandle) on sync |
| S05 | Sync log / debug UI in Settings |
| S06 | Storage management + quota monitoring |
| S07 | Chaos testing suite |
| S08 | Performance optimization (batch tuning, connection pooling) |

**Total: 28-36 stories across 4 epics**

---

## 10. Minimum Viable Sync (Fast-Track Option)

If time is limited, a stripped-down P0-only sync can ship in ~half an epic (4-5 stories):

| What | How |
|------|-----|
| v28 migration | Add userId + syncedAt to contentProgress + studySessions |
| 2 Postgres tables | content_progress + study_sessions with RLS |
| Simple sync | On app startup: upload unsynced records, download all server records, LWW merge |
| No Realtime | Polling only (on startup + manual trigger) |
| No offline queue | Sync only when online |
| No conflict UI | Pure LWW, silent resolution |

**Answers the core question:** "Where was I?" across devices. Iterate from there.

---

## 11. Open Questions

1. **Sync quizzes + quizAttempts?** Currently in "skip" list, but quiz data has learning value (knowledge decay, tutoring). Consider moving to P3 or later.

2. **Sync screenshots?** Binary data (potentially large). Could sync metadata only (timestamp, course, lesson) and regenerate/re-capture on other devices.

3. **Bandwidth limits for remote access?** On LAN via titan.local, bandwidth is unlimited. Via supabase.pedrolages.net over the internet, should there be a sync size limit or throttling?

4. **Per-table sync opt-in?** Should users be able to choose "sync notes but not sessions"? Adds UI complexity but respects user preferences.

5. **exportService version reconciliation?** Currently at v14 vs Dexie v27. Should be updated before sync to ensure export/import format matches current schema.

---

## Critical Files Reference

| File | Purpose |
|------|---------|
| `src/db/schema.ts` | Dexie migration chain — add v28-v30 |
| `src/db/checkpoint.ts` | Checkpoint schema — update for sync fields |
| `src/data/types.ts` | TypeScript interfaces — add SyncableFields mixin |
| `src/lib/spacedRepetition.ts` | SM-2 pure functions — reuse for review replay |
| `src/lib/exportService.ts` | Progress callback pattern — reuse for upload wizard |
| `src/lib/auth/supabase.ts` | Supabase client singleton |
| `src/stores/useAuthStore.ts` | userId source for backfill |
| `src/stores/useNoteStore.ts` | Wrap with syncableWrite() |
| `src/stores/useFlashcardStore.ts` | Wrap + add review log |
| `src/stores/useContentProgressStore.ts` | Wrap with syncableWrite() |
| `supabase/migrations/001_entitlements.sql` | RLS template |
| `server/middleware/entitlement.ts` | LRU cache pattern |
