---
title: "feat: E95-S04 Server-Side Streak Calculation — compute_reading_streak RPC + client hydration + localStorage removal"
type: feat
status: active
date: 2026-04-19
origin: docs/brainstorms/2026-04-19-e95-s04-server-side-streak-calculation-requirements.md
story: docs/implementation-artifacts/stories/E95-S04-server-side-streak-calculation.md
---

# feat: E95-S04 Server-Side Streak Calculation

## Overview

Makes reading-streak the third server-authoritative primitive in Knowlune (after auth and entitlements). The source signal (`public.study_sessions`) is already an append-only RLS-gated event log, so this story is purely about: (1) a read-side SQL function that aggregates those rows into a current/longest streak triple, (2) a client hydration path that replaces the current localStorage-based streak state in `useReadingGoalStore`, and (3) deleting the forgeable localStorage write path entirely.

E95-S01 deliberately left this carve-out in place with a `// E95-S04` TODO marker in `useReadingGoalStore.ts` lines 109 and 152–180. This plan fills in that carve-out.

## Problem Frame

Three concrete bugs result from the current state:

1. **Cross-device drift.** Device A reads for 30 minutes → streak advances to 5 on Device A only. Device B still shows 4 until the user manually "fixes" it by opening the app and crossing the threshold again.
2. **Streak loss on storage clear.** A user who clears site data, uses private browsing, or reinstalls loses their entire streak history — the "gym membership" effect that makes streak-driven habits fragile.
3. **Trivial forgery.** `localStorage.setItem('knowlune:reading-goal-streak', '{"currentStreak":9999,...}')` in devtools currently sets a forever-streak. No integrity check exists.

All three dissolve when the streak becomes a pure read over `study_sessions`, which is already write-protected by RLS + append-only policies.

(see origin: `docs/brainstorms/2026-04-19-e95-s04-server-side-streak-calculation-requirements.md`)

## Requirements Trace

| # | FR | Description | Story AC |
|---|----|-------------|----------|
| R1 | FR1 | `compute_reading_streak(p_user_id, p_timezone, p_goal_type, p_goal_target)` SQL function | AC1 |
| R2 | FR2 | Verify `(user_id, started_at)` index exists — **no-op, already present** as `idx_study_sessions_user_started` in `20260413000001_p0_sync_foundation.sql` line 85 | AC1 |
| R3 | FR3 | `hydrateStreakFromSupabase()` in `src/lib/streak.ts` calling the RPC | AC1, AC4 |
| R4 | FR4 | Wire hydration into store init + into `hydrateSettingsFromSupabase()` | AC2, AC4 |
| R5 | FR5 | Remove `saveStreakToStorage()` + all `knowlune:reading-goal-streak` writes | AC3 |
| R6 | FR6 | Remove `loadStreakFromStorage()` — forged values ignored | AC5 |
| R7 | FR7 | One-time `localStorage.removeItem('knowlune:reading-goal-streak')` on upgrade | AC3 |
| R8 | FR8 | Debounced (500ms) re-hydration after `syncableWrite('studySessions', ...)` resolves | AC2 |
| R9 | FR9 | IndexedDB cache of last hydrated streak + `isStale` flag when >24h old + hydration failed | AC6 |
| R10 | FR10 | Client passes `Intl.DateTimeFormat().resolvedOptions().timeZone` per call | AC7 |
| R11 | FR11 | RPC takes `p_goal_target`; only days meeting threshold count | AC8 |

## Scope Boundaries

- No schema changes to `study_sessions` (immutable once written; column set is already sufficient).
- No new Edge Functions (SQL function + RPC is enough).
- No changes to the sync engine.
- No UI/visual changes to streak-rendering components (Overview.tsx, Challenges.tsx reading store consumers unchanged — they read whatever the store exposes).
- No historical backfill: existing localStorage streak values are DELETED, not migrated. Intentional — forged values must not carry over. Server recomputes from actual `study_sessions` history on first hydration.
- No push-notify-on-streak-at-risk (deferred).

### Deferred to Separate Tasks

- Pages-based streak signal source (OQ1). This plan ships minutes-only. If `dailyType === 'pages'`, the RPC returns zero — a follow-up story can add a pages signal. See **Open Questions** below.

## Context & Research

### Relevant Code and Patterns

