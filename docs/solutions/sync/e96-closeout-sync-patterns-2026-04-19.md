---
module: sync
tags: [supabase, sync, rls, hydration, monotonic, append-only, local-only]
problem_type: best-practice
---

# E96 Closeout: Sync Patterns

Five non-obvious patterns discovered during Epic 96 (Remaining Tables & Features Sync, PRs #376–#379). All patterns are cross-linked from `docs/engineering-patterns.md`.

---

## Pattern 1: Insert-Only RLS Split (Separate INSERT + SELECT, No `FOR ALL`)

### Problem

Append-only tables (`ai_usage_events`, event logs, immutable audit rows) need immutability enforced at the database layer, not just via client convention. The shortcut `CREATE POLICY … FOR ALL` also grants UPDATE and DELETE, so a future bug or compromised client can mutate rows that were meant to be permanent.

### Solution

Write two separate policies — `FOR INSERT` and `FOR SELECT` — and never use `FOR ALL` on append-only tables. The absence of UPDATE/DELETE policies is the security property: without a policy matching those commands, RLS denies them.

```sql
CREATE POLICY "ai_usage_events_insert_own"
  ON public.ai_usage_events FOR INSERT
  WITH CHECK (user_id = auth.uid());

CREATE POLICY "ai_usage_events_select_own"
  ON public.ai_usage_events FOR SELECT
  USING (user_id = auth.uid());
```

Pair with `cursorColumn: 'created_at'` in `tableRegistry.ts` and an index on `(user_id, created_at)` — append-only tables have no `updated_at` column to index against.

### Enforcement

Grep for `FOR ALL` in `supabase/migrations/` during every schema review. Audit every `appendOnly: true` registry entry against its migration.

### Case Study

E96-S01 shipped two P4 insert-only tables (`ai_usage_events`, `course_reminders`) with split INSERT/SELECT policies.

---

## Pattern 2: Monotonic Field Hydration Guard — Per-Row Read-Before-Write

### Problem

Tables with monotonically-increasing fields (`challenges.currentProgress`, streak counters, XP totals) must not be hydrated with a plain `bulkPut`. When a user has offline progress queued in `syncQueue`, a download-phase `bulkPut(remoteRows)` overwrites the local ahead-of-server value with the stale server value before the queue drains. The regression is silent — the UI just snaps backwards.

### Solution

For every monotonic field, do a per-row read-before-write during hydration. Keep the local value if `local > remote`.

```typescript
async function hydrateChallengesFromRemote(rows: ChallengeRow[]) {
  const merged = await Promise.all(
    rows.map(async (remote) => {
      const local = await db.challenges.get(remote.id)
      if (!local) return remote
      return {
        ...remote,
        currentProgress: Math.max(local.currentProgress ?? 0, remote.currentProgress ?? 0),
      }
    })
  )
  await db.challenges.bulkPut(merged)
}
```

### Complement

The server-side analogue is "GREATEST Monotonic Guard Requires a Separate Reset RPC". Together they protect monotonic fields on both sides of the wire.

### Case Study

E96-S02 — `challenges.currentProgress` guard in `hydrateP3P4FromSupabase`.

---

## Pattern 3: Echo-Loop Invariant — Assert Zero `syncQueue` Rows, Not Zero `syncableWrite` Calls

### Problem

Hydration paths (download → local) must never re-enqueue rows they just received. The obvious test — "spy on `syncableWrite` and assert it was not called" — is too loose. Hydrators correctly use `db.<table>.bulkPut()` directly (not `syncableWrite`), so the spy passes; but a future refactor that calls `syncQueue.add()` directly would also pass while silently creating an echo loop.

### Solution

Assert the real invariant at the `syncQueue` layer.

```typescript
await hydrateP3P4FromSupabase(remoteRows)
const queuedCount = await db.syncQueue.count()
expect(queuedCount).toBe(0)
```

`bulkPut` is the allowed hydrate primitive. The only forbidden behaviour during a download phase is producing a new `syncQueue` entry — so that is what the test asserts.

### Case Study

E96-S02 echo-loop test suite for `hydrateP3P4FromSupabase`.

---

## Pattern 4: Hydration Ordering — `await` Fan-Out Before `syncEngine.start()`

### Problem

`syncEngine.start()` begins a debounced upload loop immediately. Fire-and-forget hydration calls dispatched before `start()` race with the engine's upload cycle — producing inconsistent Dexie state, lost writes, or spurious queue entries.

### Solution

`await` every hydrator via `Promise.all` before calling `syncEngine.start()`.

```typescript
await Promise.all([
  hydrateP0FromSupabase(),
  hydrateP1FromSupabase(),
  hydrateP2FromSupabase(),
  hydrateP3P4FromSupabase(),
])
syncEngine.start()
```

Use `Promise.all`, not `Promise.allSettled` — a hydration failure should halt boot rather than ship a partially-populated local DB. If a hydrator is intentionally best-effort, wrap it with `.catch()` inside the array so the contract is explicit at the call site.

### Case Study

E96-S02 — post-login bootstrap in `src/lib/sync/bootstrap.ts`.

---

## Pattern 5: Local-Only Exclusion for Derivable Data

### Problem

Not every Dexie table belongs in the sync registry. Create-once, zero-mutation, deterministically-derivable stores (`youtubeChapters`, transcripts, TTS cache) should be excluded from sync. But silent omission leaves the next auditor re-asking the same question a year later.

### Solution

Document exclusion as a positive decision with three criteria:

1. **Create-once** — rows are inserted during a deterministic bootstrap and never edited.
2. **Zero-mutation** — no UI affordance updates the row; no background job rewrites it.
3. **Deterministically derivable** — the data can be regenerated from an external source with the same result.

For every excluded table, record:

- Table name and Dexie schema version
- Why it is excluded (cite the three criteria)
- Re-open trigger: what user action or bootstrap step regenerates the data
- FK grep evidence: no other synced table references the PK

### Case Study

E96-S04 — `youtubeChapters` evaluated and excluded. `chapterId` FK grep across all synced tables confirmed zero cross-references, so the exclusion is safe from cascade regressions.

---

## Cross-References

- `docs/engineering-patterns.md` — each pattern has a condensed entry with a case-study link back to this file.
- `docs/solutions/sync/e93-closeout-sync-patterns-2026-04-18.md` — prior-epic companion; "GREATEST Monotonic Guard" pairs with Pattern 2 above.
- `src/lib/sync/tableRegistry.ts` — the registry entries that encode Patterns 1 and 5.
- `src/lib/sync/bootstrap.ts` — the ordering guarantee for Pattern 4.
