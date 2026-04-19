---
title: "feat: Wire chatConversations and learnerModels sync (E93-S08)"
type: feat
status: completed
date: 2026-04-18
origin: docs/brainstorms/2026-04-18-e93-s08-chat-conversations-learner-models-sync-requirements.md
---

# feat: Wire chatConversations and learnerModels sync (E93-S08)

## Overview

Route all Dexie write calls for `chatConversations` and `learnerModels` through `syncableWrite`, register their store refresh callbacks in `useSyncLifecycle`, and add unit tests that verify `syncQueue` entries are created correctly. Both tableRegistry entries already exist from E92-S03; no schema or migration work is needed.

## Problem Frame

AI tutor conversations and learner profiles are written directly to Dexie today. A user who starts a conversation on one device has no path to see it on another. The sync engine (E92) is fully operational and only needs the write-site wiring to cover these two tables. (see origin: docs/brainstorms/2026-04-18-e93-s08-chat-conversations-learner-models-sync-requirements.md)

## Requirements Trace

- R1. All `chatConversations` Dexie write calls in `useTutorStore.ts` route through `syncableWrite` (AC3)
- R2. The `chatConversations` delete in `ConversationHistorySheet.tsx` routes through `syncableWrite` (AC4)
- R3. All `learnerModels` Dexie write calls in `learnerModelService.ts` route through `syncableWrite` (AC5)
- R4. Store refresh callbacks for both tables are registered in `useSyncLifecycle` before `fullSync()` (AC6)
- R5. Zero direct Dexie write calls remain for either table (AC7)
- R6. Unauthenticated writes persist locally only — no syncQueue entries created (AC8)
- R7. Unit tests cover all write paths for both tables, authenticated and unauthenticated (AC9)
- R8. `npx tsc --noEmit` passes with zero errors (AC10)

## Scope Boundaries

- tableRegistry entries for `chatConversations` and `learnerModels` already exist — no modifications needed (AC1, AC2 are verification-only)
- No Supabase migration: `chat_conversations` and `learner_models` tables exist from E93-S01
- No UI changes: pure infrastructure wiring story
- No changes to read paths (`where`, `get`, `toArray`, `first`) — those remain direct Dexie calls
- No change to the `updateLearnerModel` additive merge logic — only the persistence layer changes
- No backfill of pre-existing records — handled by E97's initial upload wizard
- No per-message conflict resolution — LWW at conversation level

## Context & Research

### Relevant Code and Patterns

- `src/lib/sync/tableRegistry.ts` — `chatConversations` entry at line 262, `learnerModels` at line 272; both confirmed correct with no changes needed
- `src/lib/sync/syncableWrite.ts` — canonical write wrapper; supports `put`, `add`, `delete`; stamps `userId` and `updatedAt`; for unauthenticated callers, Dexie write succeeds but no syncQueue entry is created
- `src/stores/useTutorStore.ts` — four write sites for `chatConversations`: `persistConversation()` (add path at ~line 391, update path via `db.chatConversations.update` at ~line 373), `clearConversation()` (delete at ~line 308), and `loadConversation` corruption guard (`db.chatConversations.delete(conv.id)` at ~line 338)
- `src/app/components/tutor/ConversationHistorySheet.tsx` — one write site: `handleDelete` at line 191 (`db.chatConversations.delete(conversationId)`)
- `src/ai/tutor/learnerModelService.ts` — four write sites: `getOrCreateLearnerModel` (`add` at line 48), `updateLearnerModel` (`put` at line 123), `replaceLearnerModelFields` (`put` at line 148), `clearLearnerModel` (`delete` at line 158)
- `src/app/hooks/useSyncLifecycle.ts` — all `registerStoreRefresh` calls before `fullSync()`; no-op `Promise.resolve()` callbacks used for per-navigation stores (e.g. `bookHighlights`, `audioBookmarks`)
- `src/lib/sync/__tests__/p1-audio-bookmarks-clips-sync.test.ts` — nearest test pattern: `fake-indexeddb/auto`, `vi.resetModules()`, auth seeding via `useAuthStore.setState`, queue assertion via `db.syncQueue.toArray()` filtered by `tableName`

### Institutional Learnings