- **`src/stores/useReadingGoalStore.ts`** — has the localStorage read/write path being removed. Lines 25–27 define the `streak` shape; lines 55–65 define `loadStreakFromStorage`; lines ~80 define default streak in zustand init; lines 109 and 152–180 have the TODO comments + `saveStreakToStorage()` call sites in `updateStreakOnMinutes` / `updateStreakOnPages`.
- **`src/lib/settings.ts`** — existing `hydrateSettingsFromSupabase()` and `saveSettingsToSupabase()` from E95-S01 are the pattern for the new `hydrateStreakFromSupabase()`. Colocate in a sibling `src/lib/streak.ts` for clarity.
- **`supabase/migrations/20260413000001_p0_sync_foundation.sql`** — defines `study_sessions` with `started_at TIMESTAMPTZ NOT NULL`, `duration_seconds INTEGER`, RLS `select_own` + `insert_own`, and the `idx_study_sessions_user_started` index we need. Critical: the correct bucketing column is **`started_at`** (when the user actually read), not `created_at` (when the row synced to server — can be hours or days later on offline-first devices).
- **`supabase/migrations/20260424000001_entitlements_trial_columns.sql`** (E95-S03, just merged) — migration style to follow: header comment referencing the epic+story, `BEGIN/COMMIT`, idempotent DDL, rollback pairing.
- **`src/lib/entitlement/isPremium.ts`** — precedent for "server always called, cache is UX hint" from E95-S03. Streak hydration should follow the same shape: optimistic render from cache, then overwrite with server result.
- **`src/lib/entitlement/__tests__/isPremium.test.ts`** — mocking pattern for `supabase.rpc` / `supabase.from` to reuse in streak tests.
- **`src/lib/sync/` entry points** — `syncableWrite()` contract is documented in `docs/implementation-artifacts/92-3-sync-table-registry-and-field-mapping.md`. We listen at the pull-confirmation boundary, not on the optimistic write, to avoid racing the server.

### Institutional Learnings

- **Server-authoritative pattern (E95-S03):** write a test that asserts `mockSupabaseRpc` is called even when a fresh IDB cache exists. Mirror FR4 from that story.
- **Append-only event log (P0):** `study_sessions` is structurally immune to write-side forgery. No new guardrails needed.
- **Idempotent migrations:** `CREATE OR REPLACE FUNCTION` + `CREATE INDEX IF NOT EXISTS` + rollback `DROP FUNCTION IF EXISTS`.
- **ES2020:** `Promise.allSettled` preferred; `?.` / `??` available.
- **Dexie 4 quirks** (memory: `reference_dexie_4_quirks.md`): IDB cache table for streak should store `{userId, currentStreak, longestStreak, lastMetDate, cachedAt}` keyed by userId — same shape as `db.entitlements`.

## Key Technical Decisions

- **SQL function, not Edge Function.** Zero cold-start, RLS-honored, single-hop, transactionally consistent. Edge Function only if we later need server-to-server push.
- **`SECURITY INVOKER` (not DEFINER).** Preserves the `select_own` RLS policy on `study_sessions` — user can only aggregate their own rows.
- **Bucket by `started_at`, not `created_at`.** `created_at` is the sync-arrival timestamp on the server, which can lag hours/days on offline-first devices. `started_at` is the actual user-activity timestamp.
- **Timezone is a per-call parameter, not a column.** User travels → we want the streak to reflect their current local calendar. No DB-level timezone column, no user-settings lookup from inside the function.
- **`p_goal_target` is a parameter, not a subquery.** Keeps the function pure, avoids a second table lookup, means an on-device goal change recomputes against the new threshold immediately.
- **Cache table in IndexedDB, NOT localStorage.** `db.readingStreakCache` keyed by userId. Survives localStorage clear (IDB has separate user-initiated clear affordance) and matches the storage location used by the entitlements cache.
- **Debounce at 500ms.** A batch sync that commits 5 sessions shouldn't fire 5 RPCs. 500ms is the same debounce interval used elsewhere in the sync engine.
- **Rehydration trigger = sync-commit event, not optimistic write.** Prevents a race where the hydration fires before the row is visible server-side. Subscribe to the sync engine's post-commit event (or poll the in-flight `syncQueue` transitions — see implementation note below).

## Open Questions

### Resolved During Planning

