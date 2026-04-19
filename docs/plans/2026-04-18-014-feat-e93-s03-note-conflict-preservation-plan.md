---
title: "feat: Note Conflict Preservation (E93-S03)"
type: feat
status: active
date: 2026-04-18
origin: docs/brainstorms/2026-04-18-e93-s03-note-conflict-preservation-requirements.md
---

# feat: Note Conflict Preservation (E93-S03)

## Overview

When two devices edit the same note concurrently and sync, the current LWW strategy silently discards one version. This story adds a `conflict-copy` strategy for notes that preserves both versions inline on the winning note, surfaces a conflict badge in the UI, and lets the learner choose which version to keep.

The implementation replaces the existing stub `_applyConflictCopy` in `syncEngine.ts` — which currently creates a duplicate Dexie record with a new UUID — with the inline-field approach: the winning note gains a `conflictCopy` JSONB snapshot of the losing version.

## Problem Frame

During pull, when `remote.updated_at > local.updatedAt` AND `remote.content !== local.content`, the remote wins under LWW and the local edit is silently lost. E93-S01 scaffolded placeholder columns (`conflict_copy BOOLEAN`, `conflict_source_id UUID`) for this story to upgrade. This story delivers: schema fixup migration, type extensions, conflict detection + preservation, resolution UI, and syncable write-back so other devices see the resolved state.

(see origin: docs/brainstorms/2026-04-18-e93-s03-note-conflict-preservation-requirements.md)

## Requirements Trace

- R1. Conflict detected when remote wins on timestamp AND content differs (AC1)
- R2. Winning note gains `conflictCopy` snapshot of losing local version (AC2)
- R3. `Note` type extended with `conflictCopy` and `conflictSourceId` optional fields (AC3)
- R4. Supabase schema fixup: `conflict_copy BOOLEAN → JSONB`, `conflict_source_id UUID → TEXT` (AC4)
- R5. Conflict badge on note card — amber, accessible, button opens dialog (AC5)
- R6. Conflict detail dialog shows both versions with timestamps; three action buttons (AC6)
- R7. Resolution written back via `syncableWrite` with `conflictCopy: null` (AC7)
- R8. No Dexie migration required — new fields are non-indexed (AC8)
- R9. `tableRegistry.ts` notes entry gains `conflictStrategy: 'conflict-copy'` + two fieldMap entries (AC9)
- R10. `conflictResolvers.ts` exports pure `applyConflictCopy(local, remote): Note` (AC10)
- R11. Unit tests covering detection, resolver, and both resolution paths (AC11)
- R12. E2E tests covering badge visibility, dialog, both resolution flows, syncQueue assertion (AC12)

## Scope Boundaries

- Manual merge (two-pane editor) is out of scope — "Merge" button is disabled with "Coming soon" tooltip
- Simulating two-device sync in E2E is out of scope — seed pre-built `conflictCopy` via factory
- Efficient querying of all conflicted notes (Dexie index) is deferred to a future v54 migration
- Conflict detection in the push phase is out of scope — detection is pull-only

### Deferred to Separate Tasks

- Dexie index on `conflictCopy` for efficient batch queries: future story when needed

## Context & Research

### Relevant Code and Patterns

- `src/lib/sync/syncEngine.ts` — existing `_applyConflictCopy` stub (lines ~500–534): currently creates a new UUID record; must be replaced with inline-field approach. `_applyLww` pattern (`remote.updatedAt > local.updatedAt`) is the detection baseline.
- `src/lib/sync/tableRegistry.ts` — `notes` entry (currently `conflictStrategy: 'lww'`, `fieldMap: { deleted: 'soft_deleted' }`); needs strategy upgrade and two new fieldMap entries
- `src/data/types.ts` — `Note` interface (line ~118); add two optional fields below `linkedNoteIds`
- `src/app/components/notes/NoteCard.tsx` — note card component; add conflict badge button with `z-10` positioning (existing card already has `z-10` interactive children)
- `src/stores/useNoteStore.ts` — `saveNote` calls `syncableWrite('notes', 'put', note)` at line ~87; same pattern applies for resolution writes
- `supabase/migrations/` — latest migration is `20260417000003_p0_sync_foundation_r4.sql`; new fixup uses `20260418000001_notes_conflict_copy_jsonb.sql`
- `tests/e2e/nfr24-undo.spec.ts` — reference E2E pattern using `seedNotes` + `FIXED_DATE` from `tests/utils/test-time.ts`
- `tests/support/helpers/seed-helpers.ts` — `seedNotes(page, notes[])` helper at line ~153
- `src/lib/sync/__tests__/p1-notes-bookmarks-sync.test.ts` — reference unit test pattern for sync layer