- The `update` Dexie operation (partial fields) has no `syncableWrite` equivalent — the fetch-then-put pattern is required: fetch the full record from Dexie, merge fields, then call `syncableWrite(..., 'put', mergedRecord)`. E93-S07 established this for `updateClipTitle` in `useAudioClipStore`.
- `chatConversations.createdAt` is a `number` (epoch-ms), not an ISO string. The fieldMap `createdAt → created_at_epoch` handles the column rename; no type coercion is needed as long as callers keep `createdAt` as `number`.
- Both `chatConversations` and `learnerModels` are loaded per-course on navigation, so no-op `Promise.resolve()` callbacks are correct for `registerStoreRefresh`.
- The `syncableWrite` stamping of `updatedAt` (ISO string) is safe for `learnerModels` since its Supabase column is `updated_at TIMESTAMPTZ`. No `stripFields` needed for either table.
- `persistConversation()` in `useTutorStore` uses `db.chatConversations.update(id, partialFields)` for the update path — this must become a fetch-then-put because `syncableWrite` requires the full record for `put`.

### External References

None required — strong local patterns exist from E93-S02 through E93-S07.

## Key Technical Decisions

- **fetch-then-put for `persistConversation` update path**: `db.chatConversations.update()` only touches partial fields; `syncableWrite` requires a full record for `put`. Pattern: `get` existing record, spread with updated fields, call `syncableWrite('chatConversations', 'put', fullRecord)`. If `get` returns undefined (record disappeared), return early — same guard as current code. This mirrors the `updateClipTitle` pattern from E93-S07.
- **No-op refresh callbacks for both tables**: Both `chatConversations` and `learnerModels` are scoped to a course; no global loadAll function exists. Registering `() => Promise.resolve()` with a descriptive comment is correct, consistent with `bookHighlights` and `audioBookmarks` precedents.
- **`clearConversation()` error handling**: Current code uses a fire-and-forget `.catch()` with a comment. Post-wiring, `syncableWrite('chatConversations', 'delete', id)` should also be called inside the same `.catch()` boundary — or the `clearConversation()` call path should be awaited. Since `clearConversation()` is a void synchronous action in the Zustand store (it calls `set()` immediately then fires async Dexie), the simplest approach is to convert the direct Dexie call inside the async IIFE to `syncableWrite`, keeping the same catch wrapper.
- **`getOrCreateLearnerModel` creates a new model with `add`**: The existing code already constructs the full model object before calling `db.learnerModels.add(model)`. Replacing with `syncableWrite('learnerModels', 'add', model)` is a direct drop-in with no structural change needed. Note that `syncableWrite` will overwrite `updatedAt` with `now` — this is fine since the freshly-constructed model already has `updatedAt: now`.
- **Test file is new**: `src/lib/sync/__tests__/p1-chat-conversations-learner-models-sync.test.ts`. Tests call store actions directly (for `useTutorStore` paths) and service functions directly (for `learnerModelService` paths), checking `db.syncQueue` entries post-action.

## Open Questions

### Resolved During Planning

- **Does `chatConversations.fieldMap: { createdAt: 'created_at_epoch' }` need changes?** No — already correct in tableRegistry. The BIGINT column rename is handled; no type coercion needed. (see origin: AC1)
- **Does `learnerModels` upsert pattern require store changes?** No — the sync engine's upload phase uses Supabase `.upsert()` which handles `ON CONFLICT (user_id, course_id) DO UPDATE` automatically. `syncableWrite` operation `put` maps to upsert on the upload side. (see origin: AC2)
- **Should `persistConversation` use `add` or `put` for new conversations?** Keep `add` — a new conversation with a freshly-generated UUID will always be a new Dexie record. `put` would also work but `add` is more expressive for "new insert" semantics and consistent with existing code intent.

### Deferred to Implementation

- Whether `persistConversation`'s `add` path needs the `set({ conversationId: id })` call reordered relative to `syncableWrite` — this is a sequencing detail to verify at implementation time (the ID is known before the write, so order is flexible but the `set` should logically follow a successful write).

## Implementation Units

- [ ] **Unit 1: Verify tableRegistry entries (AC1, AC2)**

**Goal:** Confirm `chatConversations` and `learnerModels` entries are present and correct; add any missing JSDoc comments.

**Requirements:** R1 (pre-condition for wiring), R3 (pre-condition)

**Dependencies:** None

**Files:**
- Modify: `src/lib/sync/tableRegistry.ts` (JSDoc comments only — no functional changes expected)

**Approach:**
- Verify `chatConversations` entry has `fieldMap: { createdAt: 'created_at_epoch' }` and `conflictStrategy: 'lww'`
- Verify `learnerModels` entry has `fieldMap: {}`, `conflictStrategy: 'lww'`, no `compoundPkFields` (upsert handled by Supabase client `.upsert()` in upload phase)
- If any field is missing or wrong, fix it; otherwise add a confirming comment
- No functional code changes expected