- **OQ3 (index exists?).** Resolved: `idx_study_sessions_user_started` already exists in `20260413000001_p0_sync_foundation.sql` line 85. R2 becomes a no-op verification. If a smoke-check reveals it's missing on a particular environment, Unit 1 adds `CREATE INDEX IF NOT EXISTS` as a safety net.
- **OQ2 (traveler edge case).** Resolved: compute using client's current-time-of-hydration timezone. Document in the function header that a user who reads at 23:00 UTC+1, flies to UTC-8, and re-hydrates may see that session attributed to a different calendar day. Acceptable — the streak number only ever goes up, not down, for this case.
- **Prior art reference in schema comment.** The p0 foundation comment at line 84 says "Streak calculation queries (E92-S05 `calculate_streak`)" but no such function exists in any migration. This story is the first time we ship it. Function name `compute_reading_streak` (not `calculate_streak`) to avoid any stale references — documented in the function header.
- **`started_at` vs `created_at`.** Resolved: bucket on `started_at`. `created_at` is server-arrival, `started_at` is user-activity.

### Deferred to Implementation

- **OQ1 (pages signal).** In this plan: if `p_goal_type = 'pages'`, the function returns zeros with a noop — no behavioral change vs current. Follow-up story can add a pages signal source. Flagged in the function header.
- **Sync-commit event hook.** The exact API for "subscribe to post-commit" in the sync engine — we'll inspect `src/lib/sync/` during Unit 3 implementation. If no direct event exists, fall back to a 5s polling interval guarded by navigator.onLine (acceptable for a non-realtime streak display).

## Implementation Units

- [ ] **Unit 1: SQL migration — `compute_reading_streak` function**

**Goal:** Add the `public.compute_reading_streak` RPC + safety-net index + rollback.

**Requirements:** R1, R2

**Dependencies:** None

**Files:**
- Create: `supabase/migrations/20260425000001_compute_reading_streak.sql`
- Create: `supabase/migrations/rollback/20260425000001_compute_reading_streak_rollback.sql`

**Approach:**
1. Function signature:
   ```sql
   CREATE OR REPLACE FUNCTION public.compute_reading_streak(
     p_user_id    UUID,
     p_timezone   TEXT DEFAULT 'UTC',
     p_goal_type  TEXT DEFAULT 'minutes',
     p_goal_target INT  DEFAULT 20
   ) RETURNS TABLE(current_streak INT, longest_streak INT, last_met_date DATE)
   LANGUAGE plpgsql
   SECURITY INVOKER  -- RLS on study_sessions is honored
   STABLE             -- pure function of input + table state
   ```
2. Body: single CTE chain — (a) bucket into `day := (started_at AT TIME ZONE p_timezone)::date` with per-day `SUM(duration_seconds) / 60` as minutes; (b) filter to `minutes_total >= p_goal_target` when `p_goal_type = 'minutes'`, else return all-zero row (pages path deferred — OQ1); (c) compute longest consecutive run via window-functions (`date - row_number() * interval '1 day'` grouping trick); (d) compute current run by anchoring on whether the latest met-day is today or yesterday in `p_timezone`.
3. Index safety-net: `CREATE INDEX IF NOT EXISTS idx_study_sessions_user_started ON public.study_sessions (user_id, started_at);` — already present from P0 but idempotent guard ensures forward-compat.
4. Header comment: epic/story reference, explanation of timezone choice, note that `started_at` is the bucketing column, OQ1 pages-deferred note.
5. Rollback: `DROP FUNCTION IF EXISTS public.compute_reading_streak(UUID, TEXT, TEXT, INT);`

**Patterns to follow:**
- `supabase/migrations/20260424000001_entitlements_trial_columns.sql` — header, BEGIN/COMMIT, idempotent DDL
- `supabase/migrations/rollback/20260424000001_entitlements_trial_columns_rollback.sql` — rollback style

**Test scenarios:**
- None in this unit (SQL DDL). SQL behavior is tested in Unit 5 via the client test harness that invokes the RPC against a mocked or local Supabase.

**Verification:**
- `supabase migration up` applies cleanly.
- `psql -c "\df public.compute_reading_streak"` shows the function.
- `psql -c "SELECT * FROM public.compute_reading_streak('00000000-0000-0000-0000-000000000000');"` returns `(0, 0, NULL)` for a non-existent user.

---

- [ ] **Unit 2: `hydrateStreakFromSupabase()` module**

**Goal:** Client helper that calls the RPC and normalizes the response into the store shape.

**Requirements:** R3, R10, R11

**Dependencies:** Unit 1

**Files:**
- Create: `src/lib/streak.ts`
- Create: `src/lib/__tests__/streak.test.ts`