### Institutional Learnings

- `docs/solutions/` — `syncableWrite` is the required write path for any note mutation that should propagate; direct Dexie puts bypass the sync queue (see reference_sync_engine_api.md in memory)
- Dexie 4: `sortBy` returns `Promise<T[]>`, non-indexed fields require no schema migration (reference_dexie_4_quirks.md)
- ES2020 target: no `Promise.any` — use `Promise.allSettled` if needed (reference_es2020_constraints.md)
- Design tokens: use `text-warning-foreground` on `bg-warning/10` backgrounds, not `text-amber-500`

### External References

- Not needed — local patterns are sufficient. The codebase has direct precedents for: conflict strategy dispatch (`_applyRecord` switch), pure resolver modules (`fieldMapper.ts`, `tableRegistry.ts`), and accessibility patterns in existing dialog components.

## Key Technical Decisions

- **Inline-field approach over new-record approach**: The existing `_applyConflictCopy` stub creates a duplicate note with a new UUID. The requirements specify storing the losing version as a JSONB snapshot on the winning note. Replace the stub entirely — both approaches were discussed in the requirements doc and inline-field won because it doesn't pollute the notes list with ghost entries. (see origin: AC2)
- **Remote wins the conflict, local becomes `conflictCopy`**: When `remote.updatedAt > local.updatedAt` AND content differs, remote is the winner. Local content is preserved in `conflictCopy.content`. This matches the requirements' pull-phase-only, timestamp-authoritative design. (see origin: AC1, AC2)
- **`conflictResolvers.ts` is pure**: No Dexie, Supabase, or React imports — same purity rule as `tableRegistry.ts`. The sync engine imports it; React components do not call it directly. (see origin: AC10)
- **Resolution via `useNoteStore.saveNote`** (not a direct `syncableWrite` call in the dialog): The dialog calls `saveNote(updatedNote)` which already routes through `syncableWrite`. This avoids duplicating the write path and keeps the store as the single mutation interface. (see origin: AC7)
- **Dialog vs. Sheet**: Use `Dialog` (not `Sheet`) — conflict resolution is a modal decision workflow, not a side-panel content view. The dialog pattern better communicates "you must choose before continuing".
- **`null` explicitly clears, `undefined` means absent**: Resolution sets `conflictCopy: null` and `conflictSourceId: null`. Old records without the fields have `undefined` (field absent). The badge check must use `note.conflictCopy != null` (catches both null and undefined correctly via `!= null`). (see origin: AC3)

## Open Questions

### Resolved During Planning

- **Do we need to handle `conflict-copy` in the upload phase?** No — conflict detection is pull-only. Push sends local content as-is. Resolution (with `conflictCopy: null`) is uploaded as a normal LWW update. (see origin: Technical Notes)
- **Does `_applyConflictCopy` in syncEngine need to call `syncableWrite` or direct Dexie?** The download/apply phase writes directly to Dexie (consistent with `_applyLww` which uses `table.put`). The conflict resolver produces the merged `Note` object; `_applyConflictCopy` writes it via `table.put`. The `syncableWrite` path is only needed for user-initiated writes (saves, resolutions). (see origin: AC7)
- **Should `applyConflictCopy` also handle the "no conflict" case?** No — `conflictResolvers.ts` exports only the merge transform. Conflict detection (is this a conflict?) remains in `syncEngine.ts`'s `_applyConflictCopy` helper, which calls `applyConflictCopy` only when a conflict is confirmed.
- **E93-S01 created `conflict_source_id` as UUID — can we change it to TEXT in a migration?** Yes — `ALTER COLUMN conflict_source_id TYPE TEXT USING conflict_source_id::TEXT` is safe since no real data was stored under the UUID type.

### Deferred to Implementation

- Exact `line-clamp` behavior for very long content in the dialog — verify visually during implementation
- Whether `NoteConflictDialog` should be a standalone file or co-located with `NoteCard.tsx` — decide based on size at implementation time (guideline: standalone if >80 lines)

## High-Level Technical Design

> *This illustrates the intended approach and is directional guidance for review, not implementation specification. The implementing agent should treat it as context, not code to reproduce.*