**Patterns to follow:**
- Existing JSDoc format in `src/lib/sync/tableRegistry.ts` (e.g., `chatConversations` comment at line 258)

**Test scenarios:**
Test expectation: none — this is a verification/documentation-only unit with no behavioral change.

**Verification:**
- Both entries visible in the array exported from `tableRegistry.ts` with correct field values

---

- [ ] **Unit 2: Wire `chatConversations` writes in `useTutorStore.ts` (AC3)**

**Goal:** Replace all four direct Dexie write operations in `persistConversation()`, `clearConversation()`, and the `loadConversation` corruption guard with `syncableWrite`.

**Requirements:** R1, R5, R6

**Dependencies:** Unit 1 (tableRegistry confirmed)

**Files:**
- Modify: `src/stores/useTutorStore.ts`
- Test: `src/lib/sync/__tests__/p1-chat-conversations-learner-models-sync.test.ts`

**Approach:**
- Import `syncableWrite` at the top of `useTutorStore.ts`
- **`persistConversation` — add path** (`conversationId` is null): Replace `db.chatConversations.add(conversation)` with `syncableWrite('chatConversations', 'add', conversation)`. Keep `set({ conversationId: id })` after the await.
- **`persistConversation` — update path** (`conversationId` is set): Replace `db.chatConversations.update(conversationId, { messages, mode, hintLevel, updatedAt })` with:
  1. `const existing = await db.chatConversations.get(conversationId)`
  2. Guard: `if (!existing) return`
  3. `await syncableWrite('chatConversations', 'put', { ...existing, messages: tutorMessages, mode, hintLevel, updatedAt: now })`
  - Note: `now` in this path is `Date.now()` (a number) — keep as number. `ChatConversation.updatedAt` is confirmed `number` (epoch-ms) in `src/data/types.ts` line 1066. The `syncableWrite` stamp will overwrite it with an ISO string — cast the record as `unknown as SyncableRecord` to satisfy TypeScript (see Risks & Dependencies). The spread field `updatedAt: now` sets the correct epoch value before syncableWrite stamps its ISO override.
- **`clearConversation` — delete path**: Inside the async block that calls `db.chatConversations.delete(conversationId)`, replace with `syncableWrite('chatConversations', 'delete', conversationId)`. Keep the same `.catch()` wrapper.
- **`loadConversation` corruption guard** (useTutorStore.ts line ~338): Replace `db.chatConversations.delete(conv.id)` with `syncableWrite('chatConversations', 'delete', conv.id)`. This propagates the corruption delete to Supabase; LWW will re-download if remote is intact.
- Remove the `db` import from `useTutorStore.ts` if no other Dexie calls remain (read paths like `db.chatConversations.where(...)` in `loadConversation` keep the import alive — check before removing).

**Patterns to follow:**
- `persistConversation` in `src/stores/useTutorStore.ts` (existing structure)
- fetch-then-put pattern from `updateClipTitle` in `src/stores/useAudioClipStore.ts`

**Test scenarios:**
- Happy path: `persistConversation()` with no existing `conversationId` (add path) while authenticated → `syncQueue` has one entry `{ tableName: 'chatConversations', operation: 'add', status: 'pending' }`
- Happy path: `persistConversation()` with existing `conversationId` (update path) while authenticated → `syncQueue` has one entry `{ tableName: 'chatConversations', operation: 'put', status: 'pending' }`
- Happy path: `clearConversation()` with an existing `conversationId` while authenticated → `syncQueue` has one entry `{ tableName: 'chatConversations', operation: 'delete' }`; Dexie record absent
- Edge case: `persistConversation()` when `_courseId` or `_videoId` is null → early return, no syncQueue entry
- Edge case: `persistConversation()` update path when `get` returns undefined (conversation deleted externally) → early return, no syncQueue entry, no error thrown
- Unauthenticated: `persistConversation()` add path with `user = null` → Dexie record present, zero `chatConversations` queue entries
- Edge case: corrupt record → corruption guard → `syncableWrite` delete called with conversation id → `syncQueue` has one entry `{ tableName: 'chatConversations', operation: 'delete' }` while authenticated

**Verification:**
- Zero `db.chatConversations.add/update/delete` calls remain in `useTutorStore.ts`
- `syncableWrite` import present
- `npm run test:unit` passes for the new test file

---

