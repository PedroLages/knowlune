# Implementation Plan: E111-S01 — Audio Clips

## Context

Knowlune's audiobook player (E107) supports bookmarks — single-point timestamps users can drop while listening. However, users need to capture *ranges* of audio (memorable passages, key explanations) as clips with a start and end time. This story introduces a two-phase clip creation workflow (start/end), a clips management panel with DnD reordering, inline title editing, and clip-scoped playback. The feature directly parallels the existing bookmark infrastructure, so the implementation reuses BookmarkButton, BookmarkListPanel, useReadingQueueStore, and ReadingQueue as structural templates.

## Implementation Steps

### Step 1: Define the AudioClip type

**File to modify:** `src/data/types.ts`

Add the `AudioClip` interface near the existing `AudioBookmark` interface (line ~785):

```typescript
export interface AudioClip {
  id: string            // UUID v4
  bookId: string        // FK to Book.id
  chapterId: string     // chapter identifier (e.g. chapter title or slug)
  chapterIndex: number  // 0-based index into Book.chapters
  startTime: number     // seconds from chapter start
  endTime: number       // seconds from chapter start
  title?: string        // user-assigned label
  sortOrder: number     // 0-based display order (for DnD reordering)
  createdAt: string     // ISO 8601
}
```

**Reuse:** Modeled on `AudioBookmark` (line 778) and `ReadingQueueEntry` (line 664) for `sortOrder`.

**Scope:** ~10 lines, trivial.

### Step 2: Add Dexie v47 migration and update schema types

**Files to modify:**

1. `src/db/schema.ts`
   - Add `audioClips: EntityTable<AudioClip, 'id'>` to the `ElearningDatabase` type (after line 83, near `audioBookmarks`).
   - Add the v47 migration after v46:
     ```typescript
     // E111-S01: Audio Clips — clippable audio ranges
     database.version(47).stores({
       audioClips: 'id, bookId, chapterId, createdAt, sortOrder',
     })
     ```
   - Import `AudioClip` from `@/data/types`.

2. `src/db/checkpoint.ts`
   - Update `CHECKPOINT_VERSION` from 46 to 47.
   - Add `audioClips: 'id, bookId, chapterId, createdAt, sortOrder'` to `CHECKPOINT_SCHEMA`.
   - Add comment: `// v47 (E111-S01): audioClips table for audio clip ranges`.

**Reuse:** Exact same pattern as v46 (readingQueue) at schema.ts and checkpoint.ts.

**Scope:** ~15 lines across 2 files.

### Step 3: Create the useAudioClipStore Zustand store

**File to create:** `src/stores/useAudioClipStore.ts`

This store manages CRUD + reorder for audio clips scoped to a book. Closely modeled on `useReadingQueueStore.ts`.

**Store interface:**
```typescript
interface AudioClipStoreState {
  clips: AudioClip[]
  isLoaded: boolean

  loadClips: (bookId: string) => Promise<void>
  addClip: (clip: Omit<AudioClip, 'id' | 'sortOrder' | 'createdAt'>) => Promise<string>
  updateClipTitle: (clipId: string, title: string) => Promise<void>
  deleteClip: (clipId: string) => Promise<void>
  reorderClips: (oldIndex: number, newIndex: number) => Promise<void>
}
```

**Key behaviors:**
- `loadClips(bookId)` queries `db.audioClips.where('bookId').equals(bookId).sortBy('sortOrder')`.
- `addClip` generates UUID, computes `sortOrder` as max+1, writes to Dexie then updates state.
- `updateClipTitle` does optimistic update with rollback (pattern from `useBookmarkStore.updateBookmarkLabel`).
- `deleteClip` does optimistic removal with rollback.
- `reorderClips` uses `arrayMove` from `@dnd-kit/sortable` + batch Dexie updates in a transaction (pattern from `useReadingQueueStore.reorderQueue`).

**Reuse:** `useReadingQueueStore` structure (create/set/get pattern, optimistic updates, transaction-based reorder, toast feedback).

**Scope:** ~130 lines, medium.

### Step 4: Create ClipButton component

**File to create:** `src/app/components/audiobook/ClipButton.tsx`

A two-phase button: first tap captures `startTime`, visual indicator shows "recording", second tap captures `endTime` and saves the clip.

**Props:**
```typescript
interface ClipButtonProps {
  bookId: string
  chapterId: string
  chapterIndex: number
  currentTime: number
  onClipCreated?: (id: string) => void
}
```

