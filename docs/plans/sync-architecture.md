# Knowlune Sync Architecture

> **Purpose:** Implementation blueprint for cross-device data synchronization via Supabase.
> **Date:** 2026-03-28
> **Scope:** 6 epics (E44-E49), 37 stories — MVP-first (Phase 1: 18 stories, Phase 2: 19 stories)
> **Status:** ✅ READY — adversarial review complete, all decisions resolved, implementation readiness confirmed
> **Readiness Report:** [`implementation-readiness-report-2026-03-28-sync.md`](../_bmad-output/planning-artifacts/implementation-readiness-report-2026-03-28-sync.md)

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
11. [Open Questions (Resolved)](#11-open-questions-resolved-2026-03-28)
12. [Multi-User Data Filtering Architecture](#12-multi-user-data-filtering-architecture)
13. [Adversarial Review Findings (2026-03-28)](#13-adversarial-review-findings-2026-03-28)
14. [Appendix A: Edge Cases & Mitigations](#appendix-a-edge-cases--mitigations)

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
| contentProgress | LWW with status precedence | `completed > in-progress > not-started` — prevents regression |
| studySessions | INSERT-only merge | Sessions are log entries, not mutable state — keep all, dedup by id |
| bookmarks | Last-Write-Wins (LWW) | Simple, conflicts are low-stakes |
| Notes (Tiptap rich text) | LWW + conflict preservation | Both versions saved, user chooses |
| Flashcard SRS state | Review log replay | Merge review histories, replay through SM-2 |
| quizAttempts (P4) | INSERT-only merge | Immutable log entries — scores, timestamps, learning history |
| Derived/cache data | Not synced | Regenerate on each device |

> **Change log (2026-03-28 adversarial review):**
> - studySessions changed from LWW to INSERT-only merge (LWW destroys valid sessions — they're log entries, not mutable state)
> - contentProgress LWW now includes status precedence rule to prevent completion regression
> - quizAttempts added as P4 sync candidate (INSERT-only, learning history value)

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

  // 3. Queue for sync (skip if applying remote changes OR unauthenticated)
  if (!syncEngine.isSyncing && userId) {
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
  // Unauthenticated writes are local-only — queued on first login via backfill
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

**Concurrency guard:** All sync cycles are serialized via `navigator.locks.request('knowlune-sync', ...)`. If a trigger fires while a cycle is running, it queues behind the lock. This prevents concurrent cycles from processing the same queue entries.

**UPLOAD Phase:**

1. Skip if `getCurrentUserId()` is null (unauthenticated users don't sync)
2. Query `syncQueue WHERE synced = false ORDER BY timestamp ASC`
3. Coalesce: group by `(table, recordId)`, keep latest per group
4. For each group: re-read current record from Dexie
   - If re-read returns `undefined` and operation is `put` → convert to `delete` (record was deleted between queue and upload)
   - If re-read returns `undefined` and operation is `delete` → proceed (server DELETE is idempotent)
5. Batch upsert to Supabase REST API (max 100 records per request)
6. On success: diff returned rows against sent rows — only mark **confirmed** rows `synced = true`. Store server-returned `updated_at` as the record's `updatedAt` (server-authoritative timestamps).
7. On partial failure: mark successful rows synced, increment `attempts` on failed rows, log `lastError`, retry with exponential backoff (1s, 2s, 4s, 8s, 16s)

**DOWNLOAD Phase:**

1. Query Supabase: `SELECT * FROM {table} WHERE updated_at >= {lastSyncTimestamp} AND user_id = auth.uid()`
2. `lastSyncTimestamp` stored per table in `syncMetadata` (Dexie table) — always derived from `max(updated_at)` of the downloaded batch (server-authoritative, never client clock)
3. Deduplicate: skip records already in Dexie with matching `syncedAt` (handles the `>=` overlap window)
4. For each remote record:
   - No local record → INSERT into Dexie
   - Local record exists, no pending queue entry → UPDATE local (LWW: remote wins)
   - Local record exists WITH pending queue entry → CONFLICT (see Section 5)

**APPLY Phase:**

```
try {
  syncEngine.isSyncing = true   // prevents re-queuing
  // 1. Write downloaded records to Dexie
  // 2. Update Zustand store state to reflect new data
} finally {
  syncEngine.isSyncing = false  // always reset, even on error
}
// 3. Update syncMetadata.lastSyncTimestamp for each table
```

**Note:** `isSyncing` is also reset to `false` on sync engine startup as a safety net (handles prior crash).

### 3.5 Realtime + Offline Handling

**Supabase Realtime (primary — when online):**

- Subscribe to Postgres changes on synced tables via Supabase Realtime channels
- Filter: `user_id=eq.{currentUserId}`
- **Before applying:** compare incoming `updated_at` against local `updatedAt`. If incoming ≤ local, discard the event (handles out-of-order delivery)
- **Client-side validation:** verify `record.userId === currentUserId` before applying (defense against filter bypass)
- If a Realtime event arrives during the APPLY phase, queue it and apply after the current batch completes (prevents double-apply with download phase)
- Near-instant on LAN (titan.local), ~100ms remotely
- **Health check:** if no event or heartbeat received in 2 minutes, force-reconnect the channel
- **Token refresh:** listen for `onAuthStateChange`; on token refresh, unsubscribe and re-subscribe all channels

**Polling fallback (secondary — mobile/unstable):**

- Every 30 seconds, run DOWNLOAD phase for all synced tables (aligned with upload interval)
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

Before backfill, show a confirmation dialog:
> "All existing data on this device will be linked to your account ({email}). If other people use this device, they won't be able to access this data. [Link my data] [Start fresh]"

"Start fresh" skips backfill — records remain `userId = null` (invisible to the new user). "Link my data" runs backfill.

**Startup safety net:** On every authenticated app launch, check if any synced table has records with `userId = null`. If so, re-run backfill prompt. This handles interrupted backfills.

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
- **Cancel in-flight sync:** abort all pending requests via `AbortController`, wait for current cycle to release the navigator lock
- **Park other user's queue entries:** filter `syncQueue` — entries where `userId !== newUserId` are left in queue but skipped during sync (they'll resume when that user logs back in)
- Previous user's data stays in IndexedDB (NOT deleted)
- All Dexie queries filter by `userId = currentUserId`
- Zustand stores reset state on user change
- Next login re-populates stores from Dexie filtered by new userId

**On logout:**
- Cancel in-flight sync (AbortController)
- Force-unsubscribe all Realtime channels (try/catch — don't block logout on failure)
- Sync engine stops, `isSyncing` reset to false
- Data persists locally
- Re-login restores access to local data + resumes sync

---

## 5. Conflict Resolution

### 5.1 Structured Data Sync Strategies

> **Updated after adversarial review (Finding #1, #2)** — studySessions changed from LWW to INSERT-only; contentProgress got status precedence logic. See [adversarial review](../reviews/adversarial/adversarial-review-2026-03-28-sync-architecture.md).

**Timestamp authority:** All `updatedAt` comparisons use **server-assigned timestamps** (returned from Supabase on upload). Client clocks are never compared across devices. This eliminates clock-skew as a conflict source.

#### studySessions — INSERT-only merge (not LWW)

Sessions are append-only events, not mutable state. Two devices creating sessions simultaneously should keep *both*, not overwrite one.

- Upload all local sessions, download all remote sessions
- Deduplicate by session `id` — each session is unique
- No conflict possible for new sessions
- **Edge case:** Active session (no `endTime`) gets updated when it ends → LWW on `endTime` field only

#### contentProgress — LWW with status precedence

```
IF local.status == 'completed' AND remote.status != 'completed':
  KEEP local (status never regresses)
ELIF remote.status == 'completed' AND local.status != 'completed':
  APPLY remote (completed wins regardless of timestamp)
ELSE:
  Standard LWW (latest updatedAt wins; remote wins ties)
```

Rationale: Once a lesson is marked completed, it stays completed even if another device has an older "in-progress" state.

#### bookmarks — LWW

Simple records, conflicts are low-stakes. Latest `updatedAt` wins. No conflict UI.

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

Track upload progress in `syncMetadata` table. **Important:** Tables with compound primary keys (e.g., `contentProgress` with `[courseId+itemId]`) don't have a single `id` field. The cursor must match the table's PK shape.

```typescript
// SyncMetadata stores a serialized cursor key, not just an id
interface SyncMetadata {
  table: string
  lastUploadedKey: string | null  // JSON-serialized PK (e.g., '["courseA","lesson3"]')
  uploadedRecords: number
  totalRecords: number
  status: 'idle' | 'syncing' | 'complete' | 'error'
}

// On upload start:
await db.syncMetadata.put({
  table: 'contentProgress',
  lastUploadedKey: null,
  uploadedRecords: 0,
  totalRecords: await db.contentProgress.count(),
  status: 'syncing',
})

// After each batch (100 records):
const lastKey = lastBatchRecord.courseId + '::' + lastBatchRecord.itemId
await db.syncMetadata.update('contentProgress', {
  lastUploadedKey: lastKey,
  uploadedRecords: prev + batchSize,
})

// On resume after interruption:
const meta = await db.syncMetadata.get('contentProgress')
if (meta?.status === 'syncing' && meta.lastUploadedKey) {
  // Compound PK: use .above() with key array
  const [courseId, itemId] = meta.lastUploadedKey.split('::')
  const remaining = await db.contentProgress
    .where('[courseId+itemId]').above([courseId, itemId])
    .toArray()
} else if (meta?.status === 'syncing') {
  // First batch — start from beginning
  const remaining = await db.contentProgress.toArray()
}

// Tables with simple `id` PK (e.g., studySessions, notes):
// Use .where('id').above(meta.lastUploadedKey) directly
```

**Navigation during upload:** The wizard should run as a background task. If the user navigates away from Settings, show a persistent banner ("Initial sync: 68% — 2,196 / 3,229 records") in the header area until complete.

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
WHERE content_progress.updated_at <= EXCLUDED.updated_at;
```

The `WHERE` clause uses `<=` (not `<`) so that retries with identical `updated_at` still refresh `synced_at`. This prevents the client from seeing a record as "unsynced" after a successful retry. Safe to retry indefinitely — `synced_at = now()` always advances.

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

> **Edge case AC:** Each story below includes edge-case-derived acceptance criteria (marked with ⚠️). These come from the edge case analysis in Appendix A.

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

**Edge case AC for Epic 1:**

| Story | ⚠️ Additional AC |
|-------|-----------------|
| S01 | Migration guard: if `getCurrentUserId()` is null, records get `userId = null`. Startup check re-prompts backfill if null records exist after auth. |
| S03 | `syncableWrite()` is a no-op for the sync queue when `userId` is null (local-only write). |
| S04 | Upload tracks per-record success from Supabase response; only marks confirmed rows as synced. Download uses `>=` with dedup (not `>`). Apply phase uses try/finally for `isSyncing`. Sync cycles serialized via `navigator.locks`. |
| S05 | Upsert WHERE clause uses `<=` (not `<`) so retries with identical `updated_at` still refresh `synced_at`. |
| S06 | Unit test: every key in each `SyncableFields` interface has a corresponding entry in `FIELD_MAP`. Fail on missing mappings. |

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

**Edge case AC for Epic 2:**

| Story | ⚠️ Additional AC |
|-------|-----------------|
| S03 | Compare `updated_at` before applying Realtime events; discard stale (out-of-order). Re-subscribe on token refresh. Health-check: force-reconnect if no heartbeat in 2min. Validate `userId` client-side before applying. |
| S04 | Resume uses compound PK cursor for `contentProgress` (not `.where('id').above()`). Progress bar shows "~N records" and caps at 99% until verification. Background banner if user navigates away. |
| S05 | On user switch: cancel in-flight sync via AbortController. Park other user's queue entries. On logout: force-unsubscribe all Realtime channels. |

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

**Edge case AC for Epic 3:**

| Story | ⚠️ Additional AC |
|-------|-----------------|
| S08 | Replay skips reviews for deleted flashcards (logs warning). Sort reviews by `reviewedAt ASC, id ASC` (stable tiebreaker). |

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

**Original estimate: 28-36 stories across 4 epics**

> **Updated:** After adversarial review + brainstorming, this section was superseded by a formal 6-epic plan (E44-E49, 37 stories) with MVP-first phasing. See [`_bmad-output/planning-artifacts/epics-sync.md`](../_bmad-output/planning-artifacts/epics-sync.md) for the authoritative epic/story breakdown.
>
> **Phase 1 (E44-E46, 18 stories):** Pre-requisites + Infrastructure + P0 Live
> **Phase 2 (E47-E49, 19 stories):** P1 tables + P2-P3 + Polish (deferred until Phase 1 validated)

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

## 11. Open Questions (Resolved 2026-03-28)

> All questions resolved via adversarial review + brainstorming session. See artifacts:
> - Adversarial review: `docs/reviews/adversarial/adversarial-review-2026-03-28-sync-architecture.md`
> - Brainstorming: `_bmad-output/brainstorming/brainstorming-session-2026-03-28-sync-decisions.md`

1. **~~Sync quizzes + quizAttempts?~~** RESOLVED: Sync quizAttempts only as P4 (INSERT-only merge). Quizzes are regenerable; attempts are learning history that feeds knowledge decay and AI tutoring features. Move quizAttempts from "Skip" to P4 in §2.3.

2. **~~Sync screenshots?~~** RESOLVED: Defer. Screenshots are binary data. Not worth the complexity for MVP. Revisit post-Phase 2 if multi-device screenshot sharing is needed.

3. **~~Bandwidth limits for remote access?~~** RESOLVED: No throttling for MVP. Self-hosted Supabase on LAN has unlimited bandwidth. Remote access via supabase.pedrolages.net is personal use only. Monitor during MVP usage — add throttling if needed in Phase 2.

4. **~~Per-table sync opt-in?~~** RESOLVED: Single "Sync enabled" toggle for V1 (all-or-nothing). Self-hosted means no privacy concern with third parties. Upgrade to per-priority-tier toggles (P0/P1/P2/P3) in V2 only if requested.

5. **~~exportService version reconciliation?~~** RESOLVED: Pre-requisite story. Quick spec created: `_bmad-output/planning-artifacts/quick-spec-export-service-reconciliation.md`. Decouples export format version from Dexie schema version. 2 stories, ~5-7 hours. Must complete before Sync MVP.

6. **~~Multi-user store filtering?~~** RESOLVED: `scopedTable()` query helper + `scopedWrite()` stamp helper + ESLint rule `no-direct-db-access`. Architecture: `_bmad-output/planning-artifacts/architecture-multi-user-filtering.md`. 5 stories, ~15-21 hours across 14 stores.

7. **~~MVP vs full architecture?~~** RESOLVED: MVP-first approach. Phase 1 (P0 tables only, polling, no Realtime, no SyncQueue) in ~8-10 stories. Phase 2 (P1-P3, conflict UI, Realtime) deferred until MVP is validated in real usage (2-4 weeks). See §10 Minimum Viable Sync.

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
| `src/db/scopedQuery.ts` | Multi-user query scoping (new) |
| `src/db/scopedWrite.ts` | Multi-user write stamping (new) |
| `src/lib/auth/currentUser.ts` | userId source for scoping (new) |
| `eslint-plugin-data-scoping.js` | ESLint no-direct-db-access rule (new) |

---

## 12. Multi-User Data Filtering Architecture

> **Added:** 2026-03-28. Full design: `_bmad-output/planning-artifacts/architecture-multi-user-filtering.md`

### 12.1 Problem

Adding `userId` to tables without enforcing query-level filtering creates a data leak by default. All 78 current Dexie read operations are unscoped — `db.notes.toArray()` returns ALL notes from ALL users.

### 12.2 Solution: Scoped Helpers + ESLint Safety Net

**Three layers of defense:**

| Layer | Mechanism | Enforcement |
|-------|-----------|-------------|
| Structural | `scopedTable()` auto-injects userId into queries | By design — can't forget |
| Structural | `scopedWrite()` auto-stamps userId + updatedAt | By design — can't omit |
| Static | ESLint `no-direct-db-access` flags raw `db.table` access | Save-time warning |
| Reactive | Auth-change handler resets all stores on user switch | Automatic cleanup |

### 12.3 Key Patterns

```typescript
// READ: Before
db.notes.where({courseId}).toArray()
// READ: After
scopedTable('notes').where({courseId}).toArray()

// WRITE: Before
db.notes.put(note)
// WRITE: After
scopedPut('notes', note)

// Unauthenticated (userId = null): no filter applied — same as current behavior
```

### 12.4 Migration Effort

| Phase | Stores | Effort |
|-------|--------|--------|
| Foundation | Helpers + ESLint rule + auth handler | ~4-6 hours |
| P0 stores | contentProgress, sessions | ~2-3 hours |
| P1 stores | notes, bookmarks, flashcards, reviews | ~3-4 hours |
| P2-P3 stores | courses, paths, challenges, authors | ~3-4 hours |
| Transaction stores | courseImport, learningPaths, youtubeImport | ~3-4 hours |
| **Total** | **14 stores, 78 reads, 89 writes** | **~15-21 hours** |

Store migration aligns with sync epic phasing — migrate each store when it gets `syncableWrite()` wrapping.

---

## 13. Adversarial Review Findings (2026-03-28)

> **Full report:** `docs/reviews/adversarial/adversarial-review-2026-03-28-sync-architecture.md`

### HIGH Severity (Applied to Architecture)

| Finding | Resolution | Section Updated |
|---------|-----------|-----------------|
| studySessions LWW destroys valid sessions | Changed to INSERT-only merge | §1 Sync Strategy |
| ~40-50 write actions to wrap (not ~15) | Documented accurately; ESLint safety net added | §12 |
| exportService at v14 missing 16 tables | Pre-requisite story created | §11.5 |
| No rollback compounds with export gap | Fixed by exportService reconciliation | §11.5 |

### MEDIUM Severity (Accepted or Deferred)

| Finding | Resolution |
|---------|-----------|
| contentProgress LWW ignores status regression | Added status precedence rule (§1) |
| SM-2 replay loses interval context | Accepted — self-corrects over 5+ reviews. Document as known limitation. |
| Story estimate optimistic | Revised to MVP-first approach (§10, §11.7) |
| No post-sync data integrity verification | Add periodic count reconciliation in Phase 2 |
| No "sync breaks" failure documentation | Deferred to Phase 2 — MVP is simple enough |

### LOW Severity (Deferred)

Field mapping maintenance, orphaned data cleanup, Realtime complexity — all deferred per MVP-first approach.

---

## Appendix A: Edge Cases & Mitigations

> Generated via exhaustive path analysis of this architecture document. 33 edge cases across 7 categories. Tier 1 fixes are already applied inline above. Tier 2 items are captured as story AC in Section 9. Tier 3 items are accepted risks documented here.

### Tier 1 — Fixed in Architecture (Critical)

These structural changes are embedded in the relevant sections above.

| ID | Edge Case | Section Fixed |
|----|-----------|---------------|
| 1.3 | Concurrent sync cycles — no mutex | §3.4 (navigator.locks) |
| 1.5 | Apply crash leaves `isSyncing = true` forever | §3.4 (try/finally) |
| 1.8 | `lastSyncTimestamp` from client clock causes missed records | §3.4 (server-authoritative) |
| 2.1 | LWW with device clock skew | §5.1 (server timestamps) |
| 2.2 | LWW tie behavior undocumented | §5.1 (remote wins ties) |
| 3.5 / 5.1 | Compound PK cursor incompatible with `.where('id')` | §6.2 (compound key cursor) |
| 4.1 | First login claims all pre-existing records silently | §4.6 (confirmation dialog) |
| 4.2 | Sync queue from previous user uploaded with wrong auth | §4.6 (park other user's entries) |
| 4.3 | Auth change during active sync cycle | §4.6 (AbortController) |
| 5.5 | Idempotent upsert `<` prevents `synced_at` refresh on retry | §6.3 (`<=` fix) |
| 6.3 | Out-of-order Realtime events overwrite fresh data | §3.5 (timestamp compare) |
| 6.2 | JWT expires on open Realtime connection | §3.5 (health check + re-subscribe) |
| X.2 | Unauthenticated writes pollute sync queue | §3.2 (`syncableWrite` userId guard) |

### Tier 2 — Story Acceptance Criteria (Important)

These are captured as ⚠️ AC items in Section 9 story tables.

| ID | Edge Case | Story |
|----|-----------|-------|
| 1.2 | Partial batch failure marks all 100 as synced | Epic 1 S04 |
| 1.7 | Download `>` misses records at exact timestamp | Epic 1 S04 |
| 2.5 | Deleted flashcard + orphan reviews crash replay | Epic 3 S08 |
| 2.7 | Identical `reviewedAt` timestamps → unstable sort | Epic 3 S08 |
| 5.2 | Records added during initial upload → stale count | Epic 2 S04 |
| 6.5 | Realtime filter bypass delivers other user's data | Epic 2 S03 |
| X.4 | Field map incompleteness silently drops fields | Epic 1 S06 |

### Tier 3 — Accepted Risks (Monitor)

These are low-likelihood or self-correcting. Revisit if assumptions change.

| ID | Edge Case | Why Accepted | Revisit Trigger |
|----|-----------|-------------|-----------------|
| 1.4 | Write during upload between re-read and upsert | Self-corrects next sync cycle (30s). Only affects same record edited twice in <1s window. | If sync interval increases beyond 60s |
| 1.6 | Apply-triggered store action creates untracked derived write | Rare: most Zustand updates don't trigger side-effect writes. Document which store actions are "sync-safe" during implementation. | If derived writes (streak recalc, badge awards) are added to synced stores |
| 2.3 | Cascading note conflict copies accumulate | Single-user app; simultaneous offline edits to the same note are rare. | If multi-user editing is added, or users report copy spam |
| 2.4 | Conflict copy appears on other device without context toast | The `conflict-copy` tag makes it identifiable. Minor UX annoyance. | If user feedback indicates confusion |
| 2.6 | SM-2 algorithm version drift across app versions | All devices auto-update; version skew window is small. `calculateNextReview()` is stable. | If FSRS migration changes the algorithm |
| 3.2 | Large dataset IndexedDB transaction timeout during migration | Current max table is ~10K records. Dexie transactions handle this fine. | If any table exceeds 100K records |
| 3.3 | No rollback mechanism for Dexie migrations | Standard Dexie limitation. Export service provides data recovery path. | If migration corrupts data in testing |
| 3.4 | Mid-migration crash between v28 and v29 | Each version is independent — v28 works without v29. Sync engine checks for field presence. | Never (by design) |
| 5.3 | Verification step undefined in wizard | Implement count comparison during Epic 2 S04. Not architectural. | Story implementation |
| 5.4 | User navigates away mid-wizard | Fixed in §6.2 (background banner). Remaining UX detail for story. | Story implementation |
| 5.6 | Storage estimate inaccuracy on new device download | Cosmetic. Estimate is directionally correct for small datasets. | If users report >10x estimate errors |
| 6.1 | Reconnection gap shows stale data | Window is seconds. Post-reconnect download fills the gap quickly. | If reconnect download takes >10s |
| 6.4 | Realtime event overlaps with download phase apply | Timestamp comparison (§3.5 fix) prevents stale overwrites. Minor duplicate-apply is idempotent. | Never (mitigated by Tier 1 fix) |
| 6.6 | Stale Realtime subscription after failed unsubscribe | Defensive try/catch added in §4.6 logout flow. Worst case: resource leak until page reload. | If memory profiling shows channel accumulation |
| 6.7 | Polling fallback asymmetry (upload 30s, download 60s) | Fixed in §3.5 (aligned to 30s). | Already fixed |
| X.1 | No schema version negotiation between client and server | All tables deployed before client upgrade. Self-hosted = controlled rollout. | If client/server deploy independently |
| X.3 | Dead-letter queue grows unbounded | Add 30-day TTL + "Clear all failed" button in Epic 4 S05 (sync log UI). | Epic 4 implementation |