**Approach:**
1. Export `hydrateStreakFromSupabase(userId, goal): Promise<{currentStreak, longestStreak, lastMetDate} | null>`.
2. Implementation:
   ```ts
   const timezone = Intl.DateTimeFormat().resolvedOptions().timeZone
   const { data, error } = await supabase.rpc('compute_reading_streak', {
     p_user_id: userId,
     p_timezone: timezone,
     p_goal_type: goal.dailyType,
     p_goal_target: goal.dailyTarget,
   })
   if (error || !data) return null
   return {
     currentStreak: data[0].current_streak ?? 0,
     longestStreak: data[0].longest_streak ?? 0,
     lastMetDate: data[0].last_met_date ?? null,
   }
   ```
3. Guard: early-return `null` if `!supabase` or `!userId` (anonymous users never call).

**Patterns to follow:**
- `src/lib/entitlement/isPremium.ts` `validateEntitlementOnServer()` — error tolerance, null-return-on-failure shape.
- `src/lib/settings.ts` — auth guard + `saveSettingsToSupabase` pattern.

**Test scenarios:**
- Happy path: mocked RPC returns `{current_streak: 7, longest_streak: 12, last_met_date: '2026-04-19'}` → function returns normalized shape.
- Error: RPC returns `{error: {message: '...'}}` → function returns `null`.
- Anonymous: `userId = null` → function returns `null` without calling supabase.
- Timezone passthrough: spy on `supabase.rpc` to assert `p_timezone` equals the mocked `Intl` timezone.

**Verification:**
- `npm run test:unit -- src/lib/__tests__/streak.test.ts` → all pass.

---

- [ ] **Unit 3: IndexedDB streak cache table**

**Goal:** Add a Dexie table for offline-available last-known streak so cold-boot renders instantly.

**Requirements:** R9

**Dependencies:** None (can run parallel with Unit 1/2)

**Files:**
- Modify: `src/db/schema.ts` — add `readingStreakCache` table
- Create: `src/lib/streakCache.ts` — `getCachedStreak(userId)`, `cacheStreak(userId, streak)`, `clearCachedStreak(userId)`
- Create: `src/lib/__tests__/streakCache.test.ts`

**Approach:**
1. Dexie table: `readingStreakCache: 'userId, cachedAt'` with row shape `{userId, currentStreak, longestStreak, lastMetDate, cachedAt}`.
2. Bump Dexie schema version (follow existing pattern in `src/db/schema.ts` for additive version bumps — no migration function needed for pure add).
3. Helpers mirror `db.entitlements.get/put/delete` style.
4. `isStale(cached, thresholdMs = 24*60*60*1000)` helper returns `true` if `Date.now() - cached.cachedAt > thresholdMs`.

**Patterns to follow:**
- `src/db/schema.ts` — existing additive Dexie version bump pattern.
- `src/lib/checkout.ts` `getCachedEntitlement`/`cacheEntitlement` — the canonical "IDB-backed server-state cache" shape.

**Test scenarios:**
- Write then read: `cacheStreak('user-1', {...})` then `getCachedStreak('user-1')` returns same object.
- Missing: `getCachedStreak('nobody')` returns undefined.
- Stale: `isStale({cachedAt: Date.now() - 25*60*60*1000})` → true; `-23*60*60*1000` → false.
- Clear: `clearCachedStreak('user-1')` removes the row.

**Verification:**
- `npm run test:unit -- src/lib/__tests__/streakCache.test.ts` → all pass.

---

- [ ] **Unit 4: Rewire `useReadingGoalStore` to server-authoritative path**

**Goal:** Replace `loadStreakFromStorage`/`saveStreakToStorage` with hydration + cache. Delete localStorage writes. Add one-time cleanup of the legacy key.

**Requirements:** R4, R5, R6, R7, R8

**Dependencies:** Unit 2, Unit 3

**Files:**
- Modify: `src/stores/useReadingGoalStore.ts`
- Modify: `src/lib/settings.ts` (wire hydrate call into `hydrateSettingsFromSupabase`)
- Modify: `src/stores/__tests__/useReadingGoalStore.test.ts`

**Approach:**
1. **Delete** `loadStreakFromStorage()` body — replace with a stub that returns `{currentStreak: 0, longestStreak: 0, lastMetDate: null}` and that **does not touch localStorage**. Keep the symbol only if removing it breaks callers outside the store; otherwise delete.
2. **Delete** `saveStreakToStorage()` calls in `updateStreakOnMinutes()` and `updateStreakOnPages()`. Those methods become no-ops for streak advancement — the server decides. Consider renaming them or documenting they now only exist for test compatibility.
   - Decision deferred to implementation: if call sites outside the store expect them to be truthy-returning, keep the signature and always return `false` with a code comment pointing to E95-S04.