**State machine:**
- `idle` state: button shows scissors/clip icon with label "Start Clip" (aria-label). Tap sets `pendingStartTime = Math.floor(currentTime)`, transitions to `recording`.
- `recording` state: button changes to "End Clip" label with pulsing red dot indicator (`data-testid="clip-recording-indicator"`). Uses `AnimatePresence` + `motion.div` for the pulsing indicator (pattern from BookmarkButton). Tap sets `endTime = Math.floor(currentTime)`, validates `endTime > startTime`, calls `useAudioClipStore.addClip(...)`, transitions back to `idle`.
- If `endTime <= startTime`, show toast error "End time must be after start time" and stay in recording state.
- Button has `min-h-[44px] min-w-[44px]` class (AC-8, pattern from BookmarkButton).

**Reuse:** BookmarkButton's button styling, AnimatePresence pattern, toast feedback, `formatAudioTime` for toast messages.

**Scope:** ~100 lines, medium.

### Step 5: Create ClipListPanel component

**File to create:** `src/app/components/audiobook/ClipListPanel.tsx`

A Sheet panel listing all clips for the current book with DnD reorder, inline title edit, delete, and seek-to-clip.

**Props:**
```typescript
interface ClipListPanelProps {
  open: boolean
  onClose: () => void
  bookId: string
  chapters: BookChapter[]
  onPlayClip: (chapterIndex: number, startTime: number, endTime: number) => void
}
```

**Structure:**
- `Sheet` + `SheetContent side="right"` + `ScrollArea` (from BookmarkListPanel).
- `data-testid="clip-list-panel"` on the content container.
- Load clips via `useAudioClipStore.loadClips(bookId)` gated on `open`.
- DnD context wrapping the list: `DndContext`, `SortableContext`, `verticalListSortingStrategy` (from ReadingQueue).
- Sensors: `PointerSensor` with `activationConstraint: { distance: 5 }`, `KeyboardSensor`.

**Per-clip row (`data-testid="clip-item"`):**
- Drag handle button with `GripVertical` icon, `data-testid="clip-drag-handle"`, 44x44px.
- Seek button: shows chapter name + start-end time range (e.g., "Chapter 3 -- 1:23 - 2:45"). Calls `onPlayClip`.
- Title display: if title exists, show it; otherwise show "Untitled clip".
- Edit button: toggles inline `<input>` (`data-testid="clip-title-input"`) for title editing. Enter saves, Escape cancels.
- Delete button: with confirmation dialog (AlertDialog or inline confirm button).
- `DragOverlay` for ghost card while dragging.

**Reuse:** BookmarkListPanel (panel shell, load pattern, seek row, delete), ReadingQueue (DnD context, sortable items, drag overlay, drag handles).

**Scope:** ~250 lines. Consider splitting SortableClipItem into a sub-component within the same file.

### Step 6: Integrate into AudiobookRenderer

**File to modify:** `src/app/components/audiobook/AudiobookRenderer.tsx`

**Changes:**

1. **Imports**: Add `ClipButton` and `ClipListPanel`.

2. **State** (near line 76-82):
   - `const [clipsOpen, setClipsOpen] = useState(false)` — clips panel open state.
   - `const [activeClipEnd, setActiveClipEnd] = useState<{ chapterIndex: number; endTime: number } | null>(null)` — tracks end-time for clip-scoped playback (AC-4).

3. **Clip playback handler** (near `handleBookmarkSeek`):
   ```typescript
   const handlePlayClip = async (chapterIndex: number, startTime: number, endTime: number) => {
     setActiveClipEnd({ chapterIndex, endTime })
     await loadChapter(chapterIndex, false)
     setTimeout(() => {
       seekTo(startTime)
       play()
     }, 100)
     setClipsOpen(false)
   }
   ```

4. **Stop-at-end-time effect**: `useEffect` that watches `currentTime` and `activeClipEnd`. When `currentTime >= activeClipEnd.endTime` and `currentChapterIndex === activeClipEnd.chapterIndex`, call `pause()` and clear `activeClipEnd`. This implements AC-4's "plays through to the clip end time".

5. **Secondary controls bar** (line ~432): Add ClipButton after BookmarkButton:
   ```tsx
   <ClipButton
     bookId={book.id}
     chapterId={currentChapter?.title ?? `chapter-${currentChapterIndex}`}
     chapterIndex={currentChapterIndex}
     currentTime={currentTime}
   />
   ```

6. **Clips panel trigger**: Add a button with aria-label "Clips" using Scissors icon.

