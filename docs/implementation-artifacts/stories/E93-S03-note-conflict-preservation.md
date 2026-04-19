---
story_id: E93-S03
story_name: "Note Conflict Preservation"
status: ready-for-dev
started:
completed:
reviewed: false
review_started:
review_gates_passed: []
burn_in_validated: false
---

# Story 93.03: Note Conflict Preservation

## Story

As a learner who edits notes on multiple devices,
I want the sync engine to detect when two devices edited the same note concurrently and preserve both versions rather than discarding one,
so that I never silently lose note content due to a last-write-wins collision.

## Acceptance Criteria

**AC1 — Conflict detection in download/apply phase:**
Given the sync engine applies a remote note record during a pull cycle,
When `remote.updated_at > local.updatedAt` AND `remote.content !== local.content`,
Then the remote record is classified as a "winning" version and the local version is flagged as a conflict candidate before being overwritten.

**AC2 — Conflict copy written to `conflict_copy` field:**
Given a conflict is detected per AC1,
When the sync engine writes the winning (remote) note to Dexie via `syncableWrite`,
Then the local (losing) note's `content`, `tags`, and `updatedAt` are serialized as JSONB and stored in the winning note's `conflictCopy` field.
The `conflictSourceId` field is set to the local note's `id` (which is the same note id — conflict is same-note divergence, not a different record).

**AC3 — `conflictCopy` and `conflictSourceId` added to the `Note` type:**
Given the current `Note` interface in `src/data/types.ts` has no conflict fields,
When this story is shipped,
Then `Note` has two new optional fields:
```ts
conflictCopy?: {
  content: string
  tags: string[]
  savedAt: string  // ISO 8601 — the losing version's updatedAt
} | null
conflictSourceId?: string | null
```
Both fields are `undefined` by default for notes that have no conflict; `null` is used to explicitly clear a resolved conflict via `syncableWrite`.

**AC4 — Supabase `notes` table schema is already correct:**
The `conflict_copy` BOOLEAN and `conflict_source_id UUID` columns already exist in `supabase/migrations/20260413000002_p1_learning_content.sql` (added by E93-S01).
This story changes the Dexie-side type and client logic only — no new Supabase migration required.
> Note: The existing Supabase `conflict_copy` column is `BOOLEAN` (used as a flag), but this story stores the losing version content as a JSONB object in the client's `conflictCopy` field. The field mapper must map `conflictCopy → conflict_copy` and accept JSONB on the Supabase side. A fixup migration (`ALTER TABLE public.notes ALTER COLUMN conflict_copy TYPE JSONB USING NULL`) is required before shipping — include it as a new migration file.

**AC5 — Conflict indicator on note card:**
Given a `Note` record has `conflictCopy` set (non-null, non-undefined),
When the note is rendered in any note list or note card component,
Then a small conflict badge (amber/warning color, "!" icon or "Conflict" label) is visible on the card.
The badge must meet WCAG AA contrast (4.5:1). Touch target for the badge is ≥ 44×44px.

**AC6 — Conflict detail sheet/dialog:**
Given the user taps or clicks the conflict badge on a note card,
When the conflict detail UI opens (Sheet or Dialog component),
Then it shows:
- The current/winning version (content and saved time)
- The conflict copy (losing version content and saved time)
- Three actions: "Keep Current" (dismiss the conflict copy), "Use Other Version" (swap content with the conflict copy), "Merge" (opens both versions side-by-side for manual edit — out of scope for MVP: show "Coming soon" placeholder)
All three actions must be keyboard-accessible (Tab + Enter/Space). Dialog focus is trapped while open.

**AC7 — Conflict resolution written back via `syncableWrite`:**
Given the user resolves a conflict by choosing "Keep Current" or "Use Other Version",
When the resolution is confirmed,
Then:
- `conflictCopy` is set to `null` and `conflictSourceId` is set to `null` on the note
- The updated note is written to Dexie and queued via `syncableWrite('notes', 'put', updatedNote)` so the resolution propagates to all devices
- On the second device that had the stale version, the next pull cycle receives the resolved note (with `conflict_copy: null`) and the conflict indicator disappears

**AC8 — Dexie v54 migration adds `conflict_copy` index (optional):**
A new Dexie version (v54) is not strictly required since `conflictCopy` is not queried by index — it is an inline field. No migration is needed. If a future story wants to query all conflicted notes efficiently, an index can be added then. Document this decision in Implementation Notes.

**AC9 — `tableRegistry` entry for `notes` updated with `conflict-copy` strategy:**
The `notes` entry in `src/lib/sync/tableRegistry.ts` must have:
```ts
conflictStrategy: 'conflict-copy'
```
And `fieldMap` must include:
```ts
conflictCopy: 'conflict_copy',
conflictSourceId: 'conflict_source_id',
```
(in addition to the existing `deleted → soft_deleted` mapping from E93-S03 / E92-S03).

