## External Code Review: E108-S05 — GLM (glm-5.1)

**Model**: GLM (glm-5.1)
**Date**: 2026-04-11
**Story**: E108-S05

### Findings

#### Blockers
_None found._

#### High Priority

- **[src/app/hooks/usePagesReadToday.ts:68-88] (confidence: 92)**: The study sessions query uses `.where('courseId').equals('')` as the index lookup, then filters by `contentItemId === book.id`. This means for each book that was opened today, it scans **all** sessions with `courseId = ''` (which could be a very large set). This is an O(books × sessions) query pattern executed on every render of `DailyGoalRing`. Worse, if `courseId` is not actually `''` for book reading sessions (it may be undefined or a different sentinel), the query returns zero sessions and pages read will always be 0 for the pages mode — a silent correctness failure. Fix: Add a compound index on `[courseId+contentItemId]` to the studySessions table, or at minimum query by `contentItemId` directly if such an index exists. Verify the actual `courseId` value stored for book reading sessions matches `''`.

- **[src/app/hooks/usePagesReadToday.ts:89-91] (confidence: 85)**: Pages read is estimated as `duration / 2 minutes` capped at `currentPage`. This produces wildly inaccurate results: if a user reads slowly (10 min/page), they get 5x overcount; if they read fast, they get undercount. More critically, if `currentPage` is 1 (user just started), `Math.max(1, ...)` means at least 1 page is always counted even if the user opened the book and closed it immediately. A user who opens 10 books without reading will show 10 pages read. Fix: Track actual page change events or use `progress` delta instead of time-based estimation. At minimum, require a minimum session duration threshold before counting.

- **[src/app/hooks/usePagesReadToday.ts:36-100] (confidence: 80)**: `getPagesReadToday()` performs N+1 async queries: one query for all books, then for each book opened today, one or two queries against `studySessions`. If a user has 50 books opened today, this fires 50+ IndexedDB queries sequentially in the `for` loop. This runs on every mount of `DailyGoalRing` with no caching or debouncing. Fix: Batch the query — fetch all today's sessions in one call, then correlate with books in memory.

#### Medium

- **[src/app/components/library/BookMetadataEditor.tsx:131-133] (confidence: 75)**: The genre initialization reads `book.genre || book.tags.find(...)` but the save logic on line 274 writes `genre !== NONE_GENRE ? genre : undefined`. This means if a legacy book has a genre stored only in tags (no `book.genre` field), editing and saving will set `book.genre = undefined` and the tag is excluded from `finalTags` (line 277 filters out GENRES from tags). The genre information is silently deleted from both `genre` and `tags` for any legacy book where the user opens the metadata editor without changing the genre. Fix: When saving, if `genre` matches one of the GENRES, always persist it to `book.genre` even if it came from tags — don't set to undefined.

- **[src/app/components/library/DailyGoalRing.tsx:44] (confidence: 72)**: `goal.dailyTarget` is used as the denominator for progress calculation without a zero guard. If `dailyTarget` is 0 (user set pages goal to 0), `current / target` produces `Infinity`, and `Math.min(Infinity, 1)` returns 1, showing a fully-completed ring for zero progress. Fix: Add `const target = goal.dailyTarget || 1` or skip rendering when target is 0.

- **[src/app/components/library/FilterSidebar.tsx:107-118] (confidence: 70)**: `handleGenreSelect('Unset')` sets `filters.genre = 'Unset'`, which the store then uses as a special sentinel meaning "books without genre." But `'Unset'` is not a valid `BookGenre` and could collide if someone ever adds a genre called "Unset". The string magic is fragile. Fix: Use `undefined` or `null` with a separate boolean flag like `filterNoGenre`, or define `'Unset'` as a const in the genre types.

#### Nits

- **[src/app/hooks/usePagesReadToday.ts:60-61] (confidence: 65)**: The EPUB branch (line 78) and PDF branch (lines 55-76) have nearly identical session-estimation logic duplicated. A helper function would reduce the risk of the two drifting apart.

---
Issues found: 7 | Blockers: 0 | High: 3 | Medium: 3 | Nits: 1
