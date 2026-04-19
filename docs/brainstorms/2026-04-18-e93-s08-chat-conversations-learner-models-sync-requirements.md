---
title: "Chat Conversations and Learner Models Sync (E93-S08)"
storyId: E93-S08
date: 2026-04-18
module: sync
tags: [chat-conversations, learner-models, sync, lww, upsert, jsonb, supabase, dexie, syncable-write]
---

# CE Requirements: Chat Conversations and Learner Models Sync (E93-S08)

**Date:** 2026-04-18
**Story:** E93-S08
**Branch:** feature/e93-s08-chat-conversations-learner-models-sync

---

## Problem Statement

`chat_conversations` and `learner_models` tables exist in Supabase (created in E93-S01), and their Dexie counterparts `chatConversations` and `learnerModels` are registered in the tableRegistry. However, none of the write sites for either table route through `syncableWrite` — all mutations still call Dexie directly:

- **`chatConversations`**: Writes are scattered across `useTutorStore.ts` and `ConversationHistorySheet.tsx`. Three distinct operations: `add` (new conversation), `update` (append messages), and `delete` (clear / user-initiated delete).
- **`learnerModels`**: Writes are centralized in `src/ai/tutor/learnerModelService.ts`. Three distinct write functions: `createLearnerModel` (`add`), `updateLearnerModel` (`put`), `replaceLearnerModel` (`put`), and `clearLearnerModel` (`delete`). The upsert pattern (`ON CONFLICT DO UPDATE`) maps to `syncableWrite('learnerModels', 'put', model)`.

Key asymmetry between the two tables:
- **`chat_conversations`**: Standard LWW with `updatedAt`. Uses a `fieldMap: { createdAt: 'created_at_epoch' }` because `createdAt` is stored as a BIGINT epoch-ms column in Supabase (not a TIMESTAMPTZ). The sync cursor is `updated_at` (TIMESTAMPTZ), which works normally.
- **`learner_models`**: One row per `(userId, courseId)` — upsert pattern with `ON CONFLICT (user_id, course_id) DO UPDATE`. Standard LWW, no unusual field mappings. `fieldMap: {}`.

---

## User Value / Goal

A learner who has AI tutor conversations on one device should see those conversations — and have their personalized learner profile (strengths, misconceptions, mode preferences) — available when they open Knowlune on another device.

---

## Acceptance Criteria

### AC1 — `chatConversations` tableRegistry entry is correct
`src/lib/sync/tableRegistry.ts` entry for `chatConversations` already exists (from E92-S03). Verify and confirm:
```ts
{
  dexieTable: 'chatConversations',
  supabaseTable: 'chat_conversations',
  conflictStrategy: 'lww',
  priority: 1,
  fieldMap: {
    createdAt: 'created_at_epoch',
  },
}
```
**Critical note**: `chat_conversations.created_at_epoch` is **BIGINT** (epoch-ms), NOT a TIMESTAMPTZ. The fieldMap `createdAt → created_at_epoch` already handles this mapping. The sync cursor is `updated_at` (standard TIMESTAMPTZ) — no special handling needed for cursor-based sync.

### AC2 — `learnerModels` tableRegistry entry is correct
`src/lib/sync/tableRegistry.ts` entry for `learnerModels` already exists (from E92-S03). Verify and confirm:
```ts
{
  dexieTable: 'learnerModels',
  supabaseTable: 'learner_models',
  conflictStrategy: 'lww',
  priority: 1,
  fieldMap: {},
}
```
The Supabase `learner_models` table has a UNIQUE constraint on `(user_id, course_id)`. The upload phase (E92-S05) must upsert using `ON CONFLICT (user_id, course_id) DO UPDATE` — verify the sync engine handles this or document that it uses standard `upsert` via the Supabase client `.upsert()` method.

### AC3 — `chatConversations` write sites in `useTutorStore.ts` route through `syncableWrite`
All Dexie write calls in `src/stores/useTutorStore.ts` replaced with `syncableWrite`:

- `db.chatConversations.add(conversation)` (new conversation INSERT) → `syncableWrite('chatConversations', 'add', conversation)`
- `db.chatConversations.update(conversationId, { messages, mode, hintLevel, updatedAt })` → convert to fetch-then-put:
  ```ts
  const existing = await db.chatConversations.get(conversationId)
  if (!existing) return
  await syncableWrite('chatConversations', 'put', { ...existing, messages: tutorMessages, mode, hintLevel, updatedAt: now })
  ```
- `db.chatConversations.delete(conversationId)` (clear conversation) → `syncableWrite('chatConversations', 'delete', conversationId)`

**What stays as-is (read paths — do NOT change):**
- `db.chatConversations.where(...)` — read queries remain direct Dexie calls
- `db.chatConversations.get(...)` — same

### AC4 — `chatConversations` delete in `ConversationHistorySheet.tsx` routes through `syncableWrite`
`src/app/components/tutor/ConversationHistorySheet.tsx` line ~191:
```ts
await db.chatConversations.delete(conversationId)
```
Replace with:
```ts
await syncableWrite('chatConversations', 'delete', conversationId)
```

