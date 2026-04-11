## External Code Review: E108-S04 — GLM (glm-5.1)

**Model**: GLM (glm-5.1)
**Date**: 2026-04-11
**Story**: E108-S04

### Findings

#### Blockers
*(none)*

#### High Priority
*(none)*

#### Medium

- **[src/app/components/audiobook/AudiobookRenderer.tsx:109-115] (confidence: 80)**: The default speed is only applied when `currentRate === 1.0`. If a user previously set a per-book speed override (e.g., 1.5x), navigates away, then returns to the *same book*, the override is preserved. However, if they navigate to a *different* book that has no per-book override, but the audio player store still holds the previous book's rate (e.g., 1.5), the new default speed won't apply. The heuristic is fragile and depends on the audio player store resetting to 1.0 between books, which isn't guaranteed in the diff shown. Fix: Consider also reading a per-book last-known-rate from a book-specific store or IndexedDB. Alternatively, when `setCurrentBook(book.id)` is called, explicitly reset the playback rate before applying the default, or key the check on the book ID changing (which it does via `book.id` dep, but the rate check is still against 1.0).

- **[src/app/components/audiobook/AudiobookRenderer.tsx:123-140] (confidence: 70)**: The auto-bookmark effect runs on every `isPlaying` + `currentTime` + `currentChapterIndex` change. If `isPlaying` transitions from `true → false` (pause) then quickly back to `true → false` (e.g., rapid pause/play toggle), the effect fires on each `isPlaying` change with the *latest* `currentTime`, potentially creating duplicate auto-bookmarks at nearby positions. The `currentTime` dependency means even during the same "stop" event, if React batches differently, multiple triggers could occur. Fix: Add a debounce or use a ref to track the last auto-bookmark timestamp and skip if too recent (e.g., within 2 seconds of the last auto-bookmark).

#### Nits
*(none)*

---
Issues found: 2 | Blockers: 0 | High: 0 | Medium: 2 | Nits: 0
