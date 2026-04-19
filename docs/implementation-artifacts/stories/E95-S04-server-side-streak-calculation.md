---
story_id: E95-S04
story_name: "Server-Side Streak Calculation"
status: ready-for-dev
started:
completed:
reviewed: false
review_started:
review_gates_passed: []
burn_in_validated: false
---

# Story 95.04: Server-Side Streak Calculation

## Story

As a learner who uses Knowlune on multiple devices,
I want my reading and study streaks to be calculated authoritatively on the server based on my actual activity,
so that my streak is identical on every device, cannot drift when localStorage is cleared, and cannot be trivially inflated by clock tampering.

## Background

E95-S01 (Full Settings Sync Expansion) deliberately **excluded** the streak fields (`currentReadingStreak`, `longestReadingStreak`, `lastMetDate`) from the synced `user_settings` payload. The goal fields (`dailyType`, `dailyTarget`, `yearlyBookTarget`) sync; the streak fields remain in `localStorage` under `knowlune:reading-goal-streak`. That carve-out was explicit — streaks are a derived value and must not be client-writable state.

E95-S04 closes that loop. The source signal for streak calculation already exists server-side: `public.study_sessions` is an append-only sync table populated via the sync engine (P0). The reading-goal logic in `useReadingGoalStore.ts` (`updateStreakOnMinutes`, `updateStreakOnPages`) performs the same calendar-day aggregation locally that the server can now do canonically.

This story makes the server the single source of truth for streak values, exposes them via a hydration read, and removes the localStorage write path.

## Acceptance Criteria

**AC1 — Server computes current and longest streaks from append-only activity:**
Given a user has `study_sessions` rows recorded on consecutive local days.
When the client requests its streak state.
Then the server returns `currentReadingStreak` and `longestReadingStreak` computed from those rows using the user's local-calendar-day boundaries.

**AC2 — Streak is identical on two devices without any client-side merge:**
Given Device A and Device B are both signed in as the same user.
When Device A records today's reading session (syncs study_sessions).
Then after Device B's next hydration, Device B reads the same `currentReadingStreak` and `longestReadingStreak` values from the server — no client merge, no LWW contest.

**AC3 — `useReadingGoalStore` no longer writes streak state to localStorage:**
Given the new hydration path is wired up.
When a user meets today's daily goal.
Then the store's streak fields are populated from the server's hydration response; `localStorage` key `knowlune:reading-goal-streak` is NOT written by the store and `saveStreakToStorage()` is removed or becomes a no-op.

**AC4 — Streak survives localStorage clear / new device / private browsing:**
Given a user with an established 12-day streak.
When they sign in on a fresh device (empty localStorage) or clear site data.
Then after hydration the store reports `currentStreak: 12` — the streak is fully recovered from the server, no degraded-local-state UI.

**AC5 — Client cannot forge a streak by writing to localStorage:**
Given an attacker writes `knowlune:reading-goal-streak` with `currentStreak: 9999`.
When the store initializes.
Then the forged value is ignored; the store reads the server-hydrated value (or `0` if no activity).

**AC6 — Offline behavior: last-known streak is displayed, flagged as stale:**
Given a user is offline and has previously hydrated their streak.
When the UI renders the streak count.
Then the last-hydrated value is shown with an `isStale` indicator so the store can surface a subtle "last synced X ago" hint without blocking render.

**AC7 — Streak calculation respects the user's calendar day, not UTC:**
Given a user in a non-UTC timezone records a session at 23:30 local time.
When the server computes streak.
Then that session counts toward the local calendar day, not the UTC day — so a late-evening session correctly advances or preserves the streak.

**AC8 — Goal threshold is factored into server calculation:**
Given the user's daily goal is `dailyType: 'minutes', dailyTarget: 20`.
When the server aggregates `study_sessions` for a calendar day.
Then only days where total minutes ≥ 20 count toward the streak — matching the current client-side logic in `updateStreakOnMinutes`.

## Tasks / Subtasks

- [ ] **Task 1: Design server streak calculation (AC1, AC7, AC8)**
  - [ ] 1.1 Decide implementation vehicle: Postgres SQL function/view vs. Edge Function. Recommend SQL view/function for (a) zero cold-start, (b) atomic with the source table, (c) callable from a Supabase RPC.
  - [ ] 1.2 Define function signature: `public.compute_reading_streak(p_user_id UUID, p_timezone TEXT, p_goal_type TEXT, p_goal_target INT) RETURNS (current_streak INT, longest_streak INT, last_met_date DATE)`.
  - [ ] 1.3 Aggregate `study_sessions` by local calendar day (`(created_at AT TIME ZONE p_timezone)::date`), filter for days meeting `p_goal_target`, scan for the longest consecutive run and the current run ending on today-or-yesterday.
  - [ ] 1.4 SECURITY INVOKER so the existing RLS on `study_sessions` is honored (users only see their own rows). No SECURITY DEFINER.

