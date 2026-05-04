---
title: "feat: Bridge Book Reading Sessions into Learning Ecosystem"
type: feat
status: active
date: 2026-04-28
origin: docs/brainstorms/2026-04-28-bridge-books-learning-ecosystem-requirements.md
---

# feat: Bridge Book Reading Sessions into Learning Ecosystem

## Overview

Book reading sessions are captured locally but invisible to Knowlune's motivational systems — they never sync to Supabase, don't appear in the dashboard, and don't register in the knowledge map. This plan fixes the data pipeline (broken field mapping in the sync registry), unifies all session writes through a shared helper, adds reading-specific widgets to the Overview dashboard, gives book sessions a voice in the knowledge map's engagement tracking, and enforces a 5-minute minimum for streak eligibility.

## Problem Frame

`useReadingSession` and `useAudioListeningSession` capture session duration and emit events, but write to Dexie via raw `db.studySessions.add()` — bypassing the sync engine entirely. Book sessions never reach Supabase, so the server-side study streak ignores them. The knowledge map's engagement query groups by `courseId`; book sessions use `courseId: ''` as a sentinel, creating orphaned entries no topic references. Meanwhile, the `studySessions` table registry entry has an empty `fieldMap`, producing wrong Supabase column names for ALL session types (`startTime` → `start_time` instead of `started_at`, etc.) — a silent dead-letter failure even for course sessions.

The app has a partially-built reading stack: `ReadingStatsService`, `DailyGoalRing`, `ProgressRing`, `useReadingGoalStore`, and Reports-page components exist but are isolated to the Reports tab. The Overview dashboard — the primary engagement surface — shows no reading activity at all.

## Requirements Trace

- **R1.** Book/audiobook sessions sync to Supabase `study_sessions` via `syncableWrite`, matching the course session write path.
- **R2.** All session types (course, book reading, audiobook listening) route through a single shared `persistStudySession` helper.
- **R1a.** Fix the `studySessions` table registry entry: correct `fieldMap` (4 mappings), `stripFields` (9 Dexie-only fields), and `cursorField: 'created_at'` (fixes known issue where sync engine queries `order=updated_at.asc` on a table with only `created_at`).
- **R3.** Overview dashboard shows a "Currently Reading" card (most recent unfinished book from `books` Dexie table: `progress > 0 AND progress < 100`, sorted by `lastOpenedAt` desc). Taps navigate to `/library/:bookId/read`.
- **R4.** Overview shows "Reading Stats" row: books finished this year, total reading time (hours/minutes), current study streak (inclusive of reading days).
- **R5.** Activity heatmap includes days where the user completed a reading or listening session. (Client-side heatmap already includes `book_read`/`book_listened`; sync fix makes server-side streak also feed the heatmap.)
- **R6.** Overview shows "Recent Reading Sessions" list: last 5 sessions with book title, duration, and relative time.
- **R7.** Separate reading goal ring (daily minutes target) alongside the existing course study goal ring — not merged.
- **R8.** Book/audiobook sessions contribute to a global `lastEngagement` timestamp in the knowledge map, preventing false "no recent activity" for reading-primary users.
- **R9.** 5-minute minimum duration threshold for streak eligibility (separate from the 30-second data capture threshold). Sessions between 30s and 5min are persisted and synced but excluded from streak computation.

## Scope Boundaries

**In scope:**
- Fix `studySessions` table registry field mapping (prerequisite — broken for ALL session types)
- Extract shared `persistStudySession` helper, refactor `useSessionStore` to also call it
- Wire `useReadingSession` and `useAudioListeningSession` to sync via `persistStudySession`
- Add `'reading-overview'` dashboard section with reading widgets (conditional: hidden for course-only users)
- Add `globalLastEngagement` to knowledge map state and computation
- Server-side 5-minute streak threshold in `compute_reading_streak` RPC

**Explicitly out of scope:**
- Book topic extraction (mapping book genres/topics to knowledge map topics)
- Notification changes (reading streak notifications)
- Highlight-to-knowledge NLP pipeline
- Changes to the Reports page
- Changes to the Library page itself
- Per-chapter or per-book content progress tracking in `contentProgress`

## Context & Research

### Relevant Code and Patterns