- [ ] **Unit 3: Wire `chatConversations` delete in `ConversationHistorySheet.tsx` (AC4)**

**Goal:** Replace the direct `db.chatConversations.delete(conversationId)` call in `handleDelete` with `syncableWrite`.

**Requirements:** R2, R5, R6

**Dependencies:** Unit 1 (tableRegistry confirmed)

**Files:**
- Modify: `src/app/components/tutor/ConversationHistorySheet.tsx`
- Test: `src/lib/sync/__tests__/p1-chat-conversations-learner-models-sync.test.ts`

**Approach:**
- Import `syncableWrite` from `@/lib/sync/syncableWrite`
- Replace `await db.chatConversations.delete(conversationId)` with `await syncableWrite('chatConversations', 'delete', conversationId)` at line ~191
- Verify the `db` import is still needed for any remaining read calls; remove if not

**Patterns to follow:**
- Same delete pattern as `deleteClip` in `src/stores/useAudioClipStore.ts`

**Test scenarios:**
- Happy path: Calling `syncableWrite('chatConversations', 'delete', id)` directly while authenticated → Dexie record absent; syncQueue has delete entry `{ tableName: 'chatConversations', operation: 'delete', payload: { id } }`
- Unauthenticated: Same call with `user = null` → Dexie record absent, zero chatConversations queue entries

**Verification:**
- Zero `db.chatConversations.delete` calls remain in `ConversationHistorySheet.tsx`

---

- [ ] **Unit 4: Wire `learnerModels` writes in `learnerModelService.ts` (AC5)**

**Goal:** Replace all four direct Dexie write operations in `learnerModelService.ts` with `syncableWrite`.

**Requirements:** R3, R5, R6

**Dependencies:** Unit 1 (tableRegistry confirmed)

**Files:**
- Modify: `src/ai/tutor/learnerModelService.ts`
- Test: `src/lib/sync/__tests__/p1-chat-conversations-learner-models-sync.test.ts`

**Approach:**
- Import `syncableWrite` from `@/lib/sync/syncableWrite`
- **`getOrCreateLearnerModel`**: Replace `db.learnerModels.add(model)` with `syncableWrite('learnerModels', 'add', model)`. The model is fully constructed before the call; `syncableWrite` will stamp `userId` and overwrite `updatedAt` with an ISO string. Verify that `LearnerModel.updatedAt` is typed as `string` (it is, from `learnerModelService.ts` line 46) — no type mismatch.
- **`updateLearnerModel`**: Replace `db.learnerModels.put(merged)` with `syncableWrite('learnerModels', 'put', merged)`. The full merged object is already constructed.
- **`replaceLearnerModelFields`**: Replace `db.learnerModels.put(replaced)` with `syncableWrite('learnerModels', 'put', replaced)`. Same pattern.
- **`clearLearnerModel`**: Replace `db.learnerModels.delete(existing.id)` with `syncableWrite('learnerModels', 'delete', existing.id)`.
- Check whether `db` import can be removed — read paths (`where`, `first`) in `getLearnerModel` keep the import alive.

**Patterns to follow:**
- `src/lib/sync/syncableWrite.ts` — `put` and `add` paths
- `src/stores/useAudioClipStore.ts` — `deleteClip` for the delete pattern
- `src/lib/sync/__tests__/p1-audio-bookmarks-clips-sync.test.ts` — test structure

**Test scenarios:**
- Happy path: `createLearnerModel` (via `getOrCreateLearnerModel` when no model exists) while authenticated → `syncQueue` has one entry `{ tableName: 'learnerModels', operation: 'add', status: 'pending' }`
- Happy path: `updateLearnerModel()` while authenticated → `syncQueue` has one entry `{ tableName: 'learnerModels', operation: 'put', status: 'pending' }`
- Happy path: `replaceLearnerModelFields()` while authenticated → `syncQueue` has one entry `{ tableName: 'learnerModels', operation: 'put', status: 'pending' }`
- Happy path: `clearLearnerModel()` while authenticated → Dexie record absent; `syncQueue` has one entry `{ tableName: 'learnerModels', operation: 'delete' }`
- Edge case: `updateLearnerModel()` when no model exists for courseId → returns null, no syncQueue entry
- Edge case: `clearLearnerModel()` when no model exists → no Dexie write, no syncQueue entry, no error
- Unauthenticated: `getOrCreateLearnerModel()` with `user = null` → Dexie record present, zero `learnerModels` queue entries
- Unauthenticated: `updateLearnerModel()` with `user = null` → Dexie record updated, zero `learnerModels` queue entries