### AC5 — `learnerModels` write sites in `learnerModelService.ts` route through `syncableWrite`
All Dexie write calls in `src/ai/tutor/learnerModelService.ts` replaced with `syncableWrite`:

- `createLearnerModel`: `db.learnerModels.add(model)` → `syncableWrite('learnerModels', 'add', model)`
- `updateLearnerModel`: `db.learnerModels.put(merged)` → `syncableWrite('learnerModels', 'put', merged)`
- `replaceLearnerModel`: `db.learnerModels.put(replaced)` → `syncableWrite('learnerModels', 'put', replaced)`
- `clearLearnerModel`: `db.learnerModels.delete(existing.id)` → `syncableWrite('learnerModels', 'delete', existing.id)`

**What stays as-is (read paths — do NOT change):**
- `db.learnerModels.where(...)` — read queries remain direct Dexie calls

### AC6 — Store refresh callbacks registered in `useSyncLifecycle`
`src/app/hooks/useSyncLifecycle.ts` registers before `fullSync()`:
```ts
syncEngine.registerStoreRefresh('chatConversations', () =>
  // chatConversations are loaded per-course context in useTutorStore — no global refresh needed
  Promise.resolve()
)
syncEngine.registerStoreRefresh('learnerModels', () =>
  // learnerModels are loaded per-course via learnerModelService.getLearnerModel — no global refresh needed
  Promise.resolve()
)
```
Both stores load data on navigation (per-course context), so no-op `Promise.resolve()` callbacks are correct. After `fullSync()` the next navigation to a course with the tutor open will re-query and pick up downloaded data automatically. Document with comments.

### AC7 — Zero direct Dexie write calls remain for `chatConversations` and `learnerModels`
After this story:
- `src/stores/useTutorStore.ts` contains zero `db.chatConversations.add/put/update/delete` write calls
- `src/ai/tutor/learnerModelService.ts` contains zero `db.learnerModels.add/put/delete` write calls
- `src/app/components/tutor/ConversationHistorySheet.tsx` contains zero `db.chatConversations.delete` write calls

Read calls (`where`, `get`, `toArray`, `first`) remain unchanged in all files.

### AC8 — Unauthenticated writes persist locally only
When `user` is null, all mutations write to Dexie but create no `syncQueue` entries and make no Supabase requests. No errors thrown. Standard `syncableWrite` contract.

### AC9 — Unit tests
New file `src/lib/sync/__tests__/p1-chat-conversations-learner-models-sync.test.ts`:
- `useTutorStore` — `saveConversation` (add path) while authenticated → `syncQueue` entry `{ tableName: 'chatConversations', operation: 'add' }`
- `useTutorStore` — `saveConversation` (update path) while authenticated → `syncQueue` entry `{ tableName: 'chatConversations', operation: 'put' }`
- `useTutorStore` — `clearConversation` while authenticated → `syncQueue` entry `{ tableName: 'chatConversations', operation: 'delete' }`
- Unauthenticated `chatConversations` add → Dexie row exists, no `syncQueue` entry
- `learnerModelService.createLearnerModel()` while authenticated → `syncQueue` entry `{ tableName: 'learnerModels', operation: 'add' }`
- `learnerModelService.updateLearnerModel()` while authenticated → `syncQueue` entry `{ tableName: 'learnerModels', operation: 'put' }`
- `learnerModelService.clearLearnerModel()` while authenticated → `syncQueue` entry `{ tableName: 'learnerModels', operation: 'delete' }`
- Unauthenticated `learnerModels` mutation → no `syncQueue` entries

### AC10 — TypeScript clean
`npx tsc --noEmit` passes with zero errors after all changes.

---

## Technical Context and Constraints

### `chat_conversations.created_at_epoch` — BIGINT, Not TIMESTAMPTZ

The Dexie `ChatConversation` interface uses `createdAt: number` (epoch-ms). The Supabase column is `created_at_epoch BIGINT`, NOT a TIMESTAMPTZ. The tableRegistry `fieldMap: { createdAt: 'created_at_epoch' }` already handles the camelCase→snake_case rename.

The sync cursor is `updated_at` (a normal TIMESTAMPTZ) — no special cursor handling needed. Only the `createdAt` field name is non-standard.

**Important**: Do NOT pass `createdAt` as an ISO string to the Supabase column — it expects an integer epoch-ms value. The fieldMapper in `tableRegistry.ts` handles renaming but not type coercion; ensure `createdAt` remains a `number` in the Dexie record.

### `learner_models` Upsert Pattern

The Supabase `learner_models` table has a `UNIQUE (user_id, course_id)` constraint. The Supabase JavaScript client's `.upsert()` method (used by the sync engine upload phase, E92-S05) handles `ON CONFLICT DO UPDATE` automatically. Verify the upload phase uses `.upsert()` for `put`/`add` operations, which covers the `learnerModels` case without any store-level changes.

### `useTutorStore` `update` → Fetch-Then-Put Pattern