- [ ] **Task 2: Migration for the streak function (AC1)**
  - [ ] 2.1 Create `supabase/migrations/YYYYMMDDHHMMSS_reading_streak_function.sql` following the migration conventions used in `20260423000001_server_tables_no_credentials.sql` (header comment, BEGIN/COMMIT, `CREATE OR REPLACE FUNCTION`).
  - [ ] 2.2 Rollback migration: `DROP FUNCTION IF EXISTS public.compute_reading_streak`.
  - [ ] 2.3 Add an INDEX on `study_sessions (user_id, created_at)` if `\d` shows it's absent (required for the date-truncation scan to be cheap).

- [ ] **Task 3: Client hydration path (AC1, AC2, AC4)**
  - [ ] 3.1 Add `hydrateStreakFromSupabase()` in `src/lib/settings.ts` (or a new `src/lib/streak.ts`) that calls the SQL function via `supabase.rpc('compute_reading_streak', {...})` passing the user's timezone (`Intl.DateTimeFormat().resolvedOptions().timeZone`) and current goal fields.
  - [ ] 3.2 Wire the hydration into `hydrateSettingsFromSupabase()` or into `useReadingGoalStore` initialization so the store is populated from the server response.
  - [ ] 3.3 Set `streak: { currentStreak, longestStreak, lastMetDate }` in the store from the RPC result.

