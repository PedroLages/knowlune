# Edge Case Review: E50 Calendar Integration

**Date:** 2026-03-28
**Scope:** Epic E50 (6 stories, 31 AC) — Calendar Integration Phase 1-2
**Reviewer:** Claude Edge Case Hunter (automated)

---

## Summary

38 unhandled edge cases identified across 11 focus areas. 9 rated HIGH severity, 17 MEDIUM, 12 LOW.

---

## 1. Timezone Handling

### EC-01: User travels to a different timezone after creating schedules
- **Story:** E50-S01 (data model), E50-S02 (feed endpoint)
- **Scenario:** User creates a schedule in `America/New_York` (9:00 AM), then travels to `America/Los_Angeles`. The `timezone` field on `StudySchedule` is set once at creation time via `Intl.DateTimeFormat().resolvedOptions().timeZone`. The feed generates DTSTART using the stored timezone, but the user now expects events at their new local time.
- **Likelihood:** MEDIUM — common for students/remote workers
- **Impact:** HIGH — study blocks appear at wrong local time in calendar; user misses sessions
- **Mitigation:** Add a "timezone" selector in the schedule editor (E50-S05) defaulting to browser timezone but allowing manual override. Add a Settings-level "default timezone" preference. On feed generation, use the per-schedule timezone (already planned), but surface a UI warning if browser timezone differs from stored schedule timezone: "Your schedule was created in Eastern Time. Update?"

### EC-02: DST spring-forward creates a non-existent local time
- **Story:** E50-S02 (feed generation)
- **Scenario:** User has a schedule at 2:30 AM on a day when DST spring-forward skips 2:00-3:00 AM. The `startTime` "02:30" combined with RRULE BYDAY generates a VEVENT whose DTSTART refers to a non-existent local time.
- **Likelihood:** LOW — narrow time window, but guaranteed once/year for affected users
- **Impact:** MEDIUM — calendar apps handle this inconsistently (some skip, some shift to 3:30)
- **Mitigation:** `ical-generator` with proper VTIMEZONE handles this at the protocol level. Document that calendar app behavior varies. Consider adding a note in the feed preview if a schedule falls in a known DST gap.

### EC-03: DST fall-back creates an ambiguous local time
- **Story:** E50-S02 (feed generation)
- **Scenario:** User has a schedule at 1:30 AM on a fall-back day. The time 1:30 AM occurs twice (before and after the clock change). iCal RRULE with VTIMEZONE should resolve this, but the `startTime` string "01:30" alone is ambiguous.
- **Likelihood:** LOW — narrow time window
- **Impact:** LOW — `ical-generator` with VTIMEZONE produces correct UTC offsets; calendar apps handle the ambiguity
- **Mitigation:** Rely on `ical-generator`'s VTIMEZONE support (already planned). No additional handling needed if VTIMEZONE is correctly generated.

