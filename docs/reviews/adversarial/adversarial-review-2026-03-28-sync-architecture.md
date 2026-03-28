# Adversarial Review — Sync Architecture

> **Reviewed:** `docs/plans/sync-architecture.md` (1186 lines)
> **Date:** 2026-03-28
> **Reviewer stance:** Cynical, skeptical, looking for what's missing and what will break

---

## Findings

### 1. LWW for studySessions Is Data-Destructive, Not "Low-Stakes"

The doc claims "conflicts are low-stakes" for studySessions (§1 Sync Strategy table). This is wrong.

**Study sessions are append-only events, not mutable state.** Device A records a 45-minute study session. Device B records a different 50-minute session for the same course at an overlapping time. LWW picks the latest `updatedAt` and discards the other. You just destroyed a study session — the user's actual learning history is now inaccurate.

The doc treats studySessions like contentProgress (a status field you overwrite), but sessions are more like log entries. The correct strategy is **INSERT-only merge** — keep all sessions from all devices, deduplicate by `id`. There's no meaningful "conflict" between two different sessions; they're both valid.

**Impact:** Every session recorded on the losing device is silently deleted. Study time analytics, streak calculations, and quality scores will be wrong.

**Fix:** Change studySessions from LWW to INSERT-only merge (same pattern as flashcardReviews). Sessions have unique UUIDs — dedup on `id`, keep both. This is simpler than LWW, not harder.

**Severity:** HIGH — data loss in the core value proposition ("where was I?")

---

### 2. contentProgress LWW Drops Parallel Lesson Completions

The doc's own P0 example: contentProgress uses compound PK `[courseId+itemId]`. Two devices mark *different* lessons complete simultaneously. These are different records (different `itemId`), so LWW works fine — no conflict.

But the real problem is: what if the same lesson is marked complete on both devices? LWW keeps the latest `updatedAt`. Both have `status: 'completed'`. The "conflict" is meaningless — same result either way.

**Actual contentProgress risk:** Device A marks lesson 5 as `completed`, Device B marks lesson 5 as `in-progress` (user reopened it). LWW picks whichever has the latest `updatedAt`. If B wins, the user loses their completion. If A wins, the user's intent to re-study is ignored.

**The doc doesn't address status regression.** A `completed → in-progress` transition is semantically different from `in-progress → completed`. LWW is blind to this.

**Fix:** Add a status precedence rule: `completed` wins over `in-progress` wins over `not-started`. Only allow regression via explicit user action (a "Reset progress" button), not via blind LWW merge.

**Severity:** MEDIUM — subtle data regression, hard for users to notice

---

### 3. SM-2 Review Log Replay Produces Mathematically Correct but Semantically Wrong Results

The architecture claims review log replay is the right approach for flashcards (§5.3). The code in `src/lib/spacedRepetition.ts` confirms `calculateNextReview()` is a pure function — deterministic given inputs.

**The problem is context loss.** When Device B user rates a card "easy" with interval=7 days, they're saying "I remember this well after a 7-day gap." During replay, that "easy" rating is applied when the interval is 1 day (post-Device A's "hard" rating). The SM-2 formula calculates `newInterval = round(1 * 2.56) = 3 days`. The user meant "easy after 7 days" but the replay interprets it as "easy after 1 day."

Specifically, line 77: `newInterval = Math.max(MIN_INTERVAL, Math.round(record.interval * newEaseFactor))` — the `record.interval` during replay is the post-hard-review interval (1), not the interval the user actually experienced (7).

**This isn't a bug — it's a design flaw.** The architecture correctly notes "both reviews are counted" and "the final SRS state accurately reflects the card's actual review history." But "actual review history" is not just the sequence of ratings — it includes the interval context in which each rating was given.

