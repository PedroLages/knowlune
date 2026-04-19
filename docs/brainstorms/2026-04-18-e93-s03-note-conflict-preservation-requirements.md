---
story_id: E93-S03
title: "Note Conflict Preservation"
date: 2026-04-18
source: docs/implementation-artifacts/stories/E93-S03-note-conflict-preservation.md
---

# CE Requirements: Note Conflict Preservation (E93-S03)

## Goal

Detect when two devices have edited the same note concurrently during sync, preserve both versions rather than silently discarding one, and provide a UI for the learner to resolve the conflict.

---

## Acceptance Criteria

### AC1 — Conflict detection in download/apply phase
- During a pull cycle, when the sync engine applies a remote note record
- If `remote.updated_at > local.updatedAt` AND `remote.content !== local.content`
- Then classify remote as "winning" and flag local as a conflict candidate before overwrite

### AC2 — Conflict copy written to `conflictCopy` field
- On conflict detection (AC1), write the winning (remote) note via `syncableWrite`
- Store local (losing) note's `content`, `tags`, and `updatedAt` serialized as JSONB in the winning note's `conflictCopy` field
- Set `conflictSourceId` to the local note's `id` (same-note divergence, not a different record)

### AC3 — `conflictCopy` and `conflictSourceId` added to `Note` type
- Add two optional fields to `Note` interface in `src/data/types.ts`:
  ```ts
  conflictCopy?: {
    content: string
    tags: string[]
    savedAt: string  // ISO 8601 — the losing version's updatedAt
  } | null
  conflictSourceId?: string | null
  ```
- `undefined` = no conflict (default for existing records)
- `null` = explicitly cleared after resolution (via `syncableWrite`)

### AC4 — Supabase schema fixup migration
- E93-S01 created `conflict_copy BOOLEAN NOT NULL DEFAULT FALSE` — this is a placeholder
- This story requires a new migration `supabase/migrations/20260418000001_notes_conflict_copy_jsonb.sql`
- Migration: `ALTER TABLE public.notes ALTER COLUMN conflict_copy TYPE JSONB USING NULL`
- Also change `conflict_source_id` from `UUID` to `TEXT` (Dexie note IDs are strings, not Postgres UUIDs)
- Existing BOOLEAN values become NULL — acceptable since no real conflict data was stored under BOOLEAN schema
- No other Supabase schema changes required

### AC5 — Conflict badge on note card
- When `note.conflictCopy` is non-null and non-undefined, show a conflict badge on the note card
- Badge: amber/warning color, "!" or `AlertTriangle`/`GitMerge` icon (lucide-react, 16px)
- Use design tokens: `bg-warning/10 text-warning-foreground border border-warning/30` (never `text-amber-500`)
- WCAG AA contrast (4.5:1 minimum)
- Badge must be a `<button>` with touch target ≥ 44×44px (`min-w-[44px] min-h-[44px]`)
- Include `<span className="sr-only">Note has a sync conflict</span>`
- Badge click opens the conflict detail dialog

### AC6 — Conflict detail sheet/dialog
- Use `Sheet` or `Dialog` shadcn/ui component
- Show current/winning version: content preview (line-clamp-8) + saved timestamp
- Show conflict copy/losing version: content preview (line-clamp-8) + saved timestamp
- Timestamps: use `toLocaleDateString('sv-SE')` + time format, not raw ISO strings
- Three action buttons:
  - "Keep Current" — dismiss conflict copy
  - "Use Other Version" — swap content with conflict copy
  - "Merge" — disabled, shows tooltip "Manual merge coming soon" (MVP placeholder)
- All actions keyboard-accessible (Tab + Enter/Space)
- Focus trapped while dialog is open
- Escape closes dialog

### AC7 — Conflict resolution written back via `syncableWrite`
- On "Keep Current" or "Use Other Version":
  - Set `conflictCopy: null` and `conflictSourceId: null` on the note
  - Write via `syncableWrite('notes', 'put', updatedNote)` — NOT direct Dexie put
  - This queues the resolution for upload with fresh `updatedAt` timestamp
  - Other devices receive `conflict_copy: null` on next pull → conflict badge disappears
- No optimistic UI updates before `syncableWrite` succeeds

### AC8 — No Dexie migration required
- `conflictCopy` is an inline JSONB field on the existing `notes` Dexie table
- Dexie does not require schema changes for new non-indexed fields
- Document this decision in Implementation Notes
- If future story needs to query conflicted notes efficiently, add index in a v54 migration then