7. **ClipListPanel** (near BookmarkListPanel at line ~485):
   ```tsx
   <ClipListPanel
     open={clipsOpen}
     onClose={() => setClipsOpen(false)}
     bookId={book.id}
     chapters={book.chapters}
     onPlayClip={handlePlayClip}
   />
   ```

**Scope:** ~40 lines of additions.

### Step 7: Create unit tests for useAudioClipStore

**File to create:** `src/stores/__tests__/useAudioClipStore.test.ts`

**Test cases** (modeled on `useBookmarkStore.test.ts`):
- Initial state: clips empty, isLoaded false.
- `loadClips(bookId)`: loads from Dexie, sets isLoaded true, filters by bookId.
- `addClip`: optimistic add, persists to IndexedDB, assigns sortOrder.
- `updateClipTitle`: optimistic update, persists.
- `deleteClip`: optimistic removal, persists.
- `reorderClips`: arrayMove + batch Dexie update.
- Error rollback: mock Dexie failure, verify rollback.

**Setup:** `fake-indexeddb/auto`, `Dexie.delete('ElearningDB')` in beforeEach, dynamic import.

**Scope:** ~120 lines.

### Step 8: Update E2E test support (seed helper)

**File to modify:** `tests/support/helpers/indexeddb-seed.ts`

Add `seedAudioClips(page, clips[])` helper following the same pattern as `seedBooks`.

**Scope:** ~20 lines.

### Step 9: Verify existing E2E spec passes

The RED-phase E2E spec at `tests/e2e/story-e111-s01.spec.ts` already exists with test cases for all 8 ACs. After implementation, all tests should turn GREEN. The spec may need minor adjustments:

- AC-4/5/6 tests need seeded clip data (add `seedAudioClips` call).
- The `mockAudioElement` helper from bookmarks.spec.ts may need to be imported.

## Verification

### Dev Server Testing
1. `npm run dev` → navigate to `/library/{audiobook-id}/read`
2. Verify "Start Clip" button in secondary controls bar
3. Tap "Start Clip" — pulsing recording indicator appears
4. Tap "End Clip" — toast "Clip saved", indicator disappears
5. Open Clips panel — clip listed with chapter name and time range
6. Tap clip — playback jumps to start, pauses at end
7. Edit clip title inline — persists after reload
8. Delete clip — removed from list
9. Create multiple clips, drag to reorder — order persists after reload
10. Keyboard-navigate all interactive elements — focus indicators and ARIA labels

### Automated Tests
```bash
npx playwright test tests/e2e/story-e111-s01.spec.ts    # E2E (GREEN phase)
npx vitest run src/stores/__tests__/useAudioClipStore.test.ts  # Unit tests
npx vitest run src/db/__tests__/schema-checkpoint.test.ts      # Schema checkpoint
```

## Risk Assessment

### Risk 1: Clip-scoped playback timing (AC-4)
**Issue:** The `useEffect` watching `currentTime >= endTime` depends on rAF resolution. If rAF fires past `endTime`, user hears audio past the clip boundary.
**Mitigation:** Use tolerance window (pause if `currentTime >= endTime - 0.1`). rAF at 60fps = ~16ms, perceptually acceptable.
**Rollback:** Remove auto-pause; clip playback reverts to seek-only.

### Risk 2: DnD in Sheet panel (AC-7)
**Issue:** @dnd-kit inside `Sheet`/`SheetContent` with `ScrollArea` may have pointer event or scroll interference.
**Mitigation:** Test on mobile Safari and Chrome. PointerSensor `activationConstraint: { distance: 5 }` prevents accidental drags. If conflicts, switch to `TouchSensor` for mobile.
**Rollback:** Fall back to move-up/move-down buttons; ship rest of ACs.

### Risk 3: E2E audio mock requirement
**Issue:** Headless Chromium may not advance `currentTime`, causing "end time must be after start time" validation failure.
**Mitigation:** Use existing `mockAudioElement(page)` from bookmarks E2E. Mock `currentTime` to advance between start/end clicks.
**Pattern ref:** `tests/e2e/audiobookshelf/bookmarks.spec.ts`

## Commit Strategy (Granular Save Points)

1. **Commit 1:** AudioClip type + Dexie v47 migration + checkpoint update
2. **Commit 2:** useAudioClipStore + unit tests
3. **Commit 3:** ClipButton component
4. **Commit 4:** ClipListPanel component (with DnD)
5. **Commit 5:** AudiobookRenderer integration (wiring it all together)
6. **Commit 6:** E2E test support (seedAudioClips) + E2E test fixes