**Sync pipeline:**
- `src/lib/sync/tableRegistry.ts:124-131` — `studySessions` entry: priority 0, insert-only, empty `fieldMap`
- `src/lib/sync/syncableWrite.ts:72-212` — single write path: stamps userId/updatedAt, writes Dexie, enqueues sync queue
- `src/lib/sync/fieldMapper.ts:68-72` — `toSnakeCase` honors `entry.stripFields` + `entry.vaultFields` for stripping; `fieldMap` for column name overrides
- `src/lib/sync/tableRegistry.ts:269` — `audioBookmarks` entry demonstrates `cursorField: 'created_at'` pattern for append-only tables

**Session capture:**
- `src/app/hooks/useReadingSession.ts:71` — writes `db.studySessions.add()` directly (no sync)
- `src/app/hooks/useAudioListeningSession.ts:69` — same pattern
- `src/stores/useSessionStore.ts:255,342` — two call sites using `syncableWrite('studySessions', 'put', ...)` (already correct pattern, will route through shared helper)

**Dashboard:**
- `src/lib/dashboardOrder.ts` — `DashboardSectionId` union (11 IDs), `DEFAULT_ORDER`, `SECTION_LABELS`, 3-step section registration pattern
- `src/app/pages/Overview.tsx:196` — `sectionRenderers` map, rendered at line 477

**Books data:**
- `src/data/types.ts:796` — `Book` interface: `progress: number` (0-100), `status: BookStatus`, `finishedAt?: string`, `lastOpenedAt?: string`
- Dexie `books` indexes: `status`, `lastOpenedAt`, `[userId+updatedAt]`

**Knowledge map:**
- `src/stores/useKnowledgeMapStore.ts:244-251` — `lastEngagementByCourse` Map built from `session.courseId`; book sessions (`courseId: ''`) are invisible
- `src/stores/useKnowledgeMapStore.ts:406` — `set()` call where new state field must be added

**Supabase study_sessions schema** (`supabase/migrations/20260413000001_p0_sync_foundation.sql`):
- Columns: `id`, `user_id`, `started_at`, `duration_seconds`, `idle_seconds`, `interaction_count`, `breaks`, `created_at`, `client_request_id`
- No `updated_at` column (append-only insert-only log)

### Institutional Learnings

- **Single write path for synced mutations** (`docs/solutions/best-practices/single-write-path-for-synced-mutations-2026-04-18.md`): Every store must write through `syncableWrite()`. Scattered write paths are the #1 source of sync drift. This plan's `persistStudySession` helper is the enforcement mechanism.
- **fieldMap inheritance** (`docs/solutions/sync/e93-s02-notes-bookmarks-sync-wiring-2026-04-18.md`, Pattern 6): Field mappings set in table registry are inherited by all downstream wiring. Never re-declare. Always check the existing registry entry before adding mappings.
- **Append-only cursor column** (`docs/solutions/sync/e93-closeout-sync-patterns-2026-04-18.md`, Pattern 3): Append-only tables must register `cursorField: 'created_at'`, not the default `updated_at`, or the download engine silently skips all rows.
- **KNOWN ISSUE** (`docs/known-issues.yaml`, KI-supabase-cloud-sync-updated-at): Sync engine queries `?order=updated_at.asc` against `study_sessions` which only has `created_at`, returning 400 on every sync cycle. Fix: set `cursorField: 'created_at'` in table registry.

### External References

None required — codebase has strong local patterns for sync wiring, dashboard section registration, and Dexie queries.

## Key Technical Decisions

- **Approach B — Unify session writing** (see origin): Extract `persistStudySession()` at `src/lib/sessions/persistStudySession.ts`. All three session sources route through it. Prevents future write-path drift.
- **Module placement — `src/lib/sessions/`** (not `src/lib/sync/`): `persistStudySession` is a domain-level helper that happens to use sync infrastructure, not a sync primitive. The new directory may host future session-related utilities.
- **`stripFields` includes `updatedAt`**: `syncableWrite` stamps `updatedAt` on every record, but Supabase `study_sessions` has no `updated_at` column. Must be stripped from the upload payload.
- **Knowledge map — new `globalLastEngagement` field**: Scanned from ALL study sessions regardless of `courseId`. Separate from per-topic recency (which remains course-scoped). Preserves trust in per-topic knowledge scores while preventing false "inactive" state.
- **5-minute threshold at streak computation, not data capture**: Sessions ≥30s are persisted and synced. The 5-minute filter lives in the `compute_reading_streak` RPC (server-side) and the `logStudyAction` call site (client-side, via a conditional guard in the hooks). Keeps the persistence layer simple and ensures consistent threshold behavior regardless of client.
- **Dashboard layout — single new `'reading-overview'` section**: All reading widgets grouped under one `DashboardSectionId`, fitting the existing 11-section `DashboardCustomizer` pattern. Positioned after `insight-action` and before `course-gallery` in the default order.
- **"Currently Reading" data source**: Most recent unfinished book from Dexie `books` table (`progress > 0 AND < 100`, sorted by `lastOpenedAt` desc). No new data model.
- **"Books finished" data source**: `books.status === 'finished'` with `finishedAt` timestamp filtered to current year.