**Fix options:**
- A. Store the `interval` and `easeFactor` at review time in `flashcardReviews`. On replay, use the stored state instead of derived state. This makes replay a simple "take the last review's computed state" instead of sequential recalculation.
- B. Accept the mathematical imprecision. For SM-2, the ease factor drift from context loss is bounded (MIN_EASE_FACTOR = 1.3). Over 5+ reviews, the algorithm self-corrects. Document this as an accepted trade-off.
- C. Use "last review wins" (LWW on the flashcard's SRS state) instead of replay. Simpler, and the SRS state on the more recent device is likely more accurate.

**Severity:** MEDIUM — SRS scheduling will be slightly off after cross-device conflicts, but self-corrects over time

---

### 4. The 28-36 Story Estimate Is Optimistic by ~40%

The doc lists 4 epics with 28-36 stories. Let me count what's actually needed:

**What the estimate includes:**
- Schema migrations (3 versions × 1 story = 3)
- Sync engine core (~5 stories)
- Per-table wiring (~8 stories for 15 tables)
- Tests (~4 stories)
- UI (~3 stories)
- Total: ~23 stories

**What the estimate underestimates or misses entirely:**
- **Multi-user filtering:** Every one of 14 Zustand stores needs query modification. That's not just `syncableWrite()` wrapping — it's *read* path changes too. Every `db.notes.where({courseId}).toArray()` becomes `db.notes.where({courseId, userId}).toArray()`. The doc mentions this in Section 11 (open questions) but doesn't include stories for it.
- **Store state reset on user switch:** 14 stores need reset logic. The `useSessionStore` has an active session timer, `useFlashcardStore` has review sessions, `useContentProgressStore` has cached statusMaps. Each needs cleanup logic.
- **exportService reconciliation:** Schema version 14 vs DB version 27. Missing 16 tables from exports. This is a prerequisite.
- **Supabase table creation:** 15 Postgres tables with RLS, indexes, and Realtime publication. The doc only shows SQL for 3 tables (content_progress, study_sessions, flashcard_reviews). The remaining 12 need actual migration files.
- **camelCase ↔ snake_case field mapping:** The doc shows 2 tables mapped. The remaining 13 synced tables each need explicit field mappings with round-trip tests.
- **Error handling and retry UI:** Dead-letter queue management, "Sync failed" states, manual retry buttons.
- **Edge case implementations:** The doc lists 13 Tier 1 fixes and 7 Tier 2 story AC items. Many of these are non-trivial (AbortController integration, compound PK cursor handling, Realtime health checks).

**Revised estimate:** 40-50 stories across 5 epics (add a "pre-requisite" epic for exportService fix + multi-user filtering foundation).

**Severity:** MEDIUM — underestimation leads to schedule pressure and corner-cutting

---

### 5. "Free for All Users" Ignores Self-Hosted Supabase Constraints

The doc assumes zero server cost because Supabase is self-hosted on Unraid. But it never quantifies the resource requirements.

**Supabase resource profile:**
- Postgres: ~200MB RAM baseline, grows with data + connections
- GoTrue (auth): ~50MB RAM
- Realtime: ~100MB RAM baseline, plus ~1MB per active WebSocket connection
- Kong (API gateway): ~100MB RAM
- PostgREST: ~50MB RAM
- Total baseline: ~500MB RAM minimum

**Scaling concerns for Unraid:**
- Unraid is a NAS OS, not optimized for database workloads. Postgres on Unraid Docker containers has no dedicated memory pinning — other containers can starve it.
- Default Postgres `max_connections = 100`. Each Realtime subscription holds a connection. With 15 synced tables × multiple devices, connection exhaustion is possible.
- Supabase Realtime has no built-in per-table channel limits. If the client subscribes to 15 tables, that's 15 WebSocket channels per device.
- No monitoring mentioned. How do you know when Postgres is running out of connections or RAM?

**The doc promises "near-instant on LAN (titan.local), ~100ms remotely."** These numbers are aspirational, not measured. Supabase REST API through Kong on Unraid Docker will have higher latency than managed Supabase.

**Fix:** Add a "Capacity Planning" section: measure Supabase resource usage on Unraid, set connection limits, define monitoring (Grafana dashboard or pgstat queries), and document degradation behavior.

**Severity:** LOW for current single-user use, MEDIUM if multi-user materializes

---

### 6. Zustand Wrappers Create a Sync Coverage Gap by Design

The doc's rationale for Zustand wrappers over Dexie hooks (§3.2):
- "All persistence goes through Zustand store actions"
- "~15 store actions to wrap — explicit and controllable"
- "Avoids sync-loop problem (hooks fire on ALL writes including sync-applied ones)"

**The sync-loop argument is valid.** Dexie hooks would fire on sync-applied writes, creating an infinite queue→upload→download→apply→queue loop. You'd need a `skipSync` flag, which is exactly what `syncableWrite()` already does with `isSyncing`.

**But the coverage gap is real.** The doc acknowledges 14 stores but then says "~15 store actions to wrap." Looking at the actual stores:
- `useCourseImportStore` alone has 7 write actions (`addImportedCourse`, `removeImportedCourse`, `updateCourseDetails`, `updateCourseTags`, `updateCourseStatus`, `updateCourseThumbnail`, `renameTagGlobally`)
- `useNoteStore` has 5 write actions (`saveNote`, `addNote`, `deleteNote`, `softDelete`, `restoreNote`)
- `useLearningPathStore` has 8+ write actions
- Total across all stores: **~40-50 individual write actions**, not ~15.

Miss one, and that write is never synced. There's no static analysis or ESLint rule to catch unwrapped writes (the doc suggests one in §11 for reads, but not for writes).

**Fix:** Add an ESLint rule that flags any `db.table().put()`, `db.table().add()`, `db.table().update()`, `db.table().delete()` call that isn't inside a `syncableWrite()` call. This provides a safety net without the sync-loop problem.

**Severity:** HIGH — silent data loss when a write action is missed

---

### 7. The Architecture Is ~3x Over-Engineered for Current Use

The doc designs for:
- Multi-device sync with conflict resolution
- Multi-user on-device data isolation
- Real-time push notifications via WebSocket
- 3-phase sync engine with navigator.locks
- SyncQueue with coalescing and exponential backoff
- Initial upload wizard with resumability and compound PK cursors
- Auth migration with "Start fresh" vs "Link my data" dialog

**The current reality:** One user, primarily one device, self-hosted Supabase.

**The 80% solution:**
1. On app startup: dump all synced tables to Supabase via `upsert()` (reuse `exportService` pattern)
2. After dump: fetch all server records, overwrite local
3. No SyncQueue, no coalescing, no Realtime, no conflict resolution
4. If two devices conflict: server version wins (always download after upload)
5. Add a "Sync now" button in settings

**This gets you:** Cross-device "where was I?" in ~4-5 stories. No queue management, no edge cases, no dead-letter handling.

**Why you'd still want the full architecture:** If you plan to add real-time collaboration, offline-first PWA with extended offline periods, or true multi-user support. But the product roadmap doesn't indicate any of these as near-term priorities.

**Recommendation:** Ship the simple version first (Epic 1 only, stripped to MVP from Section 10). Validate that sync is actually used across devices. Then build the full engine only if the simple version's limitations are felt.

**Severity:** MEDIUM — over-engineering delays the feature without proportional value

---

### 8. The Auth Migration "Start Fresh" Path Creates Orphaned Data

§4.6 says: "'Start fresh' skips backfill — records remain `userId = null` (invisible to the new user)."

**Problem:** These `userId = null` records are now orphaned forever. They:
- Consume IndexedDB storage indefinitely
- Will trigger the "startup safety net" check on every app launch (checking for null records), creating a persistent UX annoyance
- Cannot be claimed by any future user (no mechanism to adopt orphaned data)
- Cannot be cleaned up without a manual "Delete orphaned data" button

**The doc doesn't specify what happens to the startup safety net when the user has already chosen "Start fresh."** Does it re-prompt every time? If so, it's annoying. If not, how does it distinguish "chose Start fresh" from "interrupted backfill"?

**Fix:** Store the user's choice in `localStorage` (`knowlune-backfill-choice: 'fresh' | 'linked'`). On "Start fresh," offer a follow-up: "Delete existing data? This frees ~X MB of storage." Add a cleanup option in Settings → Storage.

**Severity:** LOW — cosmetic/storage issue, not data loss

---

### 9. Realtime + Polling Dual Mode Is Unnecessary Complexity

The doc implements both Supabase Realtime (WebSocket) AND 30-second polling as a fallback (§3.5). The rationale: "Used when Realtime connection drops or on metered connections."

**For a self-hosted personal app:**
- LAN connections are stable — Realtime won't drop
- Remote connections (supabase.pedrolages.net) are to your own server — you control uptime
- "Metered connections" — who is metering access to your own Supabase?
- The 2-minute health check + force-reconnect adds more failure modes than it solves

**Polling alone is sufficient** for a single-user app:
- 30-second polling gives near-real-time experience
- No WebSocket connection management, no channel subscriptions, no health checks
- Simpler error handling: if a poll fails, try again in 30 seconds
- When you add Realtime later, it's an additive feature, not a replacement

**Fix:** Start with polling only. Add Realtime as a separate story when/if latency becomes a problem.

**Severity:** LOW — unnecessary complexity, not a correctness issue

---

### 10. No Data Integrity Verification Post-Sync

The doc describes upload, download, and apply phases but never validates that the round-trip preserved data integrity.

**What's missing:**
- No checksum or hash comparison between local and remote records
- No count verification after initial upload ("uploaded 3,229 records" — but how many does the server actually have?)
- The idempotent upsert SQL (§6.3) has a `WHERE content_progress.updated_at <= EXCLUDED.updated_at` clause that silently skips records. If the server clock is ahead, it could reject valid uploads without the client knowing.
- No periodic "full reconciliation" — only incremental sync. If a record is lost (Postgres vacuum, admin error, storage corruption), it's never re-uploaded unless modified locally.

**Fix:** Add a periodic (weekly?) full-count reconciliation: compare local record counts per table with server counts. If mismatch > threshold, trigger full re-sync for that table. Also add a one-time verification step to the initial upload wizard (the doc mentions this in §6.1 "Step 3: Verifying" but §5.3 in Appendix A says "Verification step undefined in wizard").

**Severity:** MEDIUM — silent data loss from undetected sync failures

---

### 11. The Field Mapping Layer Is a Maintenance Nightmare

§4.5 shows a per-table, per-field mapping from camelCase to snake_case. For 15 synced tables with ~10 fields each, that's ~150 manual mapping entries.

**Problems:**
- Adding a field to a type in `types.ts` requires also adding it to `FIELD_MAP` — easy to forget
- The doc's Epic 1 S06 AC says "Unit test: every key in SyncableFields interface has a corresponding entry in FIELD_MAP" — but this only checks SyncableFields, not the full interface. A new `notes.sentiment` field wouldn't be caught.
- There's no codegen or derive-from-types mechanism

**Fix:** Use a generic `camelToSnake()` / `snakeToCase()` transformer with an exception list for irregular mappings. Most field names (like `courseId → course_id`, `updatedAt → updated_at`) follow a predictable pattern. Only list exceptions.

**Severity:** LOW — maintenance burden, not a correctness issue (the unit test catches mismatches)

---

### 12. The Document Is Missing a "What Happens When Sync Breaks" Section

The doc covers happy-path sync, conflict resolution, and 33 edge cases. But it never describes the failure UX holistically.

**Missing scenarios:**
- Supabase server is down for 6 hours. What does the user see? Just "⚠️ Error"? For how long? Does the app degrade gracefully or nag constantly?
- User's Unraid server runs out of disk space. Postgres starts rejecting writes. How does the sync engine handle persistent 500 errors differently from transient network errors?
- User exports data on Device A, imports on Device B (no sync). Then enables sync on both. Now the same records exist with different IDs. How does dedup work?
- User downgrades (disables sync). What happens to server data? What happens to local `syncedAt` fields?

**Fix:** Add a "Failure Modes & Degradation" section covering: persistent server failure, storage exhaustion, sync disable/re-enable, and data import + sync overlap.

**Severity:** MEDIUM — users will encounter these scenarios and find no guidance

---

### 13. exportService Schema Gap Is a Ticking Time Bomb

`CURRENT_SCHEMA_VERSION = 14` but Dexie is at v27. The export format only includes 13 tables — missing flashcards, quizzes, quizAttempts, authors, courses, careerPaths, pathEnrollments, courseThumbnails, entitlements, youtubeVideoCache, youtubeTranscripts, youtubeChapters, videoCaptions, courseReminders, embeddings, learningPaths (?).

Wait — `learningPaths` and `learningPathEntries` ARE in the export interface. But flashcards, which are P1 sync priority, are NOT exported. If a user exports their data before sync is implemented, they lose their flashcards.

**The sync architecture plans to reuse exportService patterns (§Critical Files Reference).** If the export format doesn't include all synced tables, the initial upload wizard can't use it as a reference pattern.

**This should be a pre-requisite story, not an open question (§11.5).**

**Severity:** HIGH — data loss risk for existing users who export/import

---

### 14. No Rollback Strategy for Dexie Migrations v28-v30

The doc acknowledges "No rollback mechanism for Dexie migrations" as Tier 3 Accepted Risk (ID 3.3). It says "Export service provides data recovery path."

**But the export service is at schema version 14.** It can't export flashcards, quizzes, or other v15-v27 tables. If the v28 migration corrupts data, the "recovery path" loses everything added in v15-v27.

**The export service gap and migration rollback risk compound each other.** Fix one, you partially fix both.

**Severity:** HIGH — compounding risk with no actual recovery path

---

## Summary

| # | Finding | Severity | Category |
|---|---------|----------|----------|
| 1 | LWW for studySessions destroys valid sessions | HIGH | Data Loss |
| 2 | contentProgress LWW ignores status regression | MEDIUM | Data Integrity |
| 3 | SM-2 replay loses interval context | MEDIUM | Algorithm Correctness |
| 4 | Story estimate undercount (~40-50, not 28-36) | MEDIUM | Planning |
| 5 | No Supabase capacity planning for Unraid | LOW-MEDIUM | Infrastructure |
| 6 | ~40-50 write actions to wrap, not ~15 | HIGH | Sync Coverage |
| 7 | 3x over-engineered for current use | MEDIUM | Complexity |
| 8 | "Start fresh" creates permanent orphaned data | LOW | UX/Storage |
| 9 | Realtime + polling dual mode unnecessary | LOW | Complexity |
| 10 | No post-sync data integrity verification | MEDIUM | Data Integrity |
| 11 | Per-field mapping is maintenance burden | LOW | Maintenance |
| 12 | No "sync breaks" failure mode documentation | MEDIUM | Resilience |
| 13 | exportService missing 16 tables at v14 | HIGH | Data Loss |
| 14 | No rollback strategy compounds with export gap | HIGH | Recovery |

**HIGH findings:** 4 (studySessions LWW, sync coverage gap, exportService gap, rollback compounding)
**MEDIUM findings:** 6
**LOW findings:** 4

---

## Recommendations (Priority Order)

1. **Fix exportService first** — this is a prerequisite for everything, not an open question
2. **Change studySessions to INSERT-only merge** — simplifies, not complicates
3. **Add ESLint rule for unwrapped Dexie writes** — safety net for sync coverage
4. **Ship MVP sync first** (Section 10), then iterate — don't build the full engine before validating the simple version works
5. **Drop Realtime** from initial implementation — polling is sufficient
6. **Add status precedence for contentProgress** — `completed > in-progress > not-started`
7. **Add generic camelCase ↔ snake_case transformer** — reduce mapping maintenance
8. **Document failure modes** before implementation begins