3. **Add** `hydrateStreak()` action on the store: reads cache optimistically → calls `hydrateStreakFromSupabase(user.id, goal)` → writes result to state + cache → clears `isStale` on success / sets `isStale` on failure-with-old-cache.
4. **Wire into init:** `hydrateSettingsFromSupabase()` in `src/lib/settings.ts` gains a final step that calls `useReadingGoalStore.getState().hydrateStreak()`. This runs on sign-in / app-cold-boot.
5. **Wire into sync trigger (R8):** inspect `src/lib/sync/syncEngine.ts` for the post-commit hook. Add a debounced (500ms) listener that, when `studySessions` rows land, calls `hydrateStreak()`. If no direct event surface exists, fall back to a `window.addEventListener('online', ...)` + 60s polling interval guarded by `navigator.onLine` (acceptable for non-realtime UI) — flag this fallback in the commit message for follow-up.
6. **One-time cleanup (R7):** on store init, `localStorage.removeItem('knowlune:reading-goal-streak')` guarded by a new flag `localStorage.getItem('knowlune:e95-s04-streak-cleanup')`. After cleanup, set the flag to `'1'`. This is one-time only.

**Patterns to follow:**
- `src/lib/entitlement/isPremium.ts` — optimistic cache render, then server overwrite.
- `src/stores/useEngagementPrefsStore.ts` (from E95-S01) — zustand store + `saveSettingsToSupabase` wiring.

**Test scenarios:**
- **Happy — hydration populates store:** mock `hydrateStreakFromSupabase` to return `{currentStreak: 7, longestStreak: 12, lastMetDate: '2026-04-19'}`, call `store.hydrateStreak()`, assert `store.streak` matches.
- **Server always called even with cache (E95-S03 pattern):** pre-populate IDB cache, call `hydrateStreak()`, assert `mockHydrate` was invoked regardless.
- **Forged localStorage ignored:** `localStorage.setItem('knowlune:reading-goal-streak', '{"currentStreak":9999}')`, instantiate store, assert `store.streak.currentStreak !== 9999`.
- **One-time cleanup fires once:** on first init `localStorage.removeItem` is called and the flag is set; on second init, `removeItem` is NOT called again.
- **Offline stale:** cache present (25h old), `hydrateStreakFromSupabase` rejects, assert `store.streak` shows cached values and `store.isStale === true`.
- **Regression — `updateStreakOnMinutes` no longer writes localStorage:** spy on `localStorage.setItem`, call `updateStreakOnMinutes(30)`, assert setItem was never called with `knowlune:reading-goal-streak`.

**Verification:**
- `npm run test:unit -- src/stores/__tests__/useReadingGoalStore.test.ts` → all pass (new + existing).
- Manual: clear localStorage, reload app — streak renders from server within one round-trip.

---

- [ ] **Unit 5: Live SQL-behavior test (RPC against local Supabase or mocked client)**

**Goal:** Verify the SQL function produces the right current/longest/last-met values under real data conditions.

**Requirements:** R1, R11 (goal-threshold), AC7 (timezone), AC8

**Dependencies:** Unit 1

**Files:**
- Create: `src/lib/__tests__/streak.integration.test.ts`

**Approach:**
1. These tests run against a mocked supabase client where `.rpc('compute_reading_streak', ...)` responses are stubbed — we are testing the client's consumption + shape expectations, NOT the SQL itself. (SQL correctness is verified manually during Unit 1 via `psql`; true pgTAP tests are deferred as the project has no pg-test harness yet.)
2. Scenarios to stub:
   - 7 consecutive days, each meeting threshold → `(7, 7, today)`.
   - 7 days then 2-day gap then today → `(1, 7, today)`.
   - Session at 23:30 local UTC+1 → counts toward local day (verified via the timezone string passed to the mock).
   - Goal target 30 minutes, day with only 15 minutes → day excluded → current streak doesn't include that day.
3. Document the manual `psql` verification checklist in the test file header so Unit 1's SQL has a reproducible smoke test.

**Patterns to follow:**
- `src/lib/entitlement/__tests__/isPremium.test.ts` — mocking pattern for supabase `.rpc()`.

**Test scenarios:** (see above — 4 scenarios)