**AC10 — `conflictResolvers.ts` implements the `conflict-copy` strategy:**
`src/lib/sync/conflictResolvers.ts` (create if it does not exist) must export:
```ts
export function applyConflictCopy(
  local: Note,
  remote: Note
): Note
```
This function returns the remote (winning) version with `conflictCopy` populated from the local version. It is called by the download/apply phase when the notes conflict strategy fires.

**AC11 — Unit tests:**
`src/lib/sync/__tests__/conflictResolvers.test.ts` contains at minimum:
- Test: conflict detected when `remote.updated_at > local.updatedAt` AND content differs
- Test: no conflict (no `conflictCopy`) when content is identical even if timestamps differ
- Test: `applyConflictCopy` returns remote content as the winner
- Test: `applyConflictCopy` stores losing local content in `conflictCopy.content`
- Test: resolving "Keep Current" clears `conflictCopy` to `null`
- Test: resolving "Use Other Version" swaps content and clears `conflictCopy`

**AC12 — E2E tests:**
`tests/e2e/story-93-3.spec.ts` covers:
- Seed two conflicting note versions (via Dexie seeding helpers), trigger apply phase, verify conflict badge appears on the note card
- Click conflict badge → dialog opens with both versions shown
- Click "Keep Current" → conflict badge disappears, note content unchanged
- Click "Use Other Version" → conflict badge disappears, note content updates to the conflict copy content
- Verify `syncableWrite` is called (via spy or queue-entry assertion) after resolution

## Tasks / Subtasks

- [ ] Task 1: Extend `Note` type and Supabase schema (AC: 3, 4)
  - [ ] 1.1 Add `conflictCopy` and `conflictSourceId` optional fields to `Note` in `src/data/types.ts`
  - [ ] 1.2 Write a fixup migration `supabase/migrations/20260418000001_notes_conflict_copy_jsonb.sql` that ALTERs `conflict_copy` from BOOLEAN to JSONB (with `USING NULL` cast) and changes `conflict_source_id` from UUID to TEXT (note ids in Dexie are strings, not UUIDs)
  - [ ] 1.3 Verify `tsc --noEmit` still passes after type change

- [ ] Task 2: Implement conflict resolver (AC: 1, 2, 10, 11)
  - [ ] 2.1 Create `src/lib/sync/conflictResolvers.ts` exporting `applyConflictCopy(local: Note, remote: Note): Note`
  - [ ] 2.2 Implement conflict detection predicate: `remote.updatedAt > local.updatedAt && remote.content !== local.content`
  - [ ] 2.3 Build the `conflictCopy` JSONB object from local fields (`content`, `tags`, `savedAt: local.updatedAt`)
  - [ ] 2.4 Return `{ ...remote, conflictCopy, conflictSourceId: local.id }`
  - [ ] 2.5 Write unit tests in `src/lib/sync/__tests__/conflictResolvers.test.ts` (AC11)

- [ ] Task 3: Wire conflict resolver into sync download/apply phase (AC: 1, 2, 9)
  - [ ] 3.1 Update `src/lib/sync/tableRegistry.ts` notes entry: set `conflictStrategy: 'conflict-copy'`, add `conflictCopy` and `conflictSourceId` to `fieldMap`
  - [ ] 3.2 In the sync engine's apply-record path (`syncEngine.ts`), detect when a table entry has `conflictStrategy: 'conflict-copy'` and route through `applyConflictCopy` instead of bare LWW overwrite
  - [ ] 3.3 Ensure the resulting merged note is written via `syncableWrite` (not a direct Dexie put) so the conflict copy propagates back to Supabase

- [ ] Task 4: Conflict badge UI on note card (AC: 5)
  - [ ] 4.1 Find the note card component(s) that render individual notes (check `src/app/pages/` and `src/app/components/`)
  - [ ] 4.2 Add a conflict badge (amber, "!" icon, ≥44×44px touch target) when `note.conflictCopy != null`
  - [ ] 4.3 Make the badge a button (keyboard accessible, role="button") that opens the conflict dialog
  - [ ] 4.4 Use `text-warning` and `bg-warning/10` design tokens — never hardcode `text-amber-500`

