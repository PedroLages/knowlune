# Implementation Plan: E110-S03 — Reading Queue

## Context

The Reading Queue feature completes Epic 110 ("Library Organization -- Shelves, Series, Queue") by adding a Spotify-style "Read Next" queue to the Library page. Users currently have shelves (E110-S01) and series grouping (E110-S02) to organize their books, but no mechanism to maintain a prioritized reading order. The queue solves this by letting readers add books, reorder them via drag-and-drop, and automatically surface the next book when one is completed. This continuous-learning-flow concept originated from brainstorming CP #10.

The feature touches four layers: data model (Dexie), state management (Zustand), UI (React component with @dnd-kit), and integration (BookContextMenu, Library page, event bus subscription). All layers have strong existing patterns to follow.

---

## Implementation Steps

### Step 1: Data Model — `ReadingQueueEntry` type and Dexie v46 migration

**Files to modify:**
- `src/data/types.ts`
- `src/db/schema.ts`
- `src/db/checkpoint.ts`

**What to do:**

1. Add `ReadingQueueEntry` interface to `src/data/types.ts` after `BookShelfEntry`
2. Add v46 migration to `src/db/schema.ts`
3. Update `ElearningDatabase` type in `src/db/schema.ts`
4. Update `src/db/checkpoint.ts` — version to 46, add `readingQueue` to schema
5. Update `src/db/__tests__/schema-checkpoint.test.ts` — version assertion + table list

**Reuse:** Follows exact pattern of v44 (shelves + bookShelves) migration from E110-S01.

**Commit:** "Add ReadingQueueEntry type and Dexie v46 migration (E110-S03 AC-5)"

---

### Step 2: `useReadingQueueStore` Zustand store

**File to create:** `src/stores/useReadingQueueStore.ts`

**Actions:** loadQueue, addToQueue, removeFromQueue, reorderQueue, isInQueue, getQueuedBookIds, removeAllBookEntries

**Reuse:** Direct pattern from `useShelfStore.ts`. Import `arrayMove` from `@dnd-kit/sortable`.

**Commit:** "Add useReadingQueueStore with CRUD and reorder (E110-S03 AC-2,3,4,5)"

---

### Step 3: ReadingQueue UI component with drag-and-drop

**File to create:** `src/app/components/library/ReadingQueue.tsx`

**Structure:** DndContext + SortableContext with SortableQueueItem sub-component, following `VideoReorderList.tsx` pattern.

**Reuse:** `VideoReorderList.tsx` (DnD), `BookListItem.tsx` (display), `useBookCoverUrl` hook.

**Commit:** "Add ReadingQueue component with drag-and-drop reordering (E110-S03 AC-1,4,6)"

---

### Step 4: BookContextMenu integration

**File to modify:** `src/app/components/library/BookContextMenu.tsx`

**What:** Add flat toggle item "Add to Queue" / "Remove from Queue" in both ContextMenu and DropdownMenu sections.

**Commit:** "Add queue toggle to BookContextMenu (E110-S03 AC-2,3)"

---

### Step 5: Library page integration

**Files to modify:**
- `src/app/pages/Library.tsx` — mount ReadingQueue, load store, subscribe to book:finished
- `src/stores/useBookStore.ts` — add queue cleanup in deleteBook

**Commit:** "Wire ReadingQueue into Library page with auto-removal on completion (E110-S03 AC-1,7)"

---

### Step 6: E2E tests

**Files to create/modify:**
- `tests/e2e/story-e110-s03.spec.ts`
- `tests/support/helpers/seed-helpers.ts` — add `seedReadingQueue`

**Commit:** "Add E2E tests for Reading Queue (E110-S03 AC-1-7)"

---

## Verification

### Dev Server Manual Checks
1. Navigate to `/library`, verify queue section behavior
2. Add/remove/reorder books via context menu and drag-and-drop
3. Verify persistence on reload
4. Verify auto-removal on book completion
5. Check mobile viewport (375px)

### Automated Verification
- `npx vitest run src/db/__tests__/schema-checkpoint.test.ts`
- `npx playwright test tests/e2e/story-e110-s03.spec.ts`
- `npx vitest run` (full suite, no regressions)

---

## Risk Assessment

1. **@dnd-kit + page scroll:** Low risk. Use `PointerSensor` with `distance: 5` constraint. Pattern from `VideoReorderList.tsx`.
2. **Race condition on book:finished:** Low risk. Store guards against removing non-existent entries.
3. **Library.tsx size (761+ lines):** Known issue KI-033. Additions are ~15 lines. Future refactor tracked.

### Pattern References
- Store: `src/stores/useShelfStore.ts`
- DnD: `src/app/components/figma/VideoReorderList.tsx`
- Context menu: `src/app/components/library/BookContextMenu.tsx`
- Event bus: `src/app/pages/Library.tsx` lines 210-223
- Dexie migration: `src/db/schema.ts` v44 pattern
- E2E test: `tests/e2e/regression/story-e110-s01.spec.ts`
- DnD testing: `tests/e2e/dashboard-reordering.spec.ts`