## Open Questions

### Resolved During Planning

- **[R1a] Exact fieldMap entries**: `startTime→started_at`, `duration→duration_seconds`, `idleTime→idle_seconds`, `breakCount→breaks`. `interactionCount` converts correctly via auto camelCase→snake_case. Dexie-only fields stripped: `courseId`, `contentItemId`, `endTime`, `videosWatched`, `lastActivity`, `sessionType`, `qualityScore`, `qualityFactors`, `updatedAt`.
- **[R2] Helper location**: `src/lib/sessions/persistStudySession.ts` — new module, domain-level helper.
- **[R3-R7] Component reuse strategy**: Reuse `ProgressRing`, `DailyGoalRing`, and `ReadingStatsService` utilities (not full Reports-page components). Build fresh `ReadingOverviewSection` composite component for the dashboard context.
- **[R8] Knowledge map architecture**: New `globalLastEngagement: string | null` state field. Computed by scanning ALL study sessions for the most recent timestamp, independent of `courseId`. Set alongside existing state in the `computeScores()` `set()` call.

### Deferred to Implementation

- Exact Dexie query syntax for "Currently Reading" book lookup
- Book cover image variant and size for the overview card
- Exact grid layout of the reading stats row (responsive breakpoints)
- Visual styling details for the reading overview section (delegated to design review)
- Whether the client-side 5-minute `logStudyAction` guard should also apply to existing study session types (`lesson_complete`, `video_progress`, etc.) or only to `book_read`/`book_listened`

## Implementation Units

### Unit 1: Fix studySessions tableRegistry field mapping

**Goal:** Correct the `studySessions` registry entry so uploads produce valid Supabase column names and Dexie-only fields are stripped. Fixes the known `cursorField` issue for the download engine.

**Requirements:** R1a

**Dependencies:** None (prerequisite for all other units)

**Files:**
- Modify: `src/lib/sync/tableRegistry.ts`
- Test: `src/lib/sync/__tests__/tableRegistry.test.ts`

**Approach:**
- Add `fieldMap` with 4 entries: `startTime→started_at`, `duration→duration_seconds`, `idleTime→idle_seconds`, `breakCount→breaks`
- Add `stripFields` with 9 entries: `courseId`, `contentItemId`, `endTime`, `videosWatched`, `lastActivity`, `sessionType`, `qualityScore`, `qualityFactors`, `updatedAt`
- Add `cursorField: 'created_at'` (fixes known issue KI-supabase-cloud-sync-updated-at)
- `interactionCount` converts correctly via auto camelCase→snake_case and should NOT be stripped

**Patterns to follow:**
- Existing `fieldMap` entries in `tableRegistry.ts` (e.g., `bookHighlights`, `chapterMappings`)
- `audioBookmarks` entry at line 269 for `cursorField: 'created_at'` pattern

**Test scenarios:**
- Happy path: `toSnakeCase` with the updated registry entry converts `startTime` to `started_at`, `duration` to `duration_seconds`, `idleTime` to `idle_seconds`, `breakCount` to `breaks`
- Strip fields: Dexie-only fields (`courseId`, `contentItemId`, `endTime`, `videosWatched`, `lastActivity`, `sessionType`, `qualityScore`, `qualityFactors`, `updatedAt`) are absent from the output
- Edge case: `interactionCount` passes through as `interaction_count` (not stripped, correct auto conversion)
- Edge case: `id` and `userId` pass through unchanged (not in fieldMap, not in stripFields)
- Regression: Verify `cursorField` equals `'created_at'` on the studySessions entry