- [ ] Task 5: Conflict detail dialog (AC: 6, 7)
  - [ ] 5.1 Create `src/app/components/NoteConflictDialog.tsx` using the `Sheet` or `Dialog` shadcn/ui component
  - [ ] 5.2 Show current (winning) version content + timestamp and conflict copy content + timestamp
  - [ ] 5.3 Implement "Keep Current" action: set `conflictCopy: null`, call `useNoteStore.saveNote()`
  - [ ] 5.4 Implement "Use Other Version" action: swap content from `conflictCopy.content`, set `conflictCopy: null`, call `useNoteStore.saveNote()`
  - [ ] 5.5 Add "Merge" placeholder button with "Coming soon" tooltip (disabled state)
  - [ ] 5.6 Ensure focus trap and keyboard navigation (Tab, Enter/Space, Escape to close)
  - [ ] 5.7 Run axe scan on the dialog — zero violations before submitting

- [ ] Task 6: E2E tests (AC: 12)
  - [ ] 6.1 Create `tests/e2e/story-93-3.spec.ts`
  - [ ] 6.2 Use `seedNotes()` (or equivalent factory) to seed a note with a pre-populated `conflictCopy` field
  - [ ] 6.3 Verify conflict badge appears on the note card
  - [ ] 6.4 Test "Keep Current" resolution flow end-to-end
  - [ ] 6.5 Test "Use Other Version" resolution flow end-to-end
  - [ ] 6.6 Verify `syncQueue` has a pending entry after resolution (conflict cleared note is queued)

- [ ] Task 7: Verification
  - [ ] 7.1 `npm run test:unit` — all conflict resolver tests pass
  - [ ] 7.2 `npx playwright test tests/e2e/story-93-3.spec.ts --project=chromium` — all E2E tests pass
  - [ ] 7.3 `npx tsc --noEmit` — zero TypeScript errors
  - [ ] 7.4 `npm run lint` — zero errors
  - [ ] 7.5 `npm run build` — clean

## Design Guidance

### Conflict Badge

- Position: top-right corner of the note card, or inline next to the note title/header
- Color: use `bg-warning/10 text-warning-foreground border border-warning/30` (amber/orange tone)
- Icon: `AlertTriangle` or `GitMerge` from lucide-react — 16px, with `sr-only` span "Note has a sync conflict"
- Touch target: wrap in a `<button>` that is at minimum 44×44px (use `min-w-[44px] min-h-[44px]`)

### Conflict Dialog Layout

```
┌─────────────────────────────────────────────┐
│  Sync Conflict Detected                  ✕  │
├─────────────────────────────────────────────┤
│  Current version (saved [timestamp])         │
│  ┌─────────────────────────────────────┐    │
│  │ [winning content preview]           │    │
│  └─────────────────────────────────────┘    │
│                                             │
│  Other version (saved [timestamp])           │
│  ┌─────────────────────────────────────┐    │
│  │ [conflictCopy.content preview]      │    │
│  └─────────────────────────────────────┘    │
├─────────────────────────────────────────────┤
│  [Keep Current]  [Use Other]  [Merge…]      │
└─────────────────────────────────────────────┘
```

- "Merge…" button: disabled, shows a tooltip "Manual merge coming soon"
- Content previews: truncated at ~8 lines (line-clamp-8) for long notes
- Timestamps: use `toLocaleDateString('sv-SE')` + time, not raw ISO strings

### Component Placement

Check `src/app/pages/` for where notes are listed — likely the video player page or a dedicated Notes tab. The conflict badge is added to the note card component used in those views.

## Implementation Notes

### Schema Gap: `conflict_copy` BOOLEAN vs JSONB

The E93-S01 migration created `conflict_copy BOOLEAN NOT NULL DEFAULT FALSE` and `conflict_source_id UUID`. This was a placeholder. This story changes:
- `conflict_copy` from `BOOLEAN` to `JSONB` to store the losing version's content snapshot
- `conflict_source_id` from `UUID` to `TEXT` since Dexie note IDs are UUIDs stored as strings (not Postgres UUID type)

The fixup migration uses `ALTER COLUMN ... TYPE JSONB USING NULL` — existing `FALSE` values become `NULL` (no conflict). Existing `TRUE` values (if any) also become `NULL` — acceptable since no real conflict data was ever stored under the BOOLEAN schema.

### Why `syncableWrite` for Resolution (Not Direct Dexie Put)

After resolution, the cleared note (with `conflictCopy: null`) must propagate back to Supabase so the conflict indicator does not reappear on the other device at next pull. Using `syncableWrite` ensures the note is queued for upload with a fresh `updatedAt` timestamp, and the next pull from the other device receives the resolved state.

### No Dexie v54 Migration Needed

`conflictCopy` is an inline JSONB field on the existing `notes` Dexie table. Dexie does not require schema changes for new non-indexed fields — existing records simply have the field as `undefined` until a conflict is detected. If a future story needs to query all conflicted notes efficiently (e.g., a "Conflicts" section), add a `conflictCopy` index in a v54 migration at that time.

