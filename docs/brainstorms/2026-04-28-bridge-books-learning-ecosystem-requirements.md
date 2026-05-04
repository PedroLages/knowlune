---
date: 2026-04-28
topic: bridge-books-learning-ecosystem
---

# Bridge Books into the Learning Ecosystem

## Problem Frame

Book reading sessions are invisible to the app's motivational systems. A user who reads for 3 hours sees a study streak at zero, an empty activity heatmap, and a knowledge map that shows no recent engagement. Books and courses are completely separate experiences despite being the same activity — learning.

The data pipeline is partially built: `useReadingSession` and `useAudioListeningSession` already capture session duration, emit events on `appEventBus` (`reading:session-ended`, `listening:session-ended`), and write to Dexie `studySessions`. But the writes bypass the sync engine (`db.studySessions.add()` instead of `syncableWrite()`), so book sessions never reach Supabase and are invisible to the server-side study streak. Additionally, the knowledge map ignores these sessions because its engagement query groups by `courseId` and book/audiobook sessions write `courseId` as empty string — a separate root cause from the sync pipeline gap.

## Requirements

**Sync Pipeline Fix**
- R1. Book reading sessions and audiobook listening sessions MUST sync to Supabase `study_sessions` via the existing sync engine, using the same write path as course study sessions.
- R2. Session persistence MUST use a single shared helper (`persistStudySession`) for all session types (course, book reading, audiobook listening) to prevent future write-path drift.
- R1a. The `studySessions` table registry entry (`src/lib/sync/tableRegistry.ts:124-131`) has an empty `fieldMap`. The Dexie-to-Supabase column mapping MUST be fixed as a prerequisite — the current auto camelCase→snake_case conversion produces wrong column names (`start_time` instead of `started_at`, `duration` instead of `duration_seconds`, etc.), causing silent dead-letter failures for ALL session types, not just books.

**Dashboard — Rich Reading Section**
- R3. The Overview dashboard MUST include a "Currently Reading" card showing the user's in-progress book with cover, title, author, and progress percentage. The card displays the most recent unfinished book (queried from the `books` Dexie table: `progress > 0 AND progress < 100`, sorted by `lastOpenedAt` descending). Tapping navigates directly to the reader at `/library/:bookId/read` until a book detail page exists.
- R4. The Overview dashboard MUST include a "Reading Stats" row showing: books finished this year (count where `books.status === 'finished'` and `finishedAt` is current year), total reading time (hours/minutes), and current study streak (inclusive of reading days).
- R5. The existing activity heatmap on Overview MUST include days where the user completed a reading or listening session. (Verification note: the client-side heatmap already includes `book_read` and `book_listened` in `activityFromLog()`; this requirement ensures the server-side streak data also feeds the heatmap after sync.)
- R6. The Overview dashboard MUST include a "Recent Reading Sessions" list showing the last 5 sessions with book title, duration, and relative time ("2 hours ago").
- R7. The Overview dashboard MUST include a separate reading goal ring (daily minutes target) using the existing Apple Books-style visual pattern, displayed alongside — not merged with — the existing course study goal ring. The reading ring fills from reading and listening session time only, preserving the course ring's existing meaning for current users.
- R9. Reading and listening sessions MUST meet a minimum 5-minute duration threshold to count toward the study streak. This is separate from the data capture threshold (30 seconds, which remains unchanged for session logging). Sessions between 30 seconds and 5 minutes are persisted and synced but do not contribute to streak computation.

**Knowledge Map Engagement**
- R8. Book and audiobook study sessions MUST contribute to the global "last engagement" timestamp in the knowledge map, so the knowledge map does not show "no recent activity" for users who read daily but have not taken quizzes or completed lessons recently.

## Success Criteria

- After a 20+ minute reading session, the user's study streak increments the next day (visible on Overview and streak displays). The existing client-side streak (localStorage studyLog) already counts `book_read` and `book_listened`; this success criterion targets the server-authoritative streak via Supabase `compute_reading_streak`.
- The Overview dashboard shows book covers in "Currently Reading," not just course cards.
- The activity heatmap has dots on days the user read, not just days they took lessons.
- The knowledge map no longer reports "no recent activity" for users whose primary learning activity is reading.
- Reading sessions appear in the sync queue and are visible on a second device after sync completes.

## Scope Boundaries

**In scope:**
- Fix the `studySessions` sync pipeline field mapping (prerequisite — broken for ALL session types)
- Fix the sync pipeline for `useReadingSession` and `useAudioListeningSession`
- Refactor `useSessionStore` to also call `persistStudySession` instead of raw `syncableWrite`
- Extract a shared `persistStudySession` helper (all three session sources route through it)
- Add reading-specific widgets to the Overview dashboard (conditional on user having reading activity — course-only users see no change)
- Include book sessions in knowledge map recency calculation

**Explicitly out of scope:**
- Book topic extraction (mapping book genres/topics to knowledge map topics)
- Notification changes (reading streak notifications, "you read today" pings)
- Highlight-to-knowledge NLP pipeline (future project, added to roadmap)
- Changes to the Reports page (separate work)
- Changes to the Library page itself (covered by library organization ideation)
- Per-chapter or per-book content progress tracking in `contentProgress`