**Verification:**
- Registry snapshot test confirms the studySessions entry has the correct fieldMap, stripFields, and cursorField values
- Round-trip test: a sample Dexie record produces valid Supabase column names and excludes Dexie-only fields

---

### Unit 2: Extract persistStudySession helper

**Goal:** Create a shared `persistStudySession()` function that wraps `syncableWrite('studySessions', ...)` and serves as the single write entry point for all session types.

**Requirements:** R2

**Dependencies:** Unit 1 (fieldMap must be correct for syncableWrite to produce valid payloads)

**Files:**
- Create: `src/lib/sessions/persistStudySession.ts`
- Test: `src/lib/sessions/__tests__/persistStudySession.test.ts`

**Approach:**
- Thin wrapper around `syncableWrite('studySessions', operation, record)`
- Accepts `operation: 'add' | 'put'` — `'add'` for new sessions (book/audio hooks), `'put'` for session updates (course session store)
- Does NOT handle threshold logic (30s capture minimum, 5min streak minimum) — those belong at the call site or in streak computation
- Does NOT compose with `logStudyAction` or `appEventBus.emit` — those remain at the call site
- Exports a single async function with a narrow, documented signature

**Technical design** (directional guidance, not implementation specification):

```typescript
// persistStudySession is a thin wrapper that provides a stable API surface
// for all session-writing call sites while ensuring every write goes through
// the same syncableWrite path (field mapping, stripping, userId stamping, queue enqueue).
export async function persistStudySession(
  operation: 'add' | 'put',
  session: { id: string } & Record<string, unknown>
): Promise<void> {
  await syncableWrite('studySessions', operation, session as SyncableRecord)
}
```

**Patterns to follow:**
- `syncableWrite` itself — the canonical write wrapper pattern
- Keep the module pure (no React imports, no Zustand hooks — `syncableWrite` internally reads `useAuthStore.getState()`)

**Test scenarios:**
- Happy path: calls `syncableWrite` with table name `'studySessions'` and operation `'add'`
- Happy path: calls `syncableWrite` with operation `'put'`
- Edge case: passes through the session record fields (spy on syncableWrite to verify the record argument)

**Verification:**
- `persistStudySession('add', mockSession)` results in a Dexie write + sync queue entry
- Both `'add'` and `'put'` operations work correctly

---

### Unit 3: Wire book/audiobook hooks to sync

**Goal:** Replace raw `db.studySessions.add()` calls in `useReadingSession` and `useAudioListeningSession` with `persistStudySession('add', ...)`. Route `useSessionStore`'s existing `syncableWrite` calls through the shared helper.

**Requirements:** R1, R2

**Dependencies:** Unit 2 (persistStudySession must exist)

**Files:**
- Modify: `src/app/hooks/useReadingSession.ts`
- Modify: `src/app/hooks/useAudioListeningSession.ts`
- Modify: `src/stores/useSessionStore.ts`

**Approach:**

`useReadingSession.ts` (line 71):
- Replace `db.studySessions.add(sessionRecord)` with `persistStudySession('add', sessionRecord)`
- Keep existing `logStudyAction({type: 'book_read', ...})` call (client-side streak)
- Keep existing `appEventBus.emit({type: 'reading:session-ended', ...})` call (local consumers)
- Import `persistStudySession` from `@/lib/sessions/persistStudySession`

`useAudioListeningSession.ts` (line 69):
- Same pattern: replace `db.studySessions.add(sessionRecord)` with `persistStudySession('add', sessionRecord)`
- Keep `logStudyAction({type: 'book_listened', ...})` and `appEventBus.emit` calls

`useSessionStore.ts` (lines 255 and 342):
- Replace `syncableWrite('studySessions', 'put', closedSession)` with `persistStudySession('put', closedSession)` in `endSession()`
- Same replacement in `recoverOrphanedSessions()`

**Patterns to follow:**
- Existing `syncableWrite` call pattern in `useSessionStore.endSession()` — same error handling (fire-and-forget with `.catch()`)

**Test scenarios:**
- Happy path: reading session ≥30s calls `persistStudySession('add', ...)` with correct record
- Happy path: audiobook session ≥30s calls `persistStudySession('add', ...)`
- Edge case: sessions below 30s threshold do NOT call persistStudySession (existing guard unchanged)
- Edge case: persistStudySession failure is caught and logged (non-critical, does not disrupt UX)
- Integration: course session endSession calls `persistStudySession('put', ...)` instead of raw `syncableWrite`
- Integration: recoverOrphanedSessions calls `persistStudySession('put', ...)` for each recovered session