- [ ] **Task 4: Remove client-writable streak state (AC3, AC5)**
  - [ ] 4.1 Delete `saveStreakToStorage()` and `loadStreakFromStorage()` in `useReadingGoalStore.ts` (or replace with no-ops plus a deprecation comment pointing to E95-S04).
  - [ ] 4.2 Remove the localStorage read/write in `updateStreakOnMinutes()` and `updateStreakOnPages()`. These methods should either: (a) become no-ops that simply trigger a re-hydration, or (b) be deleted entirely if no call-site depends on their return value beyond the store update.
  - [ ] 4.3 Clean up `knowlune:reading-goal-streak` on next app load (one-time `localStorage.removeItem` in the store's initialization, guarded by a flag so it runs once).

- [ ] **Task 5: Refresh trigger — recalculate after a session is synced (AC1, AC2)**
  - [ ] 5.1 After `syncableWrite('studySessions', …)` resolves (in the pull cycle or push-confirmation path), trigger `hydrateStreakFromSupabase()` so the UI reflects the new count without a full page reload.
  - [ ] 5.2 Debounce the hydration (e.g., 500ms) so a batch of synced sessions doesn't fire N RPC calls.

- [ ] **Task 6: Offline / stale handling (AC6)**
  - [ ] 6.1 Cache the last hydrated streak value + timestamp in IndexedDB (not localStorage) so offline launches render the last-known streak instantly.
  - [ ] 6.2 Mark `isStale: true` if the cached value is >24h old and the current hydration failed.
  - [ ] 6.3 Surface `isStale` on the store so the Overview UI can optionally render a subtle "last synced X ago" affordance — visual treatment itself is out of scope for this story.

- [ ] **Task 7: Unit tests (AC1, AC2, AC3, AC4, AC5, AC7, AC8)**
  - [ ] 7.1 SQL function test (pgTAP or raw SQL assertions in a `tests/` fixture): insert `study_sessions` rows across consecutive and broken day sequences in a fixed timezone, assert correct `current_streak` and `longest_streak` output.
  - [ ] 7.2 Timezone test: insert a session at 23:30 local in a non-UTC timezone, assert it counts toward the local calendar day.
  - [ ] 7.3 Goal threshold test: sessions totaling 15 minutes with `p_goal_target=20` do not count.
  - [ ] 7.4 Client hook test (`useReadingGoalStore.test.ts`): mock `supabase.rpc('compute_reading_streak')` to return `{ current_streak: 7, longest_streak: 12 }`, assert store state matches and localStorage is untouched.
  - [ ] 7.5 Tamper test: pre-populate `localStorage.knowlune:reading-goal-streak` with `currentStreak: 9999`, initialize the store, assert the forged value is ignored.
  - [ ] 7.6 Stale-cache test: mock RPC failure, assert the store renders cached value with `isStale: true`.

- [ ] **Task 8: Cleanup / deprecation (AC3, AC5)**
  - [ ] 8.1 Remove the `streak: { currentStreak, longestStreak, lastMetDate }` field from any persisted Zustand snapshot — it's now a transient hydrated field, not a persisted one.
  - [ ] 8.2 Grep for remaining references to `knowlune:reading-goal-streak` — should be zero after this story lands.

## Design Guidance

### Why a SQL Function, Not an Edge Function

- **Zero cold-start:** RPC calls are as fast as a `SELECT`.
- **RLS-correct by construction:** `SECURITY INVOKER` means the user can only ever aggregate their own `study_sessions` — no bespoke auth check needed.
- **Atomically consistent with the write side:** An Edge Function would have to re-read `study_sessions` over the network; the SQL function runs inside the same transaction context as the write path that populated the table.
- **Cheap to evolve:** If we later want push-notified streak updates, we wrap the function in a trigger or materialized view without changing the client contract.

### Implementation Sketch

```sql
CREATE OR REPLACE FUNCTION public.compute_reading_streak(
  p_user_id UUID,
  p_timezone TEXT DEFAULT 'UTC',
  p_goal_type TEXT DEFAULT 'minutes',
  p_goal_target INT DEFAULT 20
)
RETURNS TABLE(current_streak INT, longest_streak INT, last_met_date DATE)
LANGUAGE plpgsql
SECURITY INVOKER
AS $$
-- 1. Aggregate study_sessions into per-local-day totals (minutes or pages).
-- 2. Filter for days where total >= p_goal_target.
-- 3. Scan chronologically: track current run (anchor at today or yesterday)
--    and the longest run seen.
-- 4. Return the triple.
$$;
```

### Timezone Strategy

Client passes `Intl.DateTimeFormat().resolvedOptions().timeZone` on each call. Server uses `created_at AT TIME ZONE p_timezone` to bucket. No column rename or DB-level timezone column — the timezone is a per-query input. This keeps the schema untouched and lets a traveling user compute their streak in whichever timezone they're currently using.

### Goal Target Handling

The goal fields (`dailyType`, `dailyTarget`) are already synced via E95-S01. The RPC takes them as parameters rather than reading them from `user_settings` inside the function — this keeps the function pure, avoids a second table lookup, and means a user tweaking their goal on Device A sees the streak recomputed against the new goal immediately on Device B.

### Source Signal

`public.study_sessions` is append-only (INSERT + SELECT policies only, no UPDATE or DELETE per P0 sync foundation design). This is structurally immune to the forgery class of attacks — users can INSERT their own sessions but cannot rewrite history.

### What About "Minutes vs Pages"?

`study_sessions` records minutes of activity. For the pages-based daily goal (`dailyType: 'pages'`), this story's first cut aggregates on minutes and treats `dailyType: 'pages'` as a separate signal source to be added in a follow-up (potentially tracked against `content_progress` deltas). If pages-based streaks are needed in this story, extend the function to take `p_goal_type` and branch on the source table — noted as an open question below.

## Dependencies

- **E95-S01 (Full Settings Sync Expansion)** — already merged. Provides the synced `dailyType` / `dailyTarget` fields the RPC consumes.
- **P0 sync foundation (E92)** — `study_sessions` table exists with RLS and sync wiring. No change needed.
- **E95-S03 (Server-Authoritative Entitlements)** — just merged. Sets the precedent for "server is the source of truth" in E95.

## Scope Boundaries

### In Scope

- SQL function for streak calculation + migration + rollback
- Client hydration path + store changes to consume the hydrated value
- Removal of localStorage streak write path
- Unit tests (SQL + client)

### Out of Scope

- UI/visual changes to the streak display on the Overview page (rendering uses whatever the store exposes — no component rewrite)
- Pages-based streak if it requires a new signal source (noted as open question — may be split to a follow-up story)
- Push notifications when streak is at risk (separate story)
- Historical backfill — existing users' streaks are recomputed from their actual `study_sessions` history on first hydration; there is no migration of legacy localStorage streak values (intentional: forged local values must not carry over)

## Open Questions

- **Pages-based streak signal source.** `study_sessions` is minutes-based. Is there an equivalent event log for pages-read? If yes, the RPC branches on `p_goal_type`. If no, scope this story to minutes-based streaks and add a follow-up for pages.
- **Timezone drift for a traveling user.** If a user reads at 23:00 in one timezone and 01:00 in the next timezone (same 4-hour block), does that count as one day or two? Decision: defer to whichever timezone the client is in at hydration time. Document the edge case in the function header; do not try to solve it in code.

## Success Criteria

- `compute_reading_streak` SQL function deployed; callable via `supabase.rpc()`.
- `useReadingGoalStore` reads streak from server on init and after each synced session; no localStorage writes.
- Two devices signed in as the same user show identical streak values within one hydration cycle.
- Forged localStorage values are ignored.
- All unit tests pass; no regression in existing `useReadingGoalStore.test.ts`.

## Source References

- Client store: `src/stores/useReadingGoalStore.ts` (lines 25–180 for the localStorage streak path being removed)
- Settings sync layer: `src/lib/settings.ts` (`hydrateSettingsFromSupabase`, add `hydrateStreakFromSupabase`)
- Source signal: `public.study_sessions` (P0 sync foundation — append-only, RLS-gated)
- Migration pattern to follow: `supabase/migrations/20260423000001_server_tables_no_credentials.sql` and `20260424000001_entitlements_trial_columns.sql` (just landed in E95-S03)
- Precedent for server-authoritative E95 stories: `docs/implementation-artifacts/stories/E95-S03-server-authoritative-entitlements.md`
- Goal sync context: `docs/implementation-artifacts/stories/E95-S01-full-settings-sync-expansion.md` (Tasks 4.1–4.3 — this story completes the carve-out)

## Lessons Learned

_To be filled in during `/finish-story`._