## Key Decisions

- **Approach B — Unify session writing:** Extract a shared `persistStudySession()` helper that wraps `syncableWrite`. Both book hooks and the course `useSessionStore` route through it. Chosen over minimal fix (Approach A) to prevent future write-path drift as new session types are added.
- **Rich dashboard over minimal:** Full reading section on Overview rather than a single widget. Rationale: reading is a primary activity type, not a secondary metric. It deserves equal visual weight to course progress.
- **Separate reading goal ring:** A dedicated reading ring alongside the existing course study ring. Chosen over a combined ring to preserve trust — existing users' course goals are not silently redefined to include reading time.
- **Knowledge map — global engagement timestamp:** Book sessions contribute a new `globalLastEngagement` timestamp to the knowledge map state, separate from per-topic scoring. Per-topic scores remain based on quizzes and flashcards only. Preserves trust in knowledge map scoring while preventing false "inactive" state for reading-primary users.
- **"Currently Reading" data source:** Most recent unfinished book from the `books` Dexie table (`progress > 0 AND progress < 100`, sorted by `lastOpenedAt` desc). No new data model needed — the reader already tracks position.
- **"Books finished" data source:** Uses the existing `books.status === 'finished'` field with `finishedAt` timestamp. No new completion model needed.
- **Streak threshold — 5 minutes:** Separate from the 30-second data capture threshold. Sessions between 30s and 5min are logged and synced but do not count toward streaks. Chosen to align book session streak eligibility with the effort level of course sessions.
- **Dashboard layout — single new section:** All reading widgets grouped under a new `'reading-overview'` `DashboardSectionId`, fitting the existing 11-section `DashboardCustomizer` pattern.
- **Defer notifications and topic extraction:** Both are genuine features with their own design questions. Tackling them now would delay the core value of "reading counts."

## Dependencies / Assumptions

- **Assumption:** `syncableWrite('studySessions', 'add', ...)` works correctly for book session records. The table registry already maps `studySessions` → Supabase `study_sessions` at P0 priority with insert-only strategy. The column mapping (duration → duration_seconds, idleTime → idle_seconds) is handled by the sync engine's field map.
- **Assumption:** The `compute_reading_streak` Supabase RPC aggregates all `study_sessions` rows regardless of source. It does not filter by `courseId` (which isn't even a column in the Supabase schema — it's Dexie-only).
- **Dependency:** E92 sync engine must be operational. Book sessions will sync through the same P0 pipeline as course sessions.
- **Dependency:** `useReadingSession` minimum data-capture threshold (30 seconds) and `useAudioListeningSession` thresholds remain unchanged for session logging. R9 adds a separate 5-minute threshold for streak eligibility — sessions between 30s and 5min are logged and synced but excluded from streak computation.
- **Risk:** `useReadingSession.endSession()` is called from a `beforeunload` handler. The existing code documents that async Dexie writes may not complete during tab close. Switching to `syncableWrite` (which adds userId lookup + field mapping + queue insert) increases the async work. Some tab-close sessions will be lost to sync (local Dexie write succeeds, sync queue entry does not). Mitigation: the React cleanup (useEffect unmount) catches the common navigation case; tab-close loss is accepted as a known trade-off.
- **Risk:** `syncableWrite` skips queue creation when `userId` is null (anonymous/guest sessions). Book sessions created while unauthenticated will persist to local Dexie but never sync. E92-S08 backfill mechanism exists but requires sign-in. Anonymous book session sync is deferred.

## Outstanding Questions

### Resolve Before Planning

None. All product decisions are resolved.

### Deferred to Planning

- [Affects R1a][Technical] The exact `fieldMap` entries needed in `tableRegistry.ts` for `studySessions` (Dexie fields → Supabase columns: `startTime→started_at`, `duration→duration_seconds`, `idleTime→idle_seconds`, `breakCount→breaks`). Also: Dexie-only fields (`endTime`, `sessionType`, `courseId`, `contentItemId`, `videosWatched`, `lastActivity`, `updatedAt`) must be either added to the Supabase schema or stripped before upload.
- [Affects R2][Technical] Where to place the shared `persistStudySession` helper — `src/lib/sync/` (alongside `syncableWrite`) or a new `src/lib/sessions/` module.
- [Affects R3-R7][Technical] Existing Reports components should be evaluated for reuse: `ReadingStatsSection`, `ReadingSummaryCard`, `ReadingPatternsCard`, `ReadingGoalsCard`, `ActivityHeatmap`, `StudyGoalsWidget` (with `ProgressRing`), and `DailyGoalRing`. Overview reading widgets should reuse or adapt these rather than rebuilding. (Dashboard layout decision: single new `'reading-overview'` `DashboardSectionId`. R3 link target: `/library/:bookId/read` until book detail page exists.)
- [Affects R8][Architecture] The knowledge map has no "global engagement" concept — engagement is per-topic, keyed by `courseId`. Book sessions (`courseId: ''`) create orphaned entries that no topic references. R8 requires adding a global `lastEngagementTimestamp` to the knowledge map state that is set independently of per-topic recency. This is a new architectural concept, not a query tweak.

## Next Steps

→ `/ce:plan` for structured implementation planning.