**Conflict detection + preservation (pull phase):**

```text
_applyConflictCopy(table, local, record) {
  if no local → table.put(record); return
  if remote.updatedAt > local.updatedAt AND remote.content !== local.content:
    mergedNote = applyConflictCopy(local, remote)   // pure function from conflictResolvers.ts
    table.put(mergedNote)                            // direct Dexie — download phase
  else:
    _applyLww(table, local, record)                 // timestamp wins, no conflict
}
```

**`applyConflictCopy` pure function:**

```typescript
applyConflictCopy(local: Note, remote: Note): Note {
  return {
    ...remote,                                  // remote is the winner
    conflictCopy: {
      content: local.content,
      tags: local.tags,
      savedAt: local.updatedAt,
    },
    conflictSourceId: local.id,
  }
}
```

**Resolution (UI → store → sync queue):**

```text
Keep Current:   saveNote({ ...note, conflictCopy: null, conflictSourceId: null })
Use Other:      saveNote({ ...note, content: note.conflictCopy.content,
                           tags: note.conflictCopy.tags, conflictCopy: null,
                           conflictSourceId: null })
```

Both paths route through `useNoteStore.saveNote` → `syncableWrite` → syncQueue → upload phase → Supabase (`conflict_copy: null`).

## Implementation Units

- [ ] **Unit 1: Supabase schema fixup migration**

**Goal:** Convert `conflict_copy` from BOOLEAN to JSONB and `conflict_source_id` from UUID to TEXT so the columns can store the conflict snapshot and string note IDs respectively.

**Requirements:** R4 (AC4)

**Dependencies:** None — migration is standalone DDL

**Files:**
- Create: `supabase/migrations/20260418000001_notes_conflict_copy_jsonb.sql`

**Approach:**

- Three-step sequence for `conflict_copy` (required because the column has `NOT NULL DEFAULT FALSE` from E93-S01):
  1. `ALTER TABLE public.notes ALTER COLUMN conflict_copy DROP NOT NULL`
  2. `ALTER TABLE public.notes ALTER COLUMN conflict_copy DROP DEFAULT`
  3. `ALTER TABLE public.notes ALTER COLUMN conflict_copy TYPE JSONB USING NULL`
- `ALTER TABLE public.notes ALTER COLUMN conflict_source_id TYPE TEXT USING conflict_source_id::TEXT` — UUID cast to TEXT; NULL rows remain NULL
- Include a comment block explaining the E93-S01 placeholder to E93-S03 upgrade

**Test scenarios:**
- Test expectation: none — DDL migration; correctness verified by TypeScript compilation and runtime integration when the sync engine writes JSONB payloads

**Verification:**
- Migration file is syntactically valid SQL
- `tsc --noEmit` passes after type changes in Unit 2 (schema and type changes are consistent)

---

- [ ] **Unit 2: Extend `Note` type**

**Goal:** Add `conflictCopy` and `conflictSourceId` optional fields to the `Note` interface so TypeScript propagates the new shape throughout the codebase.

**Requirements:** R3 (AC3)

**Dependencies:** None (types are standalone)

**Files:**
- Modify: `src/data/types.ts`

**Approach:**
- Add after `linkedNoteIds`:
  - `conflictCopy?: { content: string; tags: string[]; savedAt: string } | null`
  - `conflictSourceId?: string | null`
- Include JSDoc comments: `conflictCopy` is `undefined` when absent (old records), `null` when explicitly cleared after resolution, and an object when a conflict is active
- `savedAt` is ISO 8601 — the losing version's `updatedAt`

**Patterns to follow:**
- Existing optional fields pattern in `Note` (e.g., `deleted?: boolean`, `linkedNoteIds?: string[]`)

**Test scenarios:**
- Test expectation: none — pure type declaration; TypeScript compiler validates usage across all consumers

**Verification:**
- `npx tsc --noEmit` passes with zero new errors
- All existing `Note` usages compile without cast errors (fields are optional)

---

- [ ] **Unit 3: `conflictResolvers.ts` — pure conflict merge function**

**Goal:** Implement the pure `applyConflictCopy(local, remote)` function that produces the winning note with a `conflictCopy` snapshot, and cover it with unit tests.

**Requirements:** R1, R2, R10, R11 (AC1, AC2, AC10, AC11)

**Dependencies:** Unit 2 (Note type must be extended)