### AC9 — `tableRegistry.ts` notes entry updated
- Add `conflictStrategy: 'conflict-copy'` to the `notes` entry
- Add to `fieldMap`:
  ```ts
  conflictCopy: 'conflict_copy',
  conflictSourceId: 'conflict_source_id',
  ```
- Combined with existing `deleted: 'soft_deleted'` from E93-S02, three explicit fieldMap entries total

### AC10 — `conflictResolvers.ts` — pure function export
- Create `src/lib/sync/conflictResolvers.ts` if it does not exist
- Export:
  ```ts
  export function applyConflictCopy(local: Note, remote: Note): Note
  ```
- Returns remote (winning) version with `conflictCopy` populated from local version
- Pure function: no Dexie imports, no Supabase imports, no React imports
- Called by the download/apply phase when the notes conflict strategy fires
- Add `// Intentional:` comment at the call site in `syncEngine.ts` explaining why conflict-copy tables bypass bare LWW

### AC11 — Unit tests (`src/lib/sync/__tests__/conflictResolvers.test.ts`)
Minimum test cases:
1. Conflict detected when `remote.updatedAt > local.updatedAt` AND content differs
2. No conflict (no `conflictCopy`) when content is identical even if timestamps differ
3. `applyConflictCopy` returns remote content as the winner
4. `applyConflictCopy` stores losing local content in `conflictCopy.content`
5. Resolving "Keep Current" clears `conflictCopy` to `null`
6. Resolving "Use Other Version" swaps content and clears `conflictCopy`
- Use `FIXED_DATE` pattern for all timestamps (ESLint `test-patterns/deterministic-time` enforced)
- Pure Vitest — no Dexie, no DOM

### AC12 — E2E tests (`tests/e2e/story-93-3.spec.ts`)
1. Seed a note with pre-populated `conflictCopy` field via `seedNotes()` factory
2. Verify conflict badge appears on the note card
3. Click conflict badge → dialog opens showing both versions
4. Click "Keep Current" → conflict badge disappears, note content unchanged
5. Click "Use Other Version" → conflict badge disappears, note content updates to conflict copy content
6. After resolution: assert `syncQueue` has a pending entry (query Dexie via `page.evaluate`)
- Use `page.getByRole('button', { name: /conflict/i })` locators (not CSS selectors)
- `afterEach` cleanup must use `await` (not fire-and-forget)

---

## Tasks / Implementation Plan

### Task 1: Extend `Note` type and Supabase schema (AC3, AC4)
1. Add `conflictCopy` and `conflictSourceId` optional fields to `Note` in `src/data/types.ts`
2. Write fixup migration `supabase/migrations/20260418000001_notes_conflict_copy_jsonb.sql`
3. Verify `tsc --noEmit` passes after type change

### Task 2: Implement conflict resolver (AC1, AC2, AC10, AC11)
1. Create `src/lib/sync/conflictResolvers.ts` exporting `applyConflictCopy(local, remote)`
2. Implement conflict detection: `remote.updatedAt > local.updatedAt && remote.content !== local.content`
3. Build `conflictCopy` object from local: `{ content, tags, savedAt: local.updatedAt }`
4. Return `{ ...remote, conflictCopy, conflictSourceId: local.id }`
5. Write unit tests in `src/lib/sync/__tests__/conflictResolvers.test.ts`

### Task 3: Wire conflict resolver into sync download/apply phase (AC1, AC2, AC9)
1. Update `src/lib/sync/tableRegistry.ts` notes entry with `conflictStrategy` and `fieldMap` additions
2. In `syncEngine.ts` apply-record path: detect `conflictStrategy: 'conflict-copy'` → route through `applyConflictCopy` instead of bare LWW
3. Ensure merged note is written via `syncableWrite` (not direct Dexie put)

### Task 4: Conflict badge UI on note card (AC5)
1. Find note card component(s) in `src/app/pages/` and `src/app/components/`
2. Add conflict badge button when `note.conflictCopy != null`
3. Use `text-warning` / `bg-warning/10` / `border-warning/30` design tokens

### Task 5: Conflict detail dialog (AC6, AC7)
1. Create `src/app/components/NoteConflictDialog.tsx` using `Sheet` or `Dialog`
2. Show both versions with timestamps formatted via `toLocaleDateString('sv-SE')`
3. Implement "Keep Current": set `conflictCopy: null`, call `useNoteStore.saveNote()`
4. Implement "Use Other Version": swap content, set `conflictCopy: null`, call `useNoteStore.saveNote()`
5. Add disabled "Merge" button with "Coming soon" tooltip
6. Ensure focus trap, keyboard navigation, Escape-to-close
7. Run axe scan — zero violations