**Verification:**
- Zero `db.learnerModels.add/put/delete` calls remain in `learnerModelService.ts`
- `syncableWrite` import present
- Return values of all functions remain unchanged (callers depend on returned `LearnerModel | null`)

---

- [ ] **Unit 5: Register store refresh callbacks in `useSyncLifecycle.ts` (AC6)**

**Goal:** Add `registerStoreRefresh` calls for `chatConversations` and `learnerModels` before `fullSync()`.

**Requirements:** R4

**Dependencies:** None — no-op callbacks are independent of write wiring; can be done in any order

**Files:**
- Modify: `src/app/hooks/useSyncLifecycle.ts`

**Approach:**
- After the existing `audioClips` registration block (~line 88) and before the `setStatus('syncing')` call, add:
  ```
  syncEngine.registerStoreRefresh('chatConversations', () =>
    // chatConversations are loaded per-course context in useTutorStore on navigation — no global refresh needed
    Promise.resolve()
  )
  syncEngine.registerStoreRefresh('learnerModels', () =>
    // learnerModels are loaded per-course via learnerModelService.getLearnerModel — no global refresh needed
    Promise.resolve()
  )
  ```
- No new imports required — `syncEngine` is already imported
- Both callbacks are no-ops because both stores are loaded per-course on navigation, identical rationale to `bookHighlights` and `audioBookmarks`

**Patterns to follow:**
- Existing no-op registrations: `bookHighlights` (~line 74) and `audioBookmarks` (~line 82) in `useSyncLifecycle.ts`

**Test scenarios:**
Test expectation: none — this unit only adds declarative lifecycle wiring with no behavioral change observable without a full integration harness. The registration is covered implicitly by the unit tests in Unit 6 (sync queue entries prove the write path is active).

**Verification:**
- Two new `registerStoreRefresh` calls present in `useSyncLifecycle.ts`, both before the `fullSync()` call
- Each has a JSDoc comment explaining why a no-op is correct

---

- [ ] **Unit 6: Unit tests (AC9)**

**Goal:** Write the test file covering all `syncQueue` entry assertions for both tables, authenticated and unauthenticated.

**Requirements:** R7, plus verifying R1–R6 indirectly

**Dependencies:** Units 2–5

**Files:**
- Create: `src/lib/sync/__tests__/p1-chat-conversations-learner-models-sync.test.ts`

**Approach:**
- Copy the test harness structure from `src/lib/sync/__tests__/p1-audio-bookmarks-clips-sync.test.ts`: `fake-indexeddb/auto`, `vi.resetModules()` in `beforeEach`, auth seeding via `useAuthStore.setState`, `getQueueEntries(tableName)` helper
- Declare lazy module imports at the top (`let useTutorStore`, `let learnerModelService`, etc.) and resolve them inside `beforeEach` after `vi.resetModules()`
- **`chatConversations` tests** — call `useTutorStore.getState()` actions: `setLessonContext` + `persistConversation` (add path), `setLessonContext` + `persistConversation` (update path, seed existing conversation first), `clearConversation` (seed conversationId first)
- **`learnerModels` tests** — call service functions directly: `getOrCreateLearnerModel`, `updateLearnerModel`, `replaceLearnerModelFields`, `clearLearnerModel`
- **Unauthenticated group**: `useAuthStore.setState({ user: null })` then repeat key actions, assert `toHaveLength(0)` on queue

**Execution note:** Write tests first, then use them to validate each wiring unit against the `lastGreenSha` (`cadcf90cf649dfc9a55e536c732f69f8305f1001`).

**Patterns to follow:**
- `src/lib/sync/__tests__/p1-audio-bookmarks-clips-sync.test.ts` — full file structure, module reset pattern, `getQueueEntries` helper
- `src/lib/sync/__tests__/p1-notes-bookmarks-sync.test.ts` — store-action-based test style

**Test scenarios:**
The following are the test cases to include (mirroring AC9 exactly):
- `useTutorStore` — `persistConversation` (add path) while authenticated → `syncQueue` entry `{ tableName: 'chatConversations', operation: 'add' }`
- `useTutorStore` — `persistConversation` (update path, existing conversation) while authenticated → `syncQueue` entry `{ tableName: 'chatConversations', operation: 'put' }`
- `useTutorStore` — `clearConversation` while authenticated → `syncQueue` entry `{ tableName: 'chatConversations', operation: 'delete' }`
- Unauthenticated `chatConversations` add → Dexie row exists, zero `chatConversations` queue entries
- `learnerModelService.getOrCreateLearnerModel()` (create path) while authenticated → `syncQueue` entry `{ tableName: 'learnerModels', operation: 'add' }`
- `learnerModelService.updateLearnerModel()` while authenticated → `syncQueue` entry `{ tableName: 'learnerModels', operation: 'put' }`
- `learnerModelService.clearLearnerModel()` while authenticated → `syncQueue` entry `{ tableName: 'learnerModels', operation: 'delete' }`
- Unauthenticated `learnerModels` mutation → zero `learnerModels` queue entries