### EC-04: Server timezone vs user timezone mismatch in SRS event generation
- **Story:** E50-S06 (SRS events in feed)
- **Scenario:** The Express server runs in UTC (or the Unraid host's timezone). SRS events query `nextReviewAt` dates and generate DTSTART at the user's preferred review time in their timezone. If `nextReviewAt` is stored as UTC ISO string, the "next 90 days" window calculation on the server may include/exclude boundary dates differently than the user's local date.
- **Likelihood:** HIGH — every user not in server timezone
- **Impact:** MEDIUM — SRS events may be off by one day at the boundaries (day 1 or day 90)
- **Mitigation:** Convert the 90-day window boundaries to the user's timezone before querying. Use the `timezone` field from `calendar_tokens` table to compute the user's current date, then calculate the window from that date.

---

## 2. Recurring Events — Schedule Changes and Staleness

### EC-05: User edits a recurring schedule but calendar app shows old events
- **Story:** E50-S02 (feed), E50-S04 (UI)
- **Scenario:** User changes a Mon/Wed/Fri 9AM schedule to Tue/Thu 10AM. The UID `schedule-{id}@knowlune.app` stays the same, so on next feed poll the calendar app should update the event. But Google Calendar polls every 12-24h, so for up to 24h the old schedule persists.
- **Likelihood:** HIGH — any schedule edit triggers this
- **Impact:** MEDIUM — user sees stale events for hours; documented in UI warning (UX-DR4)
- **Mitigation:** Already partially mitigated by the UI warning about Google Calendar's 12-24h refresh. Consider adding `SEQUENCE` property to VEVENTs that increments on each edit (helps calendar apps prioritize updates). Store an edit counter on `StudySchedule`.

### EC-06: User deletes a schedule but calendar still shows it
- **Story:** E50-S01 (delete), E50-S02 (feed)
- **Scenario:** User deletes a schedule. The VEVENT with that UID disappears from the feed. On next poll, the calendar app should remove it. But until the next poll (up to 24h), the deleted event persists in the user's calendar.
- **Likelihood:** HIGH — any schedule deletion
- **Impact:** LOW — cosmetic; user knows they deleted it
- **Mitigation:** Add a `METHOD:CANCEL` event or `STATUS:CANCELLED` for recently deleted schedules (keep deleted IDs for 48h in a `deletedScheduleIds` array or soft-delete pattern). This tells calendar apps to remove the event proactively. Alternatively, accept the 12-24h delay (already warned in UI).

---

## 3. iCal Feed Polling and Stale Data

### EC-07: Calendar app caches feed aggressively — user sees week-old data
- **Story:** E50-S02 (feed endpoint)
- **Scenario:** Some calendar apps or corporate proxies cache iCal feeds for days. The Express endpoint does not set `Cache-Control` or `ETag` headers, so caching behavior is undefined.
- **Likelihood:** MEDIUM — depends on calendar app and network infrastructure
- **Impact:** HIGH — user sees severely outdated schedule
- **Mitigation:** Set explicit HTTP headers on the feed response: `Cache-Control: no-cache, no-store, must-revalidate`, `Pragma: no-cache`, `Expires: 0`. Also consider adding `ETag` based on a hash of the response body for conditional requests.

### EC-08: Feed requested during Supabase data sync — partial schedule data
- **Story:** E50-S02 (feed endpoint)
- **Scenario:** User creates a schedule in the browser (written to Dexie). The feed endpoint queries Supabase for schedules. If the Dexie-to-Supabase sync has not completed, the feed returns stale data missing the new schedule.
- **Likelihood:** HIGH — sync latency is inherent in the architecture
- **Impact:** MEDIUM — newly created schedules don't appear in feed immediately (beyond the calendar polling delay)
- **Mitigation:** Document the sync delay in the UI. Consider adding a "Force sync" button in Calendar Settings that triggers an immediate Dexie-to-Supabase push before regenerating the feed. The `.ics` download (client-side) does not have this issue since it reads from Dexie directly.

---

## 4. Feed URL Security

### EC-09: Token is 40-char hex but spec says "UUID" in some places
- **Story:** E50-S03 (token management)
- **Scenario:** The quick spec says "UUID-based opaque feed token" but the implementation uses `crypto.randomBytes(20).toString('hex')` producing a 40-char hex string (not UUID format). The endpoint validates with regex `/^[a-f0-9]{40}$/`. This is fine for security (160-bit entropy) but the naming inconsistency could cause confusion.
- **Likelihood:** LOW — implementation detail
- **Impact:** LOW — no functional impact; token has sufficient entropy
- **Mitigation:** Clarify in documentation: the token is a 160-bit random hex string, not a UUID. Update spec language to remove "UUID" references.

### EC-10: Leaked feed URL cannot be detected — no access logging UI
- **Story:** E50-S03 (token management), E50-S02 (feed endpoint)
- **Scenario:** The feed URL is shared (accidentally posted, compromised machine). `last_accessed_at` is updated on each request, but there is no UI to show access history. The user has no way to detect unauthorized access.
- **Likelihood:** MEDIUM — URLs get shared accidentally
- **Impact:** MEDIUM — attacker sees study schedule (low-sensitivity data, but still privacy concern)
- **Mitigation:** Add a "Last synced" indicator in the Calendar Settings section showing `last_accessed_at`. If the timestamp doesn't match the user's known calendar sync pattern, they know to regenerate. Consider adding `access_count` to `calendar_tokens` for anomaly detection.

### EC-11: Token validation is timing-attack vulnerable
- **Story:** E50-S02 (feed endpoint)
- **Scenario:** The endpoint looks up the token in Supabase with a SQL query. If an attacker can measure response times, they might distinguish "token not found" (fast DB miss) from "token found but user has no schedules" (slower with data processing). However, since Supabase is over the network, timing differences are likely drowned by network noise.
- **Likelihood:** LOW — network noise masks timing
- **Impact:** LOW — even with timing info, 160-bit entropy prevents brute force
- **Mitigation:** Use constant-time comparison if doing in-memory validation. For Supabase query, the network latency makes this impractical to exploit. No action needed.

### EC-12: Feed URL exposed in browser history if user navigates to it
- **Story:** E50-S04 (settings UI)
- **Scenario:** The feed URL is displayed in a read-only input. If the user clicks it or copies it into a browser tab, the token appears in browser history and potentially in server access logs of any proxy.
- **Likelihood:** MEDIUM — users often test URLs by visiting them
- **Impact:** LOW — the URL is meant to be shared with calendar apps; visiting it is expected behavior
- **Mitigation:** No mitigation needed. The URL is designed to be copyable. The regenerate button provides revocation if needed.

---

## 5. Empty States

### EC-13: Feed requested for user with 0 schedules and 0 due flashcards
- **Story:** E50-S02 (feed), E50-S06 (SRS events)
- **Scenario:** User enables the feed but has no study schedules and no flashcards. The feed endpoint returns a valid VCALENDAR with zero VEVENTs.
- **Likelihood:** HIGH — common during initial setup
- **Impact:** LOW — valid but empty calendar; user might think it's broken
- **Mitigation:** Already noted in E50-S02 edge cases. Add a `X-WR-CALDESC` property to the empty feed: "No study blocks scheduled yet. Create study blocks in Knowlune to see them here." Calendar apps display this description.

### EC-14: User has no courses imported — course selector is empty
- **Story:** E50-S05 (schedule editor)
- **Scenario:** User opens the schedule editor but has no courses imported. The course `Select` dropdown from `useCourseStore` is empty, showing only "Free study block" option.
- **Likelihood:** LOW — unusual to have calendar feature before any courses
- **Impact:** LOW — still functional (can create free-form blocks)
- **Mitigation:** Already implicitly handled by "Free study block" option being the only choice. Add helper text: "Import courses to link study blocks to specific subjects."

### EC-15: FeedPreview shows "No upcoming study blocks" but schedules exist for other days
- **Story:** E50-S04 (FeedPreview component)
- **Scenario:** User has schedules only on weekdays. They view the Settings page on a Saturday. FeedPreview shows "next 5 scheduled events" — if the logic only looks forward, it should show Monday's events. If it only looks at today, it shows nothing.
- **Likelihood:** MEDIUM — depends on implementation of "next 5"
- **Impact:** LOW — confusing empty state when schedules clearly exist
- **Mitigation:** FeedPreview must calculate the next 5 calendar occurrences from today (considering RRULE), not just filter by today's day. Use the `days` array to compute the next occurrence date for each schedule and sort by earliest.

---

## 6. Data Model — Course Deletion with Active Schedules

### EC-16: User deletes a course that has associated study schedules
- **Story:** E50-S01 (data model), E50-S05 (editor)
- **Scenario:** User has a schedule "Study: React" linked to a course via `courseId`. User then deletes the React course from their library. The schedule's `courseId` now references a non-existent course.
- **Likelihood:** HIGH — courses are routinely added/removed
- **Impact:** MEDIUM — schedule title still says "Study: React" but "Start" button in Overview widget navigates to a dead route; course selector in edit mode shows "Unknown course"
- **Mitigation:** E50-S05 mentions this edge case ("Course deleted after schedule creation — schedule persists with orphaned courseId (graceful handling)"). Implement: (1) In `TodaysStudyPlan`, if `courseId` is set but course not found, hide the "Start" button or show "Course removed". (2) In `StudyScheduleEditor` edit mode, show "Course no longer available" in the selector. (3) Optionally, listen for course deletion events in `useStudyScheduleStore` and null out orphaned `courseId` fields.

### EC-17: Schedule has `learningPathId` referencing a deleted learning path
- **Story:** E50-S01 (data model)
- **Scenario:** Same as EC-16 but for `learningPathId`. The field exists in the schema but UI for learning path scheduling is deferred to Phase 3+.
- **Likelihood:** LOW — field exists but is never populated in Phase 1-2
- **Impact:** LOW — no current UI uses `learningPathId`
- **Mitigation:** No action needed for Phase 1-2. When learning path scheduling is added (Phase 3+), implement the same orphan handling as EC-16.

---

## 7. Concurrent Access — Multiple Tabs

### EC-18: Two tabs create schedules simultaneously — Dexie race condition
- **Story:** E50-S01 (Zustand store + Dexie CRUD)
- **Scenario:** User has two tabs open. Tab A calls `addSchedule()` and Tab B calls `addSchedule()` at nearly the same time. Both generate `crypto.randomUUID()` IDs (guaranteed unique) and write to Dexie. The Dexie writes succeed (different IDs), but the Zustand store in each tab holds stale state — Tab A doesn't see Tab B's new schedule until `loadSchedules()` is called.
- **Likelihood:** LOW — requires deliberate multi-tab usage
- **Impact:** MEDIUM — schedules are created correctly in Dexie but UI state diverges between tabs
- **Mitigation:** Use Dexie's `liveQuery` or `db.on('changes')` to subscribe to table changes across tabs. Alternatively, call `loadSchedules()` when the tab regains focus (`document.addEventListener('visibilitychange')`).

### EC-19: Two tabs edit the same schedule simultaneously
- **Story:** E50-S01 (updateSchedule)
- **Scenario:** Tab A loads schedule X for editing. Tab B also loads schedule X. Tab A saves changes. Tab B then saves its (now stale) version, overwriting Tab A's changes. Last-write-wins with no conflict detection.
- **Likelihood:** LOW — requires simultaneous editing of same record
- **Impact:** MEDIUM — silent data loss of Tab A's changes
- **Mitigation:** Add optimistic concurrency control: compare `updatedAt` before saving. If `updatedAt` in Dexie differs from the value loaded into the edit form, show a conflict toast: "This schedule was modified in another tab. Reload and try again." This is a lightweight check without full CRDT complexity.

### EC-20: Tab A deletes a schedule while Tab B has it open in editor
- **Story:** E50-S01 (deleteSchedule), E50-S05 (editor)
- **Scenario:** Tab A deletes schedule X. Tab B still has the edit sheet open for schedule X. When Tab B clicks Save, `updateSchedule()` tries to update a non-existent Dexie record.
- **Likelihood:** LOW
- **Impact:** LOW — Dexie `put()` would re-create the record (upsert); `update()` would silently do nothing
- **Mitigation:** In `updateSchedule()`, check if the record exists first. If not, show an error toast: "This schedule no longer exists." and close the editor.

---

## 8. SRS Reminders in Feed — Dynamic Count Problem

### EC-21: SRS event shows "12 cards due" but user reviews cards before calendar syncs
- **Story:** E50-S06 (SRS events)
- **Scenario:** Feed generates "Review: 12 flashcards due" for tomorrow. User reviews 8 cards today, reducing tomorrow's count. But the calendar won't re-fetch the feed for up to 24h, so it still shows "12 flashcards due."
- **Likelihood:** HIGH — happens every time a user reviews cards
- **Impact:** MEDIUM — inaccurate count misleads user; they may skip review thinking the count is wrong
- **Mitigation:** Already documented as a known limitation. Additional mitigations: (1) Use approximate language: "Review: ~12 flashcards due" or "Review flashcards (estimated: 12)". (2) Add DESCRIPTION noting "Count was calculated at {timestamp}. Open Knowlune for current count." (3) The Overview widget (client-side) always shows the real-time count, so the calendar is a secondary reminder.

### EC-22: SRS UID collision when count changes for the same date
- **Story:** E50-S06 (SRS events)
- **Scenario:** UID is `srs-{YYYY-MM-DD}@knowlune.app`. If the feed is re-fetched and the count for a date changed (e.g., 12 to 8 after reviewing), the same UID with updated SUMMARY should cause the calendar app to update the event. But some calendar apps may cache the old version.
- **Likelihood:** MEDIUM — depends on calendar app behavior
- **Impact:** LOW — the UID is correct per iCal spec; well-behaved calendar apps will update
- **Mitigation:** Add `LAST-MODIFIED` and `DTSTAMP` properties to SRS events to help calendar apps detect updates. Add `SEQUENCE` property that increments when the count changes (requires storing previous counts or computing a hash).

### EC-23: User has 500+ flashcards due over 90 days — feed bloat
- **Story:** E50-S06 (SRS events)
- **Scenario:** Active user with many flashcard decks has cards due on 80+ of the next 90 days. That's 80 additional VEVENTs in the feed, on top of recurring study block events.
- **Likelihood:** MEDIUM — power users with large flashcard collections
- **Impact:** LOW — 80 VEVENTs is still small by iCal standards; calendar apps handle thousands
- **Mitigation:** The 90-day rolling window already bounds this. No further mitigation needed unless performance testing shows issues.

---

## 9. Large Schedules — Performance

### EC-24: User with 20 courses and daily blocks = 140 recurring events/week
- **Story:** E50-S02 (feed endpoint), NFR1
- **Scenario:** Power user creates a study block for each of 20 courses, each set to daily (7 days). The feed contains 20 recurring VEVENTs (compact due to RRULE, not 140 individual events). Plus up to 90 SRS events. Total: ~110 VEVENTs.
- **Likelihood:** LOW — extreme usage pattern
- **Impact:** LOW — 110 VEVENTs is well within iCal limits; `ical-generator` handles this efficiently
- **Mitigation:** NFR1 specifies 500ms response time for up to 50 schedules. 20 schedules is within this limit. Monitor performance and add caching if needed.

### EC-25: Feed generation queries Supabase for schedules + flashcards — two round trips
- **Story:** E50-S02, E50-S06 (feed endpoint)
- **Scenario:** Each feed request requires: (1) token lookup, (2) schedule query, (3) flashcard due-date aggregation. Three Supabase queries per feed request. With calendar apps polling every 15-60 minutes per user, this could generate significant Supabase load.
- **Likelihood:** MEDIUM — grows with user count
- **Impact:** MEDIUM — Supabase rate limits / cost; response time degradation
- **Mitigation:** (1) Combine queries where possible (single RPC function). (2) Add server-side caching with short TTL (5 minutes) keyed by token. (3) Set appropriate `Cache-Control: max-age=300` to reduce poll frequency. (4) Monitor `last_accessed_at` patterns for abuse.

### EC-26: StudyScheduleSummary computes total hours/week for many schedules
- **Story:** E50-S04 (StudyScheduleSummary component)
- **Scenario:** User has 50 schedules (NFR1 limit). The component groups by day, computes time ranges, and calculates total hours. This is a client-side computation on every render.
- **Likelihood:** LOW — 50 schedules is rare
- **Impact:** LOW — trivial computation even for 50 items; no performance concern
- **Mitigation:** No mitigation needed. Use `useMemo` for the grouping/calculation to avoid recomputing on unrelated re-renders.

---

## 10. Express Endpoint — Error Handling

### EC-27: Supabase is unreachable during feed request
- **Story:** E50-S02 (feed endpoint)
- **Scenario:** The Express server cannot reach Supabase (network issue, Unraid server down, Supabase maintenance). Token lookup fails with a connection error.
- **Likelihood:** MEDIUM — self-hosted Supabase on Unraid has uptime risks
- **Impact:** HIGH — feed returns error (likely 500); calendar apps may remove all events or show error
- **Mitigation:** Return a 503 Service Unavailable with `Retry-After: 300` header. Calendar apps that respect this will retry. Add a try-catch wrapper around all Supabase calls in the calendar route with specific error handling. Consider returning a cached last-known-good feed from a local file/memory cache when Supabase is unreachable.

### EC-28: Token lookup succeeds but schedule query fails
- **Story:** E50-S02 (feed endpoint)
- **Scenario:** Token is valid (first Supabase query succeeds) but the schedule query or flashcard query fails (partial Supabase outage, table-level issue).
- **Likelihood:** LOW — partial Supabase failures are rare
- **Impact:** MEDIUM — feed returns with missing data (some events missing) or errors
- **Mitigation:** Wrap each query in its own try-catch. If schedule query fails, return empty feed with a warning `X-KNOWLUNE-ERROR: schedule-fetch-failed` header. If flashcard query fails, return feed without SRS events (graceful degradation). Log all failures server-side.

### EC-29: Express body parsing for calendar route is unnecessary overhead
- **Story:** E50-S02 (feed endpoint)
- **Scenario:** The calendar endpoint is GET-only (no request body) but `app.use(express.json({ limit: '1mb' }))` is applied globally. This is minor overhead but also means the calendar route inherits the 1MB body limit setting.
- **Likelihood:** N/A — design observation
- **Impact:** LOW — no functional impact; GET requests don't send bodies
- **Mitigation:** No action needed. The global middleware is harmless for GET routes.

### EC-30: Calendar route mounted before middleware but after `express.json()`
- **Story:** E50-S02 (server/index.ts mounting)
- **Scenario:** The spec says to mount the calendar route before JWT middleware. If mounted correctly, the route won't require authentication. But if the mounting order is wrong (after middleware), the route will require JWT and break all calendar app subscriptions.
- **Likelihood:** MEDIUM — implementation ordering mistake
- **Impact:** HIGH — calendar feed stops working for all users
- **Mitigation:** Add an integration test that requests the feed without a JWT header and verifies 200 (not 401). Add a comment in `server/index.ts` near the mount point: `// IMPORTANT: Calendar route MUST be before JWT middleware — authenticated by URL token only`.

---

## 11. Dexie v28 Migration

### EC-31: Existing v27 user upgrades — migration adds `studySchedules` table
- **Story:** E50-S01 (Dexie v28)
- **Scenario:** User on v27 opens the app after the update. Dexie runs v28 migration which adds the `studySchedules` table. The migration is additive (no data transformation needed). Dexie handles this natively.
- **Likelihood:** HIGH — all existing users
- **Impact:** LOW — Dexie handles additive table creation automatically; no data at risk
- **Mitigation:** Already handled by Dexie's migration system. The v28 `.stores()` declaration only adds the new table; existing tables are untouched. Test with a v27 database to confirm.

### EC-32: Fresh install skips to checkpoint v27, then runs v28 migration
- **Story:** E50-S01 (Dexie v28, checkpoint.ts)
- **Scenario:** New user installs the app. The checkpoint creates v27 schema in one step, then v28 migration runs to add `studySchedules`. The checkpoint does NOT include `studySchedules` (it's at v27).
- **Likelihood:** HIGH — all new users
- **Impact:** LOW — two-step creation (checkpoint v27 + migration v28) is the intended pattern
- **Mitigation:** Already handled by design. The checkpoint.ts comment explicitly says "Do NOT update checkpoint — stays at v27." Verify with a test: fresh install creates `studySchedules` table.

### EC-33: Browser clears IndexedDB — schedules lost with no sync
- **Story:** E50-S01 (data model)
- **Scenario:** User clears browser data, uses incognito mode, or browser evicts IndexedDB storage. All local schedules are lost. The Supabase sync (if active) has the data, but the sync mechanism's recovery path for Dexie data loss is not specified in this epic.
- **Likelihood:** MEDIUM — browser data clearing is common
- **Impact:** HIGH — all study schedules lost; user must recreate
- **Mitigation:** This is a broader Dexie-to-Supabase sync concern beyond E50. For this epic: (1) Document that schedules are stored locally and may be lost if browser data is cleared. (2) The `.ics` download feature (E50-S03) serves as a manual backup. (3) Rely on the sync infrastructure (existing) to replicate data to Supabase for recovery.

---

## Additional Edge Cases (Cross-Cutting)

### EC-34: `recurrence: 'once'` schedule — no RRULE, but when does it occur?
- **Story:** E50-S01 (data model), E50-S02 (feed)
- **Scenario:** The `StudySchedule` type supports `recurrence: 'once'`. For one-time events, `days` array is ambiguous — does it mean "next Monday" or "every Monday (once)"? There's no specific date field for one-time events.
- **Likelihood:** MEDIUM — the `recurrence: 'once'` option exists in the type
- **Impact:** HIGH — impossible to correctly generate a one-time VEVENT without a specific date; using `days` for a one-time event is semantically wrong
- **Mitigation:** Either: (1) Add a `date?: string` (ISO date) field to `StudySchedule` for one-time events (used when `recurrence: 'once'`), or (2) Remove `'once'` from the recurrence type for Phase 1-2 and defer to Phase 3+. The schedule editor (E50-S05) doesn't expose a date picker, only a day-of-week picker, so `'once'` is currently unusable.

### EC-35: `recurrence: 'daily'` with specific `days` selected — contradictory
- **Story:** E50-S01 (data model), E50-S02 (feed)
- **Scenario:** User creates a schedule with `recurrence: 'daily'` but also selects specific days (e.g., Mon/Wed/Fri). The E50-S02 edge cases note that `FREQ=DAILY` should have no BYDAY, but the data model allows both `recurrence` and `days` to be set simultaneously.
- **Likelihood:** MEDIUM — depends on UI validation
- **Impact:** MEDIUM — ambiguous iCal output; does it recur daily or only on Mon/Wed/Fri?
- **Mitigation:** Add validation: if `recurrence: 'daily'`, ignore `days` array (or auto-set to all 7 days). If `recurrence: 'weekly'`, require at least one day. Document the precedence rule.

### EC-36: `crypto.randomBytes(20)` not available in browser for token generation
- **Story:** E50-S03 (token generation)
- **Scenario:** Task 2.6 notes `crypto.randomBytes(20).toString('hex')` for token generation. `crypto.randomBytes` is a Node.js API, not available in the browser. The browser equivalent is `crypto.getRandomValues()`.
- **Likelihood:** HIGH — will fail in browser if not addressed
- **Impact:** HIGH — token generation crashes; user cannot enable calendar feed
- **Mitigation:** Use the Web Crypto API: `Array.from(crypto.getRandomValues(new Uint8Array(20)), b => b.toString(16).padStart(2, '0')).join('')`. Alternatively, generate the token server-side via Supabase RPC function (mentioned as an option in the story).

### EC-37: `navigator.clipboard.writeText()` fails on HTTP (non-HTTPS) in dev
- **Story:** E50-S04 (copy button)
- **Scenario:** During development on `localhost:5173` (HTTP), `navigator.clipboard.writeText()` may fail in some browsers (Chrome requires HTTPS or localhost specifically). The story mentions this edge case but no fallback is specified.
- **Likelihood:** MEDIUM — development-only issue (localhost is usually allowed)
- **Impact:** LOW — dev-only; production will use HTTPS
- **Mitigation:** Add a fallback: create a temporary `<textarea>`, set its value, select, and `document.execCommand('copy')`. Show an error toast if both methods fail: "Copy failed. Please select and copy the URL manually."

### EC-38: Rapid toggle on/off of calendar feed — race condition in Supabase
- **Story:** E50-S03 (token management), E50-S04 (toggle)
- **Scenario:** User rapidly toggles the calendar feed switch on/off/on/off. Each toggle triggers a Supabase insert or delete. If requests arrive out of order (network latency), the final Supabase state may not match the UI state (toggle shows ON but token was deleted, or vice versa).
- **Likelihood:** MEDIUM — impatient users clicking rapidly
- **Impact:** HIGH — feed URL shows in UI but token doesn't exist in Supabase (broken feed), or feed appears disabled but token still exists (security concern)
- **Mitigation:** (1) Debounce the toggle with a 500ms delay. (2) Disable the toggle during the async operation (show loading spinner). (3) After the operation completes, re-query the actual Supabase state to reconcile UI. (4) Use optimistic locking or a sequence counter on the token row.

---

## Severity Summary

| Severity | Count | Edge Case IDs |
|----------|-------|---------------|
| HIGH | 9 | EC-01, EC-04, EC-07, EC-08, EC-27, EC-30, EC-34, EC-36, EC-38 |
| MEDIUM | 17 | EC-02, EC-05, EC-06, EC-10, EC-15, EC-16, EC-19, EC-21, EC-22, EC-25, EC-28, EC-33, EC-35, EC-37, EC-18, EC-20, EC-26 |
| LOW | 12 | EC-03, EC-09, EC-11, EC-12, EC-13, EC-14, EC-17, EC-23, EC-24, EC-29, EC-31, EC-32 |

## Recommended Priority Actions

1. **EC-36 (CRITICAL):** `crypto.randomBytes` is Node-only — will crash in browser. Switch to Web Crypto API or server-side RPC.
2. **EC-34 (HIGH):** `recurrence: 'once'` has no date field — remove from Phase 1-2 or add a `date` field.
3. **EC-38 (HIGH):** Rapid toggle race condition — debounce and disable during async.
4. **EC-07 (HIGH):** No cache-control headers on feed — add `no-cache` directives.
5. **EC-27 (HIGH):** Supabase unreachable — add 503 response with retry header and graceful degradation.
6. **EC-30 (HIGH):** Route mounting order — add integration test to prevent regression.
7. **EC-01 (HIGH):** Timezone change after travel — add timezone selector to editor.
8. **EC-04 (HIGH):** Server/user timezone mismatch in SRS window — convert boundaries to user timezone.
9. **EC-08 (HIGH):** Dexie-to-Supabase sync delay — document and consider force-sync button.
