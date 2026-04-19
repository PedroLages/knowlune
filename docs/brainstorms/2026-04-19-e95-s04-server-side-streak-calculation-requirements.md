---
title: "E95-S04 Server-Side Streak Calculation — Requirements Brief"
type: feature-requirements
status: ready-for-planning
date: 2026-04-19
origin: docs/implementation-artifacts/stories/E95-S04-server-side-streak-calculation.md
---

# E95-S04 Server-Side Streak Calculation

## Why Now

E95-S01 (just merged) synced reading goals across devices but deliberately **excluded** streak fields (`currentReadingStreak`, `longestReadingStreak`, `lastMetDate`). Those fields were left in localStorage under `knowlune:reading-goal-streak` with an explicit "server calculates in E95-S04" comment baked into `useReadingGoalStore.ts`. That carve-out is the unresolved half of the settings-sync story: until streak becomes server-authoritative, a user clearing localStorage loses their streak, a user on two devices sees diverging values, and a user writing `currentStreak: 9999` to localStorage can forge any streak they want.

E95-S03 (also just merged) set the precedent: entitlements are server-authoritative, client-writable state is a bug. E95-S04 applies the same pattern to streaks.

## Target User & Outcome

**Who:** A learner with a 12-day reading streak who uses Knowlune on their phone, tablet, and laptop.

**Outcome they should feel:** Their streak is identical on every device within seconds of reading on any one of them. Clearing site data does not reset it. Reinstalling does not reset it. The number they see is the number the server computed from their actual `study_sessions` — not a client-maintained counter that drifts.

## Source Signal Already Exists

`public.study_sessions` is an append-only event log (P0 sync foundation, E92):

- INSERT + SELECT RLS policies only; no UPDATE/DELETE. Forgery-resistant by construction.
- Populated via the sync engine whenever the client records activity.
- `created_at` timestamp is the only signal the server needs to aggregate calendar-day totals.

No new write table is needed. The streak calculation is a pure read-side aggregation.

## Implementation Shape

**Preferred vehicle: Postgres SQL function (`SECURITY INVOKER`, callable via `supabase.rpc()`).**

Rationale:
- Zero cold-start (RPC ≈ SELECT).
- RLS on `study_sessions` is honored automatically — no bespoke auth.
- Transactionally consistent with the write path.
- Cheap to evolve into a materialized view or trigger later.

**Function contract:**

```sql
public.compute_reading_streak(
  p_user_id UUID,
  p_timezone TEXT DEFAULT 'UTC',
  p_goal_type TEXT DEFAULT 'minutes',
  p_goal_target INT DEFAULT 20
) RETURNS TABLE(current_streak INT, longest_streak INT, last_met_date DATE)
```

- Aggregates `study_sessions` by local calendar day (`(created_at AT TIME ZONE p_timezone)::date`).
- Filters days where total minutes ≥ `p_goal_target`.
- Returns the longest consecutive run and the current run (anchored at today or yesterday).

**Client consumes via a new `hydrateStreakFromSupabase()` call wired into `hydrateSettingsFromSupabase()` / `useReadingGoalStore` init.**

## Functional Requirements

- **FR1.** Create `compute_reading_streak` SQL function + migration + rollback.
- **FR2.** Add index `study_sessions (user_id, created_at)` if missing (required for the per-day scan).
- **FR3.** Add `hydrateStreakFromSupabase()` to `src/lib/settings.ts` (or new `src/lib/streak.ts`) that calls the RPC with the user's local timezone + current goal settings.
- **FR4.** Wire hydration into store init so `useReadingGoalStore.streak` reflects server state on app load and after each synced session.
- **FR5.** Remove `saveStreakToStorage()` and related localStorage writes in `useReadingGoalStore.ts`.
- **FR6.** Remove localStorage-based streak read (`loadStreakFromStorage()`). A forged `knowlune:reading-goal-streak` key must not influence store state.
- **FR7.** One-time cleanup: on next app load, `localStorage.removeItem('knowlune:reading-goal-streak')` (guarded by a flag so it runs once).
- **FR8.** Debounced re-hydration trigger after `syncableWrite('studySessions', …)` resolves (debounce 500ms).
- **FR9.** Offline cache: store last hydrated streak in IndexedDB with timestamp; if hydration fails and cached value is >24h old, set `isStale: true` on the store.
- **FR10.** Timezone: use `Intl.DateTimeFormat().resolvedOptions().timeZone` client-side; pass to the RPC per-call. No DB-level timezone column.
- **FR11.** Goal threshold: pass current `dailyType` / `dailyTarget` into the RPC. Only days meeting the threshold count.