**Verification:**
- `npm run test:unit` passes with all 8+ test cases green
- `npx tsc --noEmit` passes with zero errors
- `npm run lint` passes

## System-Wide Impact

- **Interaction graph:** `persistConversation()` is called from the tutor UI on message send and session boundary; `clearConversation()` is called from toolbar and `ConversationHistorySheet.tsx`. All paths now enqueue syncQueue entries when authenticated. The sync engine nudge will fire immediately after each write.
- **Error propagation:** `syncableWrite` rethrows Dexie write failures (fatal) and logs-swallows queue insert failures (non-fatal). `persistConversation` already wraps in `try/catch` with `toast.error` — this remains the user-visible error boundary. `clearConversation` uses a fire-and-forget pattern; `syncableWrite` failure there is non-critical.
- **State lifecycle risks:** The fetch-then-put pattern in `persistConversation` update path introduces a read-before-write; if the conversation is deleted between the `get` and the `put`, the guard returns early rather than creating a ghost record. This is correct behavior.
- **API surface parity:** `learnerModelService` functions return `LearnerModel | null` to callers in `useTutorStore`; the return values are unchanged since `syncableWrite` returns `void` and the functions still return the locally-constructed merged object.
- **Integration coverage:** Full round-trip (write → syncQueue → upload engine) is not covered in unit tests — unit tests only verify the Dexie+syncQueue side. End-to-end sync against real Supabase requires E93-S01 tables to be applied (dependency).
- **Unchanged invariants:** Read paths (`getLearnerModel`, `loadConversation`, `db.chatConversations.where(...)`) remain direct Dexie calls. The sync download phase writes records directly to Dexie (E92-S06) — those writes bypass `syncableWrite` intentionally and are not affected by this story.

## Risks & Dependencies

| Risk | Mitigation |
|------|------------|
| `ChatConversation.updatedAt` is typed as `number` (epoch-ms) in `src/data/types.ts` line 1066, but `syncableWrite` stamps it as an ISO string — TypeScript error guaranteed | **Confirmed issue.** Fix: change `ChatConversation.updatedAt` type to `number \| string` in `src/data/types.ts`, OR cast the stamped record as `unknown as SyncableRecord` in the `syncableWrite` call (same pattern used in other tests for non-standard types). Preferred: keep `updatedAt: number` on the type (it's epoch-ms elsewhere in the store), cast to `SyncableRecord` for the `syncableWrite` call. Include this fix as part of Unit 2. |
| fetch-then-put in `persistConversation` doubles the Dexie transaction count for updates | Acceptable: tutor writes are infrequent, Dexie is fast locally. No perf concern. |
| `getOrCreateLearnerModel` may be called concurrently from two renders before the first `add` completes, causing a duplicate key error | Pre-existing race — not introduced by this story. `syncableWrite('add')` will throw on duplicate key same as `db.learnerModels.add()`. Deferring to future story if needed. |
| E93-S01 tables not yet applied in Supabase | E2E sync will fail until E93-S01 is merged. Unit tests are Dexie-only and unblocked. |

## Sources & References

- **Origin document:** [docs/brainstorms/2026-04-18-e93-s08-chat-conversations-learner-models-sync-requirements.md](docs/brainstorms/2026-04-18-e93-s08-chat-conversations-learner-models-sync-requirements.md)
- Related code: `src/lib/sync/tableRegistry.ts` lines 258–278
- Related code: `src/stores/useTutorStore.ts` lines 304–396
- Related code: `src/ai/tutor/learnerModelService.ts`
- Related code: `src/app/components/tutor/ConversationHistorySheet.tsx` line 191
- Related code: `src/app/hooks/useSyncLifecycle.ts` lines 52–90
- Reference test: `src/lib/sync/__tests__/p1-audio-bookmarks-clips-sync.test.ts`
- lastGreenSha: `cadcf90cf649dfc9a55e536c732f69f8305f1001`
