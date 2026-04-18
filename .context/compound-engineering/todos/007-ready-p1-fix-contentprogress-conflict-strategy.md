---
status: ready
priority: p1
issue_id: "007"
tags: [e92-s03, sync, registry, conflict-resolution]
dependencies: ["002"]
source: ce-review
relates-to: E92-S03
---

# Fix contentProgress conflictStrategy — lww conflicts with monotonic RPC

## Problem Statement

`tableRegistry.contentProgress.conflictStrategy: 'lww'` (line 164) is inconsistent with the server-side `upsert_content_progress` RPC, which implements full monotonic semantics:
- `status` only advances: `completed > in_progress > not_started` (using `_status_rank`)
- `progress_pct` uses `GREATEST`
- `completed_at` is set-once (cannot be cleared once set)

E92-S06's download phase will read `conflictStrategy: 'lww'` and apply server-wins-on-updated_at logic. This means a stale offline device with an older `updated_at` but a `status: 'in_progress'` can be written on top of a server record with `status: 'completed'` — the server's monotonic guard is only on the write path, not the read-and-merge path.

Effect: **a user who completes a lesson on Device A, then opens Device B (offline, stale cache), can have Device B's sync silently regress the lesson back to `in_progress`**. Split-brain on completion state.

## Findings

- **Location:** `src/lib/sync/tableRegistry.ts:164` (contentProgress entry)
- **Surfaced by:** data-migrations reviewer (DM-004, confidence 0.93)
- **Authoritative source:** `supabase/migrations/20260413000001_p0_sync_foundation.sql` — `upsert_content_progress` function body
- **Related:** todo #002 (schema drift on contentProgress) shares the same entry; fix together.

## Proposed Solutions

### Option 1: Change to monotonic with explicit rank declaration

**Approach:**
- Change `conflictStrategy: 'lww'` → `'monotonic'`
- Add `monotonicFields` declaring the client-side semantics. Since `status` needs rank-based comparison (not numeric GREATEST), the client-side equivalent of the RPC's `_status_rank` helper is needed. Options:
  - Extend TableRegistryEntry to support a `monotonicRank` map: `monotonicRank?: Record<string, Readonly<Record<string, number>>>` (e.g., `{ status: { not_started: 0, in_progress: 1, completed: 2 } }`)
  - Or document that status is "insert-only after first completed" and let E92-S06 implement the merge logic inline

**Pros:**
- Client merge mirrors server guard — no split-brain
- Explicit rank map is self-documenting

**Cons:**
- Extends TableRegistryEntry surface area (more fields)
- Requires E92-S06 to actually implement the rank-based merge

**Effort:** 3-4 hours (registry + type extension + test)
**Risk:** Medium

---

### Option 2: Keep lww, rely on server to reject regressions

**Approach:** Accept that the client-side merge may optimistically show a regression briefly, then a re-sync from the server corrects it.

**Pros:**
- Simpler registry

**Cons:**
- **Unacceptable UX:** a user sees their lesson flip from "completed" back to "in progress" during offline sync, even if it self-heals on next online sync. Loss of trust.
- The server doesn't reject — it just doesn't apply. But the client doesn't know that, so it ships the regressed write, then the server silently ignores it. The client's local state diverges from server state until the next download.

**Effort:** 0
**Risk:** High UX regression

## Recommended Action

**Option 1.** The cost of getting this right is small; the cost of a regression UX bug on completion state is large.

## Technical Details

**Affected files:**
- `src/lib/sync/tableRegistry.ts:50-90` — TableRegistryEntry interface (add monotonicRank if extending)
- `src/lib/sync/tableRegistry.ts:161-180` — contentProgress entry
- `src/lib/sync/__tests__/fieldMapper.test.ts` — invariant tests if TableRegistryEntry extends

**Related components:**
- E92-S06 download phase — consumes conflictStrategy
- `upsert_content_progress` RPC — server-side truth

## Resources

- **Review run artifact:** `.context/compound-engineering/ce-review/20260417-234545-6551d3b0/report.md`
- **Finding ID:** DM-004 in `data-migrations.json`
- **Depends on:** todo #002 (fixes the same entry's field map)

## Acceptance Criteria

- [ ] `contentProgress.conflictStrategy = 'monotonic'`
- [ ] `monotonicFields` declared appropriately (with rank map if chosen)
- [ ] E92-S06 implementation note added to the entry comment
- [ ] `npm run test:unit` passes

## Work Log

### 2026-04-17 - Surfaced by ce:review

**By:** Claude Code (ce:review mode:autofix)

**Actions:**
- Cross-reference between registry strategy and RPC semantics surfaced the regression risk
- Filed as P1, routed to downstream-resolver