### Task 6: E2E tests (AC12)
1. Create `tests/e2e/story-93-3.spec.ts`
2. Seed notes with pre-built `conflictCopy` payload via factory
3. Cover conflict badge visibility, dialog open, both resolution flows, syncQueue assertion

### Task 7: Verification
- `npm run test:unit` — all conflict resolver tests pass
- `npx playwright test tests/e2e/story-93-3.spec.ts --project=chromium` — all E2E pass
- `npx tsc --noEmit` — zero TypeScript errors
- `npm run lint` — zero errors
- `npm run build` — clean

---

## Files to Create / Modify

| Action | Path |
|--------|------|
| Modify | `src/data/types.ts` |
| Create | `supabase/migrations/20260418000001_notes_conflict_copy_jsonb.sql` |
| Create | `src/lib/sync/conflictResolvers.ts` |
| Modify | `src/lib/sync/tableRegistry.ts` |
| Modify | `src/lib/sync/syncEngine.ts` |
| Modify | Note card component(s) in `src/app/pages/` or `src/app/components/` |
| Create | `src/app/components/NoteConflictDialog.tsx` |
| Create | `src/lib/sync/__tests__/conflictResolvers.test.ts` |
| Create | `tests/e2e/story-93-3.spec.ts` |

---

## Out of Scope

- Manual merge UI (two-pane editor) — show "Coming soon" placeholder only
- Simulating two-device sync in E2E — seed pre-built `conflictCopy` via factory instead
- Querying all conflicted notes efficiently (no Dexie index needed now — defer to v54 migration if needed)
- Conflict detection in the push phase — detection is one-directional (pull/apply only)

---

## Dependencies

- E92 sync engine (`syncableWrite` public API must be available)
- E93-S01: `conflict_copy` BOOLEAN and `conflict_source_id UUID` columns already exist in Supabase
- E93-S02: `deleted → soft_deleted` fieldMap entry already in `tableRegistry.ts`
- `tableRegistry.ts` `conflictStrategy` field (to be extended as part of this story)

---

## Technical Notes

### Conflict Detection is One-Directional (Pull Phase Only)
- Pull: device sees remote > local → detects conflict → stores remote as winner, local as `conflictCopy`
- Push: sends local content as-is (no conflict check on push side)
- Resolution: pushes resolved version (with `conflictCopy: null`) back to remote so other devices sync clean

### `applyConflictCopy` is a Pure Function
- No Dexie, Supabase, or React imports — same purity constraint as `tableRegistry.ts` and `fieldMapper.ts`
- Input: two `Note` objects; Output: a `Note` with `conflictCopy` populated

### `fieldMap` After This Story (Three Explicit Entries)
```ts
fieldMap: {
  deleted: 'soft_deleted',               // E93-S02
  conflictCopy: 'conflict_copy',         // E93-S03
  conflictSourceId: 'conflict_source_id', // E93-S03
}
```

### Why `syncableWrite` for Resolution (Not Direct Dexie Put)
- After resolution, cleared note (`conflictCopy: null`) must propagate to Supabase
- `syncableWrite` queues upload with fresh `updatedAt` timestamp
- Other devices receive `conflict_copy: null` at next pull → conflict badge disappears

### Schema Gap: `conflict_copy` BOOLEAN → JSONB
- E93-S01 used BOOLEAN as a placeholder flag
- This story stores the losing version's content snapshot as JSONB
- Fixup migration uses `USING NULL` cast — existing FALSE/TRUE values become NULL (no real conflict data lost)

### Key Edge Cases
- `conflictCopy: null` → no badge (null-check, not just falsy)
- `conflictCopy: undefined` → no badge (field absent on old records)
- Resolution on a soft-deleted note: "Use Other Version" must not un-delete if winner was `deleted: true`
- Very long content (>50KB): must not crash dialog or `syncableWrite` payload

---

## Design Guidance

### Conflict Badge
- Position: top-right of note card, or inline next to note title/header
- Icon: `AlertTriangle` or `GitMerge` from lucide-react (16px)
- Tokens: `bg-warning/10 text-warning-foreground border border-warning/30`
- Min touch target: `min-w-[44px] min-h-[44px]`

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
- Content previews: `line-clamp-8` for long notes
- Timestamps: `toLocaleDateString('sv-SE')` + time, not raw ISO strings
- "Merge…": disabled, tooltip "Manual merge coming soon"
