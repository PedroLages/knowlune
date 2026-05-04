---
title: Paths as Study Plan — SyncableWrite Batching, Date-Range Analytics, and Milestone Hook Patterns
date: 2026-05-04
category: best-practices
module: learning-paths
problem_type: best_practice
component: development_workflow
severity: medium
applies_when:
  - Batching writes through Dexie syncableWrite where individual entries must succeed or fail independently and no transaction API exists
  - Adding date-range filters to analytics dashboards where some metrics are current-state snapshots with no historical reconstruction path
  - Building React hooks that watch derived progress and auto-create side effects (challenges, notifications) — the mount level determines coverage
  - Mutating Zustand store state where persistence depends on calling the store's update method rather than assigning properties directly
tags:
  - learning-paths
  - syncable-write
  - zustand
  - date-range
  - path-analytics
  - batch-operations
  - milestone-hooks
  - store-mutations
related_components:
  - reports
  - challenges
  - study-schedule
---

# Paths as Study Plan — SyncableWrite Batching, Date-Range Analytics, and Milestone Hook Patterns

## Context

The "Paths as Study Plan" feature (PR [#501](https://github.com/PedroLages/knowlune/pull/501)) bridged learning paths into three existing systems — Study Schedule, Challenges, and Reports — so paths function as first-class study plans. Three non-obvious patterns emerged during implementation, each solving a structural constraint in the codebase that the naive approach would have violated.

These are not bugs that were fixed; they are design decisions where the obvious approach was either impossible, lossy, or silently incorrect. Each lesson documents what constraint made the obvious approach wrong and what invariant the working solution relies on.

## Guidance

### 1. Accept Partial Creation When Batching Through Non-Transactional Persistence

`syncableWrite` — the codebase's single write path for all Dexie mutations that sync to Supabase — has no transaction semantics. Each call independently persists to IndexedDB and enqueues a separate sync queue entry. There is no batch API, no two-phase commit, and no rollback.

When building the Plan My Week flow, the user can create multiple schedule entries in one action (one per incomplete course in the path). The naive expectation was atomicity: all entries succeed or none do. But once `addSchedule` calls `syncableWrite`, that record is committed — there is no way to undo it short of a compensating delete, which itself would be a separate `syncableWrite` call (creating its own sync queue entry and a visible delete-then-recreate dance in Supabase).

**What was considered and rejected**: Building a transactional wrapper that buffers writes and flushes on success, rolling back on failure. This is impossible with the current architecture because each `syncableWrite` commits independently — there is no connection-scoped transaction to abort.

**What we did instead**: Accept partial creation as the pragmatic approach. The batch method `addSchedules` iterates sequentially, collects per-entry success/failure, and returns both sets to the caller:

```typescript
// src/stores/useStudyScheduleStore.ts
addSchedules: async (schedules) => {
  const created: StudySchedule[] = []
  const failed: Array<{ input: Omit<StudySchedule, 'id' | 'createdAt' | 'updatedAt'>; error: string }> = []

  for (const input of schedules) {
    try {
      const result = await get().addSchedule(input) // each call independently syncableWrites
      if (result) {
        created.push(result)
      } else {
        failed.push({ input, error: 'Failed to create schedule' })
      }
    } catch (err) {
      failed.push({ input, error: err instanceof Error ? err.message : 'Unknown error' })
    }
  }

  if (failed.length > 0) {
    toast.error(`${created.length} of ${schedules.length} schedule${schedules.length !== 1 ? 's' : ''} created`)
  }

  return { created, failed }
}
```

**Invariants this relies on**:
- Each `addSchedule` call is independent — failure of entry 4 does not affect entries 1-3
- The Plan My Week preview dialog is editable before the user confirms save, so the chance of creating unwanted entries is low
- Batch creation is user-initiated and infrequent, not a background sync or automated process
- The inline `PathScheduleList` supports deletion, so users can clean up unwanted entries after a partial failure

**Why this is acceptable**: Over-engineering a transaction layer for an infrequent, low-impact failure mode would be worse than the failure mode itself. The user sees a clear message about what succeeded and what failed, and can act accordingly.

### 2. Scope Date-Range Filters to Naturally-Filterable Data Only

The Reports page gained a "Learning Paths" tab with a date range filter (`DateRangeFilter`). The stacked bar chart groups paths into completion buckets (0-25%, 25-50%, 50-75%, 75-100%), and the stats table shows completion percentages per path. Both are derived from `usePathProgress`, which computes completion from the current state of `progress` and `contentProgress` tables.

**The non-obvious constraint**: These progress tables track whether a lesson is completed *now*, not when it was completed. There is no `completedAt` timestamp on lesson progress records. To answer "what was this path's completion percentage on April 1st" you would need to replay every `StudySession` record through the progress model — tracking which lessons were in the path at that date AND which were completed at that date. Neither data source exists. `StudySession` has `courseId` but no `learningPathId` FK, and it records activity (duration), not completion state.

**Attempted approach that would have been fragile**: Reconstructing historical point-in-time completion by scanning StudySessions, cross-referencing with lesson completion rules, and building a timeline. This would be complex, fragile, and would still be lossy because sessions for courses removed from a path would appear while sessions for newly added courses would be missing (path-membership-based filtering is inherently lossy without a `learningPathId` FK on `StudySession`).

**What we did instead**: Scope the date filter to what is naturally filterable, and show current state where historical reconstruction is impossible:

| Visualization | Date Range Effect | Why |
|---|---|---|
| Stacked bar chart (completion buckets) | None — always shows current completion | `usePathProgress` is point-in-time |
| Cumulative hours line chart | Filtered by `StudySession.startTime` | `startTime` is a native temporal field |
| Stats table — Completion / Courses columns | None — always shows current state | Same as bar chart |
| Stats table — Hours / Last Activity columns | Filtered by `StudySession.startTime` | Same as line chart |

The key implementation detail: `StudySession` queries are filtered by courseId set (from current `LearningPathEntry` rows) and date range, while completion data comes from `usePathProgress` / `useMultiPathProgress` (unfiltered):

```typescript
// src/app/components/reports/PathAnalyticsTab.tsx — computePathRows
const courseIds = pathCourseIds.get(path.id) ?? []
let query = db.studySessions.where('courseId').anyOf(courseIds)

// Date range only affects the session query
if (dateRange.from || dateRange.to) {
  query = query.filter(s => {
    const startTime = new Date(s.startTime).getTime()
    if (dateRange.from && startTime < dateRange.from.getTime()) return false
    if (dateRange.to && startTime > dateRange.to.getTime()) return false
    return true
  })
}
const sessions = await query.toArray()

// hoursSpent and lastActivityDate come from filtered sessions
// completionPct and course counts come from usePathProgress (current state, unfiltered)
```

The UI labels the line chart "(filtered by date range)" when a filter is active, so users understand the scope difference between the two charts.

**Invariants this relies on**:
- `usePathProgress` computes from current state only — no historical snapshots exist and none are planned
- `StudySession.startTime` is the only temporal field available for date-range queries
- Path-membership-based filtering (extracting `courseId` set from current `LearningPathEntry` rows) is adequate for analytics but lossy: sessions for courses later removed from the path appear; sessions for courses added after those sessions occurred do not appear
- Adding `learningPathId` FK to `StudySession` (tagging sessions at creation time from path context) is a deferred enhancement that would make this filtering precise

### 3. Mount Side-Effect Hooks at the Right Level, and Never Mutate Zustand State Directly

`usePathMilestones` is a React hook that watches the path completion percentage and auto-creates/fires `pathMilestone` challenges when thresholds (25%, 50%, 75%, 100%) are crossed. Two separate pitfalls emerged — one architectural (where the hook lives), one mechanical (how it mutates state).

#### 3a. Mount-Level Determines Coverage

The hook takes `pathId`, `pathName`, and `completionPct` as props. If it is only mounted on the path detail page (`LearningPathDetail.tsx`), milestones only fire when the user visits that page. If the user completes lessons on the lesson player page, the library page, or any other page, the hook is unmounted and no milestones fire — even though `completionPct` changed.

**The risk**: The user must visit the path detail page for milestones to sync up. Completion progress changes from anywhere else in the app are invisible to the hook.

**Mitigation in this implementation**: The hook is used within `LearningPathDetail.tsx`, which means coverage is page-scoped. This was accepted for the initial ship because:
- The path detail page is the natural place users go after completing lessons on a path
- On mount, the hook seeds `prevPctRef` from current `completionPct` (via `initializedRef`), so it catches up on first render
- It does not miss milestones permanently — they fire on next visit, just not immediately

**Long-term pattern**: For full coverage, a side-effect hook that auto-creates entities should be mounted at the app level (e.g., in `App.tsx` or a dedicated provider) so it watches all paths regardless of current page. The trade-off is that app-level hooks run for every path on every render and need efficient bail-out logic.

#### 3b. Direct Property Assignment Bypasses Store Persistence

The initial implementation (before the review loop caught it) mutated the challenge object directly:

```typescript
// BUG — caught in review (commit 22399a1)
// Mutates Zustand state in place but never calls updateChallenge
// UI appears to update (Zustand re-renders), but Dexie never gets the change
challenge.currentProgress = currPct
challenge.celebratedMilestones = [...challenge.celebratedMilestones, ...crossedThresholds]
```

This appears to work because Zustand re-renders on reference changes. But `updateChallenge` is the method that calls `syncableWrite` to persist the change to Dexie. Without it, the mutation is ephemeral — on page reload, the state reverts to the last persisted version.

The fix (commit `22399a1`): Always go through `useChallengeStore.getState().updateChallenge()`:

```typescript
// CORRECT — persists through the store's update method
useChallengeStore.getState().updateChallenge(challenge.id, {
  currentProgress: currPct,
  celebratedMilestones: newCelebratedMilestones,
  completedAt: currPct >= 100 ? new Date().toISOString() : challenge.completedAt,
})
```

This applies to all three mutation sites in the hook: progress regression (downward), progress increase with no new milestones, and progress increase with new milestones. Each site was replaced with `updateChallenge` during the review fix.

**Invariants the hook relies on**:
- `initializedRef` prevents duplicate challenge creation on re-renders — idempotent
- `prevPctRef` (useRef, not useState) tracks previous completion across renders without triggering extra render cycles
- Progress regression (currPct < prevPct) persists the lower value but does not fire negative milestones or un-celebrate previously celebrated thresholds
- Jump handling (R8): `detectChallengeMilestones` returns all un-celebrated thresholds at or below `currPct`; the hook filters to only those above `prevPct`, so 20% to 60% fires both 25% and 50%

## Why This Matters

These three decisions represent the difference between the obvious approach and what the codebase's invariants actually permit:

1. **Partial creation over fake transactions**: Not building a transaction layer around `syncableWrite` avoids over-engineering a problem that occurs infrequently. The per-entry success/failure contract is simpler, debuggable, and sufficient.

2. **Current-only completion charts over fragile historical reconstruction**: Not attempting to reconstruct point-in-time completion avoids building a replay system for data that was never recorded. The split approach (current state for completion, date-filtered for hours) is honest about what the data supports.

3. **Store-method-only mutations and mount-level awareness**: The review loop caught a bug (direct property assignment bypassing `syncableWrite`) that would have shipped otherwise and caused silent data loss. The pattern of always going through the store's update method is a guardrail that mechanical code review should enforce.

## When to Apply

- When batching writes through a non-transactional persistence layer — define a success/failure contract per entry and let the caller decide how to handle partial results
- When adding date-range filters to dashboards — audit which metrics are point-in-time snapshots vs. time-series data, and scope the filter accordingly
- When building React hooks that auto-create entities based on derived state — consider where the hook is mounted (page-scoped vs. app-scoped) and whether missed updates are acceptable
- When mutating Zustand store state that must persist to IndexedDB — always go through the store's update/add/delete methods, never assign properties directly on state objects
- When reviewing code that uses `syncableWrite` — verify that every state mutation goes through the store method that wraps `syncableWrite`, not through direct property assignment

## Examples

### Batch writes with partial failure

```typescript
// The pattern: iterate, collect, report
const { created, failed } = await addSchedules(scheduleInputs)
if (failed.length > 0) {
  // User sees: "5 of 6 schedules created"
  // User can delete unwanted entries from the inline PathScheduleList
}
// Failed entries are reported per-entry so the caller can retry specific ones
```

### Date-range scoping

```
Stacked bar chart (completion):    "0-25%: 3 paths | 25-50%: 5 paths | 50-75%: 2 paths | 75-100%: 1 path"
  → Always current state, no date range label

Cumulative hours line chart:       "Path A: 12h | Path B: 8h | Path C: 3h  (filtered by date range)"
  → Respects date range, labeled explicitly

Stats table:                       Completion: 45% (current) | Hours: 12h (last 30 days) | Last Activity: Apr 28
  → Split columns: current vs. filtered clearly distinguished
```

### Store mutations

```typescript
// BEFORE (bug): direct mutation — UI updates, Dexie does not
challenge.currentProgress = currPct

// AFTER (fix): through store method — UI updates AND Dexie persists
useChallengeStore.getState().updateChallenge(challenge.id, {
  currentProgress: currPct,
  celebratedMilestones: newCelebratedMilestones,
})
```

## Related

- [curriculum-composer-implementation-lessons-2026-05-03.md](curriculum-composer-implementation-lessons-2026-05-03.md) — same module, different patterns (shared picker, import round-trip, batch-add patterns)
- [single-write-path-for-synced-mutations-2026-04-18.md](single-write-path-for-synced-mutations-2026-04-18.md) — the syncableWrite single-write-path constraint that makes batch transactions impossible
- [zustand-stale-async-results-generation-counter-2026-05-03.md](zustand-stale-async-results-generation-counter-2026-05-03.md) — adjacent Zustand pattern (async race conditions via generation counter, not direct mutation persistence)
- [smart-resume-implementation-lessons-2026-05-04.md](smart-resume-implementation-lessons-2026-05-04.md) — another implementation-lessons doc from the same epic run
- PR: https://github.com/PedroLages/knowlune/pull/501
- Plan: [docs/plans/2026-05-04-003-feat-paths-as-study-plan-plan.md](../../plans/2026-05-04-003-feat-paths-as-study-plan-plan.md)