## Acceptance Criteria Traceability

Each AC from the story maps to one or more FRs:

| AC | Maps to |
|----|---------|
| AC1 (server computes streaks from activity) | FR1, FR11 |
| AC2 (identical on two devices) | FR3, FR4, FR8 |
| AC3 (no localStorage writes) | FR5, FR7 |
| AC4 (survives localStorage clear) | FR3, FR4, FR6 |
| AC5 (forged values ignored) | FR6, FR7 |
| AC6 (offline stale handling) | FR9 |
| AC7 (local calendar day, not UTC) | FR10 |
| AC8 (goal threshold factored) | FR11 |

## Scope Boundaries

**In scope:**
- SQL function + migration + rollback
- Client hydration + store changes
- Removal of localStorage streak write path
- Unit + SQL tests

**Out of scope:**
- UI/visual changes to the streak display (uses whatever the store exposes)
- Pages-based streak if it requires a new signal source (flagged as open question)
- Push notifications for streak-at-risk
- Historical backfill of legacy localStorage streak values (intentional — forged values must not persist)

## Open Questions (to resolve during planning)

- **OQ1.** Pages-based streak: does any existing event log record pages read? If no, scope this story to minutes-based and add a follow-up story for pages. If yes, the RPC branches on `p_goal_type`.
- **OQ2.** Timezone edge case for traveling users: "same 4-hour block across two timezones" — declare the behavior in the function header, don't over-engineer a solution.
- **OQ3.** Does `study_sessions` already have an index on `(user_id, created_at)`? Inspect before writing Task 2.3.

## Non-Goals

- Not a full event-sourcing rewrite.
- Not adding a new server endpoint via Edge Function (SQL function is sufficient).
- Not changing `study_sessions` schema.
- Not changing the sync engine.

## Dependencies

- E95-S01 (merged) — supplies synced goal fields.
- E92 P0 sync foundation (merged) — supplies `study_sessions` table.
- E95-S03 (merged) — precedent for server-authoritative pattern.

## Risks & Mitigations

| Risk | Mitigation |
|------|------------|
| RPC is slow without the `(user_id, created_at)` index | Verify index exists; add via migration if not. Explain-analyze on a representative dataset during planning |
| Timezone aggregation returns wrong day for DST transitions | Postgres `AT TIME ZONE` handles DST correctly; test explicitly in the function's unit tests |
| Client races: a session syncs but hydration fires before the write lands in `study_sessions` | Debounce 500ms (FR8) + listen for sync-engine "session committed" event rather than firing on optimistic write |
| Removing `loadStreakFromStorage()` orphans users mid-upgrade (they briefly see 0-streak before first hydration) | Keep offline cache (FR9) as the fast-render path; hydration result overwrites. First-launch-post-upgrade users see server value within one round-trip |

## Institutional Learnings to Apply

- **Fail-closed destructive migrations pattern** (E93-S01): this story is additive (new function, new index), so the pattern doesn't apply — noted for completeness.
- **Server-authoritative pattern** (E95-S03): tests must assert the RPC is invoked even when a cache exists. Mirror the FR4 test from E95-S03.
- **Append-only event log pattern** (E93-S08 chat conversations, P0 study_sessions): `study_sessions` is already append-only — no new write-side guardrails needed.
- **ES2020 constraint**: `Promise.allSettled` preferred over `Promise.any`.
- **Idempotent SQL**: use `CREATE OR REPLACE FUNCTION` and `CREATE INDEX IF NOT EXISTS`.

## References

- Story: `docs/implementation-artifacts/stories/E95-S04-server-side-streak-calculation.md`
- Client store: `src/stores/useReadingGoalStore.ts`
- Settings sync: `src/lib/settings.ts`
- Source table migration: `supabase/migrations/20260413000001_p0_sync_foundation.sql` (defines `study_sessions`)
- Migration style: `supabase/migrations/20260424000001_entitlements_trial_columns.sql` (E95-S03, just merged)
- Precedent story: `docs/implementation-artifacts/stories/E95-S03-server-authoritative-entitlements.md`
- Related E95-S01 carve-out: `docs/implementation-artifacts/stories/E95-S01-full-settings-sync-expansion.md` Tasks 4.1–4.3