### Conflict Detection is One-Directional (Pull Phase Only)

Conflicts are detected only during the **download/apply phase** (when the engine pulls remote changes). The push phase sends local content as-is. The symmetry works because:
- Device A pushes → remote has Device A's version
- Device B pulls → sees remote > local → detects conflict → stores Device A's version as `conflictCopy`
- Device B resolves → pushes resolved version back to remote

This matches the `conflict-copy` strategy in `tableRegistry.ts` (AC9) and the sync design doc's "LWW + conflict copy" row for notes.

### `conflictResolvers.ts` is Pure

`applyConflictCopy` takes two `Note` objects and returns a `Note`. It has no Dexie imports, no Supabase imports, no React imports. This is required by the same purity constraint as `tableRegistry.ts` and `fieldMapper.ts` (AC12 of E92-S03).

### Handling `notes.fieldMap` — Three Entries Required

After this story, the `notes` table registry entry must have all three non-obvious fieldMap entries:
```ts
fieldMap: {
  deleted: 'soft_deleted',        // E93-S02 (existing)
  conflictCopy: 'conflict_copy',  // this story
  conflictSourceId: 'conflict_source_id',  // this story
}
```
The fieldMapper's default camelCase→snake_case handles all other fields (e.g., `courseId → course_id`).

## Testing Notes

### Unit Test Strategy

Pure Vitest unit tests — no Dexie, no DOM:
- `conflictResolvers.test.ts`: test the pure `applyConflictCopy` function with fixture notes
- Use `FIXED_DATE` pattern for all timestamps (no `new Date()` / `Date.now()` in tests — enforced by ESLint `test-patterns/deterministic-time`)

### E2E Test Strategy

- Seed notes via `seedNotes()` factory with a pre-built `conflictCopy` payload — no need to actually simulate two-device sync in E2E
- Test UI behaviour (badge visible, dialog opens, resolution clears badge) without testing the sync protocol itself
- Use `page.getByRole('button', { name: /conflict/i })` locators rather than CSS class selectors
- After resolution: assert `syncQueue` has a pending entry by querying Dexie directly via `page.evaluate`

### Key Edge Cases

- Note with `conflictCopy: null` → no badge rendered (null-check, not just falsy)
- Note with `conflictCopy: undefined` → no badge rendered (field absent on old records)
- Resolution with very long content (>50KB) — should not crash the dialog or the `syncableWrite` payload
- Resolving a conflict on a soft-deleted note — "Use Other Version" should not un-delete the note (preserve `deleted: true` if winner was soft-deleted)

## Pre-Review Checklist

Before requesting `/review-story`, verify:

- [ ] All changes committed (`git status` clean)
- [ ] No error swallowing — catch blocks in `NoteConflictDialog.tsx` log AND surface errors via toast
- [ ] `useEffect` hooks have cleanup functions where applicable (none expected in this story — verify)
- [ ] No optimistic UI updates before persistence — conflict resolution state updates after `syncableWrite` succeeds
- [ ] Type guards on `note.conflictCopy` — handle `undefined` and `null` as both meaning "no conflict"
- [ ] E2E `afterEach` cleanup uses `await` (not fire-and-forget)
- [ ] Timestamps use `toLocaleDateString('sv-SE')` pattern in conflict dialog, not raw ISO string display
- [ ] CRUD completeness: `conflictCopy` field has create (set on apply), read (badge + dialog), update (resolution), delete (cleared to null on resolution) paths all tested
- [ ] AC → UI trace: conflict badge visible in rendered UI (not just in store/service)
- [ ] `// Intentional:` comment at the `applyConflictCopy` call site in `syncEngine.ts` explaining why conflict-copy tables bypass bare LWW
- [ ] Every `useEffect` or async callback reading Zustand state reads from `get()` inside the callback, not outer render scope
- [ ] `tableRegistry.ts` notes entry has all three fieldMap entries: `deleted`, `conflictCopy`, `conflictSourceId`
- [ ] Fixup migration for `conflict_copy BOOLEAN → JSONB` included and verified against local Supabase
- [ ] Touch targets ≥ 44×44px for conflict badge button (check in DevTools device toolbar)
- [ ] ARIA: axe scan on `NoteConflictDialog.tsx` — zero violations
- [ ] `tsc --noEmit`: runs clean (zero TypeScript errors) before submission
- [ ] E2E: `npx playwright test tests/e2e/story-93-3.spec.ts --project=chromium` — all pass

## Design Review Feedback

[Populated by /review-story — Playwright MCP findings]

## Code Review Feedback

[Populated by /review-story — adversarial code review findings]

## Challenges and Lessons Learned

[Document issues, solutions, and patterns worth remembering]
