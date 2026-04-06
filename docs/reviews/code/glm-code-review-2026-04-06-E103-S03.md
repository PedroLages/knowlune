## External Code Review: E103-S03 — GLM (glm-5.1)

**Model**: GLM (glm-5.1)
**Date**: 2026-04-06
**Story**: E103-S03

### Findings

#### Blockers
- **[src/stores/useBookStore.ts:258-262] (confidence: 92)**: Non-atomic `linkBooks` — two sequential `db.books.update()` calls without a transaction. If the first succeeds and the second fails (IndexedDB quota, browser crash, etc.), book A links to B but B does not link back to A. The catch block re-reads from DB and resets state, but the persisted data is already in an inconsistent state that will survive across sessions. Fix: Wrap both writes in `db.transaction('rw', db.books, async () => { ... })` so they succeed or fail atomically.

#### High Priority
- **[src/lib/chapterSwitchResolver.ts:101-107] (confidence: 88)**: CFI string comparison (`ch.position.value <= currentCfi`) is unreliable for determining EPUB chapter position. EPUB CFIs are not designed for lexicographic ordering — their string comparison depends on the numeric values embedded in the path segments (e.g., `/2/4/10` sorts before `/2/4/2` lexicographically). If two chapters' CFI values happen to be out of lexicographic order relative to their chapter order, `bestChapter` will be wrong. The function also always assigns at least `book.chapters[0]` even if no chapter's CFI is `<= currentCfi`, which silently returns a wrong chapter. Fix: Iterate chapters by `order` and use the chapter index/order to determine which chapter contains the current position, rather than comparing CFI strings. Alternatively, find the last chapter whose `order` corresponds to the CFI spine index.

#### Medium
- **[src/lib/chapterSwitchResolver.ts:122-131] (confidence: 75)**: `findCurrentAudioChapterIndex` has a fallthrough path that returns `0` (first chapter) even when no time-based chapter is found. If all chapters have `position.type !== 'time'`, the loop never matches, and the function returns `0` instead of `null`. This means `resolveEpubPositionFromAudio` would silently resolve to the first EPUB chapter instead of returning null, producing a misleading position jump. Fix: Change `return 0` to `return null` so the caller handles the missing-data case correctly.

- **[src/stores/useBookStore.ts:247-252] (confidence: 70)**: `updateBookPosition` optimistically updates Zustand state but only rolls back on DB failure via a full `db.books.toArray()` reload. If another concurrent store mutation completes between the optimistic `set` and the catch block's `set({ books })`, that intermediate mutation is silently lost. Fix: Store a snapshot of the previous books state before the optimistic update and restore from that snapshot on error, or use an abort/controller pattern to avoid the race.

#### Nits
- **[src/lib/__tests__/chapterSwitchResolver.test.ts:221] (confidence: 80)**: The test "returns null when no current position" for `resolveEpubPositionFromAudio` actually expects a fallback result `{ type: 'cfi', value: '/2/4/1' }`, contradicting the test description which says "returns null." The assertion is correct (the code does fall back to the first mapped chapter), but the test name is misleading. Fix: Rename to "returns first mapped chapter when no current position."

---
Issues found: 5 | Blockers: 1 | High: 1 | Medium: 2 | Nits: 1