**Files:**
- Create: `src/lib/sync/conflictResolvers.ts`
- Create: `src/lib/sync/__tests__/conflictResolvers.test.ts`

**Approach:**
- `applyConflictCopy(local: Note, remote: Note): Note` — spreads remote as winner, attaches `conflictCopy: { content: local.content, tags: local.tags, savedAt: local.updatedAt }`, sets `conflictSourceId: local.id`
- The function does NOT decide whether a conflict exists — that check stays in `syncEngine.ts`. The function is called only when a conflict is confirmed
- Module-level JSDoc: "Pure function — no Dexie, Supabase, or React imports."
- No default export — named exports only (consistent with `fieldMapper.ts`, `tableRegistry.ts`)

**Patterns to follow:**
- `src/lib/sync/fieldMapper.ts` — pure module purity, no framework imports
- `src/lib/sync/__tests__/p1-notes-bookmarks-sync.test.ts` — unit test structure in sync `__tests__` directory

**Test scenarios:**
- Happy path: `applyConflictCopy(local, remote)` returns an object where `id === remote.id` and `content === remote.content` (remote wins)
- Happy path: returned `conflictCopy.content === local.content`, `conflictCopy.tags === local.tags`, `conflictCopy.savedAt === local.updatedAt`
- Happy path: returned `conflictSourceId === local.id`
- Edge case: `local.tags` is an empty array — `conflictCopy.tags` is `[]` (not null or undefined)
- Edge case: very long `local.content` (1000+ chars) — snapshot stored without truncation
- Edge case: `local.content === remote.content` — function still applies (detection logic is caller's responsibility; resolver is a transform, not a guard)
- Integration: the returned note is a new object (spread, not mutated); `local` and `remote` are unchanged

**Execution note:** Implement the function test-first: write failing unit tests, then implement.

**Verification:**
- `npm run test:unit` — all `conflictResolvers.test.ts` tests pass
- `npx tsc --noEmit` — zero errors

---

- [ ] **Unit 4: Wire conflict resolver into `syncEngine.ts` and update `tableRegistry.ts`**

**Goal:** Replace the existing `_applyConflictCopy` stub (which creates duplicate records) with the inline-field approach, and switch the notes entry to `conflictStrategy: 'conflict-copy'` with the correct fieldMap.

**Requirements:** R1, R2, R9 (AC1, AC2, AC9)

**Dependencies:** Unit 2 (Note type), Unit 3 (`conflictResolvers.ts`)

**Files:**
- Modify: `src/lib/sync/syncEngine.ts`
- Modify: `src/lib/sync/tableRegistry.ts`

**Approach:**

*`tableRegistry.ts` changes:*
- Change `notes.conflictStrategy` from `'lww'` to `'conflict-copy'`
- Extend `notes.fieldMap` to three entries: `{ deleted: 'soft_deleted', conflictCopy: 'conflict_copy', conflictSourceId: 'conflict_source_id' }`

*`syncEngine.ts` `_applyConflictCopy` rewrite:*
- Remove the stub logic (new UUID, `conflictCopy: true` boolean flag, separate `table.put` for a new record)
- New detection condition: `remote.updatedAt > local.updatedAt && remote.content !== local.content` (same condition as `_applyLww` but inverted — remote wins, but we preserve local)
- When conflict confirmed: call `applyConflictCopy(local as Note, record as Note)`, write result via `table.put`
- When no conflict: call `_applyLww(table, local, record)` as fallback
- Add `// Intentional: conflict-copy tables bypass bare LWW — applyConflictCopy preserves the losing local version in conflictCopy rather than silently discarding it.` at the call site

*Import addition in `syncEngine.ts`:*
- Add named import of `applyConflictCopy` from `./conflictResolvers`

**Patterns to follow:**
- Existing `_applyLww` detection pattern in `syncEngine.ts` (line ~432)
- Existing `_applyMonotonic` as example of "detect then apply" strategy

**Test scenarios:**
- Happy path: notes entry in registry has `conflictStrategy: 'conflict-copy'` and three fieldMap keys
- Happy path: `_applyConflictCopy` with `remote.updatedAt > local.updatedAt` AND different content → `table.put` called with merged note containing `conflictCopy` object
- Edge case: `remote.updatedAt === local.updatedAt` AND different content → falls through to `_applyLww` (no conflict created for exact-same-timestamp writes)
- Edge case: `remote.updatedAt > local.updatedAt` AND same content → falls through to `_applyLww` (no conflict)
- Edge case: no local record → `table.put(record)` directly (new record, no conflict possible)
- Integration: after apply, Dexie note has `conflictCopy.content === former local content`

**Verification:**
- `npm run test:unit` — all `syncEngine.download.test.ts` and `tableRegistry.test.ts` tests pass (no regressions)
- Registry `notes.conflictStrategy === 'conflict-copy'` and `fieldMap` has three entries

---

- [ ] **Unit 5: Conflict badge on `NoteCard`**

**Goal:** Render an accessible amber conflict badge button on the note card when `note.conflictCopy` is non-null and non-undefined. Badge click opens the conflict detail dialog.

**Requirements:** R5 (AC5)

**Dependencies:** Unit 2 (Note type). Unit 5 creates the `NoteConflictDialog` stub for import compilation; Unit 6 completes it.

**Files:**
- Modify: `src/app/components/notes/NoteCard.tsx`
- Create: `src/app/components/notes/NoteConflictDialog.tsx` (stub — may be completed in Unit 6)

**Approach:**
- Add local `useState<boolean>` for `showConflictDialog` in `NoteCard`
- Add conflict badge button in the card header area — positioned top-right alongside the expand/collapse button (use `flex items-center gap-2` wrapper if needed)
- Badge button: `min-w-[44px] min-h-[44px]` touch target, design tokens `bg-warning/10 text-warning-foreground border border-warning/30`, `AlertTriangle` icon (16px), `aria-label="Note has a sync conflict"` — use `aria-label` alone (consistent with existing NoteCard interactive button pattern at line ~116–118; do not add a redundant `sr-only` span alongside it)
- Conditional rendering: `{note.conflictCopy != null && <ConflictBadgeButton ... />}` — `!= null` is false for both `null` and `undefined`, so the badge is hidden for old records (field absent) and resolved conflicts (explicitly null); it renders only when `conflictCopy` is an object
- On click: `setShowConflictDialog(true)`
- Render `<NoteConflictDialog>` when `showConflictDialog` is true

**Patterns to follow:**
- Existing `z-10` interactive element pattern in NoteCard (line ~143–155)
- `AlertTriangle` from `lucide-react` (already imported in other components)
- Badge accessibility pattern: `<button type="button" aria-label="...">` with `sr-only` span

**Test scenarios:**
- Happy path: note with `conflictCopy: { content: 'old', tags: [], savedAt: '...' }` → badge button is rendered
- Happy path: badge button click opens conflict dialog
- Edge case: note with `conflictCopy: null` → badge is NOT rendered (resolved conflict)
- Edge case: note with `conflictCopy: undefined` (old record, field absent) → badge is NOT rendered
- Integration: badge button has `min-w-[44px] min-h-[44px]` and `sr-only` text (accessibility)

**Verification:**
- Badge appears on cards with active `conflictCopy`, absent on resolved/clean cards
- Badge is keyboard-accessible (Tab + Enter opens dialog)

---

- [ ] **Unit 6: `NoteConflictDialog` — resolution UI**

**Goal:** Implement the conflict detail dialog showing both versions with formatted timestamps, and wire the three action buttons (Keep Current, Use Other Version, Merge disabled).

**Requirements:** R6, R7 (AC6, AC7)

**Dependencies:** Unit 2 (Note type), Unit 3 (`applyConflictCopy` not used here — resolution is simpler), Unit 4 (sync write path confirmed working)

**Files:**
- Create: `src/app/components/notes/NoteConflictDialog.tsx`

**Approach:**
- Use `Dialog` (not `Sheet`) — full-screen-blocking modal for a clear decision workflow
- Props: `{ note: Note; open: boolean; onOpenChange: (open: boolean) => void; onResolved: () => void }`
- "Current version" panel: `note.content` preview (`line-clamp-8`), timestamp from `note.updatedAt` formatted with `toLocaleDateString('sv-SE')` + time string
- "Other version" panel: `note.conflictCopy.content` preview (`line-clamp-8`), timestamp from `note.conflictCopy.savedAt` formatted same way
- "Keep Current" action: `await saveNote({ ...note, conflictCopy: null, conflictSourceId: null })`; call `onResolved()` which triggers `onOpenChange(false)` in parent
- "Use Other Version" action: `await saveNote({ ...note, content: note.conflictCopy.content, tags: note.conflictCopy.tags, conflictCopy: null, conflictSourceId: null })`; call `onResolved()`. Guard: if `note.conflictCopy` is null at click time (concurrent sync cleared it), disable the button or show a stale-conflict message rather than throwing.
- "Merge" button: `disabled`, wraps in `Tooltip` with content "Manual merge coming soon"
- No optimistic UI — wait for `saveNote` to resolve before closing dialog
- Both action buttons show loading state while `saveNote` is in-flight (local `useState<boolean>`)
- Escape closes dialog via `onOpenChange(false)` (Dialog primitive handles this natively)
- Focus trap is provided by Radix Dialog primitive

**Patterns to follow:**
- `src/app/components/ui/dialog.tsx` — Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter
- `src/app/components/ui/tooltip.tsx` — Tooltip, TooltipTrigger, TooltipContent
- `useNoteStore` saveNote pattern from `NoteCard.tsx` (lines ~42, ~52–68)
- `toLocaleDateString('sv-SE')` formatting (no external date lib needed)

**Test scenarios:**
- Happy path: dialog renders with `open=true` and valid `note` with `conflictCopy` — shows current version panel and other version panel
- Happy path: "Keep Current" click calls `saveNote` with `conflictCopy: null` and `conflictSourceId: null`; note content unchanged
- Happy path: "Use Other Version" click calls `saveNote` with swapped content and `conflictCopy: null`
- Error path: `saveNote` throws — dialog does not close; toast.error shown (match `NoteCard` error handling pattern)
- Edge case: "Merge" button is `disabled` and renders tooltip text "Manual merge coming soon"
- Edge case: timestamps formatted with `sv-SE` locale (YYYY-MM-DD HH:MM format) — not raw ISO string
- Integration: after "Keep Current", `syncQueue` gains a pending entry for the note (tested in E2E Unit 7)

**Verification:**
- Dialog opens/closes correctly from `NoteCard`
- All three buttons render; "Merge" is disabled
- Focus trapped inside dialog; Tab cycles through interactive elements; Escape closes

---

- [ ] **Unit 7: E2E tests**

**Goal:** Cover conflict badge visibility, dialog open/close, both resolution flows, and syncQueue assertion.

**Requirements:** R12 (AC12)

**Dependencies:** Units 2–6 all complete

**Files:**
- Create: `tests/e2e/story-93-3.spec.ts`

**Approach:**
- Seed a note with pre-built `conflictCopy` payload via `seedNotes(page, [...])` using `FIXED_DATE` timestamps
- `conflictCopy` payload: `{ content: 'older version content', tags: ['old-tag'], savedAt: FIXED_DATE }`
- Navigate to the course notes page where the seeded note appears
- Test 1: conflict badge button is visible on the note card
- Test 2: click badge → dialog opens, shows two version panels
- Test 3: "Keep Current" → dialog closes, badge gone from note card, note content unchanged
- Test 4 (separate `test`): seed fresh note, click badge, "Use Other Version" → dialog closes, badge gone, note content updates to `conflictCopy.content`
- Test 5: after either resolution, assert `syncQueue` has a pending entry via `page.evaluate(() => db.syncQueue.where('status').equals('pending').toArray())`
- Use `page.getByRole('button', { name: /conflict/i })` for badge button locator (not CSS selectors)
- `afterEach`: `await` cleanup (not fire-and-forget)

**Patterns to follow:**
- `tests/e2e/nfr24-undo.spec.ts` — `seedNotes` + `FIXED_DATE` pattern
- `tests/support/helpers/seed-helpers.ts` — `seedNotes(page, notes)` helper
- `tests/utils/test-time.ts` — `FIXED_DATE` import
- E2E syncQueue assertion pattern from AC12 description

**Test scenarios:**
- Happy path: seeded note with `conflictCopy` → conflict badge button visible in card header
- Happy path: badge click → dialog shows "Current version" and "Other version" panels
- Happy path: "Keep Current" → badge disappears, note content matches original winning content
- Happy path: "Use Other Version" → badge disappears, note content matches `conflictCopy.content`
- Integration: after resolution, `db.syncQueue` has ≥1 pending entry with `tableName === 'notes'` and the note's `recordId`
- Edge case: note without `conflictCopy` field (default factory note) → no conflict badge visible

**Execution note:** Seed via factory — do not simulate actual two-device sync.

**Verification:**
- `npx playwright test tests/e2e/story-93-3.spec.ts --project=chromium` — all tests pass
- No `waitForTimeout()` calls without justification comments

## System-Wide Impact

- **Interaction graph:** `syncEngine._applyConflictCopy` is called for all tables with `conflictStrategy: 'conflict-copy'` — currently only `notes`. No other tables are affected. The `_applyRecord` switch is the single dispatch point.
- **Error propagation:** Per-record errors in `_doDownload` are caught individually. A conflict merge failure logs a warning and the record is skipped — does not abort the table's download. (consistent with existing `_doDownload` error handling)
- **State lifecycle risks:**
  - `conflictCopy: null` resolution must propagate to other devices; this is guaranteed because `saveNote` calls `syncableWrite` which queues the write
  - "Use Other Version" on a soft-deleted note: must not accidentally un-delete — the resolution only clears `conflictCopy`/`conflictSourceId`; `deleted`/`deletedAt` fields are spread from the winning note unchanged
  - Very long content (>50KB): `conflictCopy` is a JSONB snapshot stored inline; Supabase JSONB has no practical size limit for this use case; dialog uses `line-clamp-8` to prevent layout explosion
- **API surface parity:** No other tables use `conflict-copy` strategy currently. The registry entry for `notes` is the only change to sync routing.
- **Integration coverage:** E2E Unit 7 test 5 proves the full path: badge → resolution → syncQueue entry. Unit tests prove the pure function. No cross-table side effects to cover.
- **Unchanged invariants:** All other conflict strategies (`lww`, `monotonic`, `insert-only`) are untouched. The `_applyRecord` switch adds no new arms — `conflict-copy` already exists. `fieldMapper.toCamelCase` handles `conflict_copy → conflictCopy` and `conflict_source_id → conflictSourceId` automatically via standard camelCase conversion; the explicit `fieldMap` entries override for JSONB and TEXT respectively.

## Risks & Dependencies

| Risk | Mitigation |
|------|------------|
| `_applyConflictCopy` stub behavior depended on by existing tests | Check `syncEngine.download.test.ts` for any test covering the `conflict-copy` branch; update assertions to match new inline-field behavior |
| `fieldMapper.toCamelCase` already converts `conflict_copy` to `conflictCopy` — explicit fieldMap entry may be redundant | Verify fieldMapper behavior; explicit entry does not hurt but confirm no double-mapping |
| `conflict_copy BOOLEAN NOT NULL DEFAULT FALSE` (confirmed in `supabase/migrations/20260413000002_p1_learning_content.sql` line 52) — `ALTER COLUMN ... TYPE JSONB USING NULL` will fail if NOT NULL constraint is still active | Migration must first `ALTER COLUMN conflict_copy DROP NOT NULL`, then `ALTER COLUMN conflict_copy DROP DEFAULT`, then `ALTER COLUMN conflict_copy TYPE JSONB USING NULL`. Three-step sequence is required. |
| Dialog accessibility: focus trap and Escape-to-close are Radix Dialog primitives — test that keyboard nav works with multiple interactive elements in DialogContent | Cover in E2E test: Tab through all buttons, verify Escape closes |

## Documentation / Operational Notes

- No Dexie migration is needed — `conflictCopy` is a non-indexed field on the existing `notes` store. Document this in the story's implementation notes as AC8 specifies.
- After deployment, existing notes in Supabase will have `conflict_copy: null` — the badge will not appear for them (correct behavior).

## Sources & References

- **Origin document:** [docs/brainstorms/2026-04-18-e93-s03-note-conflict-preservation-requirements.md](docs/brainstorms/2026-04-18-e93-s03-note-conflict-preservation-requirements.md)
- Related code: `src/lib/sync/syncEngine.ts` (`_applyConflictCopy`, `_applyLww`, `_applyRecord`)
- Related code: `src/lib/sync/tableRegistry.ts` (notes entry, `conflictStrategy` type)
- Related code: `src/app/components/notes/NoteCard.tsx`
- Related code: `src/stores/useNoteStore.ts` (`saveNote` via `syncableWrite`)
- Prior story: E93-S01 (Supabase schema scaffolding — `conflict_copy BOOLEAN`, `conflict_source_id UUID`)
- Prior story: E93-S02 (tableRegistry `fieldMap: { deleted: 'soft_deleted' }`)
- E92 sync engine (`syncableWrite` public API, `syncEngine` download/apply phase)