**Verification:**
- `npm run test:unit -- src/lib/__tests__/streak.integration.test.ts` → all pass.
- Manual smoke: on a local Supabase instance with 3 rows inserted, `psql -c "SELECT * FROM public.compute_reading_streak(...)"` returns expected triple.

---

- [ ] **Unit 6: Sprint-status + story-file closeout**

**Goal:** Mark the story done, update sprint-status, record lessons.

**Requirements:** none (process step)

**Dependencies:** Units 1–5

**Files:**
- Modify: `docs/implementation-artifacts/sprint-status.yaml`
- Modify: `docs/implementation-artifacts/stories/E95-S04-server-side-streak-calculation.md` (fill Lessons Learned section)

**Approach:** standard `/finish-story` bookkeeping. If any follow-up work is deferred (pages signal, sync-commit event hook) add to `docs/known-issues.yaml`.

**Test scenarios:** none.

**Verification:** sprint-status entry shows `status: done` with merged PR URL.

## System-Wide Impact

- **Interaction graph:** `hydrateStreakFromSupabase` is called from (a) `hydrateSettingsFromSupabase` on cold-boot, (b) the sync-engine post-commit hook with 500ms debounce, (c) the online-event handler (re-uses the existing entitlement online event pattern). No React effect or callback fires before user is authenticated (guarded by `!user` early-return).
- **Error propagation:** RPC failure → `hydrateStreakFromSupabase` returns `null` → store's `hydrateStreak()` keeps existing cached values and flips `isStale: true`. No toast, no error surface — streaks are visual/motivational state, not a security boundary. Visible behavior: the number stops advancing until network returns.
- **State lifecycle:** legacy `knowlune:reading-goal-streak` key is DELETED on first post-upgrade init. Users who forged values lose them (intentional). Users with genuine streaks have them recomputed from `study_sessions` on first hydration — typically identical or higher (server may credit days the client missed).
- **API surface parity:** `useReadingGoalStore.streak` getter signature is unchanged. `useReadingGoalStore.streak.isStale` is a new field — consumers that ignore it see no behavior change. No other store consumers.
- **Integration coverage:** Unit 4's store tests exercise the full hydrate-then-render path with mocked `hydrateStreakFromSupabase`. Unit 5 tests the RPC consumption contract. Manual `psql` smoke verifies SQL under real data.
- **Unchanged invariants:** `study_sessions` schema, RLS, sync engine write path, `user_settings` JSONB, entitlement hydration, Stripe webhook.

## Risks & Dependencies

| Risk | Mitigation |
|------|------------|
| Sync-engine post-commit hook doesn't exist as a callable event | Unit 4 fallback: `online` event + 60s-interval polling. Not ideal but acceptable — flagged in commit msg and known-issues |
| `dailyType === 'pages'` users see `(0, 0, null)` after upgrade | OQ1 flagged. Function header notes pages is deferred. Zero-regression for minutes users (majority). Known-issue entry added |
| Timezone travelers see a session reattributed to a different calendar day | Documented in function header. Streak number only ever goes up — no user-facing loss |
| RPC is slow on users with many years of study_sessions | Existing index `(user_id, started_at)` is the correct access path. Function uses window aggregation bounded by WHERE user_id match. Explain-analyze during Unit 1 smoke |
| One-time localStorage cleanup fires twice due to race in store init | Guarded by `knowlune:e95-s04-streak-cleanup` flag — setItem is synchronous, so the second init sees the flag and skips |
| Store's `updateStreakOnMinutes` no-op breaks unknown consumers | Grep for `updateStreakOnMinutes` + `updateStreakOnPages` before deleting. Keep method signature + return type for back-compat; just gut the body |

## Sources & References

- Requirements brief: `docs/brainstorms/2026-04-19-e95-s04-server-side-streak-calculation-requirements.md`
- Story: `docs/implementation-artifacts/stories/E95-S04-server-side-streak-calculation.md`
- Source table: `supabase/migrations/20260413000001_p0_sync_foundation.sql` (lines 70–105)
- Migration pattern: `supabase/migrations/20260424000001_entitlements_trial_columns.sql` (E95-S03)
- Server-authoritative precedent: `docs/implementation-artifacts/stories/E95-S03-server-authoritative-entitlements.md`
- Current localStorage path being removed: `src/stores/useReadingGoalStore.ts`
- E95-S01 carve-out that motivates this story: `docs/implementation-artifacts/stories/E95-S01-full-settings-sync-expansion.md` Tasks 4.1–4.3