**Verification:**
- After a 20+ minute reading session, a sync queue entry appears in `db.syncQueue` for the `studySessions` table
- The session record in Dexie has `userId` and `updatedAt` stamped (via syncableWrite)
- Existing course session flow continues to work unchanged

---

### Unit 4: Knowledge map global engagement timestamp

**Goal:** Add a `globalLastEngagement` field to the knowledge map state so the "no recent activity" guard considers book/audiobook sessions.

**Requirements:** R8

**Dependencies:** Unit 3 (logically — book sessions should exist for this to be meaningful, but the code change is independent since it reads from Dexie directly)

**Files:**
- Modify: `src/stores/useKnowledgeMapStore.ts`

**Approach:**
1. Add `globalLastEngagement: string | null` to the `KnowledgeMapState` interface (after `lastComputedAt` at line 89)
2. Initialize as `null` in the default state (after `lastComputedAt: null` at line 122)
3. In `computeScores()`, after building `lastEngagementByCourse` (after line 268), scan ALL sessions for the most recent timestamp regardless of `courseId`:
   ```typescript
   let globalLastEngagement: string | null = null
   for (const session of allSessions) {
     const ts = session.endTime ?? session.startTime
     if (!globalLastEngagement || ts > globalLastEngagement) {
       globalLastEngagement = ts
     }
   }
   ```