`db.chatConversations.update(id, partialFields)` is a partial update (Dexie's `update` only touches specified fields). `syncableWrite` uses `put` which requires the full record. The fetch-then-put pattern:
```ts
const existing = await db.chatConversations.get(conversationId)
if (!existing) return
await syncableWrite('chatConversations', 'put', { ...existing, messages: tutorMessages, mode, hintLevel, updatedAt: now })
```
This is the same pattern used in E93-S07 for `updateClipTitle` in `useAudioClipStore`.

### `syncableWrite` Pattern (E92-S04)

Import from `src/lib/sync/syncableWrite.ts`. Wraps Dexie write, stamps `userId` and `updatedAt` (for add/put), enqueues if authenticated. No `persistWithRetry` wrapper needed for these two tables (tutor operations are lightweight, and the tutor already has its own error toast boundary).

### Write Sites Are Spread Across Three Files

Unlike most sync stories where writes are in a single store, `chatConversations` writes are in two files:
1. `src/stores/useTutorStore.ts` — main conversation lifecycle (add, update, delete)
2. `src/app/components/tutor/ConversationHistorySheet.tsx` — user-initiated delete from history UI

`learnerModels` writes are centralized in `src/ai/tutor/learnerModelService.ts` — a clean migration.

### `useSyncLifecycle` Pattern (E93-S02 through E93-S07)

`registerStoreRefresh` must be called before `fullSync()`. Both `chatConversations` and `learnerModels` are loaded per-course context on navigation, so no-op `Promise.resolve()` callbacks are correct.

### ES2020 Constraints

No `Promise.any`. `Promise.allSettled` acceptable. All async paths must propagate or explicitly handle errors.

---

## Dependencies

- **E92-S03 (done):** `tableRegistry.ts` exists with `chatConversations` and `learnerModels` entries.
- **E92-S04 (done):** `syncableWrite` function exists at `src/lib/sync/syncableWrite.ts`.
- **E92-S05 (done):** Upload phase processes `syncQueue` entries, LWW strategy with `.upsert()`.
- **E92-S06 (done):** Download/apply phase applies LWW strategy per registry config.
- **E92-S09 (done):** P0 stores wired — reference implementation.
- **E93-S01 (in-progress):** `chat_conversations` and `learner_models` Supabase tables with RLS. Must be applied before end-to-end testing against real Supabase.
- **E93-S02 (done):** Notes/bookmarks wiring — nearest reference for `syncableWrite` pattern.
- **E93-S07 (in-progress):** Audio bookmarks/clips wiring — reference for component-level write sites and fetch-then-put pattern.

---

## Out of Scope

- **New migration**: No Supabase migration needed — tables exist from E93-S01.
- **tableRegistry changes**: Both entries already exist — no modifications expected.
- **UI changes**: Pure infrastructure story. No new components, no design review required.
- **`chat_conversations.messages` schema validation**: Messages are stored as opaque JSONB. No schema migration needed; the client is responsible for message format.
- **`learner_models` monotonic update logic**: `updateLearnerModel` already implements a merge/greatest-value strategy client-side in `learnerModelService.ts`. This story does not change that logic, only routes through `syncableWrite`.
- **Backfill of existing records**: Pre-existing records not in `syncQueue` are handled by E97's initial upload wizard.
- **Conflict resolution for `chat_conversations.messages`**: LWW at the conversation level — the most recently updated conversation wins. Per-message merge is out of scope.

---

## Implementation Hints

1. **Locate all `db.chatConversations` write sites**: `useTutorStore.ts` (add, update-partial, delete) and `ConversationHistorySheet.tsx` (delete).
2. **Locate all `db.learnerModels` write sites**: All in `learnerModelService.ts` (add, put×2, delete).
3. **Wire `chatConversations` in `useTutorStore`** (AC3): Convert add, update→fetch-then-put, delete.
4. **Wire `chatConversations` delete in `ConversationHistorySheet.tsx`** (AC4).
5. **Wire `learnerModels` in `learnerModelService.ts`** (AC5): add, put×2, delete.
6. **Register store refresh callbacks** in `useSyncLifecycle.ts` (AC6).
7. **Write unit tests** in `src/lib/sync/__tests__/p1-chat-conversations-learner-models-sync.test.ts` (AC9).
8. **Verification**: `npm run test:unit`, `npx tsc --noEmit`, `npm run lint`, `npm run build`.

### Key Files

| File | Role |
|------|------|
| `src/stores/useTutorStore.ts` | Wire `db.chatConversations` writes via `syncableWrite` |
| `src/app/components/tutor/ConversationHistorySheet.tsx` | Wire `db.chatConversations.delete` via `syncableWrite` |
| `src/ai/tutor/learnerModelService.ts` | Wire `db.learnerModels` writes via `syncableWrite` |
| `src/lib/sync/tableRegistry.ts` | Verify `chatConversations` and `learnerModels` entries (no changes expected) |
| `src/lib/sync/syncableWrite.ts` | The write wrapper (E92-S04) |
| `src/app/hooks/useSyncLifecycle.ts` | Register store refresh callbacks |
| `src/lib/sync/__tests__/p1-audio-bookmarks-clips-sync.test.ts` | Nearest test pattern (E93-S07) |

### lastGreenSha

`cadcf90cf649dfc9a55e536c732f69f8305f1001`