4. Include `globalLastEngagement` in the `set()` call at line 406
5. Include `globalLastEngagement: null` in the error `set()` at line 416
6. In `invalidateCache()`, do NOT clear `globalLastEngagement` (it survives cache invalidation — it's computed from the same immutable session data)

**Patterns to follow:**
- Existing `lastEngagementByCourse` computation pattern (same scan shape, different grouping)
- Existing state initialization and `set()` patterns in the same store

**Test scenarios:**
- Happy path: set of sessions includes one with `courseId: ''` (book session) and `endTime: '2026-04-28T14:00:00Z'` → `globalLastEngagement` equals that timestamp
- Happy path: set of sessions is all course sessions → `globalLastEngagement` equals the most recent course session timestamp
- Edge case: no sessions exist → `globalLastEngagement` is `null`
- Edge case: multiple book sessions → `globalLastEngagement` equals the most recent one

**Verification:**
- The knowledge map no longer reports "no recent activity" for users whose only recent engagement is reading
- Per-topic scores remain unchanged (book sessions with `courseId: ''` do not affect any topic's `daysSinceLastEngagement`)

---

### Unit 5: Dashboard reading overview section

**Goal:** Add a `'reading-overview'` dashboard section displaying reading-specific widgets (Currently Reading, Reading Stats, Recent Sessions, Reading Goal Ring). Section is hidden for users with no reading activity.

**Requirements:** R3, R4, R5, R6, R7

**Dependencies:** Unit 3 (synced sessions provide the data that populates these widgets)

**Files:**
- Create: `src/app/components/overview/ReadingOverviewSection.tsx`
- Modify: `src/lib/dashboardOrder.ts`
- Modify: `src/app/pages/Overview.tsx`
- Test: `src/app/components/overview/__tests__/ReadingOverviewSection.test.tsx`

**Approach:**

**Step A — Register the section** (`src/lib/dashboardOrder.ts`):
- Add `'reading-overview'` to `DashboardSectionId` union
- Add `'reading-overview': 'Reading Overview'` to `SECTION_LABELS`
- Add `'reading-overview'` to `DEFAULT_ORDER` (between `'insight-action'` and `'course-gallery'`)

**Step B — Build the component** (`src/app/components/overview/ReadingOverviewSection.tsx`):
- Composite component that queries Dexie on mount for:
  1. Currently reading: `db.books` where `progress > 0 AND < 100`, sorted by `lastOpenedAt` desc, limit 1
  2. Reading stats: `getReadingStats()` from `ReadingStatsService` + books finished this year count
  3. Recent sessions: `db.studySessions` where `courseId === ''`, sorted by `startTime` desc, limit 5
  4. Book titles for recent sessions: join on `contentItemId` from `db.books`
- Returns `null` if no books exist AND no reading sessions exist (conditional visibility)
- Renders sub-components for each widget (R3, R4, R6, R7)
- Daily goal ring reuses the existing `DailyGoalRing` component from `src/app/components/library/DailyGoalRing.tsx`

**Component reuse:**
- `ProgressRing` — reusable SVG ring primitive
- `DailyGoalRing` — directly reusable as the R7 reading goal ring (reads from `useReadingGoalStore`)
- `useReadingGoalStore` — goal configuration and state
- `ReadingStatsService.getTimeReadToday()`, `getReadingStats()` — data queries
- `studyLog.getCurrentStreak()` — streak value (already includes book days)
- `formatDuration` from `src/lib/formatDuration` — time formatting

**Step C — Wire into Overview** (`src/app/pages/Overview.tsx`):
- Import `ReadingOverviewSection`
- Add renderer to `sectionRenderers` map with the standard motion wrapper and `createSectionRef`

**Test scenarios:**
- Happy path: section renders Currently Reading card when an in-progress book exists (cover, title, author, progress %)
- Happy path: section renders Reading Stats row (books finished, total reading time formatted, streak count)
- Happy path: section renders Recent Reading Sessions list (up to 5 items with book title, duration, relative time)
- Happy path: section renders DailyGoalRing reading goal ring
- Edge case: section returns `null` when no books and no reading sessions exist
- Edge case: section returns `null` during loading (prevents flash of empty section)
- Edge case: clicking Currently Reading card navigates to `/library/:bookId/read`
- Edge case: section gracefully handles books with missing `coverUrl` (shows initials glyph fallback)

**Verification:**
- Overview dashboard shows "Reading Overview" section (reorderable via DashboardCustomizer)
- Section appears for users who have reading activity, hidden for course-only users
- Currently Reading card links to the reader at `/library/:bookId/read`

---

### Unit 6: Server-side 5-minute streak threshold

**Goal:** Update the `compute_reading_streak` Supabase RPC to exclude sessions shorter than 5 minutes from streak computation.

**Requirements:** R9

**Dependencies:** Independent of Units 1-5 (pure SQL change; the RPC already aggregates `study_sessions` regardless of source)

**Files:**
- Modify: `supabase/migrations/20260425000001_compute_reading_streak.sql` (via new migration that `CREATE OR REPLACE FUNCTION`)
- Create: `supabase/migrations/20260429000001_reading_streak_min_duration.sql`
- Create: `supabase/migrations/rollback/20260429000001_reading_streak_min_duration_rollback.sql`

**Approach:**
- Add `AND s.duration_seconds >= 300` to the `per_day` CTE's `WHERE` clause in `compute_reading_streak`
- Sessions with `duration_seconds < 300` are excluded from the per-day aggregation, meaning they never contribute to streak days
- Sessions are still persisted and synced (Units 1-3 ensure this) — the filter is only in the streak computation
- Migration uses `CREATE OR REPLACE FUNCTION` for idempotency, carrying forward the full function body from the original migration plus the new filter

**Patterns to follow:**
- Existing `CREATE OR REPLACE FUNCTION` pattern in Supabase migrations
- Timestamp-prefix migration filenames (Supabase CLI convention)

**Test scenarios:**
- Happy path: sessions with `duration_seconds >= 300` are included in the per-day aggregation
- Edge case: sessions with `duration_seconds < 300` are excluded from per-day aggregation
- Edge case: a day with mixed sessions (one ≥5min, one <5min) correctly counts the day as active
- Regression: sessions below 30s never reach this RPC (filtered by client-side 30s minimum)

**Verification:**
- After a 20-minute reading session, the user's streak increments the next day
- A 2-minute reading session (above 30s data capture, below 5min streak threshold) persists to Supabase but does not affect the streak

---

## System-Wide Impact

- **Interaction graph:** `useReadingSession` → `persistStudySession` → `syncableWrite` → Dexie write + `syncQueue` insert + `syncEngine.nudge()`. `useAudioListeningSession` follows the same path. `useSessionStore` → `persistStudySession` replaces the existing direct `syncableWrite` call. `useKnowledgeMapStore.computeScores()` gains a new scan pass over all sessions (minimal overhead — same data already loaded).
- **Error propagation:** `persistStudySession` failures in the hooks are caught and logged (non-critical UX path, same as current behavior). Sync queue insert failures inside `syncableWrite` are swallowed (existing pattern — the next full scan reconciles). Dexie write failures rethrow (fatal — callers catch and log).
- **State lifecycle risks:** `globalLastEngagement` is computed fresh on every `computeScores()` call. It does not persist separately — derived from session data. No partial-write or cache risk beyond the existing 30-second cache window.
- **API surface parity:** The `persistStudySession` helper provides a single API surface for all session writes. Future session types (e.g., podcast listening, video courses from a new source) should use this same helper.
- **Integration coverage:** The sync pipeline integration (Dexie write → queue enqueue → Supabase upload → download on second device) spans three layers. Unit tests alone cannot prove this works end-to-end. Manual verification: start a reading session on device A, wait for sync, verify session appears on device B.
- **Unchanged invariants:** Per-topic knowledge map scoring is unchanged (book sessions with `courseId: ''` do not affect any topic's score). Course study goal ring meaning is preserved (reading time does not affect the course ring). 30-second data capture minimum is unchanged. `contentProgress` table is unchanged. Book progress tracking (`Book.progress`, `Book.status`) is unchanged.

## Risks & Dependencies

| Risk | Mitigation |
|------|------------|
| `beforeunload` sync loss: `syncableWrite` adds more async work than raw `db.add()`, increasing chance queue insert doesn't complete during tab close | Accepted trade-off. The sync engine's next full scan reconciles Dexie rows without matching sync queue entries. The React cleanup (useEffect unmount) catches navigation-based session ends reliably. |
| Anonymous/guest sessions never sync: `syncableWrite` skips queue creation when `userId` is null | Deferred to E92-S08 backfill scope. `guestSessionId` co-stamping in `syncableWrite` ensures future backfill can disambiguate. |
| `studySessions` fieldMap change affects existing course session sync: course sessions already go through `syncableWrite`, so the fieldMap fix ALSO corrects course session uploads | This is the intended behavior — course session uploads are currently producing `start_time`/`duration` instead of `started_at`/`duration_seconds`. The fix corrects ALL session types. Verify course session sync still works after the change. |
| Dashboard section shows stale data: a user who reads on device A and opens dashboard on device B may see stale data | Same staleness applies to all overview sections. Accepted as inherent to offline-first architecture. |
| `compute_reading_streak` RPC deployment: requires Supabase migration apply | Migration uses `CREATE OR REPLACE FUNCTION` (idempotent, safe to apply multiple times). Test on staging first. |

## Sources & References

- **Origin document:** [docs/brainstorms/2026-04-28-bridge-books-learning-ecosystem-requirements.md](../brainstorms/2026-04-28-bridge-books-learning-ecosystem-requirements.md)
- Related code:
  - `src/lib/sync/tableRegistry.ts` — studySessions registry entry
  - `src/lib/sync/syncableWrite.ts` — single write path
  - `src/lib/sync/fieldMapper.ts` — toSnakeCase + stripFields logic
  - `src/app/hooks/useReadingSession.ts` — book reading session capture
  - `src/app/hooks/useAudioListeningSession.ts` — audiobook session capture
  - `src/stores/useSessionStore.ts` — course session store
  - `src/stores/useKnowledgeMapStore.ts` — knowledge map state + computeScores
  - `src/lib/dashboardOrder.ts` — dashboard section system
  - `src/app/pages/Overview.tsx` — overview page + section renderers
  - `src/app/components/library/DailyGoalRing.tsx` — reusable reading goal ring
  - `src/app/components/library/ProgressRing.tsx` — reusable SVG ring
  - `src/services/ReadingStatsService.ts` — reading stats queries
  - `src/lib/studyLog.ts` — client-side streak (logStudyAction, getCurrentStreak)
  - `supabase/migrations/20260413000001_p0_sync_foundation.sql` — study_sessions DDL
  - `supabase/migrations/20260425000001_compute_reading_streak.sql` — streak RPC
- Related known issues: `docs/known-issues.yaml` — KI-supabase-cloud-sync-updated-at (lines 1692-1698)
- Related learnings:
  - `docs/solutions/best-practices/single-write-path-for-synced-mutations-2026-04-18.md`
  - `docs/solutions/sync/e93-closeout-sync-patterns-2026-04-18.md`
  - `docs/solutions/sync/e93-s02-notes-bookmarks-sync-wiring-2026-04-18.md`
